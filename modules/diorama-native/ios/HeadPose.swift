import Foundation
import simd

// MARK: - Axis conventions (read this first)
//
// World frame: CoreMotion's `.xArbitraryCorrectedZVertical`.
//   +Z points up (away from gravity). +X is a fixed horizontal direction
//   picked when motion updates start (not north). +Y = Z × X, a quarter turn
//   counterclockwise from +X seen from above.
//   In live mode (T59) it's `.xTrueNorthZVertical` instead: the same, except
//   +X is true north (so +Y is west), and yaw becomes a real compass
//   reading (see `compassHeading(yaw:)`).
//
// Device frame: fixed to the phone, described in portrait.
//   +X toward the right edge, +Y toward the top edge (the Dynamic Island),
//   +Z out of the screen toward the person looking at it.
//
// Attitude: CoreMotion's quaternion `q` turns a device-frame direction into
//   the world frame: `q.act(deviceDirection) == worldDirection`.
//
// Head frame: the wearer's right, forward (gaze) and up. The screen faces the
//   eyes, so forward is device -Z. Right and up are the screen's right and up
//   as the wearer sees them, which depend on how the interface is rotated
//   (see `ScreenAxes`).
//
// HeadPose angles, in degrees:
//   yaw    + = turned right (clockwise seen from above, like a compass heading)
//   pitch  + = looking up, - = looking down, 0 = level
//   roll   + = right ear toward right shoulder (clockwise as the wearer sees it)
// Yaw is read from the ear-to-ear line and pitch is the nod about it, so
// looking straight down (this app's main pose) or straight up is well
// defined. Roll is the turn about the line of sight: how far the world's
// "up" appears turned in the wearer's view, which is what the picture has
// to turn back to keep the horizon level. The only blind spot is a head
// rolled 90° onto a shoulder, which nobody does in a head mount.

// Which device directions point to the screen's right and up, for each way
// the interface can be rotated. Pure data, so this file needs no UIKit.
struct ScreenAxes: Equatable {
  let right: simd_double3
  let up: simd_double3

  static let portrait = ScreenAxes(right: [1, 0, 0], up: [0, 1, 0])
  static let portraitUpsideDown = ScreenAxes(right: [-1, 0, 0], up: [0, -1, 0])
  // UIKit's `.landscapeRight`: the phone's top edge is on the wearer's left.
  static let landscapeRight = ScreenAxes(right: [0, -1, 0], up: [1, 0, 0])
  // UIKit's `.landscapeLeft`: the phone's top edge is on the wearer's right.
  static let landscapeLeft = ScreenAxes(right: [0, 1, 0], up: [-1, 0, 0])
}

// Where a head is pointing, as three angles (see the conventions above).
// A plain value type, like a `{ yaw, pitch, roll }` object in JS. HeadTracker
// also uses it for the "look": the head pose relative to where you faced when
// tracking started or was recentered.
struct HeadPose: Equatable {
  var yaw: Double
  var pitch: Double
  var roll: Double

  static let zero = HeadPose(yaw: 0, pitch: 0, roll: 0)

  // How much the roll leans on the ear's own tilt near straight up and
  // down, where a turn about the line of sight is the same as a yaw and
  // "level" stops meaning anything. 0 would be the exact turn everywhere
  // but jumpy right at straight up. This keeps it within 1% of exact up to
  // 50° above or below level (2% at 60°, for a head turned up to 45°) and
  // brings it smoothly to 0 at straight up and down.
  static let rollSteadiness = 0.01

  // The head pose for a phone attitude, given how the interface is rotated.
  // A pure function: no sensors, no state.
  static func measure(attitude: simd_quatd, screen: ScreenAxes) -> HeadPose {
    // The head's axes as world-frame directions.
    let right = attitude.act(screen.right)
    let up = attitude.act(screen.up)
    let forward = attitude.act(simd_double3(0, 0, -1))

    // Yaw: which way the right ear points on the ground plane. The ear stays
    // level when you look up or down, so this stays steady even when looking
    // straight down, where the gaze has no horizontal direction. atan2 is
    // counterclockwise-positive; flip it so turning right is positive.
    let yaw = -atan2(right.y, right.x)
    // Roll: the angle between the head's up and the world's up, both seen
    // along the line of sight. How far the ear has dropped (-right.z)
    // against how upright the head still is (up.z); looking level that's
    // simply the ear's drop. `rollSteadiness` steadies it near straight up
    // and down (see above). It stays within ±90°: bending back past
    // straight up is a pitch past 90, not an upside-down roll.
    let steadiness = rollSteadiness * forward.z * forward.z
    let roll = atan2(-right.z, (up.z * up.z + steadiness).squareRoot())
    // Pitch: the gaze's height against the head-up's height. This is the
    // nod angle, and it keeps working past straight down.
    let pitch = atan2(forward.z, up.z)

    return HeadPose(yaw: degrees(yaw), pitch: degrees(pitch), roll: degrees(roll))
  }

  // How fast `measure`'s yaw is turning, in degrees a second, from the gyro
  // alone: `rotationRate` is CoreMotion's (radians a second about the
  // device's axes), turned into the world frame by `attitude`. The
  // attitude's own yaw also moves when CoreMotion corrects its heading from
  // the compass; this doesn't, so adding it up gives the head's real turn
  // (T59). It's the rate of yaw = -atan2(right.y, right.x): the spin about
  // the vertical, plus a little from the other axes while the ear is tilted.
  static func yawRate(attitude: simd_quatd, rotationRate: simd_double3, screen: ScreenAxes)
    -> Double
  {
    let spin = attitude.act(rotationRate)
    let right = attitude.act(screen.right)
    let level = right.x * right.x + right.y * right.y
    var rate = -spin.z
    // The ear points straight up or down (never in a head mount): the spin
    // about the vertical alone.
    if level > 1e-6 {
      rate += right.z * (spin.x * right.x + spin.y * right.y) / level
    }
    return degrees(rate)
  }

  // The compass heading (0 = north, 90 = east) the face points toward, for
  // a yaw measured in the true-north frame (T59). Yaw is read from the
  // right ear, so facing north the ear points east and yaw reads 90: the
  // face is a quarter turn left of the ear.
  static func compassHeading(yaw: Double) -> Double {
    wrapDegrees(yaw - 90)
  }

  // Wraps an angle into -180...180, so 350° becomes -10°. Use it on the
  // difference of two yaws to get the short way around.
  static func wrapDegrees(_ angle: Double) -> Double {
    let wrapped = (angle + 180).truncatingRemainder(dividingBy: 360)
    return (wrapped < 0 ? wrapped + 360 : wrapped) - 180
  }

  private static func degrees(_ radians: Double) -> Double {
    radians * 180 / .pi
  }
}

// MARK: - Compass (T59)

// How the compass is doing for live mode's true north, as JS hears it
// (`onCompassState`). Like a string union type in TS.
enum CompassState: String {
  // Trusted: the view faces the real compass heading.
  case good
  // Not trusted yet, or not any more (it needs a figure 8, or something
  // magnetic is near). The city holds where it is meanwhile, and the Viewer
  // shows its calibration hint.
  case calibrating
  // Not in use: true north is off, the phone can't do it, or the compass
  // stayed poor too long (a headset's magnet, say). The view keeps the
  // usual "straight ahead is where you faced" behaviour.
  case unavailable
}

// Decides from the compass's accuracy readings whether to trust it, like a
// tiny reducer: feed it one reading per motion sample, then read `state`
// and `isTrusted`. Pure logic, no sensors.
struct CompassJudge {
  // Trusted once the heading may be off by this many degrees or less...
  static let goodDegrees = 20.0
  // ...and until it may be off by more than this (the gap keeps a reading
  // hovering around one number from flickering).
  static let poorDegrees = 30.0
  // Seconds a trusted compass may read poorly before the state says
  // "calibrating" again (a headset's magnet button pressed for a moment
  // shouldn't bring up the hint). It's no longer trusted at once, though.
  static let calibratingAfterSeconds = 2.0
  // Seconds of poor readings in a row after which it gives up for good:
  // `unavailable` until true north starts afresh.
  static let giveUpAfterSeconds = 10.0

  private(set) var state: CompassState
  // True while the heading can be used. Only ever true in `good`.
  private(set) var isTrusted = false
  // When the readings turned poor (or started, poor), in seconds.
  private var poorSince: Double?

  // `available` false: the phone can't do true north at all.
  init(available: Bool) {
    state = available ? .calibrating : .unavailable
  }

  // One reading at `now` (seconds): `accuracy` is the most the heading may
  // be off, in degrees. Negative or nil means there's no valid heading.
  mutating func read(accuracy: Double?, now: Double) {
    guard state != .unavailable else { return }
    let limit = isTrusted ? Self.poorDegrees : Self.goodDegrees
    if let accuracy, accuracy >= 0, accuracy <= limit {
      isTrusted = true
      poorSince = nil
      state = .good
      return
    }
    isTrusted = false
    let since = poorSince ?? now
    poorSince = since
    if now - since > Self.giveUpAfterSeconds {
      state = .unavailable
    } else if now - since >= Self.calibratingAfterSeconds {
      state = .calibrating
    }
  }

  // Stops trusting it for good (e.g. the sensors never delivered).
  mutating func giveUp() {
    isTrusted = false
    state = .unavailable
  }
}
