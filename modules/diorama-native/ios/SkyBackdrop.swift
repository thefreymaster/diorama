import UIKit
import simd

// The sky behind one eye's map (T31). Like a small component whose only
// job is a background gradient: EyeView puts it behind the warped map and
// hands it, every frame, where the eye looks.
//
// Why it's needed: MapKit draws a 30°-tall slice that never reaches the
// horizon (it won't tilt past its pitch cap). When you look higher than
// that, each eye's warp turns the city picture on up (StereoGeometry), so
// the picture slides down the eye and leaves nothing above it. This fills
// that: haze from the top of MapKit's picture up to the true horizon, then
// sky clearing toward straight up (see SkyColors). The band between the
// picture and the horizon is made up (MapKit never draws that far), so
// it's plain haze, not distant city.
//
// Where it goes: the color depends only on how high a direction is above
// the horizon, so the gradient runs "up" in the eye's view, turned with
// head roll, through the point the eye looks at. That's exact along the
// middle of the eye and off by at most a degree or two at its edges, where
// the gradient is gentle. The sky is at infinity, so it gets each eye's
// zero-parallax slide (StereoGeometry) and sits just behind the far city
// in depth: the same in both eyes as seen through the lenses.
final class SkyBackdrop: UIView {
  override class var layerClass: AnyClass { CAGradientLayer.self }

  // Color stops along the gradient: enough for smooth steps of about 1°.
  private static let stopCount = 24

  // Never fails: `layerClass` above makes every SkyBackdrop's layer a gradient.
  private var gradient: CAGradientLayer {
    layer as! CAGradientLayer
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    backgroundColor = SkyColors.uiColor(elevation: 0)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  // Points the gradient for an eye looking along `look` (its axes), with a
  // `focal` length and a sideways `slide` in map points, shrunk by `scale`
  // into the eye (see EyeView.pictureScale). This view is a square centered
  // on the eye, so it covers the eye however far the head rolls.
  func show(look: CameraAxes, focal: Double, slide: Double, scale: CGFloat) {
    let side = Double(bounds.width) / Double(max(scale, 0.01))  // map points
    guard side > 0, focal > 0 else { return }
    // A point (x, y) of the eye's picture (map points from its center, y
    // down, before the slide) looks along x·right − y·up + focal·forward.
    // Its height above the horizon grows along `n`: the way "up" in the
    // world points in the picture.
    let n = simd_double2(look.right.z, -look.up.z)
    let steepness = simd_length(n)
    // Straight up or down the horizon is infinitely far off and every way
    // is "up": any direction will do, the colors come out symmetric.
    let direction = steepness > 1e-9 ? n / steepness : simd_double2(0, -1)
    // Along the line through the eye's slid center in `direction`, a point
    // `t` map points out looks at elevation asin((t·steepness +
    // focal·forward.z) ÷ √(t² + focal²)). Sample it across the square.
    let middle = -slide * direction.x  // `t` at the eye's center
    var colors: [CGColor] = []
    var locations: [NSNumber] = []
    colors.reserveCapacity(Self.stopCount)
    locations.reserveCapacity(Self.stopCount)
    for index in 0..<Self.stopCount {
      let share = Double(index) / Double(Self.stopCount - 1)
      let t = middle + (share - 0.5) * side
      let height = t * steepness + focal * look.forward.z
      let sine = height / (t * t + focal * focal).squareRoot()
      let elevation = asin(min(max(sine, -1), 1)) * 180 / .pi
      colors.append(SkyColors.cgColor(elevation: elevation))
      locations.append(NSNumber(value: share))
    }
    // Unit coordinates of the square (0...1, y down), from the side that
    // looks lowest to the side that looks highest.
    let start = CGPoint(x: 0.5 - 0.5 * direction.x, y: 0.5 - 0.5 * direction.y)
    let end = CGPoint(x: 0.5 + 0.5 * direction.x, y: 0.5 + 0.5 * direction.y)
    // A view's own layer doesn't animate these changes (only layers made
    // on their own do), so each frame shows exactly this frame's sky.
    gradient.startPoint = start
    gradient.endPoint = end
    gradient.colors = colors
    gradient.locations = locations
  }
}

// Fades the top edge of one eye's map into the haze, so no hard line shows
// where MapKit's picture ends (MapKit draws the city sharp right up to its
// edge: no haze or sky of its own to match). It lies on the map (inside
// the warp), so it moves with it; EyeView fades it in as you look past
// MapKit's cap, and says how high the edge is, for the haze's color there.
final class HazeEdge: UIView {
  override class var layerClass: AnyClass { CAGradientLayer.self }

  // The share of the map's height the fade covers (4.5° of MapKit's 30°
  // slice), from solid haze at the top edge to clear.
  static let share: CGFloat = 0.15

  // Degrees above the horizon (negative: below) that the map's top edge
  // looks at. The haze there is the color it fades into.
  var elevation = 0.0 {
    didSet { if abs(elevation - oldValue) > 0.05 { updateColors() } }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    guard let gradient = layer as? CAGradientLayer else { return }
    gradient.locations = Self.stops.map { NSNumber(value: $0) }
    gradient.startPoint = CGPoint(x: 0.5, y: 0)
    gradient.endPoint = CGPoint(x: 0.5, y: 1)
    updateColors()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  private static let stops = (0...8).map { Double($0) / 8 }

  // Solid at the top, clear at the bottom, easing in and out (a smoothstep
  // curve) so neither end of the fade shows as a line.
  private func updateColors() {
    let haze = SkyColors.uiColor(elevation: elevation)
    (layer as? CAGradientLayer)?.colors = Self.stops.map { stop -> CGColor in
      let t = 1 - stop
      return haze.withAlphaComponent(t * t * (3 - 2 * t)).cgColor
    }
  }
}

// The sky's colors by elevation (degrees above the horizon), like a small
// theme file. MapKit has no sky or haze of its own to match (it never draws
// up to the horizon, and draws its farthest city sharp and unfaded), so
// these are a plain daylight sky: haze that thickens toward the horizon,
// the way distant ground pales in real air, then clear blue overhead.
// Fixed, not light/dark: MapKit's photos don't change with dark mode either.
enum SkyColors {
  // Haze well below the horizon, where the band above MapKit's picture
  // starts (as low as 40° below from high up): grayer, close to the
  // city's own tones, so the city fades into it gently.
  static let lowHaze = simd_double3(0.62, 0.65, 0.68)
  // Right at the horizon: the palest.
  static let horizon = simd_double3(0.82, 0.86, 0.90)
  // Straight up.
  static let zenith = simd_double3(0.58, 0.74, 0.94)
  // Degrees below the horizon over which the haze pales from `lowHaze`.
  static let hazeDepth = 30.0
  // Degrees above the horizon over which the haze clears to `zenith`.
  static let clearing = 45.0

  static func color(elevation: Double) -> simd_double3 {
    if elevation <= 0 {
      let t = min(-elevation / hazeDepth, 1)
      return horizon + (lowHaze - horizon) * (t * t * (3 - 2 * t))
    }
    // Clears fast just above the horizon, then more and more slowly.
    let t = min(elevation / clearing, 1)
    let eased = 1 - (1 - t) * (1 - t)
    return horizon + (zenith - horizon) * eased
  }

  static func uiColor(elevation: Double) -> UIColor {
    let rgb = color(elevation: elevation)
    return UIColor(red: rgb.x, green: rgb.y, blue: rgb.z, alpha: 1)
  }

  static func cgColor(elevation: Double) -> CGColor {
    uiColor(elevation: elevation).cgColor
  }
}
