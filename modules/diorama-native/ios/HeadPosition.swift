import ARKit
import AVFoundation
import CoreMotion
import QuartzCore
import UIKit
import simd

// MARK: - What JS sees

// The `onHeadPositionState` event (T46), like a string union in TS:
// - off: position isn't tracked (the `headPosition` prop is off, no camera
//   access, no ARKit here (the Simulator), too hot, or not on screen).
//   Turning your head still works; only leaning doesn't.
// - starting: ARKit is getting its bearings (a second or so; looking around
//   the room helps). Rotation only meanwhile.
// - tracking: leaning moves you.
// - limited: ARKit lost track (camera covered, a dark room, a blank wall, a
//   jolt). You stay where you were for a moment, then ease back to
//   rotation only until it finds its place again.
enum HeadPositionState: String {
  case off
  case starting
  case tracking
  case limited
}

// Whether head position may use the camera, as `getCameraAccess()` in JS
// reports it. `unsupported`: this device can't track position at all (the
// Simulator, or a phone without ARKit world tracking).
enum CameraAccess: String {
  case granted
  case denied
  case undetermined
  case unsupported
}

// MARK: - HeadPosition

// Where the head is, not just which way it faces (T46), so leaning in
// brings you closer to the city. Like HeadTracker, think of it as a custom
// hook, `useHeadPosition()`, that DioramaMapView's display link polls once
// per frame. Nothing here crosses the JS bridge but the state changes.
//
// What it reports (`update`): how far your eyes have moved since the
// reference (taken at start, recenter, or when the phone turns between
// portrait and landscape), in meters along three axes fixed at that moment:
// right, up and forward, level with the floor, forward being the way you
// faced. DioramaMapView scales that to the city and moves where you stand.
//
// How, step by step, every frame:
// 1. ARKit world tracking on the rear camera (the headset has an opening for
//    it) says where the phone is, once per camera frame (60 a second), each
//    about 30 ms old by the time it's used. It runs with no view: nothing is
//    shown or recorded, and there's no plane detection, depth or meshing
//    (ARKit uses the LiDAR Scanner on its own where there is one).
// 2. Where the eyes are, from where the camera is: the eyes sit a few
//    centimeters in front of the middle of the screen, the camera near the
//    phone's corner, so turning your head swings the camera around your eyes
//    (`cameraToEyes` takes that out).
// 3. Prediction (`PositionPredictor`): CoreMotion's accelerometer (100
//    samples a second, a few ms old) carries the position on from ARKit's
//    newest pose to now. Every new pose starts over from ARKit's, so it
//    never drifts; it only fills the gap.
// 4. Smoothing: a one-euro filter per axis, as for the look: steady at rest,
//    no lag once you move.
// 5. Hand-offs (`PositionHandoff`): when ARKit loses track, the last position
//    holds for a moment, then eases back to zero (rotation only); when it
//    finds its place again the position picks up from wherever it had eased
//    to. A new reference eases to its zero rather than snapping.
//
// With `usesVertical` off (T61), up and down are left out before step 4:
// only the level part of the move (right and forward) counts.
//
// The Simulator has no ARKit: with debug look on, `setDebugLean` stands in
// for the head's move and goes through steps 4 and 5 like the real thing.
final class HeadPosition: NSObject, ARSessionDelegate {
  // Smoothing (see OneEuroFilter.swift), per axis, in meters: 1 Hz at rest
  // (ARKit's millimeter jitter, magnified hundreds of times by the city's
  // scale, would show), loosening by 40 Hz per meter a second, so a lean at
  // 20 cm/s is about 20 ms behind.
  static let filterMinCutoff = 1.0
  static let filterBeta = 40.0
  static let filterSpeedCutoff = 10.0
  // From the rear camera's lens to the point between the eyes, in ARKit's
  // camera axes (meters; see `cameraAxes`): about 6 cm along the phone
  // toward its bottom end, 2.4 cm across and 6.3 cm out in front of the
  // screen. Worked out from an iPhone 14 Pro's published dimensions in a
  // Cardboard-style viewer (lenses 4 cm in front of the screen); other
  // iPhones put the camera within a centimeter or two of it.
  private static let cameraToEyes = simd_double3(0.062, -0.024, 0.063)
  // A pose older than this (seconds) counts as lost: ARKit has stalled.
  private static let staleSeconds = 0.25
  // Nobody leans farther than this (meters) from where they recentered: a
  // jump past it is ARKit losing its place, not a head moving.
  private static let maxMove = 0.75
  // Standard gravity: CoreMotion measures acceleration in g.
  private static let gravity = 9.806_65
  // Posted when `requestCameraAccess` gets an answer, so a view waiting
  // for access starts ARKit.
  private static let cameraAccessDidChange = Notification.Name("DioramaCameraAccessDidChange")

  // Called on the main thread whenever `state` changes.
  var onStateChange: ((HeadPositionState) -> Void)?

  // Where the move comes from: false = ARKit, true = `setDebugLean` (the
  // Simulator).
  var usesDebugLean = false {
    didSet {
      guard usesDebugLean != oldValue, isWanted else { return }
      stop()
      start()
    }
  }

  // Whether up and down count (T61, the `leanVertical` prop). Off, standing
  // up, sitting down or bobbing leaves your height over the city alone, and
  // only leaning forward and sideways moves you. ARKit's world is level (y
  // up, along gravity), so "up" is its y. Neither way jumps: switched off,
  // the height a lean had given eases back to none; switched on, up and
  // down count from wherever the head is then (see `track`).
  var usesVertical = true {
    didSet { if usesVertical != oldValue { verticalDidChange = true } }
  }

  // The most camera frames a second the phone's temperature allows
  // (ThermalBudget). A change picks a new camera format.
  var maxFramesPerSecond = 60 {
    didSet {
      guard maxFramesPerSecond != oldValue, isSessionRunning,
        Self.videoFormat(maxFramesPerSecond: maxFramesPerSecond) != runningFormat
      else { return }
      runSession(reset: false)
    }
  }

  private(set) var state = HeadPositionState.off {
    didSet { if state != oldValue { onStateChange?(state) } }
  }
  // The move from the last update(): meters right, up and forward since the
  // reference. Zero when not tracking (after easing there).
  private(set) var move = simd_double3.zero

  // True between start() and stop().
  private var isWanted = false
  private var session: ARSession?
  private var isSessionRunning = false
  private var runningFormat: ARConfiguration.VideoFormat?
  private var isInterrupted = false
  // ARKit started over (a new world origin), so the reference needs new
  // axes, keeping the move where it is.
  private var worldDidReset = false
  // True once tracked since start(): later losses are `limited`, not `starting`.
  private var hasTracked = false
  // ARKit's own "still starting up" (a fresh session, or after a reset).
  private var isInitializing = true
  private var reference: LevelFrame?
  private var referenceScreen: ScreenAxes?
  // The capture time of the newest ARKit pose handed to the predictor.
  private var lastPoseTime: Double?
  private var predictor = PositionPredictor()
  private var handoff = PositionHandoff()
  private var filters = HeadPosition.makeFilters()
  // The stand-in move (meters right, up, forward) and whether it counts as
  // tracked (setDebugLean).
  private var debugMove = simd_double3.zero
  private var debugTracking = true
  // `usesVertical` changed since the last tracked frame (handled there).
  private var verticalDidChange = false
  private var observers: [NSObjectProtocol] = []

  #if DEBUG
    // Dev builds only: numbers for the dev map's readout, twice a second.
    var onStats: ((Stats) -> Void)?
    private var stats = StatsWindow()
    private var hasCheckedAxes = false
  #endif

  // Camera access for head position right now (see CameraAccess).
  static var cameraAccess: CameraAccess {
    guard ARWorldTrackingConfiguration.isSupported else { return .unsupported }
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: return .granted
    case .notDetermined: return .undetermined
    default: return .denied  // Denied, or restricted (Screen Time, MDM).
    }
  }

  // Shows iOS's camera prompt if it hasn't been answered yet, then calls
  // `done` (main thread) with the access. Head position itself never asks,
  // so the prompt only ever comes when JS decides (never mid-headset).
  static func requestCameraAccess(_ done: @escaping (CameraAccess) -> Void) {
    guard cameraAccess == .undetermined else {
      done(cameraAccess)
      return
    }
    AVCaptureDevice.requestAccess(for: .video) { _ in
      DispatchQueue.main.async {
        NotificationCenter.default.post(name: cameraAccessDidChange, object: nil)
        done(cameraAccess)
      }
    }
  }

  // Like a useEffect setup: track position from now on (ARKit starts if
  // the camera may be used, and again whenever access is granted later).
  func start() {
    guard !isWanted else { return }
    isWanted = true
    hasTracked = false
    reference = nil
    observeAccess()
    resume()
  }

  // The matching cleanup: ARKit stops at once; the move eases back to zero
  // over the next frames (keep calling update()).
  func stop() {
    guard isWanted else { return }
    isWanted = false
    for observer in observers { NotificationCenter.default.removeObserver(observer) }
    observers = []
    session?.pause()
    isSessionRunning = false
    forgetPose()
    reference = nil
    state = .off
    #if DEBUG
      stats = StatsWindow()
    #endif
  }

  // Wherever the head is now becomes zero. The move eases there (a third of
  // a second) instead of snapping.
  func recenter() {
    reference = nil
  }

  // Forgets the move at once, no easing: head tracking stopped altogether,
  // and the camera glides back to its props on its own.
  func dropMove() {
    handoff = PositionHandoff()
    move = .zero
  }

  // The Simulator's stand-in for the head (debug look): meters right, up and
  // forward from where it started, or `tracking` false to act as if ARKit
  // lost track.
  func setDebugLean(_ move: simd_double3, tracking: Bool) {
    debugMove = move
    debugTracking = tracking
  }

  // Call once per frame. `screen` says how the interface is rotated right
  // now; `seconds` is the time since the previous frame. Returns `move`.
  func update(screen: ScreenAxes, seconds: Double) -> simd_double3 {
    let now = CACurrentMediaTime()
    let sample = isWanted ? measure(at: now, screen: screen) : nil
    state = currentState(tracking: sample != nil)
    if let sample {
      track(sample, screen: screen, seconds: seconds)
    } else {
      // Lost, or off: hold a moment, then ease back to rotation only (at
      // once when off).
      move = handoff.step(tracked: nil, seconds: seconds, holds: isWanted)
    }
    #if DEBUG
      if isWanted {
        stats.add(move: move)
        if let window = stats.take(at: now) { onStats?(window) }
      }
    #endif
    return move
  }

  // MARK: - Private

  // One tracked frame: from the eyes' position to the move.
  private func track(_ sample: Sample, screen: ScreenAxes, seconds: Double) {
    hasTracked = true
    if verticalDidChange {
      verticalDidChange = false
      switchVertical(at: sample)
    }
    if reference == nil || referenceScreen != screen {
      // A new zero: at start, on recenter, or when the phone turned (the
      // same pose then means a different head). The move eases to it.
      reference = LevelFrame(origin: sample.eyes, right: sample.right, forward: sample.forward)
      referenceScreen = screen
      worldDidReset = false
      resetFilters()
      handoff.rezero(to: .zero, settleSeconds: PositionHandoff.recenterSeconds)
    } else if var frame = reference,
      worldDidReset || handoff.lostSeconds > PositionHandoff.holdSeconds
        || simd_length(counted(frame.offset(of: sample.eyes))) > Self.maxMove
    {
      // Back after a while lost (ARKit may have drifted meanwhile), after
      // ARKit started over, or after a jump no head makes: carry on from
      // where the tracked move had got to (while lost, where the move has
      // eased to), so nothing moves.
      if worldDidReset {
        frame = LevelFrame(origin: sample.eyes, right: sample.right, forward: sample.forward)
      }
      let carryOn = handoff.isTracking ? handoff.tracked : handoff.output
      frame.origin = sample.eyes - frame.vector(for: carryOn)
      reference = frame
      worldDidReset = false
      resetFilters()
    }
    guard let reference else { return }
    let raw = counted(reference.offset(of: sample.eyes))
    let smoothed = simd_double3(
      filters[0].filter(raw.x, seconds: seconds),
      filters[1].filter(raw.y, seconds: seconds),
      filters[2].filter(raw.z, seconds: seconds))
    move = handoff.step(tracked: smoothed, seconds: seconds, holds: true)
  }

  // The part of a move that counts: all of it, or with up and down off
  // (T61) only the level part, right and forward. (Also what the jump check
  // measures, so standing up with it off never reads as ARKit jumping.)
  private func counted(_ move: simd_double3) -> simd_double3 {
    usesVertical ? move : simd_double3(move.x, 0, move.z)
  }

  // `usesVertical` just changed (T61), handled on the next tracked frame.
  // Off: the height the lean had given moves from the tracked move into the
  // hand-off's carry, which eases it back to none. On: the height the head
  // is at now becomes up and down's zero, so nothing moves. Either way the
  // up-and-down smoothing starts afresh (its next sample passes straight
  // through: zero, or the height the move is at).
  private func switchVertical(at sample: Sample) {
    if usesVertical {
      reference?.origin.y = sample.eyes.y
    } else {
      handoff.dropVertical(settleSeconds: PositionHandoff.verticalSeconds)
    }
    filters[1].reset()
  }

  // Where the eyes are now (in ARKit's world: meters, y up) and which ways
  // the head's right and forward point, or nil while position isn't tracked.
  private func measure(at now: Double, screen: ScreenAxes) -> Sample? {
    if usesDebugLean {
      guard debugTracking else { return nil }
      // The stand-in's own world: x right, y up, forward along -z (ARKit's).
      return Sample(
        eyes: simd_double3(debugMove.x, debugMove.y, -debugMove.z), right: [1, 0, 0],
        forward: [0, 0, -1])
    }
    guard isSessionRunning, !isInterrupted, let frame = session?.currentFrame else { return nil }
    let camera = frame.camera
    isInitializing = Self.isInitializing(camera.trackingState)
    guard case .normal = camera.trackingState, now - frame.timestamp < Self.staleSeconds else {
      return nil
    }
    let (position, rotation) = Self.pose(camera.transform)
    let eyes = position + rotation * Self.cameraToEyes
    let acceleration = worldAcceleration(rotation: rotation)
    if frame.timestamp != lastPoseTime {
      // A new camera frame: the prediction starts over from it.
      lastPoseTime = frame.timestamp
      let miss = predictor.correct(to: eyes, at: frame.timestamp, acceleration: acceleration)
      #if DEBUG
        stats.addPose(miss: miss)
        checkAxes(rotation: rotation)
      #endif
    }
    #if DEBUG
      stats.addAge(now - frame.timestamp)
    #endif
    guard let predicted = predictor.position(at: now, acceleration: acceleration) else { return nil }
    return Sample(
      eyes: predicted, right: rotation * Self.cameraAxes(screen.right),
      forward: rotation * Self.cameraAxes(simd_double3(0, 0, -1)))
  }

  private func currentState(tracking: Bool) -> HeadPositionState {
    guard isWanted else { return .off }
    if tracking { return .tracking }
    if usesDebugLean { return .limited }
    guard isSessionRunning else { return .off }  // No access, or ARKit failed.
    return hasTracked && !isInitializing ? .limited : .starting
  }

  // The phone's acceleration now (m/s², gravity taken out), in ARKit's
  // world, from CoreMotion's newest sample (HeadTracker keeps the sensors
  // on). Turned with ARKit's newest pose: a few ms of head turn off, which
  // doesn't matter for the 30 ms it's used over.
  private func worldAcceleration(rotation: simd_double3x3) -> simd_double3 {
    guard let a = HeadTracker.latestMotion?.userAcceleration else { return .zero }
    return rotation * Self.cameraAxes(simd_double3(a.x, a.y, a.z)) * Self.gravity
  }

  // Starts ARKit if it's wanted, may and can run, and isn't yet.
  private func resume() {
    guard isWanted, !usesDebugLean, !isSessionRunning, Self.cameraAccess == .granted else { return }
    runSession(reset: true)
  }

  // Runs ARKit world tracking, as light as it goes: no view, no planes, no
  // light estimate, no depth or meshing, and the smallest camera format at
  // the highest frame rate allowed. `reset` starts tracking afresh.
  private func runSession(reset: Bool) {
    let configuration = ARWorldTrackingConfiguration()
    configuration.planeDetection = []
    configuration.isLightEstimationEnabled = false
    configuration.environmentTexturing = .none
    configuration.frameSemantics = []
    let format = Self.videoFormat(maxFramesPerSecond: maxFramesPerSecond)
    if let format { configuration.videoFormat = format }
    let session = self.session ?? ARSession()
    session.delegate = self  // Weak: no retain cycle. Called on the main thread.
    self.session = session
    session.run(configuration, options: reset ? [.resetTracking, .removeExistingAnchors] : [])
    runningFormat = format
    isSessionRunning = true
    isInterrupted = false
    if reset {
      isInitializing = true
      worldDidReset = true
      forgetPose()
    }
  }

  // Forgets ARKit's last pose, so the prediction starts over.
  private func forgetPose() {
    predictor.reset()
    lastPoseTime = nil
  }

  private func resetFilters() {
    for index in filters.indices { filters[index].reset() }
  }

  // Tries ARKit again when camera access is granted (from the prompt, or in
  // iOS Settings and back).
  private func observeAccess() {
    let center = NotificationCenter.default
    let retry: (Notification) -> Void = { [weak self] _ in self?.resume() }
    observers = [
      center.addObserver(
        forName: Self.cameraAccessDidChange, object: nil, queue: .main, using: retry),
      center.addObserver(
        forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main, using: retry),
    ]
  }

  // MARK: - ARSessionDelegate (ARKit's callbacks, like event handlers)

  // The camera went away for a while (another app took it, a call came in).
  func sessionWasInterrupted(_ session: ARSession) {
    isInterrupted = true
  }

  // Back from an interruption. ARKit may have lost its place meanwhile, so
  // start tracking afresh; the move carries on from where it eased to.
  func sessionInterruptionEnded(_ session: ARSession) {
    isInterrupted = false
    guard isWanted, isSessionRunning else { return }
    runSession(reset: true)
  }

  // No camera access after all, or the camera failed: rotation only. It
  // tries again when access is granted or the app comes back to the front.
  func session(_ session: ARSession, didFailWithError error: Error) {
    NSLog("[HeadPosition] ARKit stopped: %@", error.localizedDescription)
    session.pause()
    isSessionRunning = false
    forgetPose()
  }

  // MARK: - Helpers

  // The camera format ARKit runs at: the most frames a second allowed, then
  // the fewest pixels (they cost power, and tracking doesn't need them).
  // Never the 4K formats. nil leaves ARKit's default.
  static func videoFormat(maxFramesPerSecond: Int) -> ARConfiguration.VideoFormat? {
    func pixels(_ format: ARConfiguration.VideoFormat) -> CGFloat {
      format.imageResolution.width * format.imageResolution.height
    }
    let formats = ARWorldTrackingConfiguration.supportedVideoFormats.filter {
      $0.captureDevicePosition == .back && pixels($0) <= 1920 * 1440
    }
    let allowed = formats.filter { $0.framesPerSecond <= maxFramesPerSecond }
    return (allowed.isEmpty ? formats : allowed).min { a, b in
      a.framesPerSecond != b.framesPerSecond ? a.framesPerSecond > b.framesPerSecond : pixels(a) < pixels(b)
    }
  }

  // A direction in the phone's own axes (HeadPose.swift: x toward the right
  // edge, y toward the top, z out of the screen, held upright) in ARKit's
  // camera axes, which are turned a quarter: x runs along the phone from its
  // top toward its bottom end, y toward the right edge, z out of the screen.
  static func cameraAxes(_ device: simd_double3) -> simd_double3 {
    simd_double3(-device.y, device.x, device.z)
  }

  private static func isInitializing(_ state: ARCamera.TrackingState) -> Bool {
    switch state {
    case .notAvailable, .limited(.initializing): return true
    default: return false
    }
  }

  // ARKit's camera transform (4×4, floats) as a position and a rotation
  // (camera axes → world), in doubles.
  private static func pose(_ transform: simd_float4x4) -> (simd_double3, simd_double3x3) {
    func vector(_ column: simd_float4) -> simd_double3 {
      simd_double3(Double(column.x), Double(column.y), Double(column.z))
    }
    let rotation = simd_double3x3(
      columns: (vector(transform.columns.0), vector(transform.columns.1), vector(transform.columns.2)))
    return (vector(transform.columns.3), rotation)
  }

  private static func makeFilters() -> [OneEuroFilter] {
    (0..<3).map { _ in
      OneEuroFilter(minCutoff: filterMinCutoff, beta: filterBeta, speedCutoff: filterSpeedCutoff)
    }
  }

  #if DEBUG
    // One-time check (debug builds, real device) of `cameraAxes`: ARKit's
    // pose must turn the gravity CoreMotion measures straight down (ARKit's
    // world has y up). Prints to Xcode's console.
    private func checkAxes(rotation: simd_double3x3) {
      guard !hasCheckedAxes, let g = HeadTracker.latestMotion?.gravity else { return }
      let down = rotation * Self.cameraAxes(simd_double3(g.x, g.y, g.z))
      guard simd_length(down) > 0.5 else { return }
      hasCheckedAxes = true
      let agreement = simd_dot(simd_normalize(down), simd_double3(0, -1, 0))
      NSLog(
        "[HeadPosition] axis check %@ (agreement %.3f, want ~1)", agreement > 0.9 ? "OK" : "FAILED",
        agreement)
    }
  #endif
}

// One frame's measurement: where the eyes are, and the head's right and
// forward, all in ARKit's world.
private struct Sample {
  var eyes: simd_double3
  var right: simd_double3
  var forward: simd_double3
}

// MARK: - Level frame

// The axes the move is measured along, fixed at the reference: right, up and
// forward, level with the floor, forward being the way the head faced. A
// plain value, like `{ origin, right, forward }` in JS. ARKit's world has y
// up (gravity) and its level axes point wherever the phone faced when
// ARKit started, so they're turned to the head here. Built from the ear-to-
// ear line, like HeadPose's yaw, so looking straight down still has a
// forward.
struct LevelFrame {
  static let up = simd_double3(0, 1, 0)

  var origin: simd_double3
  let right: simd_double3
  let forward: simd_double3

  init(origin: simd_double3, right head: simd_double3, forward gaze: simd_double3) {
    self.origin = origin
    var level = simd_double3(head.x, 0, head.z)
    if simd_length(level) < 0.2 {
      // Ear pointing at the floor (head on its side): use the gaze instead.
      level = simd_cross(simd_double3(gaze.x, 0, gaze.z), Self.up)
    }
    right = simd_length(level) > 1e-6 ? simd_normalize(level) : simd_double3(1, 0, 0)
    forward = simd_cross(Self.up, right)
  }

  // How far `point` is from the origin: meters right, up, forward.
  func offset(of point: simd_double3) -> simd_double3 {
    let d = point - origin
    return simd_double3(simd_dot(d, right), d.y, simd_dot(d, forward))
  }

  // The reverse: the world vector for a move right, up, forward.
  func vector(for move: simd_double3) -> simd_double3 {
    move.x * right + move.y * Self.up + move.z * forward
  }
}

// MARK: - Prediction

// Carries ARKit's newest position on to now with the accelerometer, like
// dead reckoning between fixes. ARKit's pose is about 30 ms old when used
// (the camera frame has to be captured and processed); CoreMotion's is a
// few ms old. So: newest ARKit position + velocity × age + ½ × acceleration
// × age². Each new ARKit pose replaces the old starting point, so errors
// never build up: at most one frame's worth of guessing. Pure math, no
// sensors, like a small `utils.ts` reducer.
struct PositionPredictor {
  // Each new pose's own velocity (distance ÷ time since the last) is noisy,
  // so only this share of it is mixed in; the rest is the old estimate
  // carried on by the accelerometer. Evens out ARKit's jitter over about 4
  // frames without lagging a change of pace (the accelerometer sees that).
  static let velocityBlend = 0.25
  // Never guess further ahead than this (seconds), nor trust a velocity
  // across a longer gap between poses.
  static let maxSeconds = 0.1

  private(set) var anchor: simd_double3?
  private(set) var anchorTime = 0.0
  private(set) var velocity = simd_double3.zero

  // A new ARKit position, captured at `time` (seconds), while the phone
  // accelerates at `acceleration` (m/s², same axes). Returns how far it
  // landed from where the prediction had put it (meters), or nil for the
  // first one after a gap.
  @discardableResult
  mutating func correct(to position: simd_double3, at time: Double, acceleration: simd_double3)
    -> Double?
  {
    defer {
      anchor = position
      anchorTime = time
    }
    let seconds = time - anchorTime
    guard let anchor, seconds > 0, seconds <= Self.maxSeconds else {
      velocity = .zero
      return nil
    }
    let predicted = anchor + velocity * seconds + 0.5 * acceleration * seconds * seconds
    let carried = velocity + acceleration * seconds
    // The average velocity since the last pose, moved on to this one.
    let measured = (position - anchor) / seconds + acceleration * (seconds / 2)
    velocity = carried + Self.velocityBlend * (measured - carried)
    return simd_length(position - predicted)
  }

  // Where the phone is at `time`, or nil before the first pose.
  func position(at time: Double, acceleration: simd_double3) -> simd_double3? {
    guard let anchor else { return nil }
    let ahead = min(max(time - anchorTime, 0), Self.maxSeconds)
    return anchor + velocity * ahead + 0.5 * acceleration * ahead * ahead
  }

  mutating func reset() {
    anchor = nil
    velocity = .zero
  }
}

// MARK: - Hand-offs

// Keeps the move smooth whenever its source changes: a small state machine
// plus two springs, like Reanimated's `withSpring` on a shared value.
// - Tracking: the move is the tracked one, plus a `carry` that eases to zero
//   after a new zero or a comeback, so neither jumps.
// - Lost (or off): the move holds for `holdSeconds` (short hiccups don't
//   show), then eases to zero, back to rotation only.
struct PositionHandoff {
  // Seconds a lost position holds before easing back.
  static let holdSeconds = 0.5
  // Seconds to ease back to rotation only.
  static let releaseSeconds = 1.5
  // Seconds a new zero (recenter, the phone turning) takes to settle.
  static let recenterSeconds = 0.35
  // Seconds a comeback takes to catch up with the tracked position.
  static let resumeSeconds = 0.5
  // Seconds the height a lean had given takes to ease out when up and down
  // stop counting (T61).
  static let verticalSeconds = 0.5

  private(set) var output = simd_double3.zero
  // The last tracked move handed in (`output` without the carry).
  private(set) var tracked = simd_double3.zero
  // Seconds since tracking was lost, until the next tracked frame; 0 while
  // tracking.
  private(set) var lostSeconds = 0.0
  private(set) var isTracking = false
  private var carry = Settle()
  private var carrySeconds = resumeSeconds
  private var release = Settle()

  // The tracked move is about to jump to `tracked` (a new zero): ease there
  // over `settleSeconds` instead.
  mutating func rezero(to tracked: simd_double3, settleSeconds: Double) {
    carry = Settle(value: output - tracked)
    carrySeconds = settleSeconds
  }

  // Up and down stop counting (T61): the tracked move's height moves into
  // the carry, which eases it to none over `settleSeconds`, so the output
  // doesn't change this frame and the tracked moves after it come in level.
  // Only while tracking: lost (or off), the move is easing out anyway, and
  // a comeback picks up from wherever it has got to.
  mutating func dropVertical(settleSeconds: Double) {
    guard isTracking else { return }
    carry.value.y += tracked.y
    tracked.y = 0
    carrySeconds = settleSeconds
  }

  // One frame, `seconds` long. `tracked`: this frame's tracked move, or nil
  // when lost or off. `holds`: false to ease back at once (off). Returns the
  // move to use.
  mutating func step(tracked: simd_double3?, seconds: Double, holds: Bool) -> simd_double3 {
    guard let tracked else {
      if isTracking {
        isTracking = false
        lostSeconds = 0
        release = Settle(value: output)
      }
      lostSeconds += seconds
      if !holds || lostSeconds > Self.holdSeconds {
        release.step(seconds: seconds, settleSeconds: Self.releaseSeconds)
        output = release.value
      }
      return output
    }
    if !isTracking {
      // Found again: pick up from wherever the move is now.
      isTracking = true
      carry = Settle(value: output - tracked)
      carrySeconds = Self.resumeSeconds
    }
    lostSeconds = 0
    self.tracked = tracked
    carry.step(seconds: seconds, settleSeconds: carrySeconds)
    output = tracked + carry.value
    return output
  }
}

// A 3D value easing to zero on a critically damped spring (the fastest
// with no overshoot), from rest: no jolt as it starts. Exact for any frame
// length, like FirstPersonCamera.Glide.
struct Settle {
  // (1 + x)·e^(−x) = 1% at x ≈ 6.64: within 1% after `settleSeconds`.
  private static let settleRatio = 6.64

  var value = simd_double3.zero
  var velocity = simd_double3.zero

  mutating func step(seconds: Double, settleSeconds: Double) {
    guard value != .zero || velocity != .zero else { return }
    let t = max(seconds, 0)
    let stiffness = Self.settleRatio / max(settleSeconds, 0.01)
    let drift = velocity + stiffness * value
    let decay = exp(-stiffness * t)
    value = (value + drift * t) * decay
    velocity = (velocity - stiffness * drift * t) * decay
    // Under a hundredth of a millimeter: there.
    if simd_length(value) < 1e-5, simd_length(velocity) < 1e-4 {
      value = .zero
      velocity = .zero
    }
  }
}

// MARK: - Dev readout

#if DEBUG
  extension HeadPosition {
    // What the dev map's readout shows (debug builds). Read `jitterMm`
    // holding still; while moving it measures the move.
    struct Stats {
      // ARKit poses a second.
      var framesPerSecond = 0.0
      // How old ARKit's newest pose is when a frame is drawn: the lag the
      // prediction covers (without it, position would lag this much more
      // than rotation).
      var poseAgeMs = 0.0
      // How far each new ARKit pose landed from the prediction (RMS).
      var predictionErrorMm = 0.0
      // How much the move wobbles (RMS about its average).
      var jitterMm = 0.0
      // The move now: meters right, up, forward.
      var move = simd_double3.zero
    }
  }

  // Adds up half a second of numbers for Stats.
  private struct StatsWindow {
    static let seconds = 0.5

    private var start: Double?
    private var poses = 0
    private var ages = 0.0
    private var ageCount = 0
    private var misses = 0.0
    private var missCount = 0
    private var sum = simd_double3.zero
    private var squares = 0.0
    private var count = 0
    private var last = simd_double3.zero

    mutating func addPose(miss: Double?) {
      poses += 1
      if let miss {
        misses += miss * miss
        missCount += 1
      }
    }

    mutating func addAge(_ seconds: Double) {
      ages += seconds
      ageCount += 1
    }

    mutating func add(move: simd_double3) {
      sum += move
      squares += simd_length_squared(move)
      count += 1
      last = move
    }

    // The window's numbers once it's `seconds` long, starting a new one.
    mutating func take(at now: Double) -> HeadPosition.Stats? {
      guard let start else {
        self.start = now
        return nil
      }
      let length = now - start
      guard length >= Self.seconds else { return nil }
      let mean = count > 0 ? sum / Double(count) : .zero
      let spread = count > 0 ? max(squares / Double(count) - simd_length_squared(mean), 0) : 0
      let stats = HeadPosition.Stats(
        framesPerSecond: Double(poses) / length,
        poseAgeMs: ageCount > 0 ? ages / Double(ageCount) * 1000 : 0,
        predictionErrorMm: missCount > 0 ? (misses / Double(missCount)).squareRoot() * 1000 : 0,
        jitterMm: spread.squareRoot() * 1000,
        move: last)
      self = StatsWindow()
      self.start = now
      return stats
    }
  }
#endif
