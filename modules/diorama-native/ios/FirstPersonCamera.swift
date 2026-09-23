import CoreLocation
import simd

// First-person head tracking as pure math (no views, no state), like a
// `utils.ts` file. DioramaMapView asks it for the camera once per frame.
//
// The idea: you stand still at one spot above a tabletop model and look
// around. Your head stays where it is; only the direction you look changes.
// So the city stays put and the view pans across it, the way a room does
// when you turn your head. (Before T23, turning your head swung the camera
// around the model center, like a turntable or a drone circling it.)
//
// Words used here:
// - Model center: the `center` prop, the point the starting camera looks at.
// - Vantage point: where your eyes are. It is the starting camera's own
//   position: `altitude` meters (camera-to-center distance) back from the
//   model center, `pitch` degrees from straight down, facing `heading`. It
//   stays put while you look around. New camera props (another city,
//   another framing, another Camera height) are a new place to stand, so
//   they move it; recentering doesn't (it only makes wherever you face now
//   "straight ahead" again). From far out MapKit won't draw a city's own
//   pitch, so DioramaMapView hands in the starting camera at the steepest
//   pitch MapKit draws there (see `firstPersonCamera(from:)`): a higher
//   camera stands farther forward and looks more straight down, with the
//   model center still in the middle.
// - Gaze: the direction you look, as a compass heading and a pitch.
// - Aim point: where the gaze ray meets the ground. A MapKit camera always
//   looks *at* a point on the map from some distance, so every frame the
//   camera looks at the aim point from the vantage point.
//
// Axes (the same as StereoGeometry's CameraAxes): meters in a flat
// "tabletop" frame whose origin is on the ground at the model center.
//   x = east, y = north, z = up.
//   heading: compass degrees, 0 = north, 90 = east (clockwise from above).
//   pitch: degrees from straight down (0) toward the horizon (90), as in
//     MapKit, and on past it to straight up (180).
// Head look (HeadPose): +yaw = turned right, +pitch = looking up.
//
// Every frame:
//   gaze heading = base heading + head yaw × gain
//   gaze pitch   = base pitch + head pitch × gain, bending to reach
//                  straight up and straight down (see `gazePitch`)
//   MapKit's pitch = the gaze pitch, but no steeper than MapKit draws from
//                  here (DioramaMapView); each eye's warp turns the picture
//                  the rest of the way up (StereoGeometry)
//   aim point    = vantage point + (height ÷ cos(MapKit's pitch)) × its
//                  direction
//   camera       = looking at the aim point from the vantage point, i.e.
//                  MKMapCamera(lookingAtCenter: aim, fromEyeCoordinate:
//                  vantage, eyeAltitude: height)
//
// The gain: a head turn of N° should move the city N° as seen through the
// headset's lens. An eye window shows only part of MapKit's picture (the
// map is drawn larger than the window, so MapKit's 30° spans more than the
// window), so the window shows `rendered` degrees of the city. Through the
// lens the same window fills `perceived` degrees of your view:
//   perceived = 2 × atan(window height mm ÷ 2 ÷ lens-to-screen mm)
// (about 47° for the default 35 mm circle 40 mm behind the lens). The picture is
// magnified perceived ÷ rendered times, so for the city to hold still the
// camera turns rendered ÷ perceived as far as the head:
//   gain = tracking sensitivity × rendered ÷ perceived
// (see ViewerProfile.lookGain). Head roll isn't scaled: turning a picture
// by an angle turns it by that same angle through a lens.
//
// Looking all the way up: at the default gain (~0.6) a head can't reach
// straight up that way. From a start 30° below the horizon it would take a
// 200° nod. So the gain holds exactly for the first `kneeDegrees` of nod
// either way (where you look over the city), then bends smoothly so that
// nodding 90° up from where you faced at recenter looks straight up, and
// 90° down looks straight down. Past the knee the view turns faster than
// the head, mostly over sky, where there is nothing to swim.
//
// Stereo: StereoGeometry puts the two eyes baseline/2 either side of the
// vantage point along the ear-to-ear line (perpendicular to the gaze), both
// looking at the aim point, so both MapKit cameras stand on the same spot
// of ground (see StereoGeometry for why that keeps them level).
//
// Known limit: MapKit stands a camera on the ground height it has under the
// point it looks at, and nothing public reports that height. So as the aim
// point moves over a city, the vantage point rides up and down with the
// ground under it: over Midtown Manhattan about ±10 m on a 1 km high
// vantage point (the pan speeds up or slows by up to a fifth for a degree
// or so), and not at all over flat ground or water. It does not jump onto
// rooftops: looking straight down at the Empire State Building's roof
// rather than the street beside it raised the camera about 20 m, not 380.
struct FirstPersonCamera {
  // Where you look, in degrees (see the axes above).
  struct Gaze: Equatable {
    var heading: Double
    var pitch: Double
  }

  // Degrees of head nod, up or down from where you faced at recenter, over
  // which the gaze turns exactly `gain` times as far (see `gazePitch`).
  static let kneeDegrees = 30.0
  // Degrees of head nod that reach straight up (or straight down).
  static let fullNodDegrees = 90.0

  // The starting camera: props plus orbit, backed off for overscan.
  let base: CameraPose
  // The vantage point, in meters from the model center (east, north, up).
  let eye: simd_double3

  init(base: CameraPose) {
    self.base = base
    let axes = CameraAxes(heading: base.heading, pitch: base.pitch, roll: 0)
    eye = -base.altitude * axes.forward
  }

  // The vantage point's height above the model center's ground, in meters.
  var eyeHeight: Double { eye.z }

  // The vantage point on the map.
  var eyeCoordinate: CLLocationCoordinate2D {
    Self.coordinate(at: simd_double2(eye.x, eye.y), from: base.center)
  }

  // The gaze with the head still: exactly the starting camera's.
  var restingGaze: Gaze {
    Gaze(heading: base.heading, pitch: base.pitch)
  }

  // The gaze for a head `look`, turned `gain` times as far as the head (see
  // the gain above). The heading turns freely, round and round; the pitch
  // runs from straight down (0) to straight up (180), with no stop at
  // MapKit's cap (see `gazePitch`).
  func gaze(for look: HeadPose, gain: Double) -> Gaze {
    Gaze(
      heading: CameraPose.normalizedHeading(base.heading + look.yaw * gain),
      pitch: Self.gazePitch(rest: base.pitch, nod: look.pitch, gain: gain))
  }

  // The aim point for `gaze`, in meters from the model center: walk from
  // the vantage point along the gaze until it reaches the ground (z = 0).
  func aimPoint(for gaze: Gaze) -> simd_double3 {
    eye + reach(for: gaze) * CameraAxes(heading: gaze.heading, pitch: gaze.pitch, roll: 0).forward
  }

  // The camera MapKit should draw for `gaze`: at the vantage point, looking
  // at the aim point. The same camera as MKMapCamera(lookingAtCenter: aim,
  // fromEyeCoordinate: eyeCoordinate, eyeAltitude: eyeHeight), written as
  // center, distance, pitch and heading so the pitch and heading are exactly
  // the gaze's and StereoGeometry can take it from there.
  func camera(for gaze: Gaze) -> CameraPose {
    let aim = aimPoint(for: gaze)
    var camera = base
    camera.center = Self.coordinate(at: simd_double2(aim.x, aim.y), from: base.center)
    camera.altitude = reach(for: gaze)
    camera.pitch = gaze.pitch
    camera.heading = gaze.heading
    return camera
  }

  // Meters from the vantage point to the aim point along `gaze`. It grows
  // without end toward the horizon (pitch 90), so only MapKit's own
  // (capped) pitch comes here, never the gaze past it.
  func reach(for gaze: Gaze) -> Double {
    let descent = cos(min(max(gaze.pitch, 0), 89) * .pi / 180)
    return eyeHeight / descent
  }

  // MARK: - Helpers

  // The gaze pitch (degrees from straight down) for a head `nod` (degrees,
  // + up, from where you faced at recenter) from a `rest` pitch. Within
  // `kneeDegrees` of nod it's exactly rest + nod × gain, so the city holds
  // still through the lens. Past the knee it bends smoothly (a curve with
  // no kink and no wobble, like CSS's cubic-bezier easing, only fitted to
  // both ends) to reach straight up (180) at 90° of nod up, and straight
  // down (0) at 90° down. Beyond 90° it stays there.
  static func gazePitch(rest: Double, nod: Double, gain: Double) -> Double {
    let up = nod >= 0
    let end = up ? 180.0 : 0.0
    // Degrees of gaze left between rest and straight up (or down).
    let room = abs(end - rest)
    let slope = max(gain, 0)
    let head = min(abs(nod), fullNodDegrees)
    guard room > 0, slope > 0 else { return rest }
    // The knee comes early if a high gain would reach the end too soon.
    let knee = min(kneeDegrees, room / slope / 2)
    let turned: Double
    if head <= knee {
      turned = slope * head
    } else {
      turned = bend(
        at: (head - knee) / (fullNodDegrees - knee), from: slope * knee, to: room,
        slope: slope * (fullNodDegrees - knee))
    }
    return up ? rest + turned : rest - turned
  }

  // A curve from `start` to `end` as `t` goes from 0 to 1, leaving `start`
  // at `slope` (per unit of t) with no bend at first, and never turning
  // back (a monotone cubic Hermite spline).
  private static func bend(at t: Double, from start: Double, to end: Double, slope: Double)
    -> Double
  {
    let rise = end - start
    guard rise > 0 else { return end }
    var startSlope = slope
    // The end slope that keeps the curve straight as it leaves the knee.
    var endSlope = max(3 * rise - 2 * slope, 0)
    // Keeps it from overshooting and turning back (Fritsch–Carlson).
    let size = hypot(startSlope / rise, endSlope / rise)
    if size > 3 {
      startSlope *= 3 / size
      endSlope *= 3 / size
    }
    let t2 = t * t
    let t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * start + (t3 - 2 * t2 + t) * startSlope
      + (-2 * t3 + 3 * t2) * end + (t3 - t2) * endSlope
  }

  // The coordinate `offset` meters (east, north) from `origin`. Uses the
  // Earth's curvature at `origin` (WGS84), the same measure MapKit's
  // MKMapCamera(lookingAtCenter:fromEyeCoordinate:eyeAltitude:) uses
  // (checked to the millimeter at 1 km). Fine for the few kilometers a
  // diorama spans.
  static func coordinate(at offset: simd_double2, from origin: CLLocationCoordinate2D)
    -> CLLocationCoordinate2D
  {
    let meters = metersPerDegree(atLatitude: origin.latitude)
    return CLLocationCoordinate2D(
      latitude: origin.latitude + offset.y / meters.north,
      longitude: origin.longitude + offset.x / meters.east
    )
  }

  // The reverse: how many meters (east, north) `coordinate` is from `origin`.
  static func offset(of coordinate: CLLocationCoordinate2D, from origin: CLLocationCoordinate2D)
    -> simd_double2
  {
    let meters = metersPerDegree(atLatitude: origin.latitude)
    return simd_double2(
      (coordinate.longitude - origin.longitude) * meters.east,
      (coordinate.latitude - origin.latitude) * meters.north
    )
  }

  // Meters per degree of latitude (north) and longitude (east) at a
  // latitude, on the WGS84 ellipsoid.
  private static func metersPerDegree(atLatitude latitude: Double) -> (north: Double, east: Double) {
    let equatorRadius = 6_378_137.0
    let eccentricitySquared = 0.006_694_379_990_14
    let phi = latitude * .pi / 180
    let w = 1 - eccentricitySquared * sin(phi) * sin(phi)
    let northRadius = equatorRadius * (1 - eccentricitySquared) / pow(w, 1.5)
    let eastRadius = equatorRadius / sqrt(w) * cos(phi)
    return (northRadius * .pi / 180, eastRadius * .pi / 180)
  }
}

// MARK: - Camera helpers

extension CameraPose {
  // Straight down (0) to MapKit's steepest pitch, the same range makeCamera()
  // allows. MapKit may cap it lower still, depending on how far out the
  // camera is; StereoRig asks MapKit where (see `steepestPitch(from:)`).
  // The eyes can look past it (see StereoGeometry); MapKit's camera can't.
  static let pitchRange = 0.0...85.0

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

extension FirstPersonCamera.Gaze {
  // True when `other` differs by less than `degrees` in heading and pitch.
  func isWithin(_ degrees: Double, of other: FirstPersonCamera.Gaze) -> Bool {
    abs(HeadPose.wrapDegrees(heading - other.heading)) < degrees && abs(pitch - other.pitch) < degrees
  }
}
