// Rasterises one SVG layer and blurs it for the tilt-shift concept.
//
//   blur_layer in.svg out.png yA radiusA yB radiusB
//
// The blur radius (in 1024-canvas points) changes linearly from radiusA at
// y = yA to radiusB at y = yB (y measured from the top), like a tilt-shift lens.
// Icon Composer accepts PNG layers, and SVG can't carry a blur it will draw.
import AppKit
import CoreImage

let args = CommandLine.arguments
guard args.count == 7, let svg = NSImage(contentsOfFile: args[1]) else {
  FileHandle.standardError.write("usage: blur_layer in.svg out.png yA radiusA yB radiusB\n".data(using: .utf8)!)
  exit(1)
}
let size = 1024
let yA = Double(args[3])!, rA = Double(args[4])!, yB = Double(args[5])!, rB = Double(args[6])!

let rep = NSBitmapImageRep(
  bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4,
  hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
svg.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
NSGraphicsContext.restoreGraphicsState()

let input = CIImage(bitmapImageRep: rep)!
let extent = input.extent
let maxR = max(rA, rB)
var output = input
if maxR > 0 {
  // Core Image's y axis points up, so flip the ys; the mask is white where the blur is strongest.
  let mask = CIFilter(name: "CILinearGradient", parameters: [
    "inputPoint0": CIVector(x: 0, y: CGFloat(Double(size) - yA)),
    "inputPoint1": CIVector(x: 0, y: CGFloat(Double(size) - yB)),
    "inputColor0": CIColor(red: rA / maxR, green: rA / maxR, blue: rA / maxR),
    "inputColor1": CIColor(red: rB / maxR, green: rB / maxR, blue: rB / maxR),
  ])!.outputImage!.cropped(to: extent)
  output = input.clampedToExtent()
    .applyingFilter("CIMaskedVariableBlur", parameters: ["inputMask": mask, "inputRadius": maxR])
    .cropped(to: extent)
}
let ctx = CIContext()
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
try! ctx.writePNGRepresentation(of: output, to: URL(fileURLWithPath: args[2]), format: .RGBA8, colorSpace: cs)
