import UIKit

// The miniature (tilt-shift) look for one eye, laid over that eye's map.
// Like a small component with this tree, stretched over the whole eye:
//
//   MiniatureOverlay
//   ├─ tint        a faint warm wash: sunnier, a little more colorful
//   ├─ topBand     blurs the top of the picture, fading out toward the middle
//   └─ bottomBand  the same for the bottom
//
// The sharp strip left in the middle is what a tilt-shift lens does to a
// photo of a real city, and a big part of why the city reads as a model.
// `intensity` (the `miniatureIntensity` prop, 0...1) makes the bands taller
// and the blur and tint stronger; 0 hides everything, so "off" costs nothing.
// It sits on the eye, not on the turned map, so the bands stay level with
// the screen whatever the head does, and both eyes get the exact same one.
// A round (stereo) eye clips it to its circle along with the map (see
// EyeView), so the bands blur the top and bottom of the circle and nothing
// spills into the black around it.
//
// Cost: a blur band makes the GPU copy what's under it and blur that copy
// on every frame the map moves, which is the expensive part. So each eye
// has just two bands (not a stack of progressively stronger ones), each
// only as tall as its band rather than the whole eye, and the blur is
// weakened by pausing a blur animation part way (see BlurBand), which adds
// no work per frame. The tint is one flat layer: no copy, no blur.
//
// Why a tint and not a real saturation filter: iOS has no public filter for
// live content. CALayer's `compositingFilter` blend modes are documented as
// unsupported on iOS (and the Simulator ignores them), and private CAFilter
// is not allowed on the App Store. A faint warm tint gives the mostly gray
// concrete some color instead.
final class MiniatureOverlay: UIView {
  // Each band's height as a share of the eye's height, at intensity 0 and 1.
  // At 0.6 the fully sharp strip is about a quarter of the eye.
  private static let bandHeight: ClosedRange<CGFloat> = 0.25...0.45
  // How far the blur animation is paused (BlurBand.strength), at intensity 0
  // and 1. Below ~0.2 the blur turns blocky, so weak settings fade the bands
  // out instead (see `update`).
  private static let blurStrength: ClosedRange<CGFloat> = 0.2...0.4
  // Intensities below this fade the bands in rather than blurring less.
  private static let fadeInBelow: CGFloat = 0.25
  // The tint: warm sunlight, at this opacity at intensity 1.
  private static let tintColor = UIColor(red: 1, green: 0.8, blue: 0.5, alpha: 1)
  private static let maxTintOpacity: CGFloat = 0.08

  private let tint = UIView()
  private let topBand = BlurBand(blurredEdge: .top)
  private let bottomBand = BlurBand(blurredEdge: .bottom)

  var intensity: Double {
    didSet { if intensity != oldValue { update() } }
  }

  init(intensity: Double) {
    self.intensity = intensity
    super.init(frame: .zero)
    isUserInteractionEnabled = false
    tint.backgroundColor = Self.tintColor
    addSubview(tint)
    addSubview(topBand)
    addSubview(bottomBand)
    update()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  // The intensity, kept in 0...1.
  private var amount: CGFloat { CGFloat(min(max(intensity, 0), 1)) }

  private func update() {
    isHidden = amount == 0
    let strength = Self.blurStrength.lowerBound
      + (Self.blurStrength.upperBound - Self.blurStrength.lowerBound) * amount
    let bandOpacity = min(amount / Self.fadeInBelow, 1)
    for band in [topBand, bottomBand] {
      band.strength = strength
      band.opacity = bandOpacity
    }
    tint.alpha = Self.maxTintOpacity * amount
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let range = Self.bandHeight
    let share = range.lowerBound + (range.upperBound - range.lowerBound) * amount
    let height = (bounds.height * share).rounded()
    tint.frame = bounds
    topBand.frame = CGRect(x: 0, y: 0, width: bounds.width, height: height)
    bottomBand.frame = CGRect(x: 0, y: bounds.height - height, width: bounds.width, height: height)
  }
}

// One blurred band: full blur at the eye's edge, fading to none at the
// band's inner edge, so the blur grows gradually away from the sharp middle.
private final class BlurBand: UIVisualEffectView {
  enum Edge { case top, bottom }

  // A neutral blur. Its "Dark" variant is fixed (it ignores dark mode, like
  // the map's photos) and, paused part way, barely darkens the picture;
  // the light styles leave a white haze.
  private static let blur = UIBlurEffect(style: .systemUltraThinMaterialDark)

  // 0 = no blur, 1 = the blur style's full strength.
  var strength: CGFloat = 0 {
    didSet { if strength != oldValue { scheduleFreeze() } }
  }

  // How much of the band shows, 0...1 (the fade's opacity).
  var opacity: CGFloat {
    get { fade.alpha }
    set { fade.alpha = newValue }
  }

  // The fade: a vertical gradient used as a mask (like CSS `mask-image:
  // linear-gradient(...)`). Where it's opaque the blur shows.
  private let fade = GradientView()
  // The blur animation, paused part way; see `freezeBlur()`.
  private var animator: UIViewPropertyAnimator?
  private var freezeScheduled = false
  private var observers: [NSObjectProtocol] = []

  init(blurredEdge: Edge) {
    super.init(effect: nil)
    isUserInteractionEnabled = false
    fade.setFade(blurredEdge: blurredEdge)
    // A visual effect view is masked with a mask *view*, not a layer mask.
    mask = fade
    // iOS may drop paused animations while the app is in the background,
    // which would leave the band at full blur, so freeze it again on return.
    // With Reduce Transparency on, iOS draws blurs as flat gray, which would
    // look like gray bars here, so the bands step aside.
    let center = NotificationCenter.default
    observers = [
      center.addObserver(
        forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main
      ) { [weak self] _ in self?.scheduleFreeze() },
      center.addObserver(
        forName: UIAccessibility.reduceTransparencyStatusDidChangeNotification, object: nil,
        queue: .main
      ) { [weak self] _ in self?.updateReduceTransparency() },
    ]
    updateReduceTransparency()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  deinit {
    // UIKit requires a paused animator to be stopped before it's freed.
    animator?.stopAnimation(true)
    for observer in observers { NotificationCenter.default.removeObserver(observer) }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    fade.frame = bounds
  }

  // Freeze once on screen: the blur can't be paused part way before then.
  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil { scheduleFreeze() }
  }

  private func updateReduceTransparency() {
    isHidden = UIAccessibility.isReduceTransparencyEnabled
  }

  // Freezes on the next run loop turn (like a setTimeout 0), once UIKit has
  // put the band on screen; frozen any earlier, the band shows full blur.
  // Several requests in one turn freeze once.
  private func scheduleFreeze() {
    guard !freezeScheduled else { return }
    freezeScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.freezeScheduled = false
      if self.window != nil { self.freezeBlur() }
    }
  }

  // UIKit has no public "blur radius" setting. The public way to get a
  // weaker blur is to animate from no blur to the full blur and pause the
  // animation part way, like pausing a CSS transition at 30%:
  // `fractionComplete` is where it's paused. Nothing runs per frame.
  private func freezeBlur() {
    animator?.stopAnimation(true)
    effect = nil
    let animator = UIViewPropertyAnimator(duration: 1, curve: .linear) { [weak self] in
      self?.effect = Self.blur
    }
    animator.pausesOnCompletion = true
    animator.fractionComplete = strength
    self.animator = animator
  }
}

// A view whose layer is a CAGradientLayer, so it can be a mask view.
private final class GradientView: UIView {
  override class var layerClass: AnyClass { CAGradientLayer.self }

  // Opaque at `blurredEdge`, clear at the other edge, easing in and out (a
  // smoothstep curve) so neither end of the fade shows as a line.
  func setFade(blurredEdge: BlurBand.Edge) {
    guard let gradient = layer as? CAGradientLayer else { return }
    let stops = (0...8).map { CGFloat($0) / 8 }
    gradient.colors = stops.map { stop -> CGColor in
      // 0 at the band's inner edge, 1 at the eye's edge.
      let t = blurredEdge == .top ? 1 - stop : stop
      return UIColor(white: 0, alpha: t * t * (3 - 2 * t)).cgColor
    }
    gradient.locations = stops.map { NSNumber(value: Double($0)) }
    gradient.startPoint = CGPoint(x: 0.5, y: 0)
    gradient.endPoint = CGPoint(x: 0.5, y: 1)
  }
}
