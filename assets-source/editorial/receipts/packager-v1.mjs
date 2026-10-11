/** Create a private, content-addressed delivery candidate. Registration is a separate reviewed operation. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import sharp from "sharp"

const sha = bytes => createHash("sha256").update(bytes).digest("hex")
const args = process.argv.slice(2)
assert(args.length === 4, "Usage: package.mjs FINAL_DIRECTORY REFERENCE_DIRECTORY FAMILY OUTPUT_DIRECTORY")
const [final, reference, family, output] = [resolve(args[0]), resolve(args[1]), args[2], resolve(args[3])]
const root = process.cwd()
for (const directory of [final, reference, output]) assert(directory.startsWith(`${join(root, "build/cinematic/editorial")}/`), "Private editorial directory required")
const finalBytes = await readFile(join(final, `final-${family}-all-report.json`))
const referenceBytes = await readFile(join(reference, `reference-${family}-all-report.json`))
const report = JSON.parse(finalBytes), referenceReport = JSON.parse(referenceBytes)
assert(report.status === "complete" && referenceReport.status === "complete", "Both render sets must finish")
assert(report.samples === 128 && referenceReport.samples === 256 && report.threads === 4 && report.adaptiveThreshold === .005, "Reviewed final/reference settings required")
assert(report.frames.length === 3 && referenceReport.frames.length === 3, "Three complete subjects required")
assert.deepEqual(report.source, referenceReport.source, "Reference must share the final source identity")
assert(report.source.device.requested === "metal" && report.source.device.cyclesDevice === "GPU", "Metal provenance required; an explicit CPU fallback needs a separately reviewed contract")
await mkdir(output, { recursive: false })
const files = [], subjects = {}, comparison = []
for (const frame of report.frames) {
  const referenceFrame = referenceReport.frames.find(item => item.subject === frame.subject)
  assert.deepEqual(frame.camera, referenceFrame.camera, "Final/reference cameras must match")
  const png = await readFile(join(final, family, frame.subject, "0000.png"))
  const exr = await readFile(join(final, family, frame.subject, "0000.exr"))
  const ref = await readFile(join(reference, family, frame.subject, "0000.png"))
  assert(sha(png) === frame.files.find(item => item.file === "0000.png").sha256, "Final PNG integrity failure")
  assert(sha(exr) === frame.files.find(item => item.file === "0000.exr").sha256, "Final EXR integrity failure")
  assert(sha(ref) === referenceFrame.files.find(item => item.file === "0000.png").sha256, "Reference PNG integrity failure")
  const a = await sharp(png).removeAlpha().raw().toBuffer(), b = await sharp(ref).removeAlpha().raw().toBuffer()
  assert(a.length === b.length)
  let absolute = 0, squared = 0, maximum = 0
  for (let index = 0; index < a.length; index++) { const delta = Math.abs(a[index] - b[index]); absolute += delta; squared += delta * delta; maximum = Math.max(maximum, delta) }
  comparison.push({ subject: frame.subject, meanAbsoluteError8Bit: absolute / a.length, rootMeanSquareError8Bit: Math.sqrt(squared / a.length), maximumError8Bit: maximum, referencePngSha256: sha(ref), finalSeconds: frame.seconds, referenceSeconds: referenceFrame.seconds })
  subjects[frame.subject] = { camera: frame.camera, equipmentIds: frame.equipmentIds, masterPngSha256: sha(png), masterExrSha256: sha(exr), referencePngSha256: sha(ref) }
  for (const width of [480, 800, 1280]) {
    const height = width * 5 / 8
    let bytes, quality
    for (quality = 90; quality >= 68; quality -= 2) {
      bytes = await sharp(png).resize(width, height, { fit: "fill", kernel: "lanczos3" }).webp({ quality, effort: 6 }).toBuffer()
      if (bytes.length <= 200 * 1024) break
    }
    assert(bytes.length <= 200 * 1024, "WebP ceiling exceeded")
    const file = `${frame.subject}-${width}.webp`
    await writeFile(join(output, file), bytes, { flag: "wx" })
    files.push({ file, subject: frame.subject, width, height, bytes: bytes.length, sha256: sha(bytes), mimeType: "image/webp", quality })
  }
}
const manifest = {
  schemaVersion: "editorial.v1", release: "editorial-v1", environment: "synthetic", family,
  source: { masterIdentity: "gridninja-facility-shared-master", masterSha256: report.source.masterSha256,
    settingsSha256: report.source.settingsSha256, cinematicRendererSha256: report.source.rendererSha256,
    editorialRendererSha256: report.source.editorialRendererSha256, computeSourceSha256: report.source.computeSourceSha256,
    supervisorSha256: report.source.supervisorSha256,
    finalReportSha256: sha(finalBytes), referenceReportSha256: sha(referenceBytes),
    packagerSha256: sha(await readFile(new URL(import.meta.url))), blenderVersion: report.source.blenderVersion,
    blenderBuildHash: report.source.blenderBuildHash, nodeVersion: process.version, sharpVersion: sharp.versions.sharp,
    webpVersion: sharp.versions.webp },
  render: { width: 1600, height: 1000, samples: 128, referenceSamples: 256, adaptiveThreshold: .005,
    threads: 4, device: "METAL", colorTransform: "AgX", look: "Medium High Contrast", delivery: "sRGB", motionBlur: false },
  subjects, files,
}
await writeFile(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" })
await writeFile(join(final, "delivery-comparison.json"), JSON.stringify({ family, comparison, manifestSha256: sha(await readFile(join(output, "manifest.json"))) }, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify({ output, comparison, files: files.map(({ file, bytes, quality }) => ({ file, bytes, quality })) }, null, 2))
