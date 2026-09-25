import ExpoModulesCore
import MapKit
import UIKit
import simd

// The `mapStyle` prop (T64): how the map looks. Like a TS string union,
// 'satellite' | 'hybrid' | 'standard'. Every style keeps MapKit's realistic
// elevation, so terrain and 3D buildings stay, and the same pitch caps
// (measured on iOS 27: identical in all three).
enum MapStyle: String, Enumerable {
  // Photoreal 3D imagery (Flyover) with nothing on top. The default.
  case satellite
  // The same imagery with street, district and city names ("Satellite with
  // labels").
  case hybrid
  // Apple Maps' drawn map: roads, parks, water, names and place icons, with
  // MapKit's own 3D building models; light or dark with the phone.
  case standard
}

// Everything about how the map looks, in one value: the style (T64) and
// live traffic (T63). Like a small props object `{ style, showsTraffic }`,
// handed to each eye whole, so a change swaps the map's configuration once.
struct MapLook: Equatable {
  var style = MapStyle.satellite
  // Apple Maps' live traffic (T63): green, orange and red lines along the
  // roads, where Apple has traffic data. MapKit draws it only on the hybrid
  // and standard maps; the imagery map has none, so the TS wrapper sends
  // `hybrid` rather than `satellite` while traffic is on, and here it's
  // ignored for `satellite`.
  var showsTraffic = false

  // MapKit's configuration for this look: a fresh one each time, like a
  // new props object, since a map keeps the one it's given. `round`: for a
  // stereo eye (see `pointsOfInterest`).
  func makeConfiguration(round: Bool) -> MKMapConfiguration {
    switch style {
    case .satellite:
      // The best MapKit offers on every iOS from 16.4 through 27 (T34): the
      // iOS 27 SDK adds no map configuration, elevation style or quality
      // setting, and apps can't ask for Apple's new iOS 27 Flyover (the
      // Gaussian-splat cities); MapKit still draws the classic 3D mesh in
      // apps. If a later SDK adds a way, it goes here behind `if #available`.
      // See OVERVIEW.md's research table.
      return MKImageryMapConfiguration(elevationStyle: .realistic)
    case .hybrid:
      let configuration = MKHybridMapConfiguration(elevationStyle: .realistic)
      configuration.pointOfInterestFilter = pointsOfInterest(round: round)
      configuration.showsTraffic = showsTraffic
      return configuration
    case .standard:
      let configuration = MKStandardMapConfiguration(
        elevationStyle: .realistic, emphasisStyle: .default)
      configuration.pointOfInterestFilter = pointsOfInterest(round: round)
      configuration.showsTraffic = showsTraffic
      return configuration
    }
  }

  // Which place icons (and their names) the map shows: Apple Maps' own on
  // the standard map held upright, none on the imagery, and none in a
  // stereo eye. Each eye's map places its own labels, and in the headset
  // some place names showed in one eye only, which the eyes can't fuse
  // (Boston, iOS 27: in 3 of 4 views after looking around; the muted
  // emphasis style or a short list of categories didn't fix it). Street and
  // district names come out the same in both eyes, so they stay, and so
  // does traffic (drawn on the roads themselves).
  func pointsOfInterest(round: Bool) -> MKPointOfInterestFilter {
    showsPlaceIcons(round: round) ? .includingAll : .excludingAll
  }

  func showsPlaceIcons(round: Bool) -> Bool {
    style == .standard && !round
  }
}

// One eye's picture. Mono shows one EyeView filling the component; stereo
// shows two round ones, one per headset lens (see StereoRig). Think of it as
// a small component with this tree:
//
//   EyeView         clips to its frame, like `overflow: hidden`, and when
//   │               `isRound` to the circle inside it (`border-radius: 50%`)
//   ├─ sky          haze and sky where MapKit drew nothing, shown only when
//   │               looking higher than MapKit draws (T31, SkyBackdrop)
//   ├─ warpView     shows its content turned (and in stereo slightly warped
//   │  │            and shrunk) so this eye sees what it should; see
//   │  │            StereoGeometry and `pictureScale`
//   │  ├─ mapView   Apple's map, usually larger than the eye (see `mapSize`)
//   │  └─ hazeEdge  fades the map's top edge into the haze (T31)
//   └─ overlay      optional, on top and not turned (T09: tilt-shift)
final class EyeView: UIView {
  let mapView = MKMapView()
  // Each eye is turned on its own: turning the pair as one would move one
  // eye up and the other down, and the two pictures would no longer line up.
  private let warpView = WarpView()
  private let sky = SkyBackdrop()
  private let hazeEdge = HazeEdge()

  // Degrees past MapKit's pitch cap over which the haze edge fades in:
  // done before the map's top edge (a few points outside the circle at the
  // cap) comes into view.
  private static let hazeEdgeFadeIn = 0.5
  // Points (in the eye) kept between a round eye's edge and MapKit's logo
  // or Legal link, as StereoRig does.
  private static let attributionPadding = 2.0
  // Half the smallest box (map points) left between the map's margins when
  // MapKit's logo and Legal link are lifted (see `attributionLift`). MapKit
  // hides its logo when that box is under 100 points tall or about 110 to
  // 135 wide (measured, iOS 26).
  private static let minAttributionBox = CGSize(width: 70, height: 52)
  // The middle of MapKit's logo and Legal link, in map points from the
  // bottom-left corner of the map's layout margins: this far in (x) and up
  // (y). iOS 26 sets them side by side there (measured). This is the point
  // each stereo eye puts exactly where the middle eye sees it (see
  // `stereoNudge`), so the logo and Legal, on either side of it, are off
  // by as little as can be.
  private static let attributionMiddle = simd_double2(57, 15)
  // Margin changes smaller than this (map points) are skipped, so a moving
  // head doesn't re-lay out MapKit's logo every frame for nothing. A
  // stereo eye's picture is about half size, so that's under 0.15 points
  // on screen.
  private static let minMarginChange: CGFloat = 0.25

  // The map's size. Larger than the eye whenever the map is turned, so
  // turning it never shows a corner.
  var mapSize: CGSize = .zero {
    didSet { if mapSize != oldValue { setNeedsLayout() } }
  }

  // How the map's picture is turned and warped onto the eye, about its
  // center. Identity = drawn as is. Set every frame by StereoRig (`show`).
  private var pictureTransform = CATransform3DIdentity {
    didSet { updateWarp() }
  }

  // How much the warped picture is then shrunk to fit the eye: 1 = not at
  // all (mono). A stereo eye's map is drawn larger than its window and
  // shrunk into it; see StereoRig.pictureScale.
  var pictureScale: CGFloat = 1 {
    didSet {
      guard pictureScale != oldValue else { return }
      updateWarp()
      setNeedsLayout()
    }
  }

  // The camera last handed to this eye's map, so an unchanged camera isn't
  // set again (a head roll alone only changes the transform), and so it can
  // be put back after a resize (see layoutSubviews).
  var appliedCamera: CameraPose?

  // T09 attaches this eye's miniature (tilt-shift) overlay here. It sits on
  // top of the map, fills the eye and stays level with the screen.
  var overlay: UIView? {
    didSet {
      guard overlay !== oldValue else { return }
      oldValue?.removeFromSuperview()
      if let overlay {
        overlay.isUserInteractionEnabled = false
        addSubview(overlay)
      }
      setNeedsLayout()
    }
  }

  // Round: shows only the circle that fills this (square) eye, black
  // outside it, like the round lens holes of a headset. Stereo eyes are
  // round; mono is not.
  var isRound = false {
    didSet {
      guard isRound != oldValue else { return }
      setNeedsLayout()
      // A round eye's map leaves out place icons (see MapLook).
      if mapLook.showsPlaceIcons(round: isRound) != mapLook.showsPlaceIcons(round: oldValue) {
        applyMapLook()
      }
    }
  }

  // Room MapKit's logo and Legal link keep from this eye's edges, in this
  // eye's points, so they stay clear of the screen's rounded corners (mono)
  // or inside the circle (round). Width: each side; height: the bottom.
  var attributionInsets: CGSize = .zero {
    didSet { if attributionInsets != oldValue { setNeedsLayout() } }
  }

  // The map's layout margins with the picture in place (see layoutMap), in
  // map points: each side, and top and bottom. And how far they're moved
  // from there (see `marginShift`): while you look past MapKit's cap, to
  // keep MapKit's logo and Legal link in view, and in stereo, to put them
  // in the same spot in both eyes.
  private var restMargins = CGSize.zero
  private var appliedShift = CGSize.zero

  // Set by StereoRig once MapKit has drawn this eye's first full picture,
  // and the pending "call it drawn anyway" timer if some tiles failed.
  var hasRendered = false
  var renderFallback: DispatchWorkItem?

  // How the map looks (T64 style, T63 traffic). Switching keeps the camera
  // where it is.
  var mapLook: MapLook {
    didSet { if mapLook != oldValue { applyMapLook() } }
  }

  // A still of this eye's map as it was, held over the live map while a new
  // map look loads (T64), so the switch is a crossfade rather than a flash
  // of MapKit's empty loading grid. See `holdPicture()`.
  private var heldPicture: UIView?
  private static let releaseSeconds = 0.3

  init(mapLook: MapLook = MapLook(), isRound: Bool = false) {
    self.mapLook = mapLook
    self.isRound = isRound
    super.init(frame: .zero)
    clipsToBounds = true
    // With `clipsToBounds`, a corner radius of half the side clips this view
    // and everything in it (the map, the tilt-shift overlay) to a circle.
    // `.circular` makes it a true circle rather than iOS's smoother
    // "squircle" corner.
    layer.cornerCurve = .circular
    isUserInteractionEnabled = false
    configureMap()
    sky.isHidden = true
    addSubview(sky)
    warpView.addSubview(mapView)
    hazeEdge.alpha = 0
    warpView.addSubview(hazeEdge)
    addSubview(warpView)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  // The map in `mapLook` (see MapLook), with no compass or scale, and no
  // gestures (touches fall through to React Native).
  private func configureMap() {
    mapView.preferredConfiguration = mapLook.makeConfiguration(round: isRound)
    mapView.pointOfInterestFilter = mapLook.pointsOfInterest(round: isRound)
    mapView.showsCompass = false
    mapView.showsScale = false
    mapView.showsUserLocation = false
    mapView.isZoomEnabled = false
    mapView.isScrollEnabled = false
    mapView.isRotateEnabled = false
    mapView.isPitchEnabled = false
    mapView.isUserInteractionEnabled = false
    // MapKit centers its camera between the map's layout margins, and by
    // default those include the safe area (notch, header, home indicator),
    // which differs per eye. Leave the safe area out; see layoutSubviews.
    mapView.insetsLayoutMarginsFromSafeArea = false
  }

  // A new look for the same view (T64, T63). MapKit swaps its tiles and may
  // move the camera to stand on the new map's ground, so the camera we
  // asked for goes straight back: the view doesn't jump. (StereoRig sets it
  // again once the new tiles are in; see DioramaMapView.eyesDidRender.)
  private func applyMapLook() {
    UIView.performWithoutAnimation {
      mapView.preferredConfiguration = mapLook.makeConfiguration(round: isRound)
      mapView.pointOfInterestFilter = mapLook.pointsOfInterest(round: isRound)
      if let camera = appliedCamera {
        mapView.setCamera(camera.makeCamera(), animated: false)
      }
    }
  }

  // Freezes the map's picture as it is now, until `releasePicture`. Only
  // the map's: the tilt-shift overlay on top stays live. Like a screenshot
  // laid over the map, but taken by iOS without copying pixels.
  func holdPicture() {
    guard heldPicture == nil, window != nil, warpView.alpha > 0,
      let still = warpView.snapshotView(afterScreenUpdates: false)
    else { return }
    still.frame = warpView.frame
    still.isUserInteractionEnabled = false
    insertSubview(still, aboveSubview: warpView)
    heldPicture = still
  }

  // Fades the held picture away to the live map beneath (at once when not
  // `animated`).
  func releasePicture(animated: Bool) {
    guard let still = heldPicture else { return }
    heldPicture = nil
    guard animated, window != nil else {
      still.removeFromSuperview()
      return
    }
    UIView.animate(
      withDuration: Self.releaseSeconds, delay: 0, options: [.curveEaseInOut],
      animations: { still.alpha = 0 },
      completion: { _ in still.removeFromSuperview() })
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // A resized MKMapView keeps its map scale (meters per point) by moving
    // its camera closer or farther, and if the resize is animated (UIKit
    // animates layout while the screen turns from portrait to landscape) it
    // does so when the animation ends, undoing any camera set meanwhile:
    // shrink a map from 933 to 618 points and it zooms in 1.5×. So resize
    // it at once, then put back the camera we asked for.
    UIView.performWithoutAnimation {
      layer.cornerRadius = isRound ? min(bounds.width, bounds.height) / 2 : 0
      layoutMap()
    }
  }

  // Shows this frame's `pose` (StereoGeometry.eyePose): the map warped into
  // place, and when looking higher than MapKit draws, the sky above it,
  // the map's top edge faded into the haze, MapKit's logo kept in view (and
  // in stereo, in the same spot in both eyes), and the tilt-shift bands
  // fading out as sky replaces city. Called every frame the camera moves.
  func show(_ pose: EyePose) {
    // Not even inside someone else's animation (a screen rotation).
    UIView.performWithoutAnimation {
      pictureTransform = pose.pictureTransform
      // Far out of view the map isn't drawn at all (see StereoGeometry).
      warpView.alpha = pose.showsMap ? 1 : 0
      hazeEdge.alpha = CGFloat(min(max(pose.beyondCap / Self.hazeEdgeFadeIn, 0), 1))
      // The haze the map's top edge fades into: the sky's color just there.
      hazeEdge.elevation = pose.camera.pitch + StereoGeometry.verticalFieldOfView / 2 - 90
      let shift = marginShift(for: pose)
      let moved = abs(shift.width - appliedShift.width) >= Self.minMarginChange
        || abs(shift.height - appliedShift.height) >= Self.minMarginChange
      if moved || (shift == .zero) != (appliedShift == .zero) {
        appliedShift = shift
        applyMargins()
      }
      // Below MapKit's cap the map covers the whole eye, so the sky costs
      // nothing until you look past it.
      sky.isHidden = pose.beyondCap <= 0 && pose.showsMap
      if !sky.isHidden {
        sky.show(look: pose.look, focal: pose.focal, slide: pose.slide, scale: pictureScale)
      }
      (overlay as? MiniatureOverlay)?.mapShare = mapShare(of: pose)
    }
  }

  // Roughly how much of this eye the map fills, 0...1: 1 while it covers the
  // eye, easing to 0 as its top edge slides down past the eye's bottom.
  private func mapShare(of pose: EyePose) -> CGFloat {
    guard pose.showsMap else { return 0 }
    guard pose.beyondCap > 0 else { return 1 }
    let size = mapSize == .zero ? bounds.size : mapSize
    let halfWidth = Double(size.width) / 2
    let halfHeight = Double(size.height) / 2
    // The map's top corners and bottom middle, in the eye's picture (map
    // points from the eye's center, before the shrink).
    func place(_ x: Double, _ y: Double) -> simd_double2 {
      let point = pose.picture * simd_double3(x, y, 1)
      return simd_double2(point.x, point.y) / point.z
    }
    let left = place(-halfWidth, -halfHeight)
    let right = place(halfWidth, -halfHeight)
    let bottom = place(0, halfHeight)
    // How far the eye's center is below the top edge (toward the map), in
    // eye radii.
    let edge = right - left
    guard simd_length(edge) > 0 else { return 1 }
    var normal = simd_normalize(simd_double2(-edge.y, edge.x))
    if simd_dot(bottom - left, normal) < 0 { normal = -normal }
    let radius = Double(min(bounds.width, bounds.height)) / 2 / Double(max(pictureScale, 0.01))
    guard radius > 0 else { return 1 }
    let depth = simd_dot(-left, normal) / radius
    // Smoothstep from the edge at the eye's bottom (0) to its top (1).
    let t = min(max((depth + 1) / 2, 0), 1)
    return CGFloat(t * t * (3 - 2 * t))
  }

  // How far to move the map's margins from where they rest for `pose` (map
  // points: each side, and top and bottom), which moves MapKit's logo and
  // Legal link: the lift past MapKit's cap, and in stereo a nudge so they
  // sit in the same spot in both eyes. Zero at rest in mono.
  private func marginShift(for pose: EyePose) -> CGSize {
    let lift = attributionLift(for: pose)
    guard pose.side != 0, pose.showsMap, let nudge = stereoNudge(for: pose, lift: lift) else {
      return lift
    }
    // The margins' bottom-left corner moves with the text: right means
    // wider side margins, down means narrower top and bottom ones. Kept
    // within what MapKit shows its logo in (see `minAttributionBox`).
    let size = mapSize == .zero ? bounds.size : mapSize
    let widest = max(size.width / 2 - Self.minAttributionBox.width, 0)
    let tallest = max(size.height / 2 - Self.minAttributionBox.height, 0)
    let side = min(max(restMargins.width + lift.width + CGFloat(nudge.x), 0), widest)
    let end = min(max(restMargins.height + lift.height - CGFloat(nudge.y), 0), tallest)
    return CGSize(width: side - restMargins.width, height: end - restMargins.height)
  }

  // Stereo only: how far (map points, y down) to move MapKit's logo and
  // Legal link on this eye's map so that this eye's own warp puts them
  // exactly where the middle eye (see EyePose.middlePicture) sees them with
  // the margins moved by `lift`. Both eyes do this, so the two copies land
  // in the same spot in their windows and are seen as one, at the depth of
  // the window's rim, like a label on the window. Without it each eye's
  // toe-in and zero-parallax slide would move the flat text a little
  // differently (measured about 1 point apart at rest, 5 looking well
  // down), and it read double. What margins can't undo: MapKit's toed-in
  // cameras never roll, so each eye's picture, text included, is turned a
  // little differently, about 1° apart at rest and more as you look
  // straight down. The logo and Legal, either side of the matched middle,
  // are then about 0.2 points apart at rest, and over 1 point only within
  // about 15° of straight down. Nil when there's no such spot (the text
  // behind the eye).
  private func stereoNudge(for pose: EyePose, lift: CGSize) -> simd_double2? {
    let size = mapSize == .zero ? bounds.size : mapSize
    // The text's middle on the middle eye's map (from the map's center),
    // where the middle eye sees it, and the point of this eye's map that
    // this eye's warp puts there.
    let middle = simd_double2(
      -Double(size.width) / 2 + Double(restMargins.width + lift.width) + Self.attributionMiddle.x,
      Double(size.height) / 2 - Double(restMargins.height + lift.height) - Self.attributionMiddle.y)
    let seen = pose.middlePicture * simd_double3(middle.x, middle.y, 1)
    let source = pose.picture.inverse * seen
    guard seen.z > 0, source.z > 0 else { return nil }
    return simd_double2(source.x, source.y) / source.z - middle
  }

  // Where MapKit's logo and Legal link go while you look past MapKit's cap:
  // how far to pull them in from each side and up (map points), zero
  // otherwise. The picture slides down the eye as you look up, and they sit
  // in its bottom corners, so they would slide out of the eye. MapKit puts
  // them in the bottom corners of the map's layout margins, so this grows
  // the margins, evenly top and bottom and left and right (uneven margins
  // would move MapKit's camera off the map's center): first up, then in
  // from the sides, just enough to keep both corners where they rest
  // (inside the circle, or on screen in mono). Once the city fills less
  // than about half the eye there's no room left, and they slide on out
  // with it. Worked out for the middle eye, so both eyes lift alike.
  private func attributionLift(for pose: EyePose) -> CGSize {
    guard pose.showsMap, pose.beyondCap > 0, bounds.width > 0 else { return .zero }
    let size = mapSize == .zero ? bounds.size : mapSize
    let halfWidth = Double(size.width) / 2
    let halfHeight = Double(size.height) / 2
    let scale = Double(max(pictureScale, 0.01))
    let angle = pose.roll * .pi / 180
    // True when both bottom corners of the margins sit where they may.
    func fits(_ lift: CGSize) -> Bool {
      let y = halfHeight - Double(restMargins.height + lift.height)
      let x = halfWidth - Double(restMargins.width + lift.width)
      for corner in [simd_double3(-x, y, 1), simd_double3(x, y, 1)] {
        let point = pose.middlePicture * corner
        guard point.z > 0 else { return false }
        let eye = simd_double2(point.x, point.y) / point.z * scale
        if isRound {
          let radius = Double(min(bounds.width, bounds.height)) / 2 - Self.attributionPadding
          if simd_length(eye) > radius + 0.5 { return false }
        } else {
          // Mono: on screen as at rest, measured with the head roll undone.
          let level = simd_double2(
            cos(angle) * eye.x - sin(angle) * eye.y, sin(angle) * eye.x + cos(angle) * eye.y)
          let limit = Double(bounds.height) / 2 - Double(attributionInsets.height)
          if level.y > limit + 0.5 { return false }
        }
      }
      return true
    }
    if fits(.zero) { return .zero }
    let box = Self.minAttributionBox
    let up = max(halfHeight - Double(restMargins.height) - Double(box.height), 0)
    let inward = max(halfWidth - Double(restMargins.width) - Double(box.width), 0)
    // Halves the gap between a lift that's too small and one that fits
    // (lifting more only ever helps).
    func search(_ make: (Double) -> CGSize, upTo most: Double) -> CGSize {
      var low = 0.0
      var high = most
      while high - low > 0.25 {
        let middle = (low + high) / 2
        if fits(make(middle)) { high = middle } else { low = middle }
      }
      return make(high)
    }
    if fits(CGSize(width: 0, height: up)) {
      return search({ CGSize(width: 0, height: $0) }, upTo: up)
    }
    return search({ CGSize(width: $0, height: up) }, upTo: inward)
  }

  // The map's layout margins: at rest, moved by `marginShift`.
  private func applyMargins() {
    let side = restMargins.width + appliedShift.width
    let end = restMargins.height + appliedShift.height
    mapView.layoutMargins = UIEdgeInsets(top: end, left: side, bottom: end, right: side)
  }

  // The warp, then the shrink (like CSS `transform: <warp> scale(s)` read
  // right to left).
  private func updateWarp() {
    let shrink = CATransform3DMakeScale(pictureScale, pictureScale, 1)
    warpView.pictureTransform = CATransform3DConcat(pictureTransform, shrink)
  }

  private func layoutMap() {
    let size = mapSize == .zero ? bounds.size : mapSize
    // `bounds` + `center` (not `frame`) stay valid while warpView is turned.
    warpView.bounds = CGRect(origin: .zero, size: size)
    warpView.center = CGPoint(x: bounds.midX, y: bounds.midY)
    // The sky: a square around the eye, big enough for any turn.
    let skySide = hypot(bounds.width, bounds.height)
    sky.bounds = CGRect(x: 0, y: 0, width: skySide, height: skySide)
    sky.center = CGPoint(x: bounds.midX, y: bounds.midY)
    hazeEdge.frame = CGRect(
      x: 0, y: 0, width: size.width, height: (size.height * HazeEdge.share).rounded())
    heldPicture?.frame = warpView.frame
    let oldMapSize = mapView.bounds.size
    mapView.frame = warpView.bounds
    if mapView.bounds.size != oldMapSize {
      mapView.layoutIfNeeded()  // MapKit takes in the new size now.
      if let camera = appliedCamera {
        mapView.setCamera(camera.makeCamera(), animated: false)
      }
    }
    // MapKit centers its camera between the layout margins and puts its logo
    // and Legal link inside them, in the bottom corners. Equal margins on
    // opposite sides keep the camera on the map's center, where the warp
    // expects it. Their size pulls the logo in to the part of the map this
    // eye shows (in map points: the eye's size before the shrink), plus
    // `attributionInsets` (so the top grows with the bottom).
    let scale = max(pictureScale, 0.01)
    restMargins = CGSize(
      width: max((size.width - bounds.width / scale) / 2, 0) + attributionInsets.width / scale,
      height: max((size.height - bounds.height / scale) / 2, 0) + attributionInsets.height / scale)
    applyMargins()
    overlay?.frame = bounds
  }
}

// Shows its content turned and warped by `pictureTransform`, without
// actually moving it. Like a live mirror: the real map stays where UIKit
// thinks it is (invisible), and the screen shows a warped copy of it drawn
// by Core Animation (a CAReplicatorLayer with one extra copy). Warping the
// map itself would work for turning, but under the slight perspective of a
// stereo warp MapKit lays out its logo and Legal link wrongly.
private final class WarpView: UIView {
  override class var layerClass: AnyClass { CAReplicatorLayer.self }

  // Never fails: `layerClass` above makes every WarpView's layer a replicator.
  private var replicator: CAReplicatorLayer {
    layer as! CAReplicatorLayer
  }

  // How the copy is turned and warped, about this view's center.
  var pictureTransform: CATransform3D {
    get { replicator.instanceTransform }
    set { replicator.instanceTransform = newValue }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    isUserInteractionEnabled = false
    // Two copies: the original, made fully transparent, and the warped one
    // (transparency 0 + 1 = fully opaque).
    replicator.instanceCount = 2
    replicator.instanceColor = UIColor(white: 1, alpha: 0).cgColor
    replicator.instanceAlphaOffset = 1
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }
}
