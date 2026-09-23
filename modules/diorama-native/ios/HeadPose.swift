import Foundation
import simd

// MARK: - Axis conventions (read this first)
//
// World frame: CoreMotion's `.xArbitraryCorrectedZVertical`.
//   +Z points up (away from gravity). +X is a fixed horizontal direction
//   picked when motion updates start (not north). +Y = Z × X, a quarter turn
//   counterclockwise from +X seen from above.
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
// They are applied yaw first (about world up), then roll (about the gaze),
// then pitch (about the ear-to-ear line). With that order, looking straight
// down (this app's main pose) is well defined. The only blind spot is a head
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
    // Roll: how far the right ear has dropped below level.
    let roll = asin(min(max(-right.z, -1), 1))
    // Pitch: the gaze's height against the head-up's height. This is the
    // nod angle, and it keeps working past straight down.
    let pitch = atan2(forward.z, up.z)

    return HeadPose(yaw: degrees(yaw), pitch: degrees(pitch), roll: degrees(roll))
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
