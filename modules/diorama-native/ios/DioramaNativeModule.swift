import ExpoModulesCore

// The module's public surface, like an `index.ts` for native code. It lists
// what JS can use: the city search functions, the <DioramaMapView>
// component, its props, its events and the methods available on its ref.
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

    // requireNativeView('DioramaNative') in JS renders this view.
    View(DioramaMapView.self) {
      Events("onReady", "onDegraded")

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

      Prop("mode", ViewMode.mono) { (view: DioramaMapView, mode: ViewMode) in
        view.mode = mode
      }
      Prop("eyeSeparation", 1.0) { (view: DioramaMapView, separation: Double) in
        // Guard against nonsense; the settings screen keeps it in 0.3...3.
        view.eyeSeparation = separation.isFinite ? min(max(separation, 0), 5) : 1
      }
      Prop("debugThermalState") { (view: DioramaMapView, state: ThermalStateName?) in
        view.debugThermalState = state?.processInfoState
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
