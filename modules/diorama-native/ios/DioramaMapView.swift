import ExpoModulesCore
import MapKit
import UIKit

// The native side of <DioramaMapView>. Think of it as a React component
// written in UIKit: Expo sets the "props" below (see DioramaNativeModule.swift),
// then calls `propsDidUpdate()` once per render.
//
// Every frame (orbit, head tracking) runs here on a display link, never
// through JS: props + orbit + head look → a camera → StereoRig, which gives
// each eye (one in mono, two in stereo) its own MapKit camera.
final class DioramaMapView: ExpoView {
  // Event prop. Calling `onReady([:])` fires the JS `onReady` callback.
  // MapKit can't tell whether a place has photoreal 3D (it accepts a 3D
  // camera over flat imagery too), so the TS wrapper adds `flyoverAvailable`
  // from a curated list. See src/flyoverCoverage.ts.
  let onReady = EventDispatcher()
  // Event prop: the phone got too hot for two maps, so stereo fell back to
  // mono. Payload: `{ reason: "thermal" }`.
  let onDegraded = EventDispatcher()

  // Camera props from JS, applied together in `propsDidUpdate()`.
  var pose = CameraPose()
  var orbit = false
  // Head tracking props. `debugLook` swaps the gyro for drags (Simulator).
  var headTracking = false
  var debugLook = false
  var trackingSensitivity = 1.0
  // Stereo props. Setting `mode` again also lifts a thermal fallback to mono.
  var mode = ViewMode.mono {
    didSet { isDegraded = false }
  }
  var eyeSeparation = 1.0
  // Debug builds only: pretend the phone is this hot (see ThermalMonitor).
  var debugThermalState: ProcessInfo.ThermalState?
  // The tilt-shift look (MiniatureOverlay), 0 = off. Every eye gets the same.
  var miniatureIntensity = 0.0 {
    didSet {
      for eye in rig.eyes {
        (eye.overlay as? MiniatureOverlay)?.intensity = miniatureIntensity
      }
    }
  }

  // Orbit speed: one full turn every two minutes.
  private static let orbitDegreesPerSecond = 3.0
  // Head roll is cancelled up to this angle; past it the city tilts with you.
  // Bigger costs more: the overscanned maps are larger to draw, and MapKit
  // spreads its field of view over the larger height (see
  // StereoRig.distanceScale), so less of the city fits on screen.
  private static let maxRollDegrees = 20.0
  // Per-frame changes smaller than this (degrees) are skipped, so a still
  // head lets MapKit finish rendering and rest.
  private static let minFrameChange = 0.01
  // Fade from the loading cover to the city.
  private static let revealSeconds = 0.3

  // The eyes (one or two MKMapViews) and their per-eye cameras.
  private let rig = StereoRig()
  // Black cover over a stereo view until both eyes have fully drawn, so the
  // wearer never sees one eye ahead of the other.
  private let loadingCover = UIView()
  private let headTracker = HeadTracker()
  private lazy var debugPan = UIPanGestureRecognizer(target: self, action: #selector(handleDebugPan(_:)))
  private lazy var thermal = ThermalMonitor { [weak self] budget in
    self?.thermalBudgetDidChange(budget)
  }
  // Degrees the orbit has turned away from `pose.heading`. recenter() zeroes it.
  private var orbitOffset = 0.0
  // The latest smoothed head look; zero when not tracking.
  private var look = HeadPose.zero
  private var appliedPose: CameraPose?
  private var appliedEyeSeparation = 1.0
  // The camera last handed to the rig, with orbit and look added, and the
  // head roll (degrees) its pictures were turned against so the city stays
  // level. Roll past `maxRollDegrees` tilts the city with you.
  private var appliedCamera: CameraPose?
  private var appliedRoll = 0.0
  // True once the phone got too hot and stereo fell back to mono.
  private var isDegraded = false
  // onReady fires once every eye has drawn, per center (a new place is a
  // new load) and per switch to stereo (both eyes load afresh).
  private var isReady = false
  private lazy var ticker = FrameTicker { [weak self] seconds in
    self?.tick(seconds)
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    rig.onRendered = { [weak self] in self?.eyesDidRender() }
    // Each eye (including one added later) gets its own tilt-shift overlay.
    rig.makeOverlay = { [weak self] in
      MiniatureOverlay(intensity: self?.miniatureIntensity ?? 0)
    }
    addSubview(rig.view)
    loadingCover.backgroundColor = .black
    loadingCover.isUserInteractionEnabled = false
    loadingCover.alpha = 0
    addSubview(loadingCover)
    debugPan.isEnabled = false
    addGestureRecognizer(debugPan)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    loadingCover.frame = bounds
    layoutEyes()
  }

  override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    setNeedsLayout()  // MapKit's logo keeps clear of the safe area.
  }

  // Like a useEffect cleanup/setup pair: only track, tick and watch the
  // temperature while on screen.
  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil { thermal.start() } else { thermal.stop() }
    updateHeadTracking()
    updateTicker()
  }

  // MARK: - Called from JS (via DioramaNativeModule)

  func propsDidUpdate() {
    defer { updateTicker() }  // `orbit` or `headTracking` may have changed.
    updateHeadTracking()
    thermal.debugState = debugThermalState
    fallBackToMonoIfTooHot()
    let wasStereo = rig.isStereo
    let newEyes = rig.setStereo(mode == .stereo && !isDegraded)
    let separationChanged = rig.isStereo && appliedEyeSeparation != eyeSeparation
    appliedEyeSeparation = eyeSeparation
    if rig.isStereo != wasStereo || separationChanged { setNeedsLayout() }
    if !rig.isStereo { updateCover(animated: false) }
    guard appliedPose != pose || newEyes || separationChanged else { return }
    let isNewPlace = appliedPose.map { !$0.hasSameCenter(as: pose) } ?? true
    if isNewPlace {
      // New place: jump there, and wait for its tiles before orbiting and
      // firing onReady again.
      orbitOffset = 0
      rig.restartRenderTracking()
    }
    if isNewPlace || newEyes { startLoading() }
    layoutIfNeeded()
    // Glide when adjusting the view of the same place.
    applyCamera(animated: !isNewPlace && !newEyes && !separationChanged && !ticker.isRunning)
    appliedPose = pose
  }

  // Back to the pose given by props: drops the orbit angle, and wherever the
  // head faces now becomes straight ahead.
  func recenter() {
    orbitOffset = 0
    headTracker.recenter()
    applyCamera(animated: !ticker.isRunning)
  }

  // Debug look: fake head yaw/pitch in degrees (+yaw = right, +pitch = up).
  func setDebugLook(yaw: Double, pitch: Double) {
    headTracker.setDebugLook(yaw: yaw, pitch: pitch)
  }

  // MARK: - Layout

  // Sizes the eyes; overscan (room to turn against roll) only while tracking.
  private func layoutEyes() {
    let maxRoll = headTracker.isRunning ? Self.maxRollDegrees : 0
    let changed = rig.layout(in: bounds, safeArea: safeAreaInsets, maxRoll: maxRoll)
    // The cameras' distance and the eyes' warps depend on the map sizes.
    if changed, appliedPose != nil { applyCamera(animated: false) }
  }

  // MARK: - Head tracking

  // Starts or stops the tracker to match the props and whether we're on
  // screen, and switches the debug drag on or off.
  private func updateHeadTracking() {
    if headTracker.usesDebugLook != debugLook {
      headTracker.usesDebugLook = debugLook
      headTracker.recenter()  // The new source starts looking straight ahead.
    }
    let shouldTrack = headTracking && window != nil
    debugPan.isEnabled = shouldTrack && debugLook
    guard shouldTrack != headTracker.isRunning else { return }
    if shouldTrack {
      headTracker.start()
    } else {
      headTracker.stop()
      look = .zero
      applyCamera(animated: window != nil)  // Glide back to the props, level.
    }
    setNeedsLayout()  // Overscan is only needed while tracking.
  }

  // Debug look: dragging stands in for turning your head.
  @objc private func handleDebugPan(_ pan: UIPanGestureRecognizer) {
    headTracker.dragDebugLook(by: pan.translation(in: self))
    pan.setTranslation(.zero, in: self)
  }

  // How the interface is rotated right now (HeadPose needs it to tell up
  // from sideways).
  private var screenAxes: ScreenAxes {
    ScreenAxes(window?.windowScene?.interfaceOrientation ?? .portrait)
  }

  // MARK: - Camera

  // This frame's camera: the props, turned by the orbit and the head look.
  private var liveCamera: CameraPose {
    var camera = pose.looking(look, sensitivity: trackingSensitivity)
    camera.heading = CameraPose.normalizedHeading(camera.heading + orbitOffset)
    // MapKit's field of view spans the map's height, so a taller
    // (overscanned) map shows the city bigger. Backing the camera off by the
    // same ratio keeps the city exactly the size it is without overscan.
    camera.altitude *= rig.distanceScale
    return camera
  }

  // The head roll to cancel, capped at `maxRollDegrees`.
  private var liveRoll: Double {
    min(max(look.roll, -Self.maxRollDegrees), Self.maxRollDegrees)
  }

  private func applyCamera(animated: Bool) {
    let camera = liveCamera
    let roll = liveRoll
    rig.apply(camera, roll: roll, eyeSeparation: eyeSeparation, animated: animated)
    appliedCamera = camera
    appliedRoll = roll
  }

  // One display-link frame: advance the orbit, read the head, move the
  // cameras if anything visibly changed. Both eyes move in the same frame.
  private func tick(_ seconds: CFTimeInterval) {
    guard isReady else { return }
    if orbit {
      orbitOffset = (orbitOffset + seconds * Self.orbitDegreesPerSecond)
        .truncatingRemainder(dividingBy: 360)
    }
    if headTracker.isRunning {
      look = headTracker.update(screen: screenAxes, seconds: seconds)
    }
    let rollMoved = abs(liveRoll - appliedRoll) >= Self.minFrameChange
    if let applied = appliedCamera, applied.isWithin(Self.minFrameChange, of: liveCamera), !rollMoved {
      return
    }
    applyCamera(animated: false)
  }

  // Tick while orbiting or following a head, but only once the first render
  // is done: a camera that moves every frame keeps MapKit from ever reporting
  // "finished". Head tracking takes its reference on the first tick, so
  // "straight ahead" is wherever you face when the city appears.
  private func updateTicker() {
    if window != nil && isReady && (orbit || headTracker.canLook) {
      ticker.start()
    } else {
      ticker.stop()
    }
  }

  // MARK: - Loading and ready

  // Something new has to load: hold the ticker, and in stereo hide the eyes
  // until they have all drawn.
  private func startLoading() {
    isReady = false
    ticker.stop()
    updateCover(animated: false)
  }

  // Every eye has drawn. MapKit stands a camera on whatever terrain (and
  // buildings) it has loaded when the camera is set, so an eye set before
  // its tiles arrived can sit higher or lower than the other. Setting both
  // cameras again now that both have everything puts them level.
  private func eyesDidRender() {
    guard !isReady, appliedPose != nil else { return }
    if rig.isStereo {
      rig.forgetAppliedCameras()
      applyCamera(animated: false)
    }
    isReady = true
    updateCover(animated: true)
    onReady([:])
    updateTicker()
  }

  // The cover shows while a stereo view is loading.
  private func updateCover(animated: Bool) {
    let alpha: CGFloat = rig.isStereo && !isReady ? 1 : 0
    guard loadingCover.alpha != alpha else { return }
    guard animated else {
      loadingCover.layer.removeAllAnimations()
      loadingCover.alpha = alpha
      return
    }
    let options: UIView.AnimationOptions = [.curveEaseOut, .beginFromCurrentState]
    UIView.animate(withDuration: Self.revealSeconds, delay: 0, options: options) {
      self.loadingCover.alpha = alpha
    }
  }

  // MARK: - Thermal

  private func thermalBudgetDidChange(_ budget: ThermalBudget) {
    ticker.maxFramesPerSecond = budget.maxFramesPerSecond
    fallBackToMonoIfTooHot()
  }

  // Too hot for two maps: drop the right eye and tell JS. Stays mono until
  // the `mode` prop is set again.
  private func fallBackToMonoIfTooHot() {
    guard mode == .stereo, !isDegraded, !thermal.budget.allowsStereo else { return }
    isDegraded = true
    if rig.isStereo {
      rig.setStereo(false)
      updateCover(animated: false)
      setNeedsLayout()
    }
    onDegraded(["reason": "thermal"])
  }
}

// MARK: - Head look → camera

extension CameraPose {
  // Straight down (0) to MapKit's steepest pitch, the same range makeCamera()
  // allows. MapKit may cap it lower still at high altitudes; it then simply
  // stops tilting, it doesn't jump.
  static let pitchRange = 0.0...85.0

  // This pose as seen with a head look: yaw turns the heading, and looking
  // down tilts the camera toward straight down over the model (pitch 0).
  // `sensitivity` scales both; roll is handled by rotating the view.
  func looking(_ look: HeadPose, sensitivity: Double) -> CameraPose {
    var result = self
    result.heading = Self.normalizedHeading(heading + look.yaw * sensitivity)
    let tilted = pitch + look.pitch * sensitivity
    result.pitch = min(max(tilted, Self.pitchRange.lowerBound), Self.pitchRange.upperBound)
    return result
  }

  // Wraps a heading into 0..<360 (MapKit headings are compass degrees).
  static func normalizedHeading(_ heading: Double) -> Double {
    let wrapped = heading.truncatingRemainder(dividingBy: 360)
    return wrapped < 0 ? wrapped + 360 : wrapped
  }

  // True when `other` differs by less than `degrees` in heading and pitch
  // and not at all in place or distance: too small a change to redraw for.
  func isWithin(_ degrees: Double, of other: CameraPose) -> Bool {
    hasSameCenter(as: other) && altitude == other.altitude
      && abs(HeadPose.wrapDegrees(heading - other.heading)) < degrees
      && abs(pitch - other.pitch) < degrees
  }
}
