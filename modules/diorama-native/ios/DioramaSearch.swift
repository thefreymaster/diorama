import ExpoModulesCore
import MapKit

// City search, backed by Apple Maps (free, no API key). JS reaches it through
// `autocomplete()` and `resolve()` in ../src/search.ts; think of this class as
// the server behind those two fetches.
//
// - autocomplete(query): Apple's as-you-type suggestions
//   (MKLocalSearchCompleter), limited to cities and addresses.
// - resolve(id): turns one suggestion into a coordinate and a size
//   (MKLocalSearch). TS picks the URL id and camera altitude from those.
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

  // The suggestion request in flight. Like an AbortController per fetch:
  // each query gets its own completer, and a newer query aborts the older
  // one, so a slow answer for "Pa" can never land after "Par".
  private var active: (completer: MKLocalSearchCompleter, promise: Promise)?

  // Suggestion id → suggestion, like a JS Map. A suggestion
  // (MKLocalSearchCompletion) can't be sent to JS, so JS keeps its id and
  // hands it back to `resolve()`. `rememberedOrder` is oldest first.
  private var remembered: [String: MKLocalSearchCompletion] = [:]
  private var rememberedOrder: [String] = []

  // MARK: - autocomplete(query)

  func autocomplete(_ query: String, promise: Promise) {
    // A newer query always wins: settle the older request first.
    if let previous = active {
      active = nil
      previous.completer.delegate = nil
      previous.completer.cancel()
      previous.promise.reject(SearchSupersededException())
    }

    let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else {
      promise.resolve([CompletionRecord]())
      return
    }

    let completer = makeCompleter()
    active = (completer, promise)
    // Setting the text starts the search; the delegate methods below answer.
    completer.queryFragment = text

    DispatchQueue.main.asyncAfter(deadline: .now() + Self.timeoutSeconds) { [weak self, weak completer] in
      guard let self, let completer, let promise = self.takePromise(for: completer) else { return }
      completer.cancel()
      promise.reject(SearchTimeoutException())
    }
  }

  // Places only (no businesses or "coffee near me" queries).
  private func makeCompleter() -> MKLocalSearchCompleter {
    let completer = MKLocalSearchCompleter()
    completer.resultTypes = .address
    // iOS 18+ can narrow addresses further: cities, neighborhoods and
    // regions, no street addresses (older iOS lists those too). Regions stay
    // in because Apple files some big cities as one: Tokyo is a prefecture.
    if #available(iOS 18.0, *) {
      completer.addressFilter = MKAddressFilter(including: [.locality, .subLocality, .administrativeArea])
    }
    completer.delegate = self
    return completer
  }

  // MapKit calls this when suggestions arrive (think `onSuccess`).
  func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    // An aborted completer has no promise left: its results are dropped.
    guard let promise = takePromise(for: completer) else { return }
    promise.resolve(records(for: completer.results))
  }

  // MapKit calls this when a search fails (think `onError`).
  func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    guard let promise = takePromise(for: completer) else { return }
    // "Nothing matches" is an empty list, not an error.
    if (error as? MKError)?.code == .placemarkNotFound {
      promise.resolve([CompletionRecord]())
    } else {
      promise.reject(SearchFailedException(error.localizedDescription))
    }
  }

  // The promise waiting on `completer`, or nil if that request was already
  // answered or replaced. Each promise is handed out once.
  private func takePromise(for completer: MKLocalSearchCompleter) -> Promise? {
    guard let active, active.completer === completer else { return nil }
    self.active = nil
    completer.delegate = nil
    return active.promise
  }

  private func records(for results: [MKLocalSearchCompletion]) -> [CompletionRecord] {
    var seen = Set<String>()
    var records: [CompletionRecord] = []
    for completion in results {
      let id = completion.title + Self.idSeparator + completion.subtitle
      // MapKit can repeat a suggestion; JS lists need unique ids.
      guard seen.insert(id).inserted else { continue }
      remember(completion, id: id)
      records.append(CompletionRecord(id: id, completion: completion))
    }
    return records
  }

  private func remember(_ completion: MKLocalSearchCompletion, id: String) {
    if remembered.updateValue(completion, forKey: id) == nil {
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
    if let completion = remembered[completionId] {
      request = MKLocalSearch.Request(completion: completion)
    } else {
      // Not remembered (an old suggestion, or from before a reload):
      // search for its text instead, e.g. "Paris, France".
      request = MKLocalSearch.Request()
      request.naturalLanguageQuery = completionId.replacingOccurrences(of: Self.idSeparator, with: ", ")
    }
    request.resultTypes = .address

    // MapKit calls this closure on the main thread when the search is done.
    MKLocalSearch(request: request).start { response, error in
      guard let response, let item = response.mapItems.first else {
        promise.reject(PlaceNotFoundException(error?.localizedDescription ?? title))
        return
      }
      promise.resolve(PlaceRecord(item: item, region: response.boundingRegion, fallbackName: title))
    }
  }
}
