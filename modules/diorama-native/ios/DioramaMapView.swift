import ExpoModulesCore
import MapKit

// The native side of <DioramaMapView>. Think of it as a React component
// written in UIKit: Expo sets the `pose`/`orbit` "props" (see
// DioramaNativeModule.swift), then calls `propsDidUpdate()` once per render.
final class DioramaMapView: ExpoView, MKMapViewDelegate {
  // Event prop. Calling `onReady([:])` fires the JS `onReady` callback.
  // MapKit can't tell whether a place has photoreal 3D (it accepts a 3D
  // camera over flat imagery too), so the TS wrapper adds `flyoverAvailable`
  // from a curated list. See src/flyoverCoverage.ts.
  let onReady = EventDispatcher()

  // Camera props from JS, applied together in `propsDidUpdate()`.
  var pose = CameraPose()
  var orbit = false

  // Orbit speed: one full turn every two minutes.
  private static let orbitDegreesPerSecond = 3.0
  // How long to wait for a clean render before firing onReady anyway.
  private static let readyFallbackSeconds = 2.0

  // Apple's map view. Mono mode uses one; stereo (T08) adds a second eye.
  private let mapView = MKMapView()
  // Degrees the orbit has turned away from `pose.heading`. recenter() zeroes it.
  private var orbitOffset = 0.0
  private var appliedPose: CameraPose?
  // onReady fires once per center (a new place is a new load).
  private var isReady = false
  private var readyGeneration = 0
  private lazy var ticker = FrameTicker { [weak self] delta in
    self?.advanceOrbit(by: delta)
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    configureMap()
    addSubview(mapView)
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
    mapView.delegate = self
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    mapView.frame = bounds
  }

  // Like a useEffect cleanup/setup pair: only tick while on screen.
  override func didMoveToWindow() {
    super.didMoveToWindow()
    updateTicker()
  }

  // MARK: - Called from JS (via DioramaNativeModule)

  func propsDidUpdate() {
    defer { updateTicker() }  // `orbit` may have changed on its own.
    guard appliedPose != pose else { return }
    let isNewPlace = appliedPose.map { !$0.hasSameCenter(as: pose) } ?? true
    if isNewPlace {
      // New place: jump there, and wait for its tiles before orbiting and
      // firing onReady again.
      isReady = false
      readyGeneration += 1  // Cancels a pending fallback for the old place.
      orbitOffset = 0
      ticker.stop()
    }
    // Glide when adjusting the view of the same place.
    applyCamera(animated: !isNewPlace && !ticker.isRunning)
    appliedPose = pose
  }

  // Back to the pose given by props (drops the orbit angle).
  func recenter() {
    orbitOffset = 0
    applyCamera(animated: !ticker.isRunning)
  }

  // MARK: - Camera

  private func applyCamera(animated: Bool) {
    mapView.setCamera(pose.makeCamera(headingOffset: orbitOffset), animated: animated)
  }

  // Orbit only once the first render is done: a camera that moves every
  // frame keeps MapKit from ever reporting "finished rendering".
  private func updateTicker() {
    if orbit && isReady && window != nil {
      ticker.start()
    } else {
      ticker.stop()
    }
  }

  private func advanceOrbit(by seconds: CFTimeInterval) {
    orbitOffset = (orbitOffset + seconds * Self.orbitDegreesPerSecond)
      .truncatingRemainder(dividingBy: 360)
    applyCamera(animated: false)
  }

  // MARK: - Ready event

  private func emitReady() {
    guard !isReady else { return }
    isReady = true
    onReady([:])
    updateTicker()
  }

  // MARK: - MKMapViewDelegate (MapKit's callbacks, like event handlers)

  func mapViewDidFinishRenderingMap(_ mapView: MKMapView, fullyRendered: Bool) {
    if fullyRendered {
      emitReady()
      return
    }
    // Some tiles failed (e.g. offline). Give MapKit a moment to retry, then
    // report ready anyway so screens never wait forever.
    readyGeneration += 1
    let generation = readyGeneration
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.readyFallbackSeconds) { [weak self] in
      guard let self, self.readyGeneration == generation else { return }
      self.emitReady()
    }
  }

  // Tiles couldn't load at all (e.g. offline): don't leave screens waiting.
  func mapViewDidFailLoadingMap(_ mapView: MKMapView, withError error: Error) {
    emitReady()
  }
}
