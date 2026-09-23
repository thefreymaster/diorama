import ExpoModulesCore
import MapKit
import UIKit

// The native side of <DioramaMapView>. Think of it as a React component
// written in UIKit: Expo sets the "props" below (see DioramaNativeModule.swift),
// then calls `propsDidUpdate()` once per render.
//
// Every frame (orbit, head tracking) runs here on a display link, never
// through JS: props + orbit → the base camera; with head tracking, you stand
// where the base camera is and the head look turns your gaze from there
// (FirstPersonCamera) → StereoRig, which gives each eye (one in mono, two in
// stereo) its own MapKit camera.
final class DioramaMapView: ExpoView {
  // Event prop. Calling `onReady([:])` fires the JS `onReady` callback.
  // MapKit can't tell whether a place has photoreal 3D (it accepts a 3D
  // camera over flat imagery too), so the TS wrapper adds `coverage` (yes,
  // no or unknown) from curated lists. See src/flyoverCoverage.ts.
  let onReady = EventDispatcher()
  // Event prop: the phone got too hot for two maps, so stereo fell back to
  // mono. Payload: `{ reason: "thermal" }`.
  let onDegraded = EventDispatcher()
  // Event prop: where each eye's picture is, whenever that changes, so JS
  // can draw things once per eye. Payload: `{ mode, left, right }`, each eye
  // a `{ x, y, width, height }` in this view's points: in stereo the square
  // around its circle, in mono (both) the whole view.
  let onEyeLayout = EventDispatcher()

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
  // Millimeters between the headset's lens centers: where the stereo eye
  // windows go (see ViewerProfile).
  var lensSpacing = ViewerProfile.defaultLensSpacing {
    didSet { if lensSpacing != oldValue { setNeedsLayout() } }
  }
  // Millimeters across each stereo eye's round window (see ViewerProfile).
  var windowDiameter = ViewerProfile.defaultWindowDiameter {
    didSet { if windowDiameter != oldValue { setNeedsLayout() } }
  }
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
  // Degrees the gaze stays under MapKit's steepest pitch: with head roll the
  // two eyes sit a little higher and lower than the head, and tilt a
  // little more or less.
  private static let pitchCapMargin = 0.5
  // Fade from the loading cover to the city (stereo; mono lifts at once).
  private static let revealSeconds = 0.3

  // The eyes (one or two MKMapViews) and their per-eye cameras.
  private let rig = StereoRig()
  // Black cover over the map while it loads. It lifts at the very moment
  // onReady fires and not a frame earlier, in every mode, so nobody sees a
  // half-drawn city (or one eye ahead of the other), and the Viewer's
  // countdown starts exactly when the city appears.
  private let loadingCover = UIView()
  private let headTracker = HeadTracker()
  private lazy var debugPan = UIPanGestureRecognizer(target: self, action: #selector(handleDebugPan(_:)))
  private lazy var thermal = ThermalMonitor { [weak self] budget in
    self?.thermalBudgetDidChange(budget)
  }
  // The eye frames last sent to JS with onEyeLayout.
  private var reportedEyeFrames: [CGRect] = []
  // Degrees the orbit has turned away from `pose.heading`. recenter() zeroes it.
  private var orbitOffset = 0.0
  // The latest smoothed head look; zero when not tracking.
  private var look = HeadPose.zero
  // Camera degrees per head degree, so the city holds still through the
  // headset's lens (see ViewerProfile.lookGain). Set by layout.
  private var lookGain = 1.0
  private var appliedPose: CameraPose?
  private var appliedEyeSeparation = 1.0
  // What the rig was last handed: the base camera (props plus orbit), the
  // gaze turned from it (nil when not tracking), and the head roll (degrees)
  // the pictures were turned against so the city stays level. Roll past
  // `maxRollDegrees` tilts the city with you.
  private var appliedBase: CameraPose?
  private var appliedGaze: FirstPersonCamera.Gaze?
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
    addSubview(loadingCover)  // Up from the start: nothing has loaded yet.
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
    setNeedsLayout()  // The eye windows depend on the screen (ViewerProfile).
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
  // head faces now becomes straight ahead. You stay where you stand: the
  // vantage point comes from the props, so only the gaze swings back.
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
    let profile = viewerProfile
    let changed = rig.layout(
      in: bounds, safeArea: safeAreaInsets, maxRoll: maxRoll, profile: profile)
    // The eye's window through the headset lens (a circle's diameter tall)
    // decides how far the camera turns per head degree. Mono is seen
    // through the same lenses.
    if let window = rig.eyeFrames.first, window.height > 0 {
      lookGain = profile.lookGain(height: window.height, shownFieldOfView: rig.shownFieldOfView)
    }
    reportEyeLayout()
    guard changed else { return }
    // Resize the maps first (a map resized after its camera is set moves
    // that camera; see EyeView.layoutSubviews), then set the cameras, whose
    // distance and warps depend on the map sizes.
    rig.view.layoutIfNeeded()
    if appliedPose != nil { applyCamera(animated: false) }
  }

  // The headset, measured on this phone's screen.
  private var viewerProfile: ViewerProfile {
    let screen = window?.windowScene?.screen
    let displayScale = traitCollection.displayScale
    return ViewerProfile(
      lensSpacing: lensSpacing,
      windowDiameter: windowDiameter,
      pointsPerMillimeter: ViewerProfile.pointsPerMillimeter(
        nativeScale: screen?.nativeScale ?? displayScale),
      displayScale: displayScale
    )
  }

  // Tells JS where the eyes are now, if that changed (e.g. on rotation, or
  // going stereo or mono) or `force` says to anyway.
  private func reportEyeLayout(force: Bool = false) {
    let frames = rig.eyeFrames
    guard window != nil, !bounds.isEmpty, force || frames != reportedEyeFrames,
      let left = frames.first, let right = frames.last
    else { return }
    reportedEyeFrames = frames
    onEyeLayout([
      "mode": rig.isStereo ? ViewMode.stereo.rawValue : ViewMode.mono.rawValue,
      "left": Self.json(left),
      "right": Self.json(right),
    ])
  }

  // A rect as the plain object JS gets.
  private static func json(_ rect: CGRect) -> [String: Double] {
    [
      "x": Double(rect.minX), "y": Double(rect.minY),
      "width": Double(rect.width), "height": Double(rect.height),
    ]
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

  // This frame's base camera: the props turned by the orbit. With head
  // tracking it's where you stand (FirstPersonCamera's vantage point), so
  // it's the view with the head straight ahead.
  private var baseCamera: CameraPose {
    var camera = pose
    camera.heading = CameraPose.normalizedHeading(camera.heading + orbitOffset)
    // MapKit's field of view spans the map's height, so a taller
    // (overscanned) map shows the city bigger. Backing the camera off by the
    // same ratio keeps the city exactly the size it is without overscan.
    camera.altitude *= rig.distanceScale
    return camera
  }

  // Where the head looks this frame, turned from the base camera's gaze, or
  // nil when not tracking. The pitch stops, smoothly, where MapKit stops
  // drawing (it caps pitch lower the farther out it looks).
  private func liveGaze(from firstPerson: FirstPersonCamera) -> FirstPersonCamera.Gaze? {
    guard headTracker.isRunning else { return nil }
    let start = firstPerson.base.pitch
    // Until the map can be asked, don't look up past the start.
    let steepest = rig.steepestPitch(from: firstPerson) ?? start
    // A little under MapKit's steepest, but never under a starting pitch it
    // draws: with the head still you see exactly the starting camera.
    let upper = max(steepest - Self.pitchCapMargin, min(start, steepest))
    let limits = CameraPose.pitchRange.lowerBound...max(upper, CameraPose.pitchRange.lowerBound)
    return firstPerson.gaze(for: look, gain: lookGain * trackingSensitivity, pitchLimits: limits)
  }

  // The head roll to cancel, capped at `maxRollDegrees`.
  private var liveRoll: Double {
    min(max(look.roll, -Self.maxRollDegrees), Self.maxRollDegrees)
  }

  private func applyCamera(animated: Bool) {
    let base = baseCamera
    let firstPerson = FirstPersonCamera(base: base)
    let gaze = liveGaze(from: firstPerson)
    let camera = gaze.map { firstPerson.camera(for: $0) } ?? base
    let roll = liveRoll
    // The eyes' spacing follows the base camera's distance from the model
    // center (fixed while you stand still), not how far away you look.
    let baseline = StereoGeometry.baseline(distance: base.altitude, eyeSeparation: eyeSeparation)
    rig.apply(camera, roll: roll, baseline: baseline, animated: animated)
    appliedBase = base
    appliedGaze = gaze
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
    // Read the head and move the cameras in this same frame: no added lag.
    if headTracker.isRunning {
      look = headTracker.update(screen: screenAxes, seconds: seconds)
    }
    let base = baseCamera
    let gaze = liveGaze(from: FirstPersonCamera(base: base))
    let baseMoved = appliedBase.map { !$0.isWithin(Self.minFrameChange, of: base) } ?? true
    let gazeMoved = !Self.isWithin(Self.minFrameChange, gaze, appliedGaze)
    let rollMoved = abs(liveRoll - appliedRoll) >= Self.minFrameChange
    guard baseMoved || gazeMoved || rollMoved else { return }
    applyCamera(animated: false)
  }

  // True when two gazes (nil = not tracking) differ by less than `degrees`.
  private static func isWithin(
    _ degrees: Double, _ a: FirstPersonCamera.Gaze?, _ b: FirstPersonCamera.Gaze?
  ) -> Bool {
    guard let a, let b else { return a == nil && b == nil }
    return a.isWithin(degrees, of: b)
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

  // Something new has to load: hold the ticker, and hide the map until
  // every eye has drawn.
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
    // The cover starts to lift in the same screen update that sends onReady
    // to JS, so the Viewer's countdown starts as the city appears.
    updateCover(animated: true)
    // Say where the eyes are again first, in case the first report went out
    // before React Native had hooked up this view's events (it drops them
    // then): whatever JS draws once per eye goes up now.
    reportEyeLayout(force: true)
    onReady([:])
    updateTicker()
  }

  // The cover is up exactly while the map loads (until onReady), in every
  // mode. Stereo fades it out. Mono lifts it at once: the screens with a
  // mono map (the preview, Settings) fade their own colored cover over it,
  // and black fading out underneath would darken theirs.
  private func updateCover(animated: Bool) {
    let alpha: CGFloat = isReady ? 0 : 1
    guard loadingCover.alpha != alpha else { return }
    guard animated, rig.isStereo else {
      loadingCover.layer.removeAllAnimations()
      // Not even inside someone else's animation (a screen rotation).
      UIView.performWithoutAnimation { loadingCover.alpha = alpha }
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
  // the `mode` prop is set again. Mid-load, the cover stays up until the
  // remaining eye has drawn and onReady fires.
  private func fallBackToMonoIfTooHot() {
    guard mode == .stereo, !isDegraded, !thermal.budget.allowsStereo else { return }
    isDegraded = true
    if rig.isStereo {
      rig.setStereo(false)
      setNeedsLayout()
    }
    onDegraded(["reason": "thermal"])
  }
}

