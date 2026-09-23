import ExpoModulesCore
import MapKit

// The shapes place search sends to JS. A `Record` is Expo's typed version of
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
// JS passes `id` back to `resolve()` (see `NativeCompletion` in search.ts).
struct CompletionRecord: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var subtitle: String = ""
  @Field var titleHighlights: [TextRangeRecord] = []
  // In Apple's city list (cities, neighborhoods, regions). JS files the
  // rest under places. Before iOS 18 that list has street addresses too.
  @Field var isCity: Bool = false

  init() {}

  init(id: String, completion: MKLocalSearchCompletion, isCity: Bool) {
    self.id = id
    title = completion.title
    subtitle = completion.subtitle
    titleHighlights = completion.titleHighlightRanges.map { TextRangeRecord($0.rangeValue) }
    self.isCity = isCity
  }
}

// A resolved place: where it is, how big it is and what kind of place it
// is. TS turns this into a city (URL id, subtitle, camera altitude); see
// `NativePlace` in search.ts.
struct PlaceRecord: Record {
  // "Paris", "1 Infinite Loop", "Eiffel Tower".
  @Field var name: String = ""
  @Field var country: String = ""
  // The town it's in ("Cupertino"). For a city, often its own name. Empty
  // when Apple gives none.
  @Field var locality: String = ""
  @Field var latitude: Double = 0
  @Field var longitude: Double = 0
  // Size of the place in degrees (north–south, east–west).
  @Field var latitudeDelta: Double = 0
  @Field var longitudeDelta: Double = 0
  // Apple's category for a landmark or business, e.g. "MKPOICategoryLandmark".
  // Empty for a street address or a city.
  @Field var category: String = ""
  // It was suggested as a city (see DioramaSearch.resolve). False when unknown.
  @Field var isCity: Bool = false

  init() {}

  init(item: MKMapItem, region: MKCoordinateRegion, fallbackName: String, isCity: Bool) {
    // iOS 26 replaced `placemark` with `location` and `addressRepresentations`.
    // Both give the same answers; the check just avoids the deprecated API.
    if #available(iOS 26.0, *) {
      latitude = item.location.coordinate.latitude
      longitude = item.location.coordinate.longitude
      name = item.name ?? item.addressRepresentations?.cityName ?? fallbackName
      country = item.addressRepresentations?.regionName ?? ""
      locality = item.addressRepresentations?.cityName ?? ""
    } else {
      latitude = item.placemark.coordinate.latitude
      longitude = item.placemark.coordinate.longitude
      name = item.name ?? item.placemark.locality ?? fallbackName
      country = item.placemark.country ?? ""
      locality = item.placemark.locality ?? ""
    }
    latitudeDelta = region.span.latitudeDelta
    longitudeDelta = region.span.longitudeDelta
    category = item.pointOfInterestCategory?.rawValue ?? ""
    self.isCity = isCity
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
    "Place search took too long"
  }
}

final class SearchFailedException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "Place search failed: \(param)"
  }
}

final class PlaceNotFoundException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "No place found: \(param)"
  }
}
