import ExpoModulesCore
import MapKit

// The shapes city search sends to JS. A `Record` is Expo's typed version of
// a plain JS object: each `@Field` becomes the key with the same name. The
// matching TS types live in ../src/search.ts.

// A range of characters in a suggestion's title, in JS string indices
// (UTF-16, same as NSRange). JS bolds these: they match what was typed.
struct TextRangeRecord: Record {
  @Field var start: Int = 0
  @Field var length: Int = 0

  init() {}

  init(_ range: NSRange) {
    start = range.location
    length = range.length
  }
}

// One as-you-type suggestion, e.g. { title: "Paris", subtitle: "France" }.
// JS passes `id` back to `resolve()` (see `Completion` in search.ts).
struct CompletionRecord: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var subtitle: String = ""
  @Field var titleHighlights: [TextRangeRecord] = []

  init() {}

  init(id: String, completion: MKLocalSearchCompletion) {
    self.id = id
    title = completion.title
    subtitle = completion.subtitle
    titleHighlights = completion.titleHighlightRanges.map { TextRangeRecord($0.rangeValue) }
  }
}

// A resolved place: where it is and how big it is. TS turns this into a
// city (URL id, camera altitude from the span); see `NativePlace` in search.ts.
struct PlaceRecord: Record {
  @Field var name: String = ""
  @Field var country: String = ""
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0
  // Size of the place in degrees (north–south, east–west).
  @Field var latitudeDelta: Double = 0
  @Field var longitudeDelta: Double = 0

  init() {}

  init(item: MKMapItem, region: MKCoordinateRegion, fallbackName: String) {
    // iOS 26 replaced `placemark` with `location` and `addressRepresentations`.
    // Both give the same answers; the check just avoids the deprecated API.
    if #available(iOS 26.0, *) {
      latitude = item.location.coordinate.latitude
      longitude = item.location.coordinate.longitude
      name = item.name ?? item.addressRepresentations?.cityName ?? fallbackName
      country = item.addressRepresentations?.regionName ?? ""
    } else {
      latitude = item.placemark.coordinate.latitude
      longitude = item.placemark.coordinate.longitude
      name = item.name ?? item.placemark.locality ?? fallbackName
      country = item.placemark.country ?? ""
    }
    latitudeDelta = region.span.latitudeDelta
    longitudeDelta = region.span.longitudeDelta
  }
}

// Errors JS can see. Expo derives each `code` from the class name, e.g.
// SearchSupersededException → "ERR_SEARCH_SUPERSEDED". (`@unchecked Sendable`
// just repeats what Expo's base class already promises: safe across threads.)

// The older request's answer when a newer query replaces it. The TS hook
// has already moved on by then, so nobody shows it.
final class SearchSupersededException: Exception, @unchecked Sendable {
  override var reason: String {
    "A newer search replaced this one"
  }
}

final class SearchTimeoutException: Exception, @unchecked Sendable {
  override var reason: String {
    "City search took too long"
  }
}

final class SearchFailedException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "City search failed: \(param)"
  }
}

final class PlaceNotFoundException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "No place found: \(param)"
  }
}
