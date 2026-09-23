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
final class HeadTracker {
  // Degrees the fake head turns per point dragged in debug-look mode.
  private static let debugDegreesPerPoint = 0.25
  // Debug-look pitch stops here, like a neck.
  private static let debugPitchLimit = 90.0

  // Apple asks for a single CMMotionManager per app, so every tracker shares
  // this one and the last to stop turns the sensors off.
  private static let motionManager = CMMotionManager()
  private static var motionUsers = 0

  // Where the look comes from: false = the phone's motion sensors, true =
  // drags and setDebugLook (for the Simulator).
  var usesDebugLook = false

  private(set) var isRunning = false
  // The smoothed look from the last update().
  private(set) var look = HeadPose.zero

  // Smoothing tuned for heads: steady when still, about a frame of lag at a
  // brisk 100°/s turn. See OneEuroFilter.swift.
  private var yawFilter = OneEuroFilter(minCutoff: 1, beta: 0.1)
  private var pitchFilter = OneEuroFilter(minCutoff: 1, beta: 0.1)
  private var rollFilter = OneEuroFilter(minCutoff: 1, beta: 0.1)

  // Reference, captured from the first sample after start()/recenter().
  private var referencePitch: Double?
  private var referenceScreen: ScreenAxes?
  // Yaw turned since the reference. Accumulated frame by frame so it never
  // jumps from +180 to -180 when you turn all the way round.
  private var turnedYaw = 0.0
  private var lastYaw = 0.0

  // Debug look: fake yaw and pitch in degrees.
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

  // Whatever way you face now becomes straight ahead. The look glides back
  // to zero through the filters instead of snapping.
  func recenter() {
    referencePitch = nil
    referenceScreen = nil
    debugYaw = 0
    debugPitch = 0
  }

  // Debug look: sets the fake head angle, in degrees (+yaw = right, +pitch = up).
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

    return HeadPose(yaw: turnedYaw, pitch: head.pitch - (referencePitch ?? head.pitch), roll: head.roll)
  }

  private func resetFilters() {
    yawFilter.reset()
    pitchFilter.reset()
    rollFilter.reset()
  }

  // Turns the shared sensors on: 60 samples a second, gravity-aligned, with
  // the compass correcting slow yaw drift when the device supports it.
  private static func startMotion() {
    guard motionManager.isDeviceMotionAvailable else { return }
    let available = CMMotionManager.availableAttitudeReferenceFrames()
    let frame: CMAttitudeReferenceFrame =
      available.contains(.xArbitraryCorrectedZVertical) ? .xArbitraryCorrectedZVertical : .xArbitraryZVertical
    motionManager.deviceMotionUpdateInterval = 1.0 / 60
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
