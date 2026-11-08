// Draws the app icon: swift tools/make-icon.swift <out.png>
import AppKit
let S: CGFloat = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1024, pixelsHigh: 1024, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let ctx = NSGraphicsContext.current!.cgContext
let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [CGColor(red: 0.04, green: 0.20, blue: 0.38, alpha: 1), CGColor(red: 0.02, green: 0.48, blue: 0.85, alpha: 1)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(grad, start: CGPoint(x: 0, y: 0), end: CGPoint(x: S, y: S), options: [])
// rack frame
let frame = CGRect(x: 262, y: 150, width: 500, height: 724)
ctx.setFillColor(CGColor(red: 0.05, green: 0.08, blue: 0.12, alpha: 0.9))
ctx.addPath(CGPath(roundedRect: frame, cornerWidth: 40, cornerHeight: 40, transform: nil)); ctx.fillPath()
// units
let colors: [CGColor] = [CGColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 1), CGColor(red: 0.02, green: 0.59, blue: 0.41, alpha: 1), CGColor(red: 0.15, green: 0.39, blue: 0.92, alpha: 1), CGColor(red: 0.15, green: 0.39, blue: 0.92, alpha: 1), CGColor(red: 0.49, green: 0.23, blue: 0.93, alpha: 1)]
for (i, c) in colors.enumerated() {
    let r = CGRect(x: 312, y: 730 - CGFloat(i) * 130, width: 400, height: 96)
    ctx.setFillColor(c); ctx.addPath(CGPath(roundedRect: r, cornerWidth: 14, cornerHeight: 14, transform: nil)); ctx.fillPath()
    // port lights
    for p in 0..<6 {
        ctx.setFillColor(CGColor(gray: 1, alpha: 0.85))
        ctx.fillEllipse(in: CGRect(x: 470 + CGFloat(p) * 38, y: r.midY - 11, width: 22, height: 22))
    }
    ctx.setFillColor(CGColor(red: 0.98, green: 0.8, blue: 0.08, alpha: 1))
    ctx.fillEllipse(in: CGRect(x: 345, y: r.midY - 14, width: 28, height: 28))
}
NSGraphicsContext.current = nil
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
