import MapKit
import UIKit

// One eye's picture. Mono shows one EyeView filling the component; stereo
// shows two, one per headset lens (see StereoRig). Think of it as a small
// component with this tree:
//
//   EyeView        clips to its frame, like `overflow: hidden`
//   ├─ warpView    shows its content turned (and in stereo slightly warped
//   │  │           and shrunk) so this eye sees what it should; see
//   │  │           StereoGeometry and `pictureScale`
//   │  └─ mapView  Apple's map, usually larger than the eye (see `mapSize`)
//   └─ overlay     optional, on top and not turned (T09: tilt-shift)
final class EyeView: UIView {
  let mapView = MKMapView()
  // Each eye is turned on its own: turning the pair as one would move one
  // eye up and the other down, and the two pictures would no longer line up.
  private let warpView = WarpView()

  // The map's size. Larger than the eye whenever the map is turned, so
  // turning it never shows a corner.
  var mapSize: CGSize = .zero {
    didSet { if mapSize != oldValue { setNeedsLayout() } }
  }

  // How the map's picture is turned and warped onto the eye, about its
  // center. Identity = drawn as is. Set every frame by StereoRig.
  var pictureTransform = CATransform3DIdentity {
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

  // Room MapKit's logo and Legal link keep from this eye's edges, so they
  // stay clear of the rounded corners.
  var attributionInsets: CGSize = .zero {
    didSet { if attributionInsets != oldValue { setNeedsLayout() } }
  }

  // Set by StereoRig once MapKit has drawn this eye's first full picture,
  // and the pending "call it drawn anyway" timer if some tiles failed.
  var hasRendered = false
  var renderFallback: DispatchWorkItem?

  init() {
    super.init(frame: .zero)
    clipsToBounds = true
    isUserInteractionEnabled = false
    configureMap()
    warpView.addSubview(mapView)
    addSubview(warpView)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  // Photoreal 3D imagery with nothing on top: no labels, POIs, compass or
  // scale, and no gestures (touches fall through to React Native).
  private func configureMap() {
    mapView.preferredConfiguration = MKImageryMapConfiguration(elevationStyle: .realistic)
    mapView.pointOfInterestFilter = .excludingAll
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

  override func layoutSubviews() {
    super.layoutSubviews()
    // A resized MKMapView keeps its map scale (meters per point) by moving
    // its camera closer or farther, and if the resize is animated (UIKit
    // animates layout while the screen turns from portrait to landscape) it
    // does so when the animation ends, undoing any camera set meanwhile:
    // shrink a map from 933 to 618 points and it zooms in 1.5×. So resize
    // it at once, then put back the camera we asked for.
    UIView.performWithoutAnimation {
      layoutMap()
    }
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
    let oldMapSize = mapView.bounds.size
    mapView.frame = warpView.bounds
    if mapView.bounds.size != oldMapSize {
      mapView.layoutIfNeeded()  // MapKit takes in the new size now.
      if let camera = appliedCamera {
        mapView.setCamera(camera.makeCamera(), animated: false)
      }
    }
    // MapKit centers its camera between the layout margins and puts its logo
    // and Legal link inside them. Equal margins on opposite sides keep the
    // camera on the map's center, where the warp expects it. Their size
    // pulls the logo in to the part of the map this eye shows (in map
    // points: the eye's size before the shrink).
    let scale = max(pictureScale, 0.01)
    let sideMargin = max((size.width - bounds.width / scale) / 2, 0) + attributionInsets.width / scale
    let endMargin = max((size.height - bounds.height / scale) / 2, 0) + attributionInsets.height / scale
    mapView.layoutMargins = UIEdgeInsets(
      top: endMargin, left: sideMargin, bottom: endMargin, right: sideMargin)
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
