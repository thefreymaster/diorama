import ExpoModulesCore
import MapKit
import UIKit

// The `mode` prop: one picture, or one per eye side by side.
enum ViewMode: String, Enumerable {
  case mono
  case stereo
}

// Lays out the eyes and gives each one its camera. Like a layout component
// that renders <EyeView/> once (mono) or twice (stereo, left then right),
// plus the per-eye camera math (see StereoGeometry.swift for the why).
// DioramaMapView decides *what* to show; the rig decides how each eye shows it.
final class StereoRig: NSObject, MKMapViewDelegate {
  // How long to wait for a clean render after a partial one (some tiles
  // failed) before calling an eye done anyway.
  private static let renderFallbackSeconds = 2.0
  // The longest a load may take. MapKit reports nothing at all when a new
  // camera draws exactly like the old one, so never wait longer than this.
  private static let loadTimeoutSeconds = 10.0
  // Left eye slides left (-1), right eye slides right (+1).
  private static let sides: [Double] = [-1, 1]

  // The rig's root view (like a component's root <View>): holds the eyes.
  let view = UIView()
  // Called when every eye has finished drawing (or given up on missing
  // tiles) since the last `restartRenderTracking()`.
  var onRendered: (() -> Void)?
  // Builds one overlay per eye (T09: the tilt-shift effect), drawn on top
  // of that eye's map. Called for every eye, including one added later.
  var makeOverlay: (() -> UIView)? {
    didSet { for eye in eyes { eye.overlay = makeOverlay?() } }
  }

  // The eyes, left to right: one in mono, two in stereo.
  private(set) var eyes: [EyeView] = []
  // How much farther back the camera goes because the map is larger than
  // the eye (see `layout`). 1 = no overscan.
  private(set) var distanceScale = 1.0
  // MapKit's focal length for the current map size, in points.
  private var focalLength = StereoGeometry.focalLength(mapHeight: 1)
  // MapKit caps high pitches (the cap depends on the distance). Learned from
  // what it actually drew; see `eyePoses`.
  private var pitchCap: (altitude: Double, pitch: Double)?

  var isStereo: Bool { eyes.count == 2 }

  override init() {
    super.init()
    view.isUserInteractionEnabled = false
    addEye()
  }

  // Shows one eye or two. Returns true when the eyes were replaced: they
  // then have to load before the rig reports `onRendered` again.
  @discardableResult
  func setStereo(_ stereo: Bool) -> Bool {
    if stereo, eyes.count == 1 {
      // Two fresh maps rather than reusing the mono one: a map remembers the
      // ground height it first stood a camera on, so a map with a history
      // can stand at a different height than a new one looking at the same
      // point, and the eyes would no longer line up.
      removeEye()
      addEye()
      addEye()
      return true
    }
    if !stereo, eyes.count == 2 {
      removeEye()  // The left eye carries on alone, halving the GPU work.
      reportIfRendered()
    }
    return false
  }

  // Sizes the eyes to fill `bounds` side by side. `maxRoll` (degrees) is how
  // far a mono map may turn against head roll, 0 when not tracking.
  // `safeArea` keeps MapKit's logo clear of the notch and corners. Returns
  // true when the maps changed size or position, so cameras need redoing.
  func layout(in bounds: CGRect, safeArea: UIEdgeInsets, maxRoll: Double) -> Bool {
    let eyeWidth = bounds.width / CGFloat(eyes.count)
    let eyeSize = CGSize(width: eyeWidth, height: bounds.height)
    let mapSize = StereoGeometry.mapSize(forEye: eyeSize, maxRoll: maxRoll, stereo: isStereo)
    view.frame = bounds
    // The logo sits bottom left and Legal bottom right, so only the bottom
    // and the wider of the two sides matter.
    let attributionInsets = CGSize(width: max(safeArea.left, safeArea.right), height: safeArea.bottom)
    var changed = false
    for (index, eye) in eyes.enumerated() {
      let frame = CGRect(x: CGFloat(index) * eyeWidth, y: 0, width: eyeWidth, height: bounds.height)
      if eye.frame != frame || eye.mapSize != mapSize {
        changed = true
        eye.appliedCamera = nil  // A resized map needs its camera set again.
      }
      eye.frame = frame
      eye.mapSize = mapSize
      eye.attributionInsets = attributionInsets
    }
    distanceScale = bounds.height > 0 ? Double(mapSize.height / bounds.height) : 1
    focalLength = StereoGeometry.focalLength(mapHeight: mapSize.height)
    return changed
  }

  // Points every eye at `camera` in one go (same frame): in stereo each eye
  // from its own spot, with its picture warped to match (StereoGeometry).
  // `roll` is the head roll to cancel, in degrees. Only mono glides:
  // `animated` would let the two eyes drift apart mid-glide.
  func apply(_ camera: CameraPose, roll: Double, eyeSeparation: Double, animated: Bool) {
    let poses = eyePoses(for: camera, roll: roll, eyeSeparation: eyeSeparation)
    let glide = animated && !isStereo
    for (eye, pose) in zip(eyes, poses) {
      if eye.appliedCamera != pose.camera {
        eye.appliedCamera = pose.camera
        if glide {
          eye.mapView.setCamera(pose.camera.makeCamera(), animated: true)
        } else {
          // Not even inside someone else's animation (a screen rotation).
          UIView.performWithoutAnimation {
            eye.mapView.setCamera(pose.camera.makeCamera(), animated: false)
          }
        }
      }
      eye.pictureTransform = pose.pictureTransform
    }
    if isStereo { learnPitchCap(from: poses, altitude: camera.altitude) }
  }

  // Makes the next `apply` set every eye's camera even if unchanged, so
  // MapKit stands it on the terrain it has loaded by now.
  func forgetAppliedCameras() {
    for eye in eyes { eye.appliedCamera = nil }
  }

  // A new load (new place): wait for every eye to draw again.
  func restartRenderTracking() {
    for eye in eyes {
      eye.hasRendered = false
      markRendered(eye, after: Self.loadTimeoutSeconds)
    }
  }

  // MARK: - Eyes

  private func addEye() {
    let eye = EyeView()
    eye.mapView.delegate = self
    eye.overlay = makeOverlay?()
    eyes.append(eye)
    view.addSubview(eye)
    markRendered(eye, after: Self.loadTimeoutSeconds)
  }

  // Removes the last eye and frees its map.
  private func removeEye() {
    guard let eye = eyes.popLast() else { return }
    eye.renderFallback?.cancel()
    eye.mapView.delegate = nil
    eye.removeFromSuperview()
  }

  // MARK: - Per-eye cameras

  // Each eye's camera and picture warp. MapKit caps high pitches (lower
  // the farther out it is), and a capped eye would no longer match its warp,
  // so in stereo the whole camera stops tilting at the cap instead.
  private func eyePoses(for camera: CameraPose, roll: Double, eyeSeparation: Double) -> [EyePose] {
    let baseline = StereoGeometry.baseline(distance: camera.altitude, eyeSeparation: eyeSeparation)
    var base = camera
    var poses: [EyePose] = []
    // Twice, because tilting less also changes how far each eye tilts.
    for _ in 0..<2 {
      poses = Self.sides.prefix(eyes.count).map { side in
        StereoGeometry.eyePose(
          of: base, side: isStereo ? side : 0, baseline: baseline, roll: roll, focal: focalLength)
      }
      guard isStereo, let cap = pitchCap, cap.altitude == camera.altitude,
        let steepest = poses.map(\.camera.pitch).max(), steepest > cap.pitch
      else { break }
      base.pitch = max(base.pitch - (steepest - cap.pitch), 0)
    }
    return poses
  }

  // Remembers MapKit's pitch cap at this distance from what it really drew.
  private func learnPitchCap(from poses: [EyePose], altitude: Double) {
    if pitchCap?.altitude != altitude { pitchCap = nil }
    for (eye, pose) in zip(eyes, poses) {
      // A map with no size yet reports pitch 0 whatever it was given.
      guard eye.window != nil, !eye.mapView.bounds.isEmpty else { continue }
      let drawn = Double(eye.mapView.camera.pitch)
      if drawn < min(pose.camera.pitch, CameraPose.pitchRange.upperBound) - 0.01 {
        pitchCap = (altitude, min(pitchCap?.pitch ?? drawn, drawn))
      }
    }
  }

  // MARK: - Render tracking

  private func markRendered(_ eye: EyeView) {
    eye.renderFallback?.cancel()
    guard !eye.hasRendered else { return }
    eye.hasRendered = true
    reportIfRendered()
  }

  // Counts the eye as drawn after `seconds` unless MapKit reports first.
  // Replaces any earlier pending fallback for this eye.
  private func markRendered(_ eye: EyeView, after seconds: Double) {
    eye.renderFallback?.cancel()
    let fallback = DispatchWorkItem { [weak self, weak eye] in
      guard let self, let eye else { return }
      self.markRendered(eye)
    }
    eye.renderFallback = fallback
    DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: fallback)
  }

  private func reportIfRendered() {
    guard eyes.allSatisfy(\.hasRendered) else { return }
    onRendered?()
  }

  // MARK: - MKMapViewDelegate (MapKit's callbacks, like event handlers)

  func mapViewDidFinishRenderingMap(_ mapView: MKMapView, fullyRendered: Bool) {
    guard let eye = eyes.first(where: { $0.mapView === mapView }), !eye.hasRendered else { return }
    if fullyRendered {
      markRendered(eye)
      return
    }
    // Some tiles failed (e.g. offline). Give MapKit a moment to retry, then
    // count the eye as drawn anyway so screens never wait forever.
    markRendered(eye, after: Self.renderFallbackSeconds)
  }

  // Tiles couldn't load at all (e.g. offline): don't leave screens waiting.
  func mapViewDidFailLoadingMap(_ mapView: MKMapView, withError error: Error) {
    guard let eye = eyes.first(where: { $0.mapView === mapView }) else { return }
    markRendered(eye)
  }
}
