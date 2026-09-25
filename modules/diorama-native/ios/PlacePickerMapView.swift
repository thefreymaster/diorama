import CoreLocation
import ExpoModulesCore
import MapKit
import UIKit

// The native side of <PlacePickerMapView> (T43, "Choose on map"): a plain,
// interactive Apple map that you move under a fixed pin, like Apple Maps'
// "Move pin to location". Think of it as a small React component written in
// UIKit: Expo sets the props below (see DioramaNativeModule.swift) and calls
// `propsDidUpdate()` once per render. The pin and the card are drawn in
// React, over the middle and the bottom of this view.
//
// Pan and pinch move the map under the pin, a tap brings the tapped spot to
// the pin, and each time the map comes to rest it fires `onRegionChangeEnd`
// with the spot under the pin. Flat, north up, no pitch or rotation.
final class PlacePickerMapView: ExpoView, MKMapViewDelegate, UIGestureRecognizerDelegate {
  // Event prop: the map came to rest (after a pan, pinch, tap or a new
  // start). Payload: `{ latitude, longitude, spanMeters }`, the point under
  // the pin (the middle of this view) and the meters across this view.
  let onRegionChangeEnd = EventDispatcher()

  // Props from JS, applied together in `propsDidUpdate()`.
  // Where the map starts: the `center` and `span` props (`span` is the
  // meters across the view). Named `start…` here because every UIView
  // already has a `center` (its position on screen).
  var startCenter: CLLocationCoordinate2D?
  var startSpan = 2000.0
  // Apple's blue location dot. Shown only if location access was already
  // granted; this view never asks for it.
  var showsUserLocation = false
  // Points kept clear at the bottom (the card over the map) for MapKit's
  // logo and Legal link, which Apple requires to stay visible.
  var attributionInset: CGFloat = 0

  private let mapView = MKMapView()
  // Only reads whether location access was granted (it never asks).
  private let locationManager = CLLocationManager()
  // A tap brings that spot to the pin. It waits for `doubleTap` to fail,
  // so a double tap still zooms in (MapKit's own gesture), as in Maps.
  private lazy var tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
  private let doubleTap = UITapGestureRecognizer()
  // The start (center and span) last shown. A new one moves the map; the
  // same one again (JS re-rendering) never undoes the user's panning.
  private var shownStart: (center: CLLocationCoordinate2D, span: Double)?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    configureMap()
    addSubview(mapView)
  }

  // A satellite map with roads, labels and points of interest (Apple Maps'
  // "Hybrid"), flat and north up: turning or tilting it would make the pin
  // harder to place.
  private func configureMap() {
    let configuration = MKHybridMapConfiguration(elevationStyle: .flat)
    configuration.pointOfInterestFilter = .includingAll
    mapView.preferredConfiguration = configuration
    mapView.isRotateEnabled = false
    mapView.isPitchEnabled = false
    mapView.showsCompass = false
    mapView.delegate = self
    // MapKit centers the map between its layout margins, which by default
    // include the safe area (the home indicator). Leave the safe area out,
    // so the map's center is this view's middle, right under the pin.
    mapView.insetsLayoutMarginsFromSafeArea = false

    doubleTap.numberOfTapsRequired = 2
    doubleTap.delegate = self
    tap.require(toFail: doubleTap)
    tap.delegate = self
    mapView.addGestureRecognizer(doubleTap)
    mapView.addGestureRecognizer(tap)
  }

  // Runs once after each batch of prop changes (like a useEffect on props).
  func propsDidUpdate() {
    applyMargins()
    applyUserLocation()
    showStartIfNew()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    mapView.frame = bounds
    // The start waits for a size: MapKit can't frame a span in no space.
    showStartIfNew()
  }

  // MapKit's logo and Legal link sit inside the bottom margin; the top
  // margin matches it so the map's center stays this view's middle.
  private func applyMargins() {
    let inset = max(attributionInset, 0)
    mapView.layoutMargins = UIEdgeInsets(top: inset, left: 0, bottom: inset, right: 0)
  }

  private func applyUserLocation() {
    let status = locationManager.authorizationStatus
    let granted = status == .authorizedWhenInUse || status == .authorizedAlways
    mapView.showsUserLocation = showsUserLocation && granted
  }

  // Moves the map to the `center` and `span` props when they're new. The
  // first time at once, later ones (a new deep link) with MapKit's glide.
  private func showStartIfNew() {
    guard let center = startCenter, CLLocationCoordinate2DIsValid(center),
      startSpan.isFinite, startSpan > 0, bounds.width > 0, bounds.height > 0
    else { return }
    let span = startSpan
    if let shownStart, shownStart.center.latitude == center.latitude,
      shownStart.center.longitude == center.longitude, shownStart.span == span
    {
      return
    }
    let animated = shownStart != nil
    shownStart = (center, span)
    // Asking for less north-south than east-west lets the width decide, so
    // `span` meters fit across the view whatever its shape.
    let region = MKCoordinateRegion(
      center: center, latitudinalMeters: span / 4, longitudinalMeters: span)
    mapView.setRegion(region, animated: animated)
  }

  @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
    guard gesture.state == .ended else { return }
    let point = gesture.location(in: mapView)
    let spot = mapView.convert(point, toCoordinateFrom: mapView)
    mapView.setCenter(spot, animated: true)
  }

  // Our taps work alongside MapKit's own gestures instead of blocking them.
  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    true
  }

  // MKMapViewDelegate: the map stopped moving (finger lifted and the glide
  // done, or a programmatic move finished). Tells JS what's under the pin.
  func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
    guard bounds.width > 0, bounds.height > 0 else { return }
    let middle = CGPoint(x: bounds.midX, y: bounds.midY)
    let spot = mapView.convert(middle, toCoordinateFrom: mapView)
    let left = mapView.convert(CGPoint(x: 0, y: bounds.midY), toCoordinateFrom: mapView)
    let right = mapView.convert(CGPoint(x: bounds.width, y: bounds.midY), toCoordinateFrom: mapView)
    let across = CLLocation(latitude: left.latitude, longitude: left.longitude)
      .distance(from: CLLocation(latitude: right.latitude, longitude: right.longitude))
    onRegionChangeEnd([
      "latitude": spot.latitude,
      "longitude": spot.longitude,
      "spanMeters": across,
    ])
  }
}
