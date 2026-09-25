import ExpoModulesCore

// The module's public surface, like an `index.ts` for native code. It lists
// what JS can use: the city search functions, the <DioramaMapView>
// component, its props, its events and the methods available on its ref,
// and the <PlacePickerMapView> behind "Choose on map".
// The TS types live in ../src.
public class DioramaNativeModule: Module {
  // One search service for the whole app, like a module-level singleton in JS.
  private let search = DioramaSearch()

  public func definition() -> ModuleDefinition {
    Name("DioramaNative")

    // `autocomplete(query)` in src/search.ts: Apple Maps suggestions for
    // cities and addresses. A newer call rejects the older one.
    AsyncFunction("autocomplete") { (query: String, promise: Promise) in
      self.search.autocomplete(query, promise: promise)
    }.runOnQueue(.main)

    // `resolve(completionId)` in src/search.ts: one suggestion → a place.
    AsyncFunction("resolve") { (completionId: String, promise: Promise) in
      self.search.resolve(completionId, promise: promise)
    }.runOnQueue(.main)

    // `pointsOfInterest(latitude, longitude, radiusMeters, categories)` in
    // src/search.ts (T60): scenic views, visitor centers and other outdoor
    // places near a spot. [] before iOS 27, which has no such categories.
    AsyncFunction("pointsOfInterest") {
      (latitude: Double, longitude: Double, radius: Double, categories: [PointOfInterestKind],
        promise: Promise) in
      self.search.pointsOfInterest(
        latitude: latitude, longitude: longitude, radius: radius, kinds: categories, promise: promise)
    }.runOnQueue(.main)

    // `getCameraAccess()` in src/cameraAccess.ts (T46): may head position use
    // the camera? "granted", "denied", "undetermined" or "unsupported".
    AsyncFunction("getCameraAccess") { () -> String in
      HeadPosition.cameraAccess.rawValue
    }

    // `requestCameraAccess()`: shows iOS's camera prompt if it hasn't been
    // answered yet, then says the access. Head position never asks itself.
    AsyncFunction("requestCameraAccess") { (promise: Promise) in
      HeadPosition.requestCameraAccess { access in promise.resolve(access.rawValue) }
    }.runOnQueue(.main)

    // requireNativeView('DioramaNative') in JS renders this view.
    View(DioramaMapView.self) {
      Events(
        "onReady", "onDegraded", "onEyeLayout", "onHeadPositionState", "onHeadPositionStats",
        "onCompassState")

      // Each Prop is a setter, called only when that prop changes.
      Prop("center") { (view: DioramaMapView, center: Coordinate) in
        view.pose.center = center.clLocation
      }
      Prop("altitude") { (view: DioramaMapView, altitude: Double) in
        view.pose.altitude = altitude
      }
      Prop("pitch") { (view: DioramaMapView, pitch: Double) in
        view.pose.pitch = pitch
      }
      Prop("heading") { (view: DioramaMapView, heading: Double) in
        view.pose.heading = heading
      }
      Prop("orbit", false) { (view: DioramaMapView, orbit: Bool) in
        view.orbit = orbit
      }
      Prop("headTracking", false) { (view: DioramaMapView, headTracking: Bool) in
        view.headTracking = headTracking
      }
      Prop("debugLook", false) { (view: DioramaMapView, debugLook: Bool) in
        view.debugLook = debugLook
      }
      Prop("trackingSensitivity", 1.0) { (view: DioramaMapView, sensitivity: Double) in
        // Guard against nonsense; the settings screen keeps it in 0.5...2.
        view.trackingSensitivity = sensitivity.isFinite ? min(max(sensitivity, 0), 5) : 1
      }
      // Head position (T46): lean to move closer, with ARKit.
      Prop("headPosition", false) { (view: DioramaMapView, headPosition: Bool) in
        view.headPosition = headPosition
      }
      Prop("leanGain", 1.0) { (view: DioramaMapView, gain: Double) in
        // Guard against nonsense; Settings will keep it in about 1...5.
        view.leanGain = gain.isFinite ? min(max(gain, 0), 10) : 1
      }
      // T61: false leaves up and down out of the lean (height stays put).
      Prop("leanVertical", true) { (view: DioramaMapView, vertical: Bool) in
        view.leanVertical = vertical
      }
      // True north (T59, live mode): face the real compass heading.
      Prop("trueNorth", false) { (view: DioramaMapView, trueNorth: Bool) in
        view.trueNorth = trueNorth
      }

      Prop("mode", ViewMode.mono) { (view: DioramaMapView, mode: ViewMode) in
        view.mode = mode
      }
      Prop("eyeSeparation", 1.0) { (view: DioramaMapView, separation: Double) in
        // Guard against nonsense; the settings screen keeps it in 0.3...3.
        view.eyeSeparation = separation.isFinite ? min(max(separation, 0), 5) : 1
      }
      Prop("lensSpacing", ViewerProfile.defaultLensSpacing) { (view: DioramaMapView, spacing: Double) in
        // Guard against nonsense; viewer lenses sit about 55 to 75 mm apart.
        view.lensSpacing = spacing.isFinite ? min(max(spacing, 40), 90) : ViewerProfile.defaultLensSpacing
      }
      // Millimeters across one eye's round window. Guard against nonsense;
      // Settings keeps it in 25...45. The layout also keeps the two circles
      // apart and on screen (ViewerProfile.eyeFrames).
      Prop("windowDiameter", ViewerProfile.defaultWindowDiameter) { (view: DioramaMapView, diameter: Double) in
        view.windowDiameter =
          diameter.isFinite ? min(max(diameter, 10), 80) : ViewerProfile.defaultWindowDiameter
      }
      Prop("miniatureIntensity", 0.0) { (view: DioramaMapView, intensity: Double) in
        view.miniatureIntensity = intensity.isFinite ? min(max(intensity, 0), 1) : 0
      }
      Prop("debugThermalState") { (view: DioramaMapView, state: ThermalStateName?) in
        view.debugThermalState = state?.processInfoState
      }
      // Live mode: Apple's blue location dot in every eye.
      Prop("showsUserLocation", false) { (view: DioramaMapView, shows: Bool) in
        view.showsUserLocation = shows
      }
      // T64: "satellite", "hybrid" (satellite with labels) or "standard".
      // Expo turns the string into a MapStyle and refuses any other.
      Prop("mapStyle", MapStyle.satellite) { (view: DioramaMapView, style: MapStyle) in
        view.mapStyle = style
      }

      // Runs once after a batch of prop changes, so the camera moves once.
      OnViewDidUpdateProps { (view: DioramaMapView) in
        view.propsDidUpdate()
      }

      // `ref.recenter()` in JS. Returns a Promise; runs on the main thread.
      AsyncFunction("recenter") { (view: DioramaMapView) in
        view.recenter()
      }

      // `ref.setDebugLook(dx, dy)` in JS: fake head yaw/pitch in degrees.
      AsyncFunction("setDebugLook") { (view: DioramaMapView, dx: Double, dy: Double) in
        view.setDebugLook(yaw: dx, pitch: dy)
      }

      // `ref.setDebugLean(right, up, forward, tracking)` in JS: head
      // position's stand-in in the Simulator (with debug look), in meters.
      AsyncFunction("setDebugLean") {
        (view: DioramaMapView, right: Double, up: Double, forward: Double, tracking: Bool) in
        view.setDebugLean(right: right, up: up, forward: forward, tracking: tracking)
      }

      // Pinch to zoom, one call per step of the gesture: `ref.beginZoom()`
      // as it starts, `ref.setZoom(scale)` as the fingers move (the scale
      // since it started), `ref.endZoom()` as they lift. `ref.resetZoom()`
      // goes back to the place's normal distance. The moving runs natively.
      AsyncFunction("beginZoom") { (view: DioramaMapView) in
        view.beginZoom()
      }
      AsyncFunction("setZoom") { (view: DioramaMapView, scale: Double) in
        view.setZoom(scale: scale)
      }
      AsyncFunction("endZoom") { (view: DioramaMapView) in
        view.endZoom()
      }
      AsyncFunction("resetZoom") { (view: DioramaMapView) in
        view.resetZoom()
      }

      // `ref.followTo(latitude, longitude)` in JS, live mode: a new GPS fix.
      // The model center glides there natively; JS sends one now and then.
      AsyncFunction("followTo") { (view: DioramaMapView, latitude: Double, longitude: Double) in
        view.followTo(latitude: latitude, longitude: longitude)
      }
    }

    // The second view (T43): requireNativeView('DioramaNative',
    // 'PlacePickerMapView') in JS. An interactive map you move under a pin.
    View(PlacePickerMapView.self) {
      Events("onRegionChangeEnd")

      // Where the map starts: its middle, and the meters across the view.
      Prop("center") { (view: PlacePickerMapView, center: Coordinate) in
        view.startCenter = center.clLocation
      }
      Prop("span", 2000.0) { (view: PlacePickerMapView, span: Double) in
        view.startSpan = span
      }
      Prop("showsUserLocation", false) { (view: PlacePickerMapView, shows: Bool) in
        view.showsUserLocation = shows
      }
      Prop("attributionInset", 0.0) { (view: PlacePickerMapView, inset: Double) in
        view.attributionInset = inset.isFinite ? CGFloat(inset) : 0
      }

      OnViewDidUpdateProps { (view: PlacePickerMapView) in
        view.propsDidUpdate()
      }
    }
  }
}

// The `debugThermalState` prop's values, named like iOS's thermal states.
enum ThermalStateName: String, Enumerable {
  case nominal
  case fair
  case serious
  case critical

  var processInfoState: ProcessInfo.ThermalState {
    switch self {
    case .nominal: return .nominal
    case .fair: return .fair
    case .serious: return .serious
    case .critical: return .critical
    }
  }
}
