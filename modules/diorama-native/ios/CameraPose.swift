import CoreLocation
import ExpoModulesCore
import MapKit

// The `center` prop as it arrives from JS: `{ latitude, longitude }`.
// A `Record` is Expo's typed version of a plain JS object: each `@Field`
// is read from the key with the same name.
struct Coordinate: Record {
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0

  var clLocation: CLLocationCoordinate2D {
    CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
  }
}

// Where the camera should be, before any live offsets (orbit now; head
// tracking and per-eye shifts later). Think of it as the camera "props".
struct CameraPose: Equatable {
  var center = CLLocationCoordinate2D(latitude: 40.7549, longitude: -73.9840)
  // Meters from the camera to `center` (MapKit's centerCoordinateDistance).
  var altitude: Double = 1200
  // Degrees tilted away from straight down. MapKit caps this further.
  var pitch: Double = 60
  // Compass degrees the camera faces (0 = north).
  var heading: Double = 0

  static func == (a: CameraPose, b: CameraPose) -> Bool {
    a.hasSameCenter(as: b) && a.altitude == b.altitude && a.pitch == b.pitch
      && a.heading == b.heading
  }

  func hasSameCenter(as other: CameraPose) -> Bool {
    center.latitude == other.center.latitude && center.longitude == other.center.longitude
  }

  // Builds the MapKit camera, adding `headingOffset` degrees (the orbit).
  // Inputs are clamped so a bad prop can't produce an invalid camera.
  func makeCamera(headingOffset: Double = 0) -> MKMapCamera {
    MKMapCamera(
      lookingAtCenter: center,
      fromDistance: max(altitude, 50),
      pitch: CGFloat(min(max(pitch, 0), 85)),
      heading: (heading + headingOffset).truncatingRemainder(dividingBy: 360)
    )
  }
}
