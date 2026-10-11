import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import sharp from "sharp"

const root = process.cwd()
const directory = resolve(process.argv[2] ?? "")
if (!directory.startsWith(`${join(root, "build/cinematic/editorial")}/`)) throw new Error("Private editorial directory required")
const report = JSON.parse(await readFile(join(directory, "studies-all-all-report.json"), "utf8"))
if (report.status !== "complete" || report.frames.length !== 9) throw new Error("Complete nine-composition study required")
const layers = []
for (let index = 0; index < report.frames.length; index++) {
  const frame = report.frames[index]
  const input = await sharp(join(directory, frame.family, frame.subject, "0000.png")).resize(400, 250).png().toBuffer()
  const left = (index % 3) * 400, top = Math.floor(index / 3) * 286
  layers.push({ input, left, top })
  const label = `<svg width="400" height="36"><rect width="400" height="36" fill="#161A1E"/><text x="14" y="24" font-family="Arial,sans-serif" font-size="13" fill="#F4F7FA">${frame.family} · ${frame.subject}</text></svg>`
  layers.push({ input: Buffer.from(label), left, top: top + 250 })
}
await writeFile(join(directory, "contact-sheet.jpg"), await sharp({ create: { width: 1200, height: 858, channels: 3, background: "#080808" } }).composite(layers).jpeg({ quality: 95 }).toBuffer())
console.log(join(directory, "contact-sheet.jpg"))
