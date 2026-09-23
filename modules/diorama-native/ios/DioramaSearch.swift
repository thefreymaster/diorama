import ExpoModulesCore
import MapKit

// Place search, backed by Apple Maps (free, no API key). JS reaches it through
// `autocomplete()` and `resolve()` in ../src/search.ts; think of this class as
// the server behind those two fetches.
//
// - autocomplete(query): Apple's as-you-type suggestions
//   (MKLocalSearchCompleter): cities, street addresses, landmarks and
//   businesses, with cities flagged so JS can list them on their own.
// - resolve(id): turns one suggestion into a coordinate and a size
//   (MKLocalSearch), plus what TS needs to tell a city from an address or a
//   landmark. TS picks the URL id and camera altitude from those.
//
// DioramaNativeModule runs both on the main thread, and MapKit answers on
// the main thread too, so no locks are needed.
final class DioramaSearch: NSObject, MKLocalSearchCompleterDelegate {
  // Give up on suggestions after this long (e.g. no network).
  private static let timeoutSeconds = 10.0
  // How many suggestions `resolve()` can look up directly. Older ones still
  // resolve, through a plain text search for their title and subtitle.
  private static let rememberedLimit = 500
  // Joins title and subtitle into a suggestion id ("Paris" + "France").
  private static let idSeparator = "\u{1F}"

  // Each query asks Apple Maps two questions at once, like Promise.all over
  // two fetches. (Apple allows about 100 questions a minute, so two per
  // keystroke is the budget: a third would run out while typing.)
  // - cities: cities, neighborhoods and regions only, well ranked.
  // - everything: addresses, landmarks, businesses and cities mixed, in
  //   Apple's own order. JS uses that order to pick which section goes first.
  private enum Question: CaseIterable {
    case cities, everything
  }

  // One query in flight: a completer per question, their answers so far and
  // the promise JS is waiting on.
  private final class PendingSearch {
    let promise: Promise
    var completers: [Question: MKLocalSearchCompleter] = [:]
    var answers: [Question: Result<[MKLocalSearchCompletion], Error>] = [:]

    init(promise: Promise) {
      self.promise = promise
    }

    func question(for completer: MKLocalSearchCompleter) -> Question? {
      completers.first { $0.value === completer }?.key
    }

    // Like AbortController.abort() on both fetches: no more answers arrive.
    func stop() {
      for completer in completers.values {
        completer.delegate = nil
        completer.cancel()
      }
    }
  }

  // The query in flight. Each query gets its own completers, and a newer
  // query aborts the older one, so a slow answer for "Pa" can never land
  // after "Par".
  private var active: PendingSearch?

  // Suggestion id → suggestion, like a JS Map. A suggestion
  // (MKLocalSearchCompletion) can't be sent to JS, so JS keeps its id and
  // hands it back to `resolve()`. `isCity` remembers which list it came from.
  // `rememberedOrder` is oldest first.
  private var remembered: [String: (completion: MKLocalSearchCompletion, isCity: Bool)] = [:]
  private var rememberedOrder: [String] = []

  // MARK: - autocomplete(query)

  func autocomplete(_ query: String, promise: Promise) {
    // A newer query always wins: settle the older request first.
    if let previous = active {
      active = nil
      previous.stop()
      previous.promise.reject(SearchSupersededException())
    }

    let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else {
      promise.resolve([CompletionRecord]())
      return
    }

    let search = PendingSearch(promise: promise)
    for question in Question.allCases {
      search.completers[question] = makeCompleter(for: question)
    }
    active = search
    // Setting the text starts each search; the delegate methods below answer.
    for completer in search.completers.values {
      completer.queryFragment = text
    }

    DispatchQueue.main.asyncAfter(deadline: .now() + Self.timeoutSeconds) { [weak self, weak search] in
      guard let self, let search, self.active === search else { return }
      self.finish(search)
    }
  }

  private func makeCompleter(for question: Question) -> MKLocalSearchCompleter {
    let completer = MKLocalSearchCompleter()
    switch question {
    case .cities:
      completer.resultTypes = .address
      // iOS 18+ can narrow addresses to cities, neighborhoods and regions
      // (older iOS lists street addresses here too). Regions stay in because
      // Apple files some big cities as one: Tokyo is a prefecture.
      if #available(iOS 18.0, *) {
        completer.addressFilter = MKAddressFilter(including: [.locality, .subLocality, .administrativeArea])
      }
    case .everything:
      completer.resultTypes = Self.everyResultType
      completer.pointOfInterestFilter = Self.placeFilter
      // Street addresses stay in; whole countries and bare postcodes don't
      // make a diorama.
      if #available(iOS 18.0, *) {
        completer.addressFilter = MKAddressFilter(excluding: [.country, .postalCode])
      }
    }
    completer.delegate = self
    return completer
  }

  // Addresses, points of interest and, on iOS 18+, natural features such as
  // Mount Fuji (without them, "Mount Fuji" finds steakhouses first).
  private static var everyResultType: MKLocalSearchCompleter.ResultType {
    if #available(iOS 18.0, *) {
      return [.address, .pointOfInterest, .physicalFeature]
    }
    return [.address, .pointOfInterest]
  }

  // Places nobody makes a diorama of. Left in, they crowd out the rest:
  // "Par" lists a dozen car parks.
  private static let placeFilter = MKPointOfInterestFilter(excluding: [.parking, .evCharger, .atm, .restroom])

  // MapKit calls this when suggestions arrive (think `onSuccess`).
  func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    record(.success(completer.results), from: completer)
  }

  // MapKit calls this when a search fails (think `onError`).
  func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    // "Nothing matches" is an empty list, not an error.
    if (error as? MKError)?.code == .placemarkNotFound {
      record(.success([]), from: completer)
    } else {
      record(.failure(error), from: completer)
    }
  }

  // Keeps a completer's first answer. Once both questions have one, JS gets
  // its list.
  private func record(_ answer: Result<[MKLocalSearchCompletion], Error>, from completer: MKLocalSearchCompleter) {
    // An aborted query has no promise left: its answers are dropped.
    guard let search = active, let question = search.question(for: completer),
      search.answers[question] == nil
    else { return }
    search.answers[question] = answer
    completer.delegate = nil
    if search.answers.count == Question.allCases.count {
      finish(search)
    }
  }

  // Settles the promise with what has arrived: called when both answers are
  // in, or at the timeout. One list is enough to show something.
  private func finish(_ search: PendingSearch) {
    active = nil
    search.stop()

    let cities = try? search.answers[.cities]?.get()
    let everything = try? search.answers[.everything]?.get()
    if cities == nil && everything == nil {
      let failure = search.answers.values.lazy.compactMap { answer -> Error? in
        if case .failure(let error) = answer { return error }
        return nil
      }.first
      if let failure {
        search.promise.reject(SearchFailedException(failure.localizedDescription))
      } else {
        search.promise.reject(SearchTimeoutException())
      }
      return
    }
    search.promise.resolve(records(cities: cities ?? [], everything: everything ?? []))
  }

  // One list for JS, in Apple's order: everything it ranked (cities and
  // places mixed), then the rest of the city list. Each says whether it's in
  // the city list, which is how JS splits cities from places.
  private func records(cities: [MKLocalSearchCompletion], everything: [MKLocalSearchCompletion]) -> [CompletionRecord] {
    let cityIds = Set(cities.map(Self.id(for:)))
    var seen = Set<String>()
    var records: [CompletionRecord] = []
    for completion in everything + cities {
      let id = Self.id(for: completion)
      // Cities come twice, and MapKit can repeat a suggestion; JS lists need
      // unique ids.
      guard seen.insert(id).inserted else { continue }
      let isCity = cityIds.contains(id)
      remember(completion, id: id, isCity: isCity)
      records.append(CompletionRecord(id: id, completion: completion, isCity: isCity))
    }
    return records
  }

  private static func id(for completion: MKLocalSearchCompletion) -> String {
    completion.title + idSeparator + completion.subtitle
  }

  private func remember(_ completion: MKLocalSearchCompletion, id: String, isCity: Bool) {
    if remembered.updateValue((completion, isCity), forKey: id) == nil {
      rememberedOrder.append(id)
    }
    while rememberedOrder.count > Self.rememberedLimit {
      remembered.removeValue(forKey: rememberedOrder.removeFirst())
    }
  }

  // MARK: - resolve(completionId)

  func resolve(_ completionId: String, promise: Promise) {
    let request: MKLocalSearch.Request
    let title = completionId.components(separatedBy: Self.idSeparator).first ?? completionId
    // Only iOS 18+ keeps street addresses out of the city list, so only
    // there does "listed as a city" mean it is one. False means "unknown":
    // TS works it out from the address.
    let isCity: Bool
    if let entry = remembered[completionId] {
      request = MKLocalSearch.Request(completion: entry.completion)
      if #available(iOS 18.0, *) {
        isCity = entry.isCity
      } else {
        isCity = false
      }
    } else {
      // Not remembered (an old suggestion, or from before a reload):
      // search for its text instead, e.g. "Paris, France".
      request = MKLocalSearch.Request()
      request.naturalLanguageQuery = completionId.replacingOccurrences(of: Self.idSeparator, with: ", ")
      isCity = false
    }
    // Any kind of place: the suggestion (or its text) picks the one.
    if #available(iOS 18.0, *) {
      request.resultTypes = [.address, .pointOfInterest, .physicalFeature]
    } else {
      request.resultTypes = [.address, .pointOfInterest]
    }

    // MapKit calls this closure on the main thread when the search is done.
    MKLocalSearch(request: request).start { response, error in
      guard let response, let item = response.mapItems.first else {
        promise.reject(PlaceNotFoundException(error?.localizedDescription ?? title))
        return
      }
      promise.resolve(
        PlaceRecord(item: item, region: response.boundingRegion, fallbackName: title, isCity: isCity))
    }
  }
}
