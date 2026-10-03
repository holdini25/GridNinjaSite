/** Adopt actual private Three captures without freezing/registering a release. */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile, writeFile, mkdir, copyFile, rename } from "node:fs/promises"
import { isAbsolute, join, relative, resolve } from "node:path"
import { parseArgs } from "node:util"
import { assertOfflineReceipt, captureCases } from "../qa/offline-facility-capture.mjs"
import { hash, manifestSchema, releasePattern, validateFacilityDirectory } from "./validate-release.mjs"

const { values } = parseArgs({ options: { capture: { type: "string" } } })
assert(values.capture, "Usage: adopt-surface-posters.mjs --capture build/qa/<private-capture>")
const captureRoot = resolve(values.capture), within = relative(resolve("build/qa"), captureRoot)
assert(within && !within.startsWith("..") && !isAbsolute(within), "Capture must be private build/qa evidence")
const reportBytes = await readFile(join(captureRoot, "report.json")), report = JSON.parse(reportBytes)
assert(report.result === "pass" && report.sourceUnchanged === true && report.scope === "release", "A complete matching native capture is required")
assert(report.cleanup?.browserClosed && report.cleanup?.serverClosed, "Capture must release its renderer and server")
assert.deepEqual(report.errors, [])
assert(releasePattern.test(report.release), "Invalid release")
const registry = JSON.parse(await readFile("src/content/facility-releases/registry.json", "utf8"))
assert(!registry.some(item => item.release === report.release), "Never change a registered release")
const root = resolve("build/facility", report.release), current = join(root, "release")
const original = await readFile(join(current, "manifest.json")), manifest = manifestSchema.parse(JSON.parse(original))
assert.equal(hash(original), report.manifestSha256, "Capture belongs to a different candidate")
assert(manifest.source.derivation?.kind === "gltf-surface-derivative.v1", "Only a private surface derivative may use this path")
for (const [file, digest] of Object.entries(report.inputs)) assert.equal(hash(await readFile(file)), digest, `Capture source changed: ${file}`)
for (const profile of ["desktop-poster", "mobile-native"]) for (const item of captureCases("release", profile, manifest)) {
  const matches = report.captures.filter(capture => capture.profile === profile && capture.case === item.id)
  assert.equal(matches.length, 1, `Missing/duplicate native frame: ${profile}/${item.id}`)
  const capture = matches[0]
  assertOfflineReceipt({ receipt: capture.receipt }, profile, item, manifest)
  assert.equal(hash(await readFile(join(captureRoot, capture.filename))), capture.sha256, "Captured frame changed")
}
const temporary = join(root, `.posters-${randomUUID()}`)
await mkdir(temporary)
for (const file of manifest.files) {
  if (!file.file.endsWith(".webp")) {
    assert.equal(hash(await readFile(join(current, file.file))), file.sha256)
    await copyFile(join(current, file.file), join(temporary, file.file))
    continue
  }
  const sourceName = file.file === "poster-mobile.webp" ? "poster-mobile-native.webp" : file.file
  const poster = report.posters[sourceName]
  assert(poster, `Missing fresh poster ${sourceName}`)
  const bytes = await readFile(join(captureRoot, sourceName))
  assert.equal(bytes.length, poster.bytes); assert.equal(hash(bytes), poster.sha256)
  const sourceFrame = report.captures.find(capture => capture.filename === poster.sourceCapture)
  assert(sourceFrame && sourceFrame.sha256 === poster.sourceSha256, "Poster needs its exact source frame")
  file.bytes = bytes.length; file.sha256 = hash(bytes)
  await writeFile(join(temporary, file.file), bytes)
}
const updated = Buffer.from(JSON.stringify(manifest, null, 2) + "\n")
await writeFile(join(temporary, "manifest.json"), updated)
await validateFacilityDirectory(temporary, report.release, { reportPath: join(root, "posters-validation.json") })
const preserved = join(root, `pre-posters-${hash(original).slice(0, 12)}`)
await rename(current, preserved)
try { await rename(temporary, current) } catch (error) { await rename(preserved, current); throw error }
await writeFile(join(root, "poster-adoption.json"), JSON.stringify({
  release: report.release, status: "native-captured-awaiting-visual-review", previousManifestSha256: hash(original), manifestSha256: hash(updated),
  captureReport: relative(process.cwd(), join(captureRoot, "report.json")), captureReportSha256: hash(reportBytes),
  source: manifest.source.derivation, preserved: relative(process.cwd(), preserved), registered: false,
}, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify({ release: report.release, manifestSha256: hash(updated), status: "Native posters adopted; visual review and publication remain separate." }))
