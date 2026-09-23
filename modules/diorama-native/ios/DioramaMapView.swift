import ExpoModulesCore
import MapKit
import UIKit

// The native side of <DioramaMapView>. Think of it as a React component
// written in UIKit: Expo sets the "props" below (see DioramaNativeModule.swift),
// then calls `propsDidUpdate()` once per render.
//
// Every frame (orbit, head tracking) runs here on a display link, never
// through JS: props + orbit + head look → one MapKit camera per frame.
final class DioramaMapView: ExpoView, MKMapViewDelegate {
  // Event prop. Calling `onReady([:])` fires the JS `onReady` callback.
  // MapKit can't tell whether a place has photoreal 3D (it accepts a 3D
  // camera over flat imagery too), so the TS wrapper adds `flyoverAvailable`
  // from a curated list. See src/flyoverCoverage.ts.
  let onReady = EventDispatcher()

  // Camera props from JS, applied together in `propsDidUpdate()`.
  var pose = CameraPose()
  var orbit = false
  // Head tracking props. `debugLook` swaps the gyro for drags (Simulator).
  var headTracking = false
  var debugLook = false
  var trackingSensitivity = 1.0

  // Orbit speed: one full turn every two minutes.
  private static let orbitDegreesPerSecond = 3.0
  // How long to wait for a clean render before firing onReady anyway.
  private static let readyFallbackSeconds = 2.0
  // Head roll is cancelled up to this angle; past it the city tilts with you.
  // Bigger costs more: the overscanned map is larger to draw, and MapKit
  // spreads its field of view over the larger height (see
  // overscanDistanceScale), so less of the city fits on screen.
  private static let maxRollDegrees = 20.0
  // Per-frame changes smaller than this (degrees) are skipped, so a still
  // head lets MapKit finish rendering and rest.
  private static let minFrameChange = 0.01

  // Apple's map view. Mono mode uses one; stereo (T08) adds a second eye.
  private let mapView = MKMapView()
  // Holds the map and turns it against head roll so the city stays level.
  // While tracking it is larger than this view ("overscan"), so turning it
  // never shows a corner.
  private let rollView = UIView()
  private let headTracker = HeadTracker()
  private lazy var debugPan = UIPanGestureRecognizer(target: self, action: #selector(handleDebugPan(_:)))
  // Degrees the orbit has turned away from `pose.heading`. recenter() zeroes it.
  private var orbitOffset = 0.0
  // The latest smoothed head look; zero when not tracking.
  private var look = HeadPose.zero
  private var appliedPose: CameraPose?
  // The camera last handed to MapKit, with orbit and look added.
  private var appliedCamera: CameraPose?
  private var appliedRoll = 0.0
  // onReady fires once per center (a new place is a new load).
  private var isReady = false
  private var readyGeneration = 0
  private lazy var ticker = FrameTicker { [weak self] seconds in
    self?.tick(seconds)
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    configureMap()
    rollView.isUserInteractionEnabled = false
    rollView.addSubview(mapView)
    addSubview(rollView)
    debugPan.isEnabled = false
    addGestureRecognizer(debugPan)
  }

  // Photoreal 3D imagery with nothing on top: no labels, POIs, compass or
  // scale, and no gestures (touches fall through to React Native).
  private func configureMap() {
    mapView.preferredConfiguration = MKImageryMapConfiguration(elevationStyle: .realistic)
    mapView.pointOfInterestFilter = .excludingAll
    mapView.showsCompass = false
    mapView.showsScale = false
    mapView.showsUserLocation = false
    mapView.isZoomEnabled = false
    mapView.isScrollEnabled = false
    mapView.isRotateEnabled = false
    mapView.isPitchEnabled = false
    mapView.isUserInteractionEnabled = false
    mapView.delegate = self
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let size = headTracker.isRunning ? Self.overscanSize(for: bounds.size) : bounds.size
    // `bounds` + `center` (not `frame`) stay valid while rollView is rotated.
    rollView.bounds = CGRect(origin: .zero, size: size)
    rollView.center = CGPoint(x: bounds.midX, y: bounds.midY)
    mapView.frame = rollView.bounds
    // MapKit places its logo and Legal link inside the layout margins. Pull
    // them in by the overscan so they stay on screen.
    let overscanX = (size.width - bounds.width) / 2
    let overscanY = (size.height - bounds.height) / 2
    mapView.layoutMargins = UIEdgeInsets(top: overscanY, left: overscanX, bottom: overscanY, right: overscanX)
  }

  // Like a useEffect cleanup/setup pair: only track and tick while on screen.
  override func didMoveToWindow() {
    super.didMoveToWindow()
    updateHeadTracking()
    updateTicker()
  }

  // MARK: - Called from JS (via DioramaNativeModule)

  func propsDidUpdate() {
    defer { updateTicker() }  // `orbit` or `headTracking` may have changed.
    updateHeadTracking()
    guard appliedPose != pose else { return }
    let isNewPlace = appliedPose.map { !$0.hasSameCenter(as: pose) } ?? true
    if isNewPlace {
      // New place: jump there, and wait for its tiles before orbiting and
      // firing onReady again.
      isReady = false
      readyGeneration += 1  // Cancels a pending fallback for the old place.
      orbitOffset = 0
      ticker.stop()
    }
    // Glide when adjusting the view of the same place.
    applyCamera(animated: !isNewPlace && !ticker.isRunning)
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
      appliedRoll = 0
      rollView.transform = .identity
      if window != nil { applyCamera(animated: true) }  // Glide back to the props.
    }
    setNeedsLayout()  // Overscan is only needed while tracking.
  }

  // Debug look: dragging stands in for turning your head.
  @objc private func handleDebugPan(_ pan: UIPanGestureRecognizer) {
    headTracker.dragDebugLook(by: pan.translation(in: self))
    pan.setTranslation(.zero, in: self)
  }

  // Turns the map against the head's roll, so the city stays level.
  // UIKit angles are clockwise-positive on screen, hence the minus.
  private func applyRoll() {
    let roll = min(max(look.roll, -Self.maxRollDegrees), Self.maxRollDegrees)
    guard abs(roll - appliedRoll) >= Self.minFrameChange else { return }
    appliedRoll = roll
    rollView.transform = CGAffineTransform(rotationAngle: -roll * .pi / 180)
  }

  // The smallest size that still covers `size` when turned by up to
  // `maxRollDegrees` either way (the bounding box of the turned screen).
  private static func overscanSize(for size: CGSize) -> CGSize {
    let angle = maxRollDegrees * .pi / 180
    return CGSize(
      width: ceil(size.width * cos(angle) + size.height * sin(angle)),
      height: ceil(size.width * sin(angle) + size.height * cos(angle))
    )
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
    camera.altitude *= overscanDistanceScale
    return camera
  }

  // MapKit's field of view spans the map's height, so a taller (overscanned)
  // map shows the city bigger. Backing the camera off by the same ratio keeps
  // the city exactly the size it is without overscan.
  private var overscanDistanceScale: Double {
    guard bounds.height > 0, mapView.bounds.height > 0 else { return 1 }
    return mapView.bounds.height / bounds.height
  }

  private func applyCamera(animated: Bool) {
    let camera = liveCamera
    mapView.setCamera(camera.makeCamera(), animated: animated)
    appliedCamera = camera
  }

  // One display-link frame: advance the orbit, read the head, move the
  // camera if anything visibly changed.
  private func tick(_ seconds: CFTimeInterval) {
    guard isReady else { return }
    if orbit {
      orbitOffset = (orbitOffset + seconds * Self.orbitDegreesPerSecond)
        .truncatingRemainder(dividingBy: 360)
    }
    if headTracker.isRunning {
      look = headTracker.update(screen: screenAxes, seconds: seconds)
      applyRoll()
    }
    let camera = liveCamera
    if let applied = appliedCamera, applied.isWithin(Self.minFrameChange, of: camera) { return }
    mapView.setCamera(camera.makeCamera(), animated: false)
    appliedCamera = camera
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

  // MARK: - Ready event

  private func emitReady() {
    guard !isReady else { return }
    isReady = true
    onReady([:])
    updateTicker()
  }

  // MARK: - MKMapViewDelegate (MapKit's callbacks, like event handlers)

  func mapViewDidFinishRenderingMap(_ mapView: MKMapView, fullyRendered: Bool) {
    if fullyRendered {
      emitReady()
      return
    }
    // Some tiles failed (e.g. offline). Give MapKit a moment to retry, then
    // report ready anyway so screens never wait forever.
    readyGeneration += 1
    let generation = readyGeneration
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.readyFallbackSeconds) { [weak self] in
      guard let self, self.readyGeneration == generation else { return }
      self.emitReady()
    }
  }

  // Tiles couldn't load at all (e.g. offline): don't leave screens waiting.
  func mapViewDidFailLoadingMap(_ mapView: MKMapView, withError error: Error) {
    emitReady()
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
