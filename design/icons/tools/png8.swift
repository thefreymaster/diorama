// Rewrites PNGs in place as 8 bits per channel, keeping their colour space
// (ictool exports 16-bit Display P3, twice the size with no visible gain).
//
//   xcrun swift png8.swift a.png b.png ...
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

for path in CommandLine.arguments.dropFirst() {
  let url = URL(fileURLWithPath: path)
  guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fatalError("can't read \(path)") }
  let space = img.colorSpace ?? CGColorSpace(name: CGColorSpace.displayP3)!
  guard let ctx = CGContext(
    data: nil, width: img.width, height: img.height, bitsPerComponent: 8, bytesPerRow: 0, space: space,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fatalError("no context for \(path)") }
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: img.width, height: img.height))
  guard let out = ctx.makeImage(),
        let dst = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("can't write \(path)") }
  CGImageDestinationAddImage(dst, out, nil)
  CGImageDestinationFinalize(dst)
}
