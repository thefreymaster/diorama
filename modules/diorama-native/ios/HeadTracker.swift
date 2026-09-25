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

  // Apple asks for a single CMMotionManager per app, so every tracker shares
  // this one and the last to stop turns the sensors off.
  private static let motionManager = CMMotionManager()
  private static var motionUsers = 0

  // The newest motion sample (a few ms old), or nil while no tracker runs.
  // HeadPosition (T46) reads the accelerometer from it to fill the gaps
  // between ARKit's camera frames.
  static var latestMotion: CMDeviceMotion? {
    motionUsers > 0 ? motionManager.deviceMotion : nil
  }

  // Where the look comes from: false = the phone's motion sensors, true =
  // drags and setDebugLook (for the Simulator).
  var usesDebugLook = false

  private(set) var isRunning = false
  // The smoothed look from the last update().
  private(set) var look = HeadPose.zero

  // One filter per angle (see `filterMinCutoff`).
  private var yawFilter = HeadTracker.makeFilter()
  private var pitchFilter = HeadTracker.makeFilter()
  private var rollFilter = HeadTracker.makeFilter()

  // Reference, captured from the first sample after start()/recenter().
  private var referencePitch: Double?
  private var referenceScreen: ScreenAxes?
  // Yaw turned since the reference. Accumulated frame by frame so it never
  // jumps from +180 to -180 when you turn all the way round.
  private var turnedYaw = 0.0
  private var lastYaw = 0.0

  // Dragged look, in degrees: the whole look in debug-look mode, added to
  // the sensors' look otherwise.
  private var debugYaw = 0.0
  private var debugPitch = 0.0

  #if DEBUG
    private var hasCheckedAxes = false
  #endif

  // True when update() can produce a look: debug look is on, or this device
  // has motion sensors (the Simulator doesn't).
  var canLook: Bool {
    isRunning && (usesDebugLook || Self.motionManager.isDeviceMotionAvailable)
  }

  // Like a useEffect setup: turn the sensors on and forget the old reference.
  func start() {
    guard !isRunning else { return }
    isRunning = true
    Self.motionUsers += 1
    if Self.motionUsers == 1 { Self.startMotion() }
    recenter()
    resetFilters()
    look = .zero
  }

  // The matching cleanup.
  func stop() {
    guard isRunning else { return }
    isRunning = false
    Self.motionUsers -= 1
    if Self.motionUsers == 0 { Self.motionManager.stopDeviceMotionUpdates() }
    look = .zero
  }

  // Whatever way you face now becomes straight ahead. The look swings back
  // to zero through the filters (within a few frames) instead of snapping.
  func recenter() {
    referencePitch = nil
    referenceScreen = nil
    debugYaw = 0
    debugPitch = 0
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
  // now; `seconds` is the time since the previous frame.
  func update(screen: ScreenAxes, seconds: Double) -> HeadPose {
    guard isRunning, let target = targetLook(screen: screen) else { return look }
    look = HeadPose(
      yaw: yawFilter.filter(target.yaw, seconds: seconds),
      pitch: pitchFilter.filter(target.pitch, seconds: seconds),
      roll: rollFilter.filter(target.roll, seconds: seconds)
    )
    return look
  }

  // MARK: - Private

  // This frame's look before smoothing, or nil until the sensors warm up.
  private func targetLook(screen: ScreenAxes) -> HeadPose? {
    if usesDebugLook {
      return HeadPose(yaw: debugYaw, pitch: debugPitch, roll: 0)
    }
    guard let motion = Self.motionManager.deviceMotion else { return nil }
    let q = motion.attitude.quaternion
    let attitude = simd_quatd(ix: q.x, iy: q.y, iz: q.z, r: q.w)
    #if DEBUG
      checkAxes(attitude: attitude, gravity: motion.gravity)
    #endif
    let head = HeadPose.measure(attitude: attitude, screen: screen)

    // New reference after start(), recenter(), or when the interface rotates
    // (the same phone attitude then means a different head pose).
    if referencePitch == nil || referenceScreen != screen {
      referencePitch = head.pitch
      referenceScreen = screen
      turnedYaw = 0
      lastYaw = head.yaw
    }
    turnedYaw += HeadPose.wrapDegrees(head.yaw - lastYaw)
    lastYaw = head.yaw

    // Plus any dragged look (see setDebugLook). The pitch isn't limited
    // here: FirstPersonCamera takes it from straight down to straight up.
    return HeadPose(
      yaw: turnedYaw + debugYaw,
      pitch: head.pitch - (referencePitch ?? head.pitch) + debugPitch,
      roll: head.roll)
  }

  private static func makeFilter() -> OneEuroFilter {
    OneEuroFilter(minCutoff: filterMinCutoff, beta: filterBeta, speedCutoff: filterSpeedCutoff)
  }

  private func resetFilters() {
    yawFilter.reset()
    pitchFilter.reset()
    rollFilter.reset()
  }

  // Turns the shared sensors on: `motionRate` samples a second,
  // gravity-aligned, with the compass correcting slow yaw drift when the
  // device supports it.
  private static func startMotion() {
    guard motionManager.isDeviceMotionAvailable else { return }
    let available = CMMotionManager.availableAttitudeReferenceFrames()
    let frame: CMAttitudeReferenceFrame =
      available.contains(.xArbitraryCorrectedZVertical) ? .xArbitraryCorrectedZVertical : .xArbitraryZVertical
    motionManager.deviceMotionUpdateInterval = 1 / motionRate
    // No handler: update() reads the latest sample on each display frame.
    motionManager.startDeviceMotionUpdates(using: frame)
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
