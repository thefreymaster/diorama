import Foundation

// Smooths a jittery number that also has to follow fast changes (Casiez et
// al., "1€ filter"). It is a low-pass filter that adapts to speed: when the
// value holds still it smooths hard (no jitter); when it moves fast it
// smooths less (no lag). Like a spring whose stiffness grows with speed.
struct OneEuroFilter {
  // Smoothing at rest, in Hz. Lower = steadier but laggier when still.
  let minCutoff: Double
  // How much speed loosens the smoothing, in Hz per (unit per second).
  let beta: Double
  // Smoothing for the speed estimate itself, in Hz.
  let speedCutoff: Double

  private var lastValue: Double?
  private var lastSpeed = 0.0

  init(minCutoff: Double, beta: Double, speedCutoff: Double = 1) {
    self.minCutoff = minCutoff
    self.beta = beta
    self.speedCutoff = speedCutoff
  }

  // Feeds one sample taken `seconds` after the previous one. Returns the
  // smoothed value.
  mutating func filter(_ value: Double, seconds: Double) -> Double {
    // The first sample passes straight through.
    guard let previous = lastValue else {
      lastValue = value
      return value
    }
    // No time has passed (e.g. the first frame after a pause): hold still.
    guard seconds > 0 else { return previous }
    let speed = (value - previous) / seconds
    lastSpeed += Self.weight(cutoff: speedCutoff, seconds: seconds) * (speed - lastSpeed)
    let cutoff = minCutoff + beta * abs(lastSpeed)
    let smoothed = previous + Self.weight(cutoff: cutoff, seconds: seconds) * (value - previous)
    lastValue = smoothed
    return smoothed
  }

  // Forgets history, so the next sample passes straight through.
  mutating func reset() {
    lastValue = nil
    lastSpeed = 0
  }

  // How far to move toward the new sample (0...1) for a low-pass filter with
  // this cutoff frequency.
  private static func weight(cutoff: Double, seconds: Double) -> Double {
    let timeConstant = 1 / (2 * .pi * cutoff)
    return 1 / (1 + timeConstant / seconds)
  }
}
