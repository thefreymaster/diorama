import Foundation

// What the phone's temperature allows. A pure function of iOS's thermal
// state, like a selector: easy to test, no timers, no views.
//   nominal, fair  → stereo at up to 60 frames a second
//   serious        → stereo, but at most 30 frames a second
//   critical       → mono (one map instead of two) at 30
struct ThermalBudget: Equatable {
  var maxFramesPerSecond: Int
  var allowsStereo: Bool

  static let full = ThermalBudget(maxFramesPerSecond: 60, allowsStereo: true)

  init(maxFramesPerSecond: Int, allowsStereo: Bool) {
    self.maxFramesPerSecond = maxFramesPerSecond
    self.allowsStereo = allowsStereo
  }

  init(_ state: ProcessInfo.ThermalState) {
    switch state {
    case .nominal, .fair:
      self = .full
    case .serious:
      self.init(maxFramesPerSecond: 30, allowsStereo: true)
    case .critical:
      self.init(maxFramesPerSecond: 30, allowsStereo: false)
    @unknown default:
      // A state newer than this code: play it safe, like `serious`.
      self.init(maxFramesPerSecond: 30, allowsStereo: true)
    }
  }
}

// Watches the phone's temperature while started, like a `useEffect` that
// subscribes to an event and calls `onChange` with the new budget (always on
// the main thread, and only when the budget actually changes).
final class ThermalMonitor {
  private let onChange: (ThermalBudget) -> Void
  private var observer: NSObjectProtocol?
  private(set) var budget = ThermalBudget.full

  // Debug builds only: pretend the phone is this hot (the Simulator never
  // heats up). nil = use the real state.
  var debugState: ProcessInfo.ThermalState? {
    didSet { if debugState != oldValue { refresh() } }
  }

  init(onChange: @escaping (ThermalBudget) -> Void) {
    self.onChange = onChange
  }

  deinit {
    stop()
  }

  func start() {
    guard observer == nil else { return }
    // iOS posts this on a background queue; `queue: .main` hops to main.
    observer = NotificationCenter.default.addObserver(
      forName: ProcessInfo.thermalStateDidChangeNotification, object: nil, queue: .main
    ) { [weak self] _ in
      self?.refresh()
    }
    refresh()
  }

  func stop() {
    if let observer { NotificationCenter.default.removeObserver(observer) }
    observer = nil
  }

  private func refresh() {
    guard observer != nil else { return }
    var state = ProcessInfo.processInfo.thermalState
    #if DEBUG
      state = debugState ?? state
    #endif
    let next = ThermalBudget(state)
    guard next != budget else { return }
    budget = next
    onChange(next)
  }
}
