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
//   In live mode (T40, `Glide` below) it glides along as you walk or ride,
//   and everything here moves with it.
// - Vantage point: where your eyes are. It is the starting camera's own
//   position: `altitude` meters (camera-to-center distance) back from the
//   model center, `pitch` degrees from straight down, facing `heading`. It
//   stays put while you look around. New camera props (another city,
//   another framing, another Camera height) are a new place to stand, so
//   they move it; recentering doesn't (it only makes wherever you face now
//   "straight ahead" again). A pinch does (T37, see `Dolly` below): it
//   slides it along the gaze, toward or away from the aim point, and the
//   slide is kept as `shift`. So does leaning in (T46, see `lean` below):
//   the head's real move, scaled to the city, kept as `lean`. From far out
//   MapKit won't draw a city's own pitch, so DioramaMapView hands in the
//   starting camera at the steepest pitch MapKit draws there (see
//   `firstPersonCamera(from:)`): a higher camera stands farther forward and
//   looks more straight down, with the model center still in the middle.
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
  // How far pinches have moved the vantage point from the starting
  // camera's position, in meters (east, north, up). Zero until you zoom.
  let shift: simd_double3
  // How far leaning moves it on top of that (T46), in meters (east, north,
  // up): the head's real move since recenter, scaled to the city (see
  // `Lean`). Zero without head position.
  let lean: simd_double3
  // The vantage point, in meters from the model center (east, north, up).
  let eye: simd_double3

  init(base: CameraPose, shift: simd_double3 = .zero, lean: simd_double3 = .zero) {
    self.base = base
    self.shift = shift
    self.lean = lean
    let axes = CameraAxes(heading: base.heading, pitch: base.pitch, roll: 0)
    eye = -base.altitude * axes.forward + shift + lean
  }

  // The same camera with the head moved by `lean` (meters east, north, up).
  func leaning(by lean: simd_double3) -> FirstPersonCamera {
    FirstPersonCamera(base: base, shift: shift, lean: lean)
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

// MARK: - Pinch to zoom (T37)

// Zooming moves where you stand, not the picture: a pinch slides the
// vantage point along a straight line toward the aim point (spreading the
// fingers) or away from it (pinching them together), the way Apple Maps
// zooms into whatever is in the middle of the screen. The aim point stays
// where it is on the ground and the gaze doesn't turn, so whatever is in
// the middle of the view stays there and grows or shrinks.
//
// The line is the gaze, toward the ground in the middle of the view, even
// where MapKit leaves that in haze (from far out MapKit won't tilt up that
// far; see DioramaMapView): moving nearer brings the city back, and
// pinching in and out along one line undo each other exactly. Only a gaze
// near the horizon, which meets the ground far off, or above it, which
// never does, slides along the line `Dolly.maxPitch` under it instead
// (15° below the horizon, where MapKit's farthest city usually is): toward
// the ground a few heights ahead, below the middle of the view. The gaze
// still doesn't turn, and nothing jumps as it crosses that line.
//
// The distance to the aim point stays within a range (300 m to 5 km, like
// the Camera height setting; DioramaMapView also stops a pinch backing
// away where MapKit would stop drawing the middle of the view). Past
// either end the pinch gives way less and less, like a scroll view pulled
// past its end, and springs back once the fingers lift. A pinch that starts outside the range (say you zoomed in
// close, then looked straight down) doesn't jump into it: the range widens
// to take in where it starts.
extension FirstPersonCamera {
  // One pinch: the line the vantage point slides along. Like a plain JS
  // object of numbers plus a few pure functions; DioramaMapView keeps the
  // state (how far along the line you are).
  struct Dolly {
    // UIScrollView's rubber-band constant: just past an end, the distance
    // moves 0.55 times as far as the fingers ask, then less and less.
    static let resistance = 0.55
    // The farthest past an end a pinch can stretch: 25% nearer or farther.
    static let maxStretch = log(1.25)
    // How quickly a stretch springs back once the fingers lift: the gap
    // shrinks e-fold every this many seconds (gone in about 0.4 s), with no
    // overshoot.
    static let settleSeconds = 0.08
    // The shallowest line a pinch slides along, in degrees from straight
    // down: 15° below the horizon, whose ground is 3.9 heights ahead.
    static let maxPitch = 75.0

    // The point zoomed toward, in meters from the model center (on the ground).
    let aim: simd_double3
    // The way from the vantage point to the aim point (unit length).
    let direction: simd_double3
    // Meters from the vantage point to the aim point as the pinch began.
    let startDistance: Double
    // Where the vantage point is with no zoom at all (a zero shift), leaning
    // as it was when the pinch began.
    let origin: simd_double3
    // The meters to the aim point the pinch may come to rest at.
    let range: ClosedRange<Double>

    // The line's pitch, in degrees from straight down.
    var pitch: Double {
      acos(min(max(-direction.z, -1), 1)) * 180 / .pi
    }

    // The same line, going back no farther than `farthest` meters from the
    // aim point (but never nearer than where it started).
    func limited(to farthest: Double) -> Dolly {
      let upper = max(min(range.upperBound, farthest), range.lowerBound, startDistance)
      return Dolly(
        aim: aim, direction: direction, startDistance: startDistance, origin: origin,
        range: range.lowerBound...upper)
    }

    // Meters to the aim point for a pinch `scale` (finger spread ÷ spread
    // as the pinch began): 2 is half as far, 0.5 twice as far, with the
    // rubber band past either end of `range`.
    func distance(forScale scale: Double) -> Double {
      let pinch = scale.isFinite && scale > 0 ? scale : 1
      // In logarithms, so a stretch feels the same near and far.
      let wanted = log(startDistance / pinch)
      return exp(Self.rubberBand(wanted, within: log(range.lowerBound)...log(range.upperBound)))
    }

    // The vantage point's shift (see FirstPersonCamera.shift) at `distance`
    // meters from the aim point.
    func shift(atDistance distance: Double) -> simd_double3 {
      aim - distance * direction - origin
    }

    // Where a stretched pinch comes to rest: back inside `range`.
    func restingDistance(from distance: Double) -> Double {
      min(max(distance, range.lowerBound), range.upperBound)
    }

    // One frame of springing back: `distance` after `seconds` more of
    // easing toward `target`. Exactly `target` once within 0.1% of it.
    static func settle(_ distance: Double, toward target: Double, seconds: Double) -> Double {
      let gap = log(distance / target) * exp(-max(seconds, 0) / settleSeconds)
      return abs(gap) < 0.001 ? target : target * exp(gap)
    }

    // `value` if it's within `range`; past it, only part of the way past
    // (UIScrollView's formula), and never more than `maxStretch`.
    static func rubberBand(_ value: Double, within range: ClosedRange<Double>) -> Double {
      func give(_ overshoot: Double) -> Double {
        (1 - 1 / (overshoot * resistance / maxStretch + 1)) * maxStretch
      }
      if value > range.upperBound { return range.upperBound + give(value - range.upperBound) }
      if value < range.lowerBound { return range.lowerBound - give(range.lowerBound - value) }
      return value
    }
  }

  // A pinch from here along `gaze` (at most `Dolly.maxPitch` from straight
  // down; see above), keeping the distance to its aim point within `range`
  // meters, widened to take in the distance it starts at.
  func dolly(along gaze: Gaze, range: ClosedRange<Double>) -> Dolly {
    let line = Gaze(heading: gaze.heading, pitch: min(max(gaze.pitch, 0), Dolly.maxPitch))
    let direction = CameraAxes(heading: line.heading, pitch: line.pitch, roll: 0).forward
    let distance = reach(for: line)
    return Dolly(
      aim: eye + distance * direction,
      direction: direction,
      startDistance: distance,
      origin: eye - shift,
      range: min(range.lowerBound, distance)...max(range.upperBound, distance))
  }
}

// MARK: - Leaning in (T46)

// Leaning moves where you stand, like a pinch, only by the head's real move
// (HeadPosition, from ARKit): lean down and you sink toward the city, lean
// forward or sideways and you move out over it, the way you would over a
// real tabletop model; the city shifts against itself as you move (motion
// parallax). The gaze doesn't change: that stays with the head's turn.
//
// Scale: the stereo eyes stand `baseline` meters apart in the city (see
// StereoGeometry.baseline) and about 6.4 cm apart in your head, which is
// what makes the city read as one small model. Moving the head by one eye
// spacing moves you by one baseline, so the model stays that size: one real
// meter is baseline ÷ 0.064 meters of city (375 m from 1.2 km out), times
// the `leanGain` prop. The baseline comes from where you stand without the
// lean, so it doesn't change while you lean (the model would shrink as you
// sink toward it otherwise).
//
// Directions: right and forward are the base camera's (the view with the
// head straight ahead at recenter), level with the ground; up is up.
//
// Limits, with the pinch's rubber band (`Dolly.rubberBand`), so you slow to
// a stop rather than hit one, and never go more than a quarter past:
// - Down and up: the distance to the ground straight ahead, along the
//   resting gaze (no shallower than `Dolly.maxPitch`), stays within the
//   pinch's range (300 m to 5 km), widened to take in where you stand.
//   Leaning up also stops where MapKit stops drawing the middle of the view
//   (DioramaMapView finds that as you go and hands in a lower range).
// - Out over the city: no farther than the camera's distance from the model
//   center.
extension FirstPersonCamera {
  // Meters between a viewer's own eyes (a typical adult's).
  static let eyeSpacing = 0.064

  // Meters of city per real meter the head moves, for eyes `baseline`
  // meters apart, times `gain` (the `leanGain` prop).
  static func leanScale(baseline: Double, gain: Double) -> Double {
    max(baseline, 0) / eyeSpacing * max(gain, 0)
  }

  // Meters along the resting gaze per meter of height: how far the ground
  // straight ahead is, per meter you stand above it.
  var leanSlant: Double {
    1 / cos(min(max(base.pitch, 0), Dolly.maxPitch) * .pi / 180)
  }

  // Where a head `move` (meters right, up and forward since recenter) puts
  // you, `scale` meters of city per meter (`leanScale`), as meters (east,
  // north, up) from where you stand now (call it on the camera without a
  // lean). Up and down stay within `range` (meters to the ground ahead
  // along the resting gaze), and out over the city within the camera's
  // distance from the model center; see the limits above.
  func lean(for move: simd_double3, scale: Double, range: ClosedRange<Double>) -> simd_double3 {
    guard scale > 0, move != .zero else { return .zero }
    // Out over the city.
    let heading = base.heading * .pi / 180
    let right = simd_double2(cos(heading), -sin(heading))
    let forward = simd_double2(sin(heading), cos(heading))
    var across = scale * (move.x * right + move.z * forward)
    let spread = simd_length(across)
    if spread > 0 {
      let farthest = log(max(base.altitude, 1))
      across *= exp(Dolly.rubberBand(log(spread), within: -Double.infinity...farthest)) / spread
    }
    // Down and up.
    let height = max(eyeHeight, 1)
    let slant = leanSlant
    let start = height * slant
    let lower = min(max(range.lowerBound, 1), start)
    let upper = max(range.upperBound, start)
    let wanted = max(height + scale * move.y, 1) * slant
    let distance = exp(Dolly.rubberBand(log(wanted), within: log(lower)...log(upper)))
    return simd_double3(across.x, across.y, distance / slant - height)
  }
}

// MARK: - Following your location (T40)

// Live location moves where you stand: each GPS fix JS sends (at most one a
// second) is a new spot for the model center, and the center glides there
// rather than jumping. The glide is kept as an offset in meters (east,
// north) from the `center` prop; the vantage point, the aim point and any
// zoom (`shift`) are all measured from the model center, so they ride along
// with it, and the way you look never changes.
//
// Two layers, like a CSS transition feeding Reanimated's `withSpring`:
// - The target doesn't jump to a new fix. It slides there in a straight
//   line over as long as the fixes came apart (a "leg"), so while you walk
//   or ride at a steady pace it moves at that pace, with no stop between
//   fixes. (Springing straight to each fix instead, the city would lurch
//   ahead and stop once a fix: at 10 m/s it swung between 0.4 and 26 m/s.)
// - The center follows the target on a critically damped spring (about a
//   second, no bounce), which rounds off every start, stop and turn.
// Fixes further apart than `maxLegSeconds` (the first one, or after a
// pause) have no leg: the spring alone glides there, in about a second.
extension FirstPersonCamera {
  // One glide: where the center is now, how fast it's going, and the target
  // it follows, all in meters (east, north) from the `center` prop. Like a
  // plain JS object of numbers; DioramaMapView keeps it and steps it once
  // per frame.
  struct Glide {
    // Seconds the spring takes to all but arrive (within 1% of the way).
    static let seconds = 1.0
    // Under Reduce Motion: no legs, and a very quick spring.
    static let reducedMotionSeconds = 0.25
    // The longest leg: slow walking (5 m in 4 s). Fixes further apart than
    // this are a fresh start (the spring alone glides there).
    static let maxLegSeconds = 4.0
    // Nearer than this (meters, and meters a second) counts as there.
    static let restMeters = 0.01
    // (1 + x)·e^(−x) = 1% at x ≈ 6.64: a spring with no bounce covers 99%
    // of the way in `6.64 ÷ stiffness` seconds (see `step`).
    private static let settleRatio = 6.64

    // A straight slide of the target from one spot to the next.
    private struct Leg {
      var from: simd_double2
      var to: simd_double2
      var seconds: Double
      var elapsed = 0.0
    }

    private(set) var offset = simd_double2.zero
    private(set) var velocity = simd_double2.zero
    // The spot the spring pulls toward (sliding along `leg`, if any).
    private(set) var target = simd_double2.zero
    private var leg: Leg?
    // When the last fix came (seconds on the display's clock).
    private var lastFixAt: Double?

    // True until the center has come to rest at the latest spot.
    var isMoving: Bool { leg != nil || offset != target || velocity != .zero }

    // A new fix, `spot`, at time `now` (seconds). `smooth` false (Reduce
    // Motion) skips the leg: the spring alone takes it there.
    mutating func head(to spot: simd_double2, at now: Double, smooth: Bool) {
      let since = lastFixAt.map { now - $0 } ?? .infinity
      lastFixAt = now
      if smooth, since <= Self.maxLegSeconds, spot != target {
        leg = Leg(from: target, to: spot, seconds: max(since, 0.05))
      } else {
        leg = nil
        target = spot
      }
    }

    // One frame, `seconds` long: slide the target along its leg, then one
    // step of a critically damped spring toward it: the fastest way to
    // arrive with no overshoot, and a change of target keeps the speed it
    // has, so nothing jerks. Exact for any frame length (the closed-form
    // solution, not a small-step estimate), so a dropped frame just catches
    // up. `settleSeconds`: `seconds` above, or `reducedMotionSeconds`.
    mutating func step(seconds: Double, settleSeconds: Double) {
      guard isMoving else { return }
      let t = max(seconds, 0)
      if var leg {
        leg.elapsed += t
        let share = min(leg.elapsed / leg.seconds, 1)
        target = leg.from + (leg.to - leg.from) * share
        self.leg = share < 1 ? leg : nil
      }
      let stiffness = Self.settleRatio / max(settleSeconds, 0.01)
      let gap = offset - target
      let drift = velocity + stiffness * gap
      let decay = exp(-stiffness * t)
      let nextGap = (gap + drift * t) * decay
      velocity = (velocity - stiffness * drift * t) * decay
      offset = target + nextGap
      if leg == nil, simd_length(nextGap) < Self.restMeters,
        simd_length(velocity) < Self.restMeters
      {
        arrive()
      }
    }

    // Straight to the latest spot, with no glide (nothing on screen to
    // glide, or the map is reloading behind its cover).
    mutating func arrive() {
      if let leg { target = leg.to }
      leg = nil
      offset = target
      velocity = .zero
    }
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
