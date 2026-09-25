// Builds design/icons/contact-sheet.png from the rendered concept PNGs.
//
//   xcrun swift contact_sheet.swift <design/icons> <work dir from render.sh> <out.png>
//
// One column per concept plus the app's current icon: the 1024 px light icon,
// then 180/60/29 px in every appearance on light and dark backgrounds, then a
// mock home-screen row next to placeholder icons, then all of them side by side.
import AppKit

let args = CommandLine.arguments
let iconsDir = URL(fileURLWithPath: args[1])
let workDir = URL(fileURLWithPath: args[2])
let outURL = URL(fileURLWithPath: args[3])

// MARK: - inputs

struct Column {
  let title: String
  let light: NSImage, dark: NSImage, tinted: NSImage, tintedLight: NSImage, clearLight: NSImage, clearDark: NSImage
}

func load(_ url: URL) -> NSImage {
  guard let img = NSImage(contentsOf: url) else { fatalError("missing \(url.path)") }
  return img
}

var columns: [Column] = []
let folders = try FileManager.default.contentsOfDirectory(atPath: iconsDir.path)
  .filter { $0.range(of: #"^\d\d-"#, options: .regularExpression) != nil }.sorted()
for name in folders {
  let dir = iconsDir.appendingPathComponent(name)
  let work = workDir.appendingPathComponent(name)
  let titles = ["glass-dome": "Glass dome", "tilt-shift": "Tilt-shift street", "two-lenses": "Two lenses",
                "museum-plinth": "Museum plinth", "popup-map": "Pop-up map"]
  let key = String(name.dropFirst(3))
  let title = "\(Int(name.prefix(2))!) · " + (titles[key] ?? key.replacingOccurrences(of: "-", with: " "))
  columns.append(Column(
    title: title,
    light: load(dir.appendingPathComponent("light.png")), dark: load(dir.appendingPathComponent("dark.png")),
    tinted: load(dir.appendingPathComponent("tinted.png")),
    tintedLight: load(work.appendingPathComponent("tinted-light.png")),
    clearLight: load(work.appendingPathComponent("clear-light.png")), clearDark: load(work.appendingPathComponent("clear-dark.png"))))
}
let cur = workDir.appendingPathComponent("current")
columns.append(Column(
  title: "Current icon (T17)",
  light: load(cur.appendingPathComponent("Default.png")), dark: load(cur.appendingPathComponent("Dark.png")),
  tinted: load(cur.appendingPathComponent("TintedDark.png")), tintedLight: load(cur.appendingPathComponent("TintedLight.png")),
  clearLight: load(cur.appendingPathComponent("ClearLight.png")), clearDark: load(cur.appendingPathComponent("ClearDark.png"))))

// MARK: - layout

let margin: CGFloat = 96, colW: CGFloat = 1024, gutter: CGFloat = 96
let width = margin * 2 + CGFloat(columns.count) * colW + CGFloat(columns.count - 1) * gutter
let panelH: CGFloat = 180 + 60 + 29 + 3 * 56 + 40
let homeH: CGFloat = 420
let glanceH: CGFloat = 2 * (180 + 80 + 90)
let height = margin + 210 + 90 + colW + 70 + 2 * (panelH + 70) + 2 * (homeH + 40) + 110 + glanceH + margin

let rep = NSBitmapImageRep(
  bitmapDataPlanes: nil, pixelsWide: Int(width), pixelsHigh: Int(height), bitsPerSample: 8, samplesPerPixel: 4,
  hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = NSSize(width: width, height: height)
let ctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.saveGraphicsState()
// A flipped context so y grows downward like a page.
NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx.cgContext, flipped: true)
ctx.cgContext.translateBy(x: 0, y: height)
ctx.cgContext.scaleBy(x: 1, y: -1)
ctx.imageInterpolation = .high
NSColor.white.setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()

func color(_ hex: UInt32, _ a: CGFloat = 1) -> NSColor {
  NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: a)
}
let paper = color(0xF2F2F7), ink = color(0x1C1C1E), inkSoft = color(0x6E6E73), night = color(0x000000), nightInk = color(0xF2F2F7)

func fill(_ r: NSRect, _ c: NSColor, radius: CGFloat = 0) {
  c.setFill()
  NSBezierPath(roundedRect: r, xRadius: radius, yRadius: radius).fill()
}

func text(_ s: String, _ p: NSPoint, size: CGFloat, weight: NSFont.Weight = .regular, color c: NSColor = ink, center: Bool = false, maxWidth: CGFloat = 0) {
  let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: size, weight: weight), .foregroundColor: c]
  let str = NSAttributedString(string: s, attributes: attrs)
  var x = p.x
  if center { x -= str.size().width / 2 }
  str.draw(at: NSPoint(x: x, y: p.y))
}

func draw(_ img: NSImage, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat) {
  img.draw(in: NSRect(x: x, y: y, width: size, height: size), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: [.interpolation: NSImageInterpolation.high.rawValue])
}

// An iOS-like icon outline (a superellipse) for the placeholder neighbours.
func squircle(_ r: NSRect) -> NSBezierPath {
  let p = NSBezierPath()
  let n = 5.0, steps = 160
  for i in 0...steps {
    let t = Double(i) / Double(steps) * 2 * Double.pi
    let c = cos(t), s = sin(t)
    let x = pow(abs(c), 2 / n) * (c < 0 ? -1 : 1), y = pow(abs(s), 2 / n) * (s < 0 ? -1 : 1)
    let pt = NSPoint(x: r.midX + CGFloat(x) * r.width / 2, y: r.midY + CGFloat(y) * r.height / 2)
    if i == 0 { p.move(to: pt) } else { p.line(to: pt) }
  }
  p.close()
  return p
}

struct Placeholder { let symbol: String; let label: String; let top: UInt32; let bottom: UInt32 }
let neighbours = [
  Placeholder(symbol: "cloud.sun.fill", label: "Weather", top: 0x5AB8FF, bottom: 0x1F6FE0),
  Placeholder(symbol: "music.note", label: "Music", top: 0xFF6B7F, bottom: 0xF2294A),
  Placeholder(symbol: "camera.fill", label: "Camera", top: 0xB9B9BF, bottom: 0x6E6E75),
]

func placeholder(_ p: Placeholder, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, dark: Bool) {
  let r = NSRect(x: x, y: y, width: size, height: size)
  NSGraphicsContext.saveGraphicsState()
  let path = squircle(r)
  path.addClip()
  if dark {
    fill(r, color(0x1C1C1E))
  } else {
    NSGradient(starting: color(p.top), ending: color(p.bottom))!.draw(in: r, angle: 90)
  }
  let glyphColor = dark ? color(p.top) : NSColor.white
  let cfg = NSImage.SymbolConfiguration(pointSize: size * 0.42, weight: .medium).applying(.init(paletteColors: [glyphColor]))
  if let sym = NSImage(systemSymbolName: p.symbol, accessibilityDescription: nil)?.withSymbolConfiguration(cfg) {
    let s = sym.size
    sym.draw(in: NSRect(x: r.midX - s.width / 2, y: r.midY - s.height / 2, width: s.width, height: s.height), from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
  }
  NSGraphicsContext.restoreGraphicsState()
}

// MARK: - header

var y = margin
text("Mini Cities: app icon concepts (T62)", NSPoint(x: margin, y: y), size: 84, weight: .bold)
y += 110
text("Rendered by Icon Composer's own renderer (ictool, Xcode 27) from each .icon bundle. Each column: the 1024 px light icon; then 180, 60 and 29 px in light, dark, tinted and clear looks on light and dark backgrounds; then a home-screen row at iPhone size (60 pt at 3x) next to placeholder icons.", NSPoint(x: margin, y: y), size: 34, color: inkSoft)
y += 90

func colX(_ i: Int) -> CGFloat { margin + CGFloat(i) * (colW + gutter) }

// MARK: - 1024 px

for (i, c) in columns.enumerated() {
  text(c.title, NSPoint(x: colX(i), y: y), size: 52, weight: .semibold)
}
y += 90
for (i, c) in columns.enumerated() {
  fill(NSRect(x: colX(i), y: y, width: colW, height: colW), paper, radius: 40)
  draw(c.light, colX(i), y, colW)
}
y += colW + 70

// MARK: - small sizes on light and dark

func sizesPanel(dark: Bool) {
  for (i, c) in columns.enumerated() {
    let x0 = colX(i)
    fill(NSRect(x: x0, y: y, width: colW, height: panelH), dark ? night : paper, radius: 40)
    let looks: [(String, NSImage)] = dark
      ? [("Light", c.light), ("Dark", c.dark), ("Tinted", c.tinted), ("Clear", c.clearDark)]
      : [("Light", c.light), ("Dark", c.dark), ("Tinted", c.tintedLight), ("Clear", c.clearLight)]
    let cell: CGFloat = (colW - 80) / 4
    var yy = y + 30
    for size: CGFloat in [180, 60, 29] {
      for (k, look) in looks.enumerated() {
        let cx = x0 + 40 + CGFloat(k) * cell + cell / 2
        draw(look.1, cx - size / 2, yy, size)
        if size == 29 {
          text(look.0, NSPoint(x: cx, y: yy + size + 14), size: 26, color: dark ? nightInk : inkSoft, center: true)
        }
      }
      yy += size + 40
    }
  }
  y += panelH + 70
}
sizesPanel(dark: false)
sizesPanel(dark: true)

// MARK: - home-screen rows

func homeRow(dark: Bool) {
  for (i, c) in columns.enumerated() {
    let x0 = colX(i)
    let r = NSRect(x: x0, y: y, width: colW, height: homeH)
    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(roundedRect: r, xRadius: 40, yRadius: 40).addClip()
    let wall = dark ? NSGradient(starting: color(0x0B1530), ending: color(0x2A1847))! : NSGradient(starting: color(0xBFD8F6), ending: color(0xF6D9C9))!
    wall.draw(in: r, angle: -90)
    NSGraphicsContext.restoreGraphicsState()
    let icon: CGFloat = 180, step = (colW - 4 * icon) / 5
    let slots: [Placeholder?] = [neighbours[0], nil, neighbours[1], neighbours[2]]
    for (k, slot) in slots.enumerated() {
      let ix = x0 + step + CGFloat(k) * (icon + step)
      let iy = y + 80
      if let p = slot {
        placeholder(p, ix, iy, icon, dark: dark)
      } else {
        draw(dark ? c.dark : c.light, ix, iy, icon)
      }
      text(slot?.label ?? "Mini Cities", NSPoint(x: ix + icon / 2, y: iy + icon + 18), size: 36, weight: .medium, color: dark ? .white : ink, center: true)
    }
  }
  y += homeH + 40
}
homeRow(dark: false)
homeRow(dark: true)

// MARK: - all together

y += 30
text("Side by side (concepts 1 to 5, then the current icon)", NSPoint(x: margin, y: y), size: 44, weight: .semibold)
y += 80
for dark in [false, true] {
  let r = NSRect(x: margin, y: y, width: width - 2 * margin, height: glanceH / 2 - 30)
  fill(r, dark ? night : paper, radius: 40)
  let captionColor = dark ? nightInk : inkSoft
  var x = margin + 60
  let top = y + 40
  func group(_ caption: String, _ size: CGFloat, _ spacing: CGFloat, _ pick: (Column) -> NSImage) {
    let start = x
    for c in columns {
      draw(pick(c), x, top + (180 - size) / 2, size)
      x += size + spacing
    }
    text(caption, NSPoint(x: start, y: top + 180 + 24), size: 30, color: captionColor)
    x += 90
  }
  group(dark ? "180 px, dark" : "180 px, light", 180, 70) { dark ? $0.dark : $0.light }
  group(dark ? "60 px, dark" : "60 px, light", 60, 36) { dark ? $0.dark : $0.light }
  group(dark ? "60 px, tinted" : "60 px, tinted (light)", 60, 36) { dark ? $0.tinted : $0.tintedLight }
  group(dark ? "60 px, clear" : "60 px, clear (light)", 60, 36) { dark ? $0.clearDark : $0.clearLight }
  group(dark ? "29 px, dark" : "29 px, light", 29, 24) { dark ? $0.dark : $0.light }
  y += glanceH / 2
}

NSGraphicsContext.restoreGraphicsState()

// Save without an alpha channel: the sheet is opaque, and RGB keeps the file smaller.
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let opaque = CGContext(
  data: nil, width: Int(width), height: Int(height), bitsPerComponent: 8, bytesPerRow: 0, space: srgb,
  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
opaque.draw(rep.cgImage!, in: CGRect(x: 0, y: 0, width: width, height: height))
let dst = CGImageDestinationCreateWithURL(outURL as CFURL, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(dst, opaque.makeImage()!, nil)
guard CGImageDestinationFinalize(dst) else { fatalError("could not write \(outURL.path)") }
print("contact sheet \(Int(width))x\(Int(height))")
