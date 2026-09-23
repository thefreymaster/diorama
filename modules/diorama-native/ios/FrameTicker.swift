import QuartzCore

// Calls `onFrame(secondsSinceLastFrame)` once per screen refresh while
// running, like a `requestAnimationFrame` loop. Backed by CADisplayLink.
final class FrameTicker {
  private let onFrame: (CFTimeInterval) -> Void
  private var link: CADisplayLink?
  private var lastTimestamp: CFTimeInterval?

  init(onFrame: @escaping (CFTimeInterval) -> Void) {
    self.onFrame = onFrame
  }

  var isRunning: Bool { link != nil }

  func start() {
    guard link == nil else { return }
    // CADisplayLink keeps a strong reference to its target, so it points at a
    // tiny proxy instead of `self`. Otherwise the ticker could never be freed.
    let link = CADisplayLink(target: DisplayLinkProxy(self), selector: #selector(DisplayLinkProxy.step))
    link.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
    link.add(to: .main, forMode: .common)
    self.link = link
  }

  func stop() {
    link?.invalidate()
    link = nil
    lastTimestamp = nil
  }

  fileprivate func step(_ link: CADisplayLink) {
    // First frame after start: no previous frame, so report 0 seconds.
    let delta = lastTimestamp.map { link.timestamp - $0 } ?? 0
    lastTimestamp = link.timestamp
    // Clamp long gaps (app was paused) so animations don't jump.
    onFrame(min(delta, 0.1))
  }
}

// Forwards display-link ticks to the ticker without keeping it alive.
private final class DisplayLinkProxy: NSObject {
  private weak var ticker: FrameTicker?

  init(_ ticker: FrameTicker) {
    self.ticker = ticker
  }

  @objc func step(_ link: CADisplayLink) {
    guard let ticker else {
      link.invalidate()
      return
    }
    ticker.step(link)
  }
}
