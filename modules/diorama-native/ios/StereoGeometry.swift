import CoreGraphics
import MapKit
import QuartzCore
import simd

// Pure stereo math: no views, no state, like a `utils.ts` file. StereoRig
// uses it to size each eye's map, to place each eye's MapKit camera, and to
// correct each eye's picture.
//
// How the two eyes work:
// 1. The ideal eyes are "parallel": both keep the head-tracked pitch and
//    heading and sit baseline/2 left and right of the camera's position
//    (with head tracking, the fixed vantage point; see FirstPersonCamera),
//    along the wearer's ear-to-ear line. Each eye's picture is then slid
//    sideways so the point the camera looks at (the model center, or with
//    head tracking the aim point) lands in the same spot in both eyes (zero
//    parallax). Buildings rising toward you pop out, the ground beyond
//    sinks in.
// 2. MapKit can't draw that directly. It stands every camera on the surface
//    under the point it looks at, rooftops included, so two eyes looking at
//    two different points can end up a skyscraper's height apart. So both
//    MapKit cameras look at the *same* point, the one the camera looks at,
//    from the ideal eye positions (a slight "toe-in").
// 3. A toed-in MapKit camera sees the same rays as the ideal eye in the same
//    spot, only turned (and MapKit keeps its horizon level, so looking
//    nearly straight down it turns a lot). The picture of a camera turned in
//    place maps onto the ideal picture exactly (a homography), so each eye's
//    map is warped by that. The same warp cancels head roll and does the
//    zero-parallax slide. See `EyePose.picture`.
// 4. Looking higher than MapKit draws (T31). MapKit won't tilt past its
//    pitch cap, and never up to the horizon. But the ideal eye may look
//    anywhere, straight up included: its MapKit camera stops at the cap and
//    the warp turns the picture the rest of the way. That's exact at every
//    depth, because it's a turn in place. The picture then slides down the
//    eye, and SkyBackdrop fills what MapKit never drew above it.
// 5. MapKit's logo and Legal link (T44) are flat text drawn on each eye's
//    map, so each eye's warp moves them too, a little differently in each
//    eye, and they'd be seen double. EyeView moves them (through the map's
//    layout margins) so that both land where an eye midway between the two
//    would see them (`EyePose.middlePicture`): the same spot in both
//    windows, which reads as a label on the window's rim.
enum StereoGeometry {
  // MapKit's vertical field of view, in degrees. It spans the map view's
  // height whatever its width (measured 30.1° in the Simulator, iOS 26, for
  // maps 402 and 539 points tall).
  static let verticalFieldOfView = 30.0

  // Baseline ÷ camera distance at eyeSeparation 1. Much wider than human
  // eyes (hyperstereo), which is what makes the city read as a small model,
  // yet small enough that the two eyes differ by at most ~4 points at the
  // edges of a lens window (0.7 mm, about 1° through a Cardboard lens), so
  // they merge easily. At 1/30 with the old half-screen eyes it was 14.
  static let baselinePerMeter = 1.0 / 50

  // Extra map around a stereo eye for the slight perspective of the warp.
  private static let stereoMargin: CGFloat = 1.04

  // The warped map is drawn only while every corner of it is within about
  // 78° of where the eye looks (the cosine of that angle is 0.2). Past that
  // it is far outside the eye anyway (the eye sees about 20° to its
  // corners), and Core Animation can't draw a picture that reaches behind
  // the viewer: it would show a mirror image of the city in the sky.
  private static let minCornerCosine = 0.2

  // Meters between the two eye cameras for a camera `distance` meters from
  // the model center.
  static func baseline(distance: Double, eyeSeparation: Double) -> Double {
    distance * baselinePerMeter * eyeSeparation
  }

  // The vertical field of view, in degrees, of the part of the map an eye
  // shows. MapKit's 30° spans the whole map, but a map larger than its eye
  // (`overscan` = map height ÷ height shown, 1 = none) shows only its middle.
  static func shownFieldOfView(overscan: Double) -> Double {
    let halfAngle = verticalFieldOfView / 2 * .pi / 180
    return 2 * atan(tan(halfAngle) / max(overscan, 1)) * 180 / .pi
  }

  // MapKit's focal length in points for a map this tall: how many points a
  // one-meter object spans at one meter away.
  static func focalLength(mapHeight: CGFloat) -> Double {
    Double(mapHeight) / 2 / tan(verticalFieldOfView / 2 * .pi / 180)
  }

  // The map size one eye needs so that the warp never shows an edge.
  // Mono only turns against head roll (up to `maxRoll` degrees, 0 when not
  // tracking), so its map covers the eye turned that far. A stereo eye can
  // turn any amount (looking straight down, MapKit's own camera is turned up
  // to 90°), so its map is a square covering the eye's diagonal.
  static func mapSize(forEye eye: CGSize, maxRoll: Double, stereo: Bool) -> CGSize {
    if stereo {
      let side = ceil(hypot(eye.width, eye.height) * stereoMargin)
      return CGSize(width: side, height: side)
    }
    let angle = maxRoll * .pi / 180
    let sine = CGFloat(sin(angle))
    let cosine = CGFloat(cos(angle))
    return CGSize(
      width: ceil(eye.width * cosine + eye.height * sine),
      height: ceil(eye.width * sine + eye.height * cosine)
    )
  }

  // One eye: the camera MapKit should draw, and how to warp its picture.
  // `base` is MapKit's camera between the eyes. `lookPitch` is where the
  // eyes really look (degrees from straight down, up to 180 = straight up):
  // `base.pitch` itself, or more when looking past MapKit's cap. `side` is
  // -1 for the left eye, +1 for the right, 0 for mono. `baseline` is the
  // meters between the eyes (fixed for a head: see StereoRig.apply). `roll`
  // is the head roll to cancel, in degrees (as in HeadPose). `focal` is the
  // map's focal length in points, and `mapSize` the map's size.
  static func eyePose(
    of base: CameraPose, lookPitch: Double, side: Double, baseline: Double, roll: Double,
    focal: Double, mapSize: CGSize
  ) -> EyePose {
    // Where the eye really looks, and where MapKit's camera between the
    // eyes looks (the same spot, just not as far up).
    let ideal = CameraAxes(heading: base.heading, pitch: lookPitch, roll: roll)
    let between = CameraAxes(heading: base.heading, pitch: base.pitch, roll: 0)
    var camera = base
    var drawn = between
    if side != 0, baseline > 0 {
      // Where the eye sits relative to the point the camera looks at
      // (meters: east, north, up), along the ear-to-ear line, and MapKit's
      // camera from there looking at that same point.
      let eye = -base.altitude * between.forward + side * baseline / 2 * ideal.right
      let look = simd_normalize(-eye)
      camera.altitude = simd_length(eye)
      camera.pitch = acos(min(max(-look.z, -1), 1)) * 180 / .pi
      camera.heading = CameraPose.normalizedHeading(atan2(look.x, look.y) * 180 / .pi)
      drawn = CameraAxes(heading: camera.heading, pitch: camera.pitch, roll: 0)
    }
    // Zero parallax: the ideal eye sees the point the camera looks at
    // (b/2)·focal/distance points to one side; slide it back to the middle.
    let slide = side * baseline / 2 * focal / base.altitude
    return EyePose(
      camera: camera,
      picture: picture(from: drawn, to: ideal, focal: focal, slide: slide),
      // The eye midway between the two: MapKit's camera between the eyes,
      // no toe-in, no slide. The same as `picture` in mono.
      middlePicture: picture(from: between, to: ideal, focal: focal, slide: 0),
      side: side,
      look: ideal,
      roll: roll,
      focal: focal,
      slide: slide,
      beyondCap: lookPitch - base.pitch,
      showsMap: isInFront(mapSize, drawnBy: drawn, of: ideal, focal: focal)
    )
  }

  // True when every corner of a map `size` points big, drawn by `drawn`,
  // is well in front of `ideal` (see `minCornerCosine`).
  private static func isInFront(
    _ size: CGSize, drawnBy drawn: CameraAxes, of ideal: CameraAxes, focal: Double
  ) -> Bool {
    let halfWidth = Double(size.width) / 2
    let halfHeight = Double(size.height) / 2
    for x in [-halfWidth, halfWidth] {
      for y in [-halfHeight, halfHeight] {
        let ray = x * drawn.right - y * drawn.up + focal * drawn.forward
        if simd_dot(ray, ideal.forward) < minCornerCosine * simd_length(ray) { return false }
      }
    }
    return true
  }

  // The homography taking a point of the picture drawn by `drawn` to where
  // `ideal` (a camera in the same spot) sees it, slid sideways by `slide`.
  // Points are measured in points from the picture's center, y down.
  private static func picture(
    from drawn: CameraAxes, to ideal: CameraAxes, focal: Double, slide: Double
  ) -> simd_double3x3 {
    // Picture point (x, y, 1) → the ray x·right − y·up + focal·forward.
    let rays = simd_double3x3(columns: (drawn.right, -drawn.up, focal * drawn.forward))
    // That ray in the ideal camera's terms: (right, up, forward).
    let toIdeal = simd_double3x3(rows: [ideal.right, ideal.up, ideal.forward])
    // And onto its picture: x = focal·right/forward + slide, y = −focal·up/forward.
    let project = simd_double3x3(rows: [[focal, 0, slide], [0, -focal, 0], [0, 0, 1]])
    let homography = project * toIdeal * rays
    // Scaled so the map's center keeps weight 1. (When the map is behind the
    // eye this flips it into a mirror image in front, which is why
    // `showsMap` hides the map well before then.)
    return homography * (1 / homography[2][2])
  }
}

// One eye's MapKit camera and the warp that turns MapKit's picture into
// what this eye should see, plus what the eye needs to draw the sky.
struct EyePose {
  var camera: CameraPose
  // Maps a point of MapKit's picture (from its center, y down) to the eye's
  // picture (from the eye's center, y down), as a 3×3 homography.
  var picture: simd_double3x3
  // The same for an eye midway between the two (a "middle eye" that sees
  // with neither eye's toe-in nor slide). Each eye's warp differs from it on
  // purpose: that difference is the city's depth. But MapKit's logo and
  // Legal link are flat text drawn on each eye's map, so the same
  // difference would put them in slightly different spots in the two eyes
  // (T44), and they'd be seen double. EyeView uses this to place them
  // where the middle eye would see them, in both eyes alike.
  var middlePicture: simd_double3x3
  // -1 for the left eye, +1 for the right, 0 in mono.
  var side: Double
  // Where this eye really looks: its axes (east, north, up), roll included.
  var look: CameraAxes
  // The head roll the picture is turned against, in degrees.
  var roll: Double
  // The eye's focal length in map points (as for MapKit's picture).
  var focal: Double
  // Map points the eye's picture is slid sideways (zero parallax). The sky
  // gets the same slide, which puts it at infinity, just behind the city.
  var slide: Double
  // Degrees the eye looks higher than MapKit draws: 0 up to MapKit's pitch
  // cap, then growing to straight up.
  var beyondCap: Double
  // False when the map is so far out of view (looking up at the sky) that
  // it isn't drawn at all; see `minCornerCosine`.
  var showsMap: Bool

  // The warp as a Core Animation transform about the map's center (see
  // EyeView's WarpView). Any homography of a flat layer fits in a 4×4.
  var pictureTransform: CATransform3D {
    let h = picture  // h[column][row]
    var t = CATransform3DIdentity
    // Core Animation multiplies row vectors: [x y 0 1] × M.
    t.m11 = CGFloat(h[0][0])
    t.m21 = CGFloat(h[1][0])
    t.m41 = CGFloat(h[2][0])
    t.m12 = CGFloat(h[0][1])
    t.m22 = CGFloat(h[1][1])
    t.m42 = CGFloat(h[2][1])
    t.m14 = CGFloat(h[0][2])
    t.m24 = CGFloat(h[1][2])
    t.m44 = CGFloat(h[2][2])
    return t
  }
}

// A camera's axes in world terms (east, north, up), MapKit style: `pitch`
// from straight down, compass `heading`, and `roll` turning the camera
// clockwise about its view (MapKit's own cameras never roll). Pitch may go
// past MapKit's 90 (the horizon) up to 180, straight up. Built as a
// rotation (vectors), not angles read back, so straight up and straight
// down are no special case: the heading still says which way the ears
// point, and the picture turns smoothly through them.
struct CameraAxes {
  let right: simd_double3
  let up: simd_double3
  let forward: simd_double3

  init(heading: Double, pitch: Double, roll: Double) {
    let h = heading * .pi / 180
    let p = pitch * .pi / 180
    let r = roll * .pi / 180
    let ahead = simd_double3(sin(h), cos(h), 0)
    let level = simd_double3(cos(h), -sin(h), 0)
    let unrolledUp = cos(p) * ahead + simd_double3(0, 0, sin(p))
    forward = sin(p) * ahead - simd_double3(0, 0, cos(p))
    // A head rolled clockwise tips the ear-to-ear line down on the right.
    right = cos(r) * level - sin(r) * unrolledUp
    up = sin(r) * level + cos(r) * unrolledUp
  }
}
