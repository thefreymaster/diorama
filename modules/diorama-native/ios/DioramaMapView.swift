import ExpoModulesCore
import MapKit
import UIKit
import simd

// The native side of <DioramaMapView>. Think of it as a React component
// written in UIKit: Expo sets the "props" below (see DioramaNativeModule.swift),
// then calls `propsDidUpdate()` once per render.
//
// Every frame (orbit, head tracking) runs here on a display link, never
// through JS: props + orbit → the base camera; with head tracking, you stand
// where the base camera is and the head look turns your gaze from there
// (FirstPersonCamera), anywhere from straight down to straight up → MapKit's
// camera follows the gaze as far up as MapKit draws → StereoRig, which gives
// each eye (one in mono, two in stereo) its own MapKit camera and warps its
// picture the rest of the way up, sky and all (T31). Held upright, a pinch
// moves where you stand along the gaze (T37, `beginZoom()` and friends):
// JS sends only the pinch; the moving happens here, frame by frame. In live
// mode (T40, `followTo()`), JS sends a GPS fix now and then and the model
// center glides there, taking you, your zoom and your gaze along with it.
final class DioramaMapView: ExpoView {
  // Event prop. Calling `onReady(...)` fires the JS `onReady` callback.
  // Payload: `{ mode }`, the eyes that just finished drawing ("mono" or
  // "stereo"), so JS can tell a late mono report from the stereo one it
  // waits for after the phone turns. MapKit can't tell whether a place has
  // photoreal 3D (it accepts a 3D camera over flat imagery too), so the TS
  // wrapper adds `coverage` (yes, no or unknown) from curated lists. See
  // src/flyoverCoverage.ts.
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
  // Apple's blue location dot, in every eye (T40, live mode).
  var showsUserLocation = false {
    didSet { rig.showsUserLocation = showsUserLocation }
  }

  // Orbit speed: one full turn every two minutes.
  private static let orbitDegreesPerSecond = 3.0
  // Mono only: head roll is cancelled up to this angle; past it the city
  // tilts with you. A full-screen rectangle isn't round, so turning it
  // needs a map that covers its corners (overscan), and turning it any
  // amount would need a square map as wide as the screen's diagonal: 42%
  // more to draw than now, and MapKit spreads its 30° over that height, so
  // the camera backs off farther (see StereoRig.distanceScale). Stereo's
  // round eyes need none of that (a circle turned is the same circle), so
  // their roll is free.
  private static let maxMonoRollDegrees = 20.0
  // Per-frame changes smaller than this (degrees) are skipped, so a still
  // head lets MapKit finish rendering and rest.
  private static let minFrameChange = 0.01
  // Degrees MapKit's camera stays under the steepest pitch MapKit draws
  // (on top of the tilt a rolled head gives each eye; see
  // `steepestDrawnPitch`).
  private static let pitchCapMargin = 0.25
  // Fade from the loading cover to the city (stereo; mono lifts at once).
  private static let revealSeconds = 0.3
  // Pinch to zoom: the meters from the vantage point to the aim point it
  // may come to rest at. The same range as the Camera height setting
  // (CAMERA_DISTANCE in src/features/map/cameraHeight.ts), in the same
  // measure: scaled by overscan like the props' altitude (see `baseCamera`).
  private static let zoomDistances = 300.0...5000.0
  // While zoomed, MapKit's pitch cap is asked for once per 2% step of the
  // vantage point's height, not every frame (see `steepestPitch(from:)`).
  private static let zoomCapStep = log(1.02)

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
  // the pictures were turned against so the city stays level. In mono, roll
  // past `maxMonoRollDegrees` tilts the city with you.
  private var appliedBase: CameraPose?
  private var appliedGaze: FirstPersonCamera.Gaze?
  private var appliedRoll = 0.0
  // Pinch to zoom: how far pinches have moved the vantage point from where
  // the props put it, in meters (east, north, up). Like a useRef: a
  // recenter keeps it; resetZoom() (the phone turned) and new camera props
  // drop it. Only the one picture held upright uses it (`zoomApplies`).
  private var zoomShift = simd_double3.zero
  // The pinch moving it, if any (including one springing back).
  private var pinch: Pinch?
  // The zoom shift the cameras were last set with.
  private var appliedShift = simd_double3.zero
  // Live mode (T40): how far the model center has glided from the `center`
  // prop toward the latest GPS fix (see FirstPersonCamera.Glide). Like a
  // useRef: recenter and zoom keep it; a new place (new `center`) drops it.
  private var glide = FirstPersonCamera.Glide()
  // How long this glide takes: quicker under Reduce Motion.
  private var glideSeconds = FirstPersonCamera.Glide.seconds
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
    // New camera props are a new place to stand: the zoom starts over.
    if let appliedPose, appliedPose != pose { dropZoom() }
    guard appliedPose != pose || newEyes || separationChanged else { return }
    let isNewPlace = appliedPose.map { !$0.hasSameCenter(as: pose) } ?? true
    if isNewPlace {
      // New place: jump there, and wait for its tiles before orbiting and
      // firing onReady again. Any live glide belonged to the old one.
      orbitOffset = 0
      glide = FirstPersonCamera.Glide()
      rig.restartRenderTracking()
    }
    if isNewPlace || newEyes { startLoading() }
    layoutIfNeeded()
    // Glide when adjusting the view of the same place.
    applyCamera(animated: !isNewPlace && !newEyes && !separationChanged && !ticker.isRunning)
    appliedPose = pose
  }

  // Back to the pose given by props: drops the orbit angle, and wherever the
  // head faces now becomes straight ahead. You stay where you stand (the
  // props' vantage point, moved by any zoom), so only the gaze swings back.
  func recenter() {
    orbitOffset = 0
    headTracker.recenter()
    applyCamera(animated: !ticker.isRunning)
  }

  // Debug look: fake head yaw/pitch in degrees (+yaw = right, +pitch = up).
  func setDebugLook(yaw: Double, pitch: Double) {
    headTracker.setDebugLook(yaw: yaw, pitch: pitch)
  }

  // Pinch to zoom, step 1 of 3: fingers down. Takes the line the pinch
  // slides you along: from where you stand along the gaze, toward the
  // ground in the middle of the view (see FirstPersonCamera.Dolly). Only
  // while following the head, in the one picture held upright.
  func beginZoom() {
    guard isReady, zoomApplies, headTracker.isRunning else { return }
    let firstPerson = firstPersonCamera(from: baseCamera)
    guard let gaze = liveGaze(from: firstPerson) else { return }
    let dolly = firstPerson.dolly(along: gaze, range: zoomRange)
    pinch = Pinch(
      dolly: dolly, distance: dolly.startDistance,
      stopsBeforeHaze: draws(dolly, at: dolly.startDistance))
  }

  // Step 2, as the fingers move: `scale` is the finger spread ÷ the spread
  // at beginZoom(). 2 stands half as far from the aim point, 0.5 twice as
  // far, rubber-banded past the ends of `zoomDistances`.
  func setZoom(scale: Double) {
    guard var pinch, !pinch.isReleased, zoomApplies else { return }
    var distance = pinch.dolly.distance(forScale: scale)
    // Backing away, MapKit tilts up less and less (see steepestDrawnPitch)
    // until it no longer draws the middle of the view, which would then
    // fade into haze. Where it last drew it is as far back as this pinch
    // goes: past it the pinch stretches, as at any other end, and springs
    // back. (A pinch that starts in haze, looking up, has no such stop.)
    if pinch.stopsBeforeHaze, distance > pinch.distance, !draws(pinch.dolly, at: distance) {
      pinch.stopsBeforeHaze = false
      pinch.dolly = pinch.dolly.limited(to: pinch.distance)
      distance = pinch.dolly.distance(forScale: scale)
    }
    pinch.distance = distance
    self.pinch = pinch
    zoomShift = pinch.dolly.shift(atDistance: pinch.distance)
    zoomDidChange()
  }

  // Step 3, fingers up: a pinch stretched past either end springs back.
  func endZoom() {
    guard var pinch, !pinch.isReleased else { return }
    pinch.isReleased = true
    self.pinch = pinch
    updateTicker()  // Springs back frame by frame on the display link,
    if !ticker.isRunning { settleZoom(seconds: .infinity) }  // or at once without one.
  }

  // Back to the props' vantage point, the place's normal distance (JS
  // calls it when the phone turns sideways).
  func resetZoom() {
    let wasZoomed = zoomShift != .zero
    dropZoom()
    if wasZoomed, appliedPose != nil { applyCamera(animated: !ticker.isRunning) }
  }

  // Live mode (T40): you're now at this spot. The model center, and with it
  // where you stand, glides there on the display link, both eyes in the
  // same frame: at your own pace while fixes keep coming, else over about a
  // second (see FirstPersonCamera.Glide); under Reduce Motion, a quick
  // quarter-second glide to each fix. Unlike a new `center` prop, it isn't
  // a new place: no loading cover, no onReady, and the head look, zoom,
  // orbit angle and eye spacing all stay.
  func followTo(latitude: Double, longitude: Double) {
    let spot = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    guard appliedPose != nil, CLLocationCoordinate2DIsValid(spot) else { return }
    let reduceMotion = UIAccessibility.isReduceMotionEnabled
    glide.head(
      to: FirstPersonCamera.offset(of: spot, from: pose.center), at: CACurrentMediaTime(),
      smooth: !reduceMotion)
    glideSeconds =
      reduceMotion ? FirstPersonCamera.Glide.reducedMotionSeconds : FirstPersonCamera.Glide.seconds
    updateTicker()
    guard !ticker.isRunning else { return }  // The next frames glide.
    // Nothing on screen to glide (still loading, or not in a window): go now.
    glide.arrive()
    applyCamera(animated: false)
  }

  // MARK: - Layout

  // Sizes the eyes; overscan (room to turn against roll) only while tracking,
  // or zoomed (a zoom lasts while tracking pauses, and a map that changes
  // size moves the camera it's zoomed from).
  private func layoutEyes() {
    let maxRoll = headTracker.isRunning || isZoomed ? Self.maxMonoRollDegrees : 0
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

  // This frame's base camera: the props turned by the orbit, and in live
  // mode moved along to where the glide has got to. With head tracking it's
  // where you stand (FirstPersonCamera's vantage point), so it's the view
  // with the head straight ahead.
  private var baseCamera: CameraPose {
    var camera = pose
    if glide.offset != .zero {
      camera.center = FirstPersonCamera.coordinate(at: glide.offset, from: pose.center)
    }
    camera.heading = CameraPose.normalizedHeading(camera.heading + orbitOffset)
    // MapKit's field of view spans the map's height, so a taller
    // (overscanned) map shows the city bigger. Backing the camera off by the
    // same ratio keeps the city exactly the size it is without overscan.
    camera.altitude *= rig.distanceScale
    return camera
  }

  // You stand where the base camera is, until a pinch moves you from there
  // (`liveZoomShift`). From far out (a high Camera height) MapKit won't tilt
  // as steeply as the props ask, so while tracking (or zoomed) you start
  // from the steepest pitch it draws there, still looking at the model
  // center: the city stays in the middle and you look more straight down.
  // (Standing at the props' pitch instead, the gaze could only tilt as far
  // as MapKit draws, and it would land short of the city.)
  private func firstPersonCamera(from base: CameraPose) -> FirstPersonCamera {
    var start = base
    if headTracker.isRunning || isZoomed, let steepest = rig.steepestPitch(lookingAt: base) {
      start.pitch = min(start.pitch, steepest)
    }
    return FirstPersonCamera(base: start, shift: liveZoomShift)
  }

  // Where the head looks this frame, turned from the base camera's gaze, or
  // nil when not tracking: anywhere from straight down to straight up, and
  // round and round. Zoomed in, you stay where the pinch took you while
  // tracking pauses (the app in the background), looking straight ahead.
  private func liveGaze(from firstPerson: FirstPersonCamera) -> FirstPersonCamera.Gaze? {
    guard headTracker.isRunning else { return isZoomed ? firstPerson.restingGaze : nil }
    return firstPerson.gaze(for: look, gain: lookGain * trackingSensitivity)
  }

  // MapKit's camera looks along the gaze, but no steeper than it draws.
  private func drawnGaze(
    _ gaze: FirstPersonCamera.Gaze, from firstPerson: FirstPersonCamera, baseline: Double,
    roll: Double
  ) -> FirstPersonCamera.Gaze {
    var drawn = gaze
    drawn.pitch = min(
      gaze.pitch, steepestDrawnPitch(from: firstPerson, baseline: baseline, roll: roll))
    return drawn
  }

  // The steepest pitch MapKit's camera takes from `firstPerson`'s vantage
  // point (MapKit caps pitch lower the farther out it looks). A little
  // under the steepest it draws, but never under a starting pitch it
  // draws, so with the head still you see exactly the starting camera.
  // Until the map can be asked, the starting pitch. The eyes look higher
  // than this whenever the gaze does; their warp turns the picture the
  // rest of the way (StereoGeometry).
  private func steepestDrawnPitch(
    from firstPerson: FirstPersonCamera, baseline: Double, roll: Double
  ) -> Double {
    let start = firstPerson.base.pitch
    let steepest = steepestPitch(from: firstPerson) ?? start
    let upper = max(steepest - Self.pitchCapMargin, min(start, steepest))
    guard rig.isStereo else { return upper }
    // A rolled head puts one eye lower than the other, and the lower eye
    // looks at the aim point less steeply: up to half the eyes' spacing
    // seen from there (0.6° with the head on its side). Keep it under too.
    let reach = firstPerson.reach(for: .init(heading: firstPerson.base.heading, pitch: upper))
    let lift = baseline / 2 * abs(sin(roll * .pi / 180)) / max(reach, 1)
    return max(upper - atan(lift) * 180 / .pi, CameraPose.pitchRange.lowerBound)
  }

  // The steepest pitch MapKit draws from `firstPerson`'s vantage point.
  // StereoRig asks MapKit (a dozen trial cameras) whenever the vantage point
  // changes, which a pinch does every frame. So while zoomed it asks from
  // the top of the vantage point's 2% step of height (`zoomCapStep`), which
  // changes only now and then. MapKit's cap only comes down as the camera
  // backs off, so what it draws from a little higher it draws from here.
  private func steepestPitch(from firstPerson: FirstPersonCamera) -> Double? {
    guard firstPerson.shift != .zero else { return rig.steepestPitch(from: firstPerson) }
    let height = max(firstPerson.eyeHeight, 1)
    let top = exp((log(height) / Self.zoomCapStep).rounded(.up) * Self.zoomCapStep)
    let raised = FirstPersonCamera(
      base: firstPerson.base, shift: firstPerson.shift + simd_double3(0, 0, max(top - height, 0)))
    return rig.steepestPitch(from: raised)
  }

  // The head roll to cancel: all of it in stereo, up to
  // `maxMonoRollDegrees` in mono.
  private var liveRoll: Double {
    guard !rig.isStereo else { return look.roll }
    return min(max(look.roll, -Self.maxMonoRollDegrees), Self.maxMonoRollDegrees)
  }

  // The eyes' spacing follows the base camera's distance from the model
  // center (fixed while you stand still), not how far away you look.
  private func baseline(for base: CameraPose) -> Double {
    StereoGeometry.baseline(distance: base.altitude, eyeSeparation: eyeSeparation)
  }

  private func applyCamera(animated: Bool) {
    let base = baseCamera
    let firstPerson = firstPersonCamera(from: base)
    let gaze = liveGaze(from: firstPerson)
    let roll = liveRoll
    let baseline = baseline(for: base)
    var camera = base
    if let gaze {
      camera = firstPerson.camera(
        for: drawnGaze(gaze, from: firstPerson, baseline: baseline, roll: roll))
    }
    rig.apply(camera, lookPitch: gaze?.pitch, roll: roll, baseline: baseline, animated: animated)
    appliedBase = base
    appliedGaze = gaze
    appliedRoll = roll
    appliedShift = firstPerson.shift
  }

  // One display-link frame: advance the orbit and the live glide, read the
  // head, move the cameras if anything visibly changed (a gliding center
  // always has). Both eyes move in the same frame.
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
    settleZoom(seconds: seconds)
    if glide.isMoving {
      glide.step(seconds: seconds, settleSeconds: glideSeconds)
      if !glide.isMoving { updateTicker() }  // Arrived: tick only if something else needs it.
    }
    let base = baseCamera
    let gaze = liveGaze(from: firstPersonCamera(from: base))
    let baseMoved = appliedBase.map { !$0.isWithin(Self.minFrameChange, of: base) } ?? true
    let gazeMoved = !Self.isWithin(Self.minFrameChange, gaze, appliedGaze)
    let rollMoved = abs(liveRoll - appliedRoll) >= Self.minFrameChange
    let zoomMoved = appliedShift != liveZoomShift
    guard baseMoved || gazeMoved || rollMoved || zoomMoved else { return }
    applyCamera(animated: false)
  }

  // True when two gazes (nil = not tracking) differ by less than `degrees`.
  private static func isWithin(
    _ degrees: Double, _ a: FirstPersonCamera.Gaze?, _ b: FirstPersonCamera.Gaze?
  ) -> Bool {
    guard let a, let b else { return a == nil && b == nil }
    return a.isWithin(degrees, of: b)
  }

  // Tick while orbiting, following a head or gliding to a new fix, but only
  // once the first render is done: a camera that moves every frame keeps
  // MapKit from ever reporting "finished". Head tracking takes its reference
  // on the first tick, so "straight ahead" is wherever you face when the
  // city appears.
  private func updateTicker() {
    let isMoving = orbit || headTracker.canLook || isSettlingZoom || glide.isMoving
    if window != nil && isReady && isMoving {
      ticker.start()
    } else {
      ticker.stop()
    }
  }

  // MARK: - Pinch to zoom

  // A zoom belongs to the one picture held upright. The headset (even when
  // too hot for two eyes) and a sideways view ignore it, so a turn of the
  // phone never shows a zoom made for another shape of screen.
  private var zoomApplies: Bool {
    mode == .mono && bounds.height > bounds.width
  }

  // The zoom the cameras use now.
  private var liveZoomShift: simd_double3 { zoomApplies ? zoomShift : .zero }

  private var isZoomed: Bool { liveZoomShift != .zero }

  // True while a released pinch springs back inside its range.
  private var isSettlingZoom: Bool { pinch?.isReleased == true }

  // The meters to the aim point a pinch may come to rest at, in the
  // cameras' own measure (see `zoomDistances`).
  private var zoomRange: ClosedRange<Double> {
    let scale = rig.distanceScale
    return (Self.zoomDistances.lowerBound * scale)...(Self.zoomDistances.upperBound * scale)
  }

  // The zoom moved: the next frame shows it, together with the head. If
  // nothing ticks (the Simulator has no motion), it shows now.
  private func zoomDidChange() {
    if !ticker.isRunning { applyCamera(animated: false) }
  }

  // One frame of a released pinch springing back inside its range; then
  // the pinch is over.
  private func settleZoom(seconds: Double) {
    guard var pinch, pinch.isReleased else { return }
    let target = pinch.dolly.restingDistance(from: pinch.distance)
    pinch.distance = FirstPersonCamera.Dolly.settle(pinch.distance, toward: target, seconds: seconds)
    zoomShift = pinch.dolly.shift(atDistance: pinch.distance)
    guard pinch.distance == target else {
      self.pinch = pinch
      zoomDidChange()
      return
    }
    self.pinch = nil
    zoomDidChange()
    updateTicker()  // Nothing left to spring: tick only if something else needs it.
  }

  // True when MapKit draws the pinch's line of sight itself from `distance`
  // meters along it (rather than leaving it to the warp and the haze).
  private func draws(_ dolly: FirstPersonCamera.Dolly, at distance: Double) -> Bool {
    let base = firstPersonCamera(from: baseCamera).base
    let there = FirstPersonCamera(base: base, shift: dolly.shift(atDistance: distance))
    guard let steepest = steepestPitch(from: there) else { return true }
    return steepest >= dolly.pitch - 0.01
  }

  // Forgets the zoom (and any pinch) without moving the cameras.
  private func dropZoom() {
    pinch = nil
    guard zoomShift != .zero else { return }
    zoomShift = .zero
    setNeedsLayout()  // Overscan for roll only while tracking now.
  }

  // MARK: - Loading and ready

  // Something new has to load: hold the ticker, and hide the map until
  // every eye has drawn. A live glide under way lands at once, unseen.
  private func startLoading() {
    isReady = false
    ticker.stop()
    glide.arrive()
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
    onReady(["mode": rig.isStereo ? ViewMode.stereo.rawValue : ViewMode.mono.rawValue])
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

  // Too hot for two maps: tell JS, then drop the right eye. Stays mono
  // until the `mode` prop is set again. Mid-load, the cover stays up until
  // the remaining eye has drawn and onReady fires (at once if it already
  // has, which is why JS hears onDegraded first).
  private func fallBackToMonoIfTooHot() {
    guard mode == .stereo, !isDegraded, !thermal.budget.allowsStereo else { return }
    isDegraded = true
    onDegraded(["reason": "thermal"])
    if rig.isStereo {
      rig.setStereo(false)
      setNeedsLayout()
    }
  }
}

// One pinch (T37): the line it slides the vantage point along, how far along
// it you are (meters from the aim point), whether it still has to find
// where MapKit stops drawing the middle of the view (see setZoom), and
// whether the fingers have lifted (it then springs back inside its range,
// if stretched past it).
private struct Pinch {
  var dolly: FirstPersonCamera.Dolly
  var distance: Double
  var stopsBeforeHaze: Bool
  var isReleased = false
}
