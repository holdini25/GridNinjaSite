import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import sharp from "sharp"

const args = process.argv.slice(2)
assert(args.length === 3, "Usage: quality-sheet.mjs PRIVATE_RELEASE FINAL_DIRECTORY REFERENCE_DIRECTORY")
const [release, final, reference] = args.map(path => resolve(path)), root = process.cwd()
for (const directory of [release, final, reference]) assert(directory.startsWith(`${join(root, "build/cinematic/editorial")}/`))
const manifest = JSON.parse(await readFile(join(release, "manifest.json"), "utf8"))
const layers = [], names = ["ai-workload", "colocation-hall", "platform-systems"]
const label = (text, left, top, width = 360) => layers.push({ left, top, input: Buffer.from(`<svg width="${width}" height="28"><rect width="${width}" height="28" fill="#161A1E"/><text x="12" y="19" font-family="Arial,sans-serif" font-size="12" fill="#F4F7FA">${text}</text></svg>`) })
for (let col = 0; col < names.length; col++) {
  const name = names[col], left = col * 360
  label(`${name} · 128 samples / final WebP`, left, 0)
  layers.push({ left: left + 20, top: 28, input: await sharp(join(release, `${name}-800.webp`)).resize(320, 200).png().toBuffer() })
  label("256-sample reference · 320 × 200", left, 228)
  layers.push({ left: left + 20, top: 256, input: await sharp(join(reference, manifest.family, name, "0000.png")).resize(320, 200).png().toBuffer() })
  label("160 × 100 · normal / 50% pixel brightness", left, 456)
  layers.push({ left: left + 10, top: 484, input: await sharp(join(release, `${name}-480.webp`)).resize(160, 100).png().toBuffer() })
  layers.push({ left: left + 190, top: 484, input: await sharp(join(release, `${name}-480.webp`)).resize(160, 100).modulate({ brightness: .5 }).png().toBuffer() })
  label("160 × 100 · grayscale / grayscale + dim", left, 584)
  layers.push({ left: left + 10, top: 612, input: await sharp(join(release, `${name}-480.webp`)).resize(160, 100).grayscale().png().toBuffer() })
  layers.push({ left: left + 190, top: 612, input: await sharp(join(release, `${name}-480.webp`)).resize(160, 100).grayscale().modulate({ brightness: .5 }).png().toBuffer() })
}
await writeFile(join(final, "quality-sheet.png"), await sharp({ create: { width: 1080, height: 728, channels: 3, background: "#080808" } }).composite(layers).png().toBuffer())
console.log(join(final, "quality-sheet.png"))
