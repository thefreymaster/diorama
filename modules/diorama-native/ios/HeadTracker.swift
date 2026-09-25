import CoreLocation
import CoreMotion
import UIKit
import simd

// Turns head motion into a smoothed "look" once per frame. Think of it as a
// custom hook, `useHeadLook()`, except that DioramaMapView's display link
// polls it every frame instead of it causing re-renders. Nothing here crosses
// the JS bridge.
//
// The look is a HeadPose (see HeadPose.swift for the axes):
// - yaw and pitch are relative to a reference taken at start() and
//   recenter(), so they read 0 when you face the way you faced then;
// - roll is measured against gravity, so the view can cancel it and keep the
//   horizon level even if the phone sits a little crooked in the mount.
//
// In debug-look mode (the Simulator has no gyro) drags stand in for the head.
// Otherwise a drag (setDebugLook, e.g. the Viewer's one-finger drag held
// upright) adds to what the sensors say, so you can look around by hand too.
//
// In live mode (`trueNorth`, T59) it also lines the city up with the real
// world; see "True north" below.
final class HeadTracker {
  // Degrees the fake head turns per point dragged in debug-look mode.
  private static let debugDegreesPerPoint = 0.25
  // Debug-look pitch stops here, like a neck.
  private static let debugPitchLimit = 90.0
  // Smoothing tuned for heads (see OneEuroFilter.swift). At rest it evens
  // out sensor jitter; the moment the head moves it lets go, so the view
  // keeps up with a turn: about 3 ms behind at 100°/s and 9 ms at a slow
  // 20°/s, 10 ms at most as a turn begins. (It was 1, 0.1 and 1 Hz: 10 to
  // 26 ms behind, up to 43 ms as a turn began, which read as floaty.)
  static let filterMinCutoff = 1.5  // Hz, at rest
  static let filterBeta = 0.5  // Hz more per degree per second
  static let filterSpeedCutoff = 10.0  // Hz: how fast it notices a turn
  // Motion samples per second. Faster than the screen, so the sample each
  // frame reads is fresh (5 ms old at most instead of 17).
  private static let motionRate = 100.0
  // After the sensors restart in another frame, samples still from the old
  // one are skipped for up to this long (see `freshSample`).
  private static let restartSeconds = 1.0
  // Samples further apart than this aren't added up from the gyro (see
  // `yawTurn`).
  private static let maxGyroGapSeconds = 0.1
  // Degrees the compass must disagree with the city's heading by before the
  // city turns to follow it (see `followNorth`); far finer than a phone's
  // compass is accurate (5–20°).
  private static let followDegrees = 0.5
  // Seconds the view takes to swing into line with true north, or to a new
  // "straight ahead" on a live-mode recenter (a critically damped spring,
  // like the live glide's). Quicker under Reduce Motion, like the glide.
  private static var alignSeconds: Double {
    UIAccessibility.isReduceMotionEnabled ? 0.3 : 1.2
  }

  // Apple asks for a single CMMotionManager per app, so every tracker shares
  // this one and the last to stop turns the sensors off.
  private static let motionManager = CMMotionManager()
  private static var motionUsers = 0
  // Running trackers that want the true-north frame now (see `syncMotion`).
  private static var trueNorthUsers = 0
  // Whether the sensors are on, in the true-north frame, and when they
  // (re)started (seconds since boot, CoreMotion's own clock).
  private static var isMotionOn = false
  private static var runsTrueNorth = false
  private static var motionStartedAt = 0.0

  // The newest motion sample (a few ms old), or nil while no tracker runs.
  // HeadPosition (T46) reads the accelerometer from it to fill the gaps
  // between ARKit's camera frames.
  static var latestMotion: CMDeviceMotion? {
    motionUsers > 0 ? motionManager.deviceMotion : nil
  }

  // Where the look comes from: false = the phone's motion sensors, true =
  // drags and setDebugLook (for the Simulator).
  var usesDebugLook = false {
    didSet { if usesDebugLook != oldValue { restartTrueNorth() } }
  }
  // Live mode (T59): face the real compass heading. Set from the
  // `trueNorth` prop.
  var trueNorth = false {
    didSet { if trueNorth != oldValue { trueNorthDidChange() } }
  }
  // Called whenever `compassState` changes (DioramaMapView's
  // onCompassState event).
  var onCompassStateChange: ((CompassState) -> Void)?

  private(set) var isRunning = false
  // The smoothed look from the last update().
  private(set) var look = HeadPose.zero
  // The compass, for true north: `unavailable` whenever true north isn't
  // running.
  private(set) var compassState = CompassState.unavailable {
    didSet { if compassState != oldValue { onCompassStateChange?(compassState) } }
  }

  // One filter per angle (see `filterMinCutoff`).
  private var yawFilter = HeadTracker.makeFilter()
  private var pitchFilter = HeadTracker.makeFilter()
  private var rollFilter = HeadTracker.makeFilter()

  // Reference, captured from the first sample after start()/recenter().
  private var needsReference = true
  private var referencePitch = 0.0
  private var referenceScreen: ScreenAxes?
  // Yaw turned since the reference. Accumulated frame by frame so it never
  // jumps from +180 to -180 when you turn all the way round, nor when the
  // sensors restart in another frame (the first sample then only sets
  // `lastYaw`). In the true-north frame it adds up the gyro's turn instead
  // (`lastYawRate` at `lastSampleTime`), so the compass correcting its
  // heading never turns the view; that goes to `headingTurn`, easing.
  private var turnedYaw = 0.0
  private var lastYaw = 0.0
  private var rebasesYaw = false
  private var lastYawRate = 0.0
  private var lastSampleTime: Double?
  // The `motionStartedAt` this tracker has caught up with.
  private var seenMotionStart: Double?

  // Dragged look, in degrees: the whole look in debug-look mode, added to
  // the sensors' look otherwise.
  private var debugYaw = 0.0
  private var debugPitch = 0.0

  // True north (T59). `judge` trusts the compass or not. The targets:
  // `headingTurnTarget`, degrees the base camera turns from the props'
  // heading to face true north, and `yawShiftTarget`, degrees of
  // `turnedYaw` a live-mode recenter has moved "straight ahead" by.
  // `aligning` holds what's left to ease of each (x: heading turn, y: yaw
  // shift; target minus now), like a Reanimated shared value springing.
  private var judge = CompassJudge(available: false)
  private var countsForTrueNorth = false
  private var headingTurnTarget = 0.0
  private var yawShiftTarget = 0.0
  private var aligning = Settle()
  // A recenter asked to keep the view on true north (see `readHead`).
  private var recenterKeepsNorth = false
  // iOS 26 and earlier only (see CompassAccuracyReader).
  private var accuracyReader: CompassAccuracyReader?

  #if DEBUG
    private var hasCheckedAxes = false
  #endif

  // True when update() can produce a look: debug look is on, or this device
  // has motion sensors (the Simulator doesn't).
  var canLook: Bool {
    isRunning && (usesDebugLook || Self.motionManager.isDeviceMotionAvailable)
  }

  // Degrees the base camera turns from the props' heading so the view faces
  // true north (T59): 0 until the compass is trusted, then easing into line.
  // DioramaMapView adds it to the base camera's heading. It stays while
  // tracking pauses, so the city doesn't swing back.
  var headingTurn: Double {
    headingTurnTarget - aligning.value.x
  }

  // Like a useEffect setup: turn the sensors on and forget the old reference.
  func start() {
    guard !isRunning else { return }
    isRunning = true
    Self.motionUsers += 1
    // Before the sensors start, so they start in the right frame.
    beginTrueNorth()
    Self.syncMotion()
    needsReference = true
    recenterKeepsNorth = false
    lastSampleTime = nil
    debugYaw = 0
    debugPitch = 0
    dropYawShift()
    resetFilters()
    look = .zero
  }

  // The matching cleanup.
  func stop() {
    guard isRunning else { return }
    isRunning = false
    endTrueNorth()
    Self.motionUsers -= 1
    Self.syncMotion()
    look = .zero
  }

  // Whatever way you face now becomes straight ahead. The look swings back
  // to zero through the filters (within a few frames) instead of snapping.
  // With true north trusted (live mode), the city turns with you instead,
  // so what's ahead of you is ahead in the city too: the look and the base
  // camera ease there together (see `readHead`).
  func recenter() {
    needsReference = true
    recenterKeepsNorth = isRunning && judge.isTrusted && Self.runsTrueNorth
    debugYaw = 0
    debugPitch = 0
  }

  // A new place (DioramaMapView's new `center`): its own heading, until the
  // compass turns it again. Behind the loading cover, so no easing.
  func dropHeadingTurn() {
    headingTurnTarget = 0
    aligning.value.x = 0
    aligning.velocity.x = 0
  }

  // Sets the dragged look, in degrees (+yaw = right, +pitch = up): the whole
  // look in debug-look mode, otherwise added to the sensors' look.
  // recenter() zeroes it.
  func setDebugLook(yaw: Double, pitch: Double) {
    debugYaw = yaw
    debugPitch = min(max(pitch, -Self.debugPitchLimit), Self.debugPitchLimit)
  }

  // Debug look: drag the way you'd turn your head. Right looks right, down
  // looks down, so the near side of the city follows your finger, as in a
  // 3D model viewer.
  func dragDebugLook(by translation: CGPoint) {
    setDebugLook(
      yaw: debugYaw + translation.x * Self.debugDegreesPerPoint,
      pitch: debugPitch - translation.y * Self.debugDegreesPerPoint
    )
  }

  // Call once per frame. `screen` says how the interface is rotated right
  // now; `seconds` is the time since the previous frame; `restingHeading`
  // is the base camera's heading before `headingTurn` (the props' heading
  // plus any orbit).
  func update(screen: ScreenAxes, seconds: Double, restingHeading: Double) -> HeadPose {
    guard isRunning else { return look }
    let head = usesDebugLook ? nil : readHead(screen: screen, restingHeading: restingHeading)
    aligning.step(seconds: seconds, settleSeconds: Self.alignSeconds)
    let target: HeadPose
    if usesDebugLook {
      target = HeadPose(yaw: debugYaw, pitch: debugPitch, roll: 0)
    } else if let head {
      // Plus any dragged look (see setDebugLook). The pitch isn't limited
      // here: FirstPersonCamera takes it from straight down to straight up.
      target = HeadPose(
        yaw: turnedYaw - yawShift + debugYaw,
        pitch: head.pitch - referencePitch + debugPitch,
        roll: head.roll)
    } else {
      return look  // The sensors are still warming up.
    }
    look = HeadPose(
      yaw: yawFilter.filter(target.yaw, seconds: seconds),
      pitch: pitchFilter.filter(target.pitch, seconds: seconds),
      roll: rollFilter.filter(target.roll, seconds: seconds)
    )
    return look
  }

  // MARK: - Private

  // The yaw shift now, part way through its ease.
  private var yawShift: Double {
    yawShiftTarget - aligning.value.y
  }

  // This frame's head pose from the sensors, with the yaw bookkeeping and
  // true north brought up to date; nil until the sensors warm up.
  private func readHead(screen: ScreenAxes, restingHeading: Double) -> HeadPose? {
    let now = ProcessInfo.processInfo.systemUptime
    guard let motion = freshSample(now: now) else { return nil }
    let q = motion.attitude.quaternion
    let attitude = simd_quatd(ix: q.x, iy: q.y, iz: q.z, r: q.w)
    #if DEBUG
      checkAxes(attitude: attitude, gravity: motion.gravity)
    #endif
    let head = HeadPose.measure(attitude: attitude, screen: screen)

    // This sample's turn since the last one read. The attitude's yaw can't
    // say across a restart or a turn of the interface (it's measured from
    // another direction, or another ear, then).
    let turn = yawTurn(
      of: motion, attitude: attitude, head: head, screen: screen,
      attitudeCarriesOn: !rebasesYaw && referenceScreen == screen)

    // New reference after start(), recenter(), or when the interface rotates
    // (the same phone attitude then means a different head pose). Keeping
    // true north, only pitch starts over: the yaw carries on, and
    // "straight ahead" moves to where you face now (below).
    var keepsNorth = false
    if needsReference || referenceScreen != screen {
      keepsNorth = (recenterKeepsNorth || !needsReference) && judge.isTrusted && Self.runsTrueNorth
      referencePitch = head.pitch
      referenceScreen = screen
      if keepsNorth {
        turnedYaw += turn
      } else {
        turnedYaw = 0
        dropYawShift()
      }
      needsReference = false
      recenterKeepsNorth = false
    } else {
      turnedYaw += turn
    }
    rebasesYaw = false
    lastYaw = head.yaw

    followNorth(
      head: head, accuracy: headingAccuracy(of: motion), restingHeading: restingHeading,
      recentered: keepsNorth, now: now)
    return head
  }

  // Degrees the head turned (yaw) since the last sample read. In the usual
  // frame, from the attitude's yaw (0 when `attitudeCarriesOn` is false:
  // the first sample after a restart only sets where it carries on from).
  // In the true-north frame, from the gyro: this sample's rate and the last
  // one's, averaged over the time between them. The compass correcting
  // CoreMotion's heading moves the attitude's yaw but not the gyro, so the
  // view doesn't swim; `followNorth` puts the correction on the base camera
  // instead. A long gap (a hitch) falls back to the attitude.
  private func yawTurn(
    of motion: CMDeviceMotion, attitude: simd_quatd, head: HeadPose, screen: ScreenAxes,
    attitudeCarriesOn: Bool
  ) -> Double {
    let spin = motion.rotationRate
    let rate = HeadPose.yawRate(
      attitude: attitude, rotationRate: simd_double3(spin.x, spin.y, spin.z), screen: screen)
    let (previousRate, previousTime) = (lastYawRate, lastSampleTime)
    lastYawRate = rate
    lastSampleTime = motion.timestamp
    let fromAttitude = attitudeCarriesOn ? HeadPose.wrapDegrees(head.yaw - lastYaw) : 0
    guard Self.runsTrueNorth, let previousTime else { return fromAttitude }
    let seconds = motion.timestamp - previousTime
    guard seconds >= 0, seconds < Self.maxGyroGapSeconds else { return fromAttitude }
    return (rate + previousRate) / 2 * seconds
  }

  // The newest sample, or nil if there's none yet. Just after the sensors
  // restart in another frame (true north on or off), CoreMotion may still
  // hand over a sample from the old one, whose yaw is measured from another
  // direction: skip those (a true-north sample has a heading, an arbitrary
  // one doesn't), then carry the yaw on from the first new one.
  private func freshSample(now: Double) -> CMDeviceMotion? {
    let motion = Self.motionManager.deviceMotion
    guard seenMotionStart != Self.motionStartedAt else { return motion }
    let waited = now - Self.motionStartedAt
    // A little patience covers a sample that arrived just as they restarted
    // (and, in the usual frame, any phone whose headings don't follow the
    // documented sign).
    let patient = waited > Self.restartSeconds / 4
    if let motion {
      let rightFrame = (motion.heading >= 0) == Self.runsTrueNorth
      let isNew = motion.timestamp >= Self.motionStartedAt
      if (rightFrame && (isNew || patient)) || (!Self.runsTrueNorth && patient) {
        seenMotionStart = Self.motionStartedAt
        rebasesYaw = true
        return motion
      }
    }
    // Nothing from the true-north frame after a second: don't wait on it.
    if waited > Self.restartSeconds, Self.runsTrueNorth, countsForTrueNorth {
      giveUpTrueNorth()
    }
    return nil
  }

  private static func makeFilter() -> OneEuroFilter {
    OneEuroFilter(minCutoff: filterMinCutoff, beta: filterBeta, speedCutoff: filterSpeedCutoff)
  }

  private func resetFilters() {
    yawFilter.reset()
    pitchFilter.reset()
    rollFilter.reset()
  }

  // Keeps the shared sensors on while any tracker runs, `motionRate`
  // samples a second, gravity-aligned. In the true-north frame if any
  // running tracker wants it (T59); otherwise the usual frame, with the
  // compass correcting slow yaw drift when the device supports it. Switching
  // frames restarts the sensors (each tracker then carries its yaw on).
  private static func syncMotion() {
    guard motionUsers > 0, motionManager.isDeviceMotionAvailable else {
      if isMotionOn { motionManager.stopDeviceMotionUpdates() }
      isMotionOn = false
      return
    }
    let wantsTrueNorth = trueNorthUsers > 0
    guard !isMotionOn || wantsTrueNorth != runsTrueNorth else { return }
    if isMotionOn { motionManager.stopDeviceMotionUpdates() }
    let available = CMMotionManager.availableAttitudeReferenceFrames()
    let frame: CMAttitudeReferenceFrame =
      wantsTrueNorth
      ? .xTrueNorthZVertical
      : available.contains(.xArbitraryCorrectedZVertical)
        ? .xArbitraryCorrectedZVertical : .xArbitraryZVertical
    motionManager.deviceMotionUpdateInterval = 1 / motionRate
    // No handler: update() reads the latest sample on each display frame.
    motionManager.startDeviceMotionUpdates(using: frame)
    isMotionOn = true
    runsTrueNorth = wantsTrueNorth
    motionStartedAt = ProcessInfo.processInfo.systemUptime
  }

  #if DEBUG
    // One-time check (debug builds, real device) of the axis conventions in
    // HeadPose.swift: the attitude must predict the gravity CoreMotion
    // measures. The result prints to Xcode's console.
    private func checkAxes(attitude: simd_quatd, gravity: CMAcceleration) {
      let measured = simd_double3(gravity.x, gravity.y, gravity.z)
      guard !hasCheckedAxes, simd_length(measured) > 0.5 else { return }
      hasCheckedAxes = true
      let predicted = attitude.inverse.act(simd_double3(0, 0, -1))
      let agreement = simd_dot(predicted, simd_normalize(measured))
      NSLog("[HeadTracker] axis check %@ (agreement %.3f, want ~1)", agreement > 0.9 ? "OK" : "FAILED", agreement)
    }
  #endif
}

// MARK: - True north (T59)
//
// Live mode lines the city up with the real world: turn toward the real
// river and it's ahead of you in the model. Without it, "straight ahead" is
// wherever you faced when tracking started, and the city there faces the
// place's own heading. With `trueNorth` on:
// - The sensors run in CoreMotion's true-north frame, so the attitude's yaw
//   is a real compass reading (HeadPose.compassHeading). The look still
//   turns by the gyro alone (`yawTurn`), exactly as your head turns: as the
//   compass settles or corrects itself, the view doesn't swim.
// - While the compass is trusted (CompassJudge, from its accuracy: iOS 27's
//   CMDeviceMotion.headingAccuracy, or CoreLocation's before that),
//   `headingTurn` turns the base camera so the city's "straight ahead"
//   faces the same real heading as yours: the view swings round the model
//   center (where you are) into line, easing, never jumping. It keeps
//   following the compass (smoothed by the same ease), which also takes out
//   the gyro's slow drift.
// - A recenter then keeps north: it levels pitch and roll, and "straight
//   ahead" moves to wherever you face now, the base camera turning with it
//   (the look and the base camera ease together, so the view swings one way
//   only). The Viewer recenters as the countdown ends, so whatever you face
//   when the headset goes on lines up.
// - The head still turns the camera by the lens gain (ViewerProfile), so the
//   city holds still through the lens as you turn. The model and the world
//   match exactly straight ahead and a little less the farther you turn
//   from there; a double-tap lines up whatever you face.
// - A poor compass (it wants a figure 8, or a headset's magnet is near)
//   holds the city where it is and reports `calibrating`. After about 10 s
//   of that the sensors go back to the usual frame and it stays that way
//   (`unavailable`), keeping whatever alignment it had.
extension HeadTracker {
  // True north is asked for and can be tried: sensors, not drags.
  private var wantsTrueNorth: Bool {
    trueNorth && !usesDebugLook
  }

  // Whether this phone has a compass CoreMotion can use for true north (and,
  // before iOS 27, CoreLocation's compass to judge it).
  private static var canRunTrueNorth: Bool {
    guard motionManager.isDeviceMotionAvailable,
      CMMotionManager.availableAttitudeReferenceFrames().contains(.xTrueNorthZVertical)
    else { return false }
    if #available(iOS 27, *) { return true }
    return CLLocationManager.headingAvailable()
  }

  // The prop changed. While running, start true north afresh (or stop it);
  // turned off, the city eases back to the props' heading.
  fileprivate func trueNorthDidChange() {
    if !trueNorth {
      aligning.value.x -= headingTurnTarget
      headingTurnTarget = 0
      shiftYaw(to: 0)
    }
    restartTrueNorth()
  }

  fileprivate func restartTrueNorth() {
    guard isRunning else { return }
    endTrueNorth()
    beginTrueNorth()
    Self.syncMotion()
  }

  // Starts judging the compass, and counts toward the true-north frame, if
  // true north is wanted and possible. The caller syncs the sensors.
  fileprivate func beginTrueNorth() {
    let possible = wantsTrueNorth && Self.canRunTrueNorth
    judge = CompassJudge(available: possible)
    compassState = judge.state
    guard possible else { return }
    if #unavailable(iOS 27) {
      let reader = accuracyReader ?? CompassAccuracyReader()
      accuracyReader = reader
      reader.start()
    }
    setCountsForTrueNorth(true)
  }

  // Stops judging and no longer asks for the true-north frame. The caller
  // syncs the sensors.
  fileprivate func endTrueNorth() {
    accuracyReader?.stop()
    setCountsForTrueNorth(false)
    judge = CompassJudge(available: false)
    compassState = .unavailable
  }

  // The compass stayed poor (or never came): back to the usual frame for
  // good, keeping whatever alignment the city has.
  fileprivate func giveUpTrueNorth() {
    judge.giveUp()
    compassState = .unavailable
    accuracyReader?.stop()
    setCountsForTrueNorth(false)
    Self.syncMotion()
  }

  private func setCountsForTrueNorth(_ counts: Bool) {
    guard counts != countsForTrueNorth else { return }
    countsForTrueNorth = counts
    Self.trueNorthUsers += counts ? 1 : -1
  }

  // How far off the compass may be, in degrees (negative: no heading). iOS
  // 27 says so with each motion sample; before that, CoreLocation's compass
  // stands in.
  fileprivate func headingAccuracy(of motion: CMDeviceMotion) -> Double? {
    if #available(iOS 27, *) { return motion.headingAccuracy }
    return accuracyReader?.accuracy
  }

  // One sample's worth of true north: judge the compass and, while it's
  // trusted, keep the base camera facing the real heading of "straight
  // ahead" (`recentered`: first moving straight ahead to where you face
  // now). A poor compass leaves the targets alone, so the city holds.
  fileprivate func followNorth(
    head: HeadPose, accuracy: Double?, restingHeading: Double, recentered: Bool, now: Double
  ) {
    guard countsForTrueNorth else { return }
    judge.read(accuracy: accuracy, now: now)
    compassState = judge.state
    let trusted = judge.isTrusted && Self.runsTrueNorth
    if recentered {
      if trusted {
        shiftYaw(to: turnedYaw)
      } else {
        // The compass went poor this very moment: a plain recenter.
        turnedYaw = 0
        dropYawShift()
      }
    }
    guard judge.state != .unavailable else {
      giveUpTrueNorth()
      return
    }
    guard trusted else { return }
    // The real heading your face had at the reference (turnedYaw 0), moved
    // on by any live-mode recenters: where the city's straight ahead faces.
    let ahead = HeadPose.compassHeading(yaw: head.yaw) - turnedYaw + yawShiftTarget
    // The short way from the base camera's (target) heading to it. The
    // change eases in (see `aligning`). The compass's own jitter (and the
    // gyro's slow drift) is left alone until it adds up to
    // `followDegrees`, so a still head lets MapKit rest.
    let change = HeadPose.wrapDegrees(ahead - (restingHeading + headingTurnTarget))
    guard recentered || abs(change) >= Self.followDegrees else { return }
    headingTurnTarget += change
    aligning.value.x += change
  }

  // Moves "straight ahead" to `target` degrees of `turnedYaw`, easing.
  private func shiftYaw(to target: Double) {
    aligning.value.y += target - yawShiftTarget
    yawShiftTarget = target
  }

  // No yaw shift, at once (a plain recenter: the filters smooth the swing).
  fileprivate func dropYawShift() {
    yawShiftTarget = 0
    aligning.value.y = 0
    aligning.velocity.y = 0
  }
}

// iOS 26 and earlier have no CMDeviceMotion.headingAccuracy, so CoreLocation's
// compass stands in: each CLHeading says how far off it may be. Like a tiny
// store a listener keeps up to date; HeadTracker reads `accuracy` each
// frame. Heading updates don't need location access, and never show iOS's
// own calibration screen (the Viewer's HUD asks for the figure 8 instead).
final class CompassAccuracyReader: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  // Degrees the heading may be off (negative: no heading), or nil before
  // the first reading.
  private(set) var accuracy: Double?

  override init() {
    super.init()
    manager.delegate = self
    // Every reading, not just turns of a degree or more: the accuracy can
    // change while the heading doesn't.
    manager.headingFilter = kCLHeadingFilterNone
  }

  func start() {
    accuracy = nil
    manager.startUpdatingHeading()
  }

  func stop() {
    manager.stopUpdatingHeading()
    accuracy = nil
  }

  func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
    accuracy = newHeading.headingAccuracy
  }

  func locationManagerShouldDisplayHeadingCalibration(_ manager: CLLocationManager) -> Bool {
    false
  }
}

extension ScreenAxes {
  // The screen axes for the interface's current rotation.
  init(_ orientation: UIInterfaceOrientation) {
    switch orientation {
    case .landscapeLeft: self = .landscapeLeft
    case .landscapeRight: self = .landscapeRight
    case .portraitUpsideDown: self = .portraitUpsideDown
    default: self = .portrait
    }
  }
}
