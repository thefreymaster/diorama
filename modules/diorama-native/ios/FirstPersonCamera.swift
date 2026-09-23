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
//   another framing) are a new place to stand, so they move it; recentering
//   doesn't (it only makes wherever you face now "straight ahead" again).
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
//     MapKit.
// Head look (HeadPose): +yaw = turned right, +pitch = looking up.
//
// Every frame:
//   gaze heading = base heading + head yaw × gain
//   gaze pitch   = base pitch + head pitch × gain, eased to a stop at the
//                  pitches MapKit will draw from here (see `gaze(for:)`)
//   aim point    = vantage point + (height ÷ cos(gaze pitch)) × gaze direction
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
// (about 55° for the default 42 mm-tall window 40 mm behind the lens). The picture is
// magnified perceived ÷ rendered times, so for the city to hold still the
// camera turns rendered ÷ perceived as far as the head:
//   gain = tracking sensitivity × rendered ÷ perceived
// (see ViewerProfile.lookGain). Head roll isn't scaled: turning a picture
// by an angle turns it by that same angle through a lens.
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

  // How many degrees of gaze pitch the soft stop at MapKit's steepest pitch
  // (and at straight down) eases over.
  static let pitchEasing = 5.0

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
  // the gain above). The pitch stays within `pitchLimits` (straight down up
  // to the steepest pitch MapKit will draw from here), easing to a stop over
  // the last few degrees instead of hitting a wall.
  func gaze(for look: HeadPose, gain: Double, pitchLimits: ClosedRange<Double>) -> Gaze {
    let pitch = Self.softLimit(
      base.pitch + look.pitch * gain, to: pitchLimits, rest: base.pitch, easing: Self.pitchEasing)
    return Gaze(heading: CameraPose.normalizedHeading(base.heading + look.yaw * gain), pitch: pitch)
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
  // without end toward the horizon (pitch 90), which the pitch limits keep
  // well clear of.
  func reach(for gaze: Gaze) -> Double {
    let descent = cos(min(max(gaze.pitch, 0), 89) * .pi / 180)
    return eyeHeight / descent
  }

  // MARK: - Helpers

  // `value` kept inside `limits`, easing in over the last `easing` degrees
  // at each end (like a rubber band that stiffens) so it slows to a stop
  // rather than stopping dead. The easing never starts before `rest` (the
  // starting pitch), so with the head still the result is exactly `rest`.
  // Past a limit it approaches that limit without ever reaching it.
  static func softLimit(
    _ value: Double, to limits: ClosedRange<Double>, rest: Double, easing: Double
  ) -> Double {
    let upperEasing = min(easing, max(limits.upperBound - rest, 0))
    let upperStart = limits.upperBound - upperEasing
    if value > upperStart {
      guard upperEasing > 0 else { return limits.upperBound }
      return limits.upperBound - upperEasing * exp(-(value - upperStart) / upperEasing)
    }
    let lowerEasing = min(easing, max(rest - limits.lowerBound, 0))
    let lowerStart = limits.lowerBound + lowerEasing
    if value < lowerStart {
      guard lowerEasing > 0 else { return limits.lowerBound }
      return limits.lowerBound + lowerEasing * exp(-(lowerStart - value) / lowerEasing)
    }
    return value
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
