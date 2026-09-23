import UIKit

// The headset the stereo view is laid out for: a Cardboard-style viewer with
// two lenses a fixed distance apart. Pure layout math plus a small lookup
// table, like a `utils.ts` file. StereoRig asks it where each eye goes.
//
// Each eye's picture is a window centered on its lens, with black around it
// (see docs/reference/cardboard-viewer.png). A picture centered off its lens
// makes the eyes turn outward to merge the two, which most people can't do,
// and a picture wider than the lens runs into the lens edges.
struct ViewerProfile {
  // Millimeters between the two lens centers. Cardboard v2 is 64 mm.
  static let defaultLensSpacing = 64.0
  // One eye's window, in millimeters: the part of the screen a Cardboard-style
  // lens shows well. From the reference (iPhone 14 Pro): 230 × 187 points.
  // Millimeters, not a share of the screen, so a bigger phone behind the
  // same lenses shows the same picture rather than one that spills past them.
  static let eyeWidth = 38.0
  static let eyeHeight = 31.0
  // Millimeters from the lenses to the screen. A Cardboard-style viewer
  // puts the screen about one focal length (~40 mm) behind its lenses.
  static let defaultLensDistance = 40.0

  // The `lensSpacing` prop, in millimeters.
  var lensSpacing: Double
  // Screen points per millimeter on this phone (see `pointsPerMillimeter`).
  var pointsPerMillimeter: Double
  // Screen pixels per point, so window edges land on whole pixels.
  var displayScale: CGFloat
  // Millimeters from the lenses to the screen (not a prop yet).
  var lensDistance = defaultLensDistance

  // The two eye windows, left then right, in a view of `size` that fills the
  // screen: centered on the lenses, vertically centered, never overlapping.
  func eyeFrames(in size: CGSize) -> [CGRect] {
    let perMillimeter = CGFloat(pointsPerMillimeter)
    // Lens centers no farther out than the middle of each half-screen (the
    // old side-by-side layout), so a window can't run off a narrow screen.
    let spacing = min(CGFloat(lensSpacing) * perMillimeter, size.width / 2)
    // No wider than the lens spacing, so the two windows never overlap.
    let width = min(CGFloat(Self.eyeWidth) * perMillimeter, spacing).rounded(.down)
    let height = min(CGFloat(Self.eyeHeight) * perMillimeter, size.height).rounded(.down)
    let left = CGRect(
      x: onPixel((size.width - spacing - width) / 2),
      y: onPixel((size.height - height) / 2),
      width: width,
      height: height
    )
    // The right window mirrors the left, so both sit exactly as far from the
    // screen's center.
    let right = CGRect(x: size.width - left.maxX, y: left.minY, width: width, height: height)
    return [left, right]
  }

  // How many degrees of your view a picture `height` points tall fills when
  // seen through a lens: 2 × atan(half its height ÷ the lens distance), both
  // in millimeters. About 42° for a 31 mm window 40 mm from the lens.
  func perceivedFieldOfView(height: CGFloat) -> Double {
    let millimeters = Double(height) / max(pointsPerMillimeter, 0.01)
    return 2 * atan(millimeters / 2 / max(lensDistance, 1)) * 180 / .pi
  }

  // How far the camera turns per degree the head turns, so that a head turn
  // of N° moves the city N° as seen through the lens. A window `height`
  // points tall shows `shownFieldOfView` degrees of the city (StereoRig) but
  // fills `perceivedFieldOfView` degrees of your view, which magnifies it by
  // perceived ÷ shown; the camera turns by the inverse. Scaled on top by the
  // tracking sensitivity setting (1 = true to life). See FirstPersonCamera.
  func lookGain(height: CGFloat, shownFieldOfView: Double) -> Double {
    let perceived = perceivedFieldOfView(height: height)
    guard perceived > 0, shownFieldOfView > 0 else { return 1 }
    return shownFieldOfView / perceived
  }

  // Rounds a position to the nearest whole screen pixel.
  private func onPixel(_ value: CGFloat) -> CGFloat {
    let scale = max(displayScale, 1)
    return (value * scale).rounded() / scale
  }
}

// MARK: - Screen size in millimeters

extension ViewerProfile {
  // Screen points per millimeter. iOS has no public API for a screen's
  // physical size, so this looks up the phone's pixels per inch by model.
  // `nativeScale` is how many physical pixels one point covers: 3 on most
  // iPhones, 2.88 on the minis, and different again under Display Zoom.
  static func pointsPerMillimeter(nativeScale: CGFloat) -> Double {
    let scale = Double(max(nativeScale, 1))
    // An unknown (newer) iPhone: every @3x iPhone since the 12 is 458–476
    // ppi, and every @2x one 326.
    let ppi = pixelsPerInch[modelIdentifier] ?? (scale >= 2.5 ? 460 : 326)
    return ppi / 25.4 / scale
  }

  // This phone's model identifier, e.g. "iPhone15,2" for an iPhone 14 Pro
  // (what `uname` reports, like `navigator.userAgent` but exact). The
  // Simulator reports the Mac's chip instead and puts the simulated model in
  // an environment variable.
  static let modelIdentifier: String = {
    if let simulated = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] {
      return simulated
    }
    var info = utsname()
    uname(&info)
    // `machine` is a fixed-size C string: read it up to its terminating 0.
    return withUnsafeBytes(of: info.machine) { bytes in
      String(decoding: bytes.prefix(while: { $0 != 0 }), as: UTF8.self)
    }
  }()

  // Pixels per inch by model identifier, from Apple's tech specs (they match
  // Xcode's Simulator device profiles). iPhone 11 onward.
  private static let pixelsPerInch: [String: Double] = [
    "iPhone12,1": 326,  // iPhone 11
    "iPhone12,3": 458,  // iPhone 11 Pro
    "iPhone12,5": 458,  // iPhone 11 Pro Max
    "iPhone12,8": 326,  // iPhone SE (2nd generation)
    "iPhone13,1": 476,  // iPhone 12 mini
    "iPhone13,2": 460,  // iPhone 12
    "iPhone13,3": 460,  // iPhone 12 Pro
    "iPhone13,4": 458,  // iPhone 12 Pro Max
    "iPhone14,4": 476,  // iPhone 13 mini
    "iPhone14,5": 460,  // iPhone 13
    "iPhone14,2": 460,  // iPhone 13 Pro
    "iPhone14,3": 458,  // iPhone 13 Pro Max
    "iPhone14,6": 326,  // iPhone SE (3rd generation)
    "iPhone14,7": 460,  // iPhone 14
    "iPhone14,8": 458,  // iPhone 14 Plus
    "iPhone15,2": 460,  // iPhone 14 Pro
    "iPhone15,3": 460,  // iPhone 14 Pro Max
    "iPhone15,4": 460,  // iPhone 15
    "iPhone15,5": 460,  // iPhone 15 Plus
    "iPhone16,1": 460,  // iPhone 15 Pro
    "iPhone16,2": 460,  // iPhone 15 Pro Max
    "iPhone17,3": 460,  // iPhone 16
    "iPhone17,4": 460,  // iPhone 16 Plus
    "iPhone17,1": 460,  // iPhone 16 Pro
    "iPhone17,2": 460,  // iPhone 16 Pro Max
    "iPhone17,5": 460,  // iPhone 16e
    "iPhone18,3": 460,  // iPhone 17
    "iPhone18,4": 460,  // iPhone Air
    "iPhone18,1": 460,  // iPhone 17 Pro
    "iPhone18,2": 460,  // iPhone 17 Pro Max
    "iPhone18,5": 460,  // iPhone 17e
  ]
}
