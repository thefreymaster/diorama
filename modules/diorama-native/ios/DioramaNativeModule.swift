import ExpoModulesCore

// The module's public surface, like an `index.ts` for native code. It lists
// what JS can use: the <DioramaMapView> component, its props, its events and
// the methods available on its ref. The TS types live in ../src.
public class DioramaNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DioramaNative")

    // requireNativeView('DioramaNative') in JS renders this view.
    View(DioramaMapView.self) {
      Events("onReady")

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

      // Runs once after a batch of prop changes, so the camera moves once.
      OnViewDidUpdateProps { (view: DioramaMapView) in
        view.propsDidUpdate()
      }

      // `ref.recenter()` in JS. Returns a Promise; runs on the main thread.
      AsyncFunction("recenter") { (view: DioramaMapView) in
        view.recenter()
      }
    }
  }
}
