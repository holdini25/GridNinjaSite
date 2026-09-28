/** Explicit CPU-only selection of reviewed private captures. Never registers assets. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import sharp from "sharp"
import { assertOfflineReceipt, captureCases } from "./offline-facility-capture.mjs"
import { manifestSchema } from "../../src/lib/facility/manifest-schema.mjs"

const hash = value => createHash("sha256").update(value).digest("hex")
export function estimateOfflineFramebuffer(frame) {
  const [width, height] = frame.drawingBuffer, reportedSamples = frame.graphics.samples
  assert([width, height].every(value => Number.isInteger(value) && value > 0) && Number.isInteger(reportedSamples) && reportedSamples >= 0, "Framebuffer estimate requires actual dimensions/sample count")
  const multisampled = frame.graphics.antialias && reportedSamples > 1
  // The existing receipt does not query DEPTH_BITS/STENCIL_BITS. Do not turn
  // those absent counters into measured values; assume aligned32-bit storage.
  const colorBytesPerPixel = 4, assumedDepthStencilBytesPerPixel = 4
  const attachmentBytes = width * height * (colorBytesPerPixel + assumedDepthStencilBytesPerPixel) * (multisampled ? reportedSamples : 1)
  const resolvedColorBytes = multisampled ? width * height * colorBytesPerPixel : 0
  return { schemaVersion: "offline-framebuffer-estimate.v1", drawingBuffer: [width, height], reportedSamples, reportedAntialias: frame.graphics.antialias, measuredDepthBits: null, measuredStencilBits: null, assumedColorFormat: "RGBA8", assumedDepthStencilBits: 32, attachmentBytes, resolvedColorBytes, estimatedBytes: attachmentBytes + resolvedColorBytes, estimatedMiB: (attachmentBytes + resolvedColorBytes) / 1024 / 1024, excludes: ["driver overhead", "compositor/swapchain buffers", "CPU PNG encoding/readback", "asset and environment allocations"], interpretation: "Storage estimate from recorded dimensions and samples, with assumed formats; not measured GPU allocation. Separate from the32MiB asset/staging ceiling." }
}
export async function adoptOfflinePosters({ reportPath, reportHash, mobileSource, output }) {
  assert(["native", "supersampled"].includes(mobileSource), "Explicit --mobile-source native|supersampled required")
  const reportBytes = await readFile(reportPath); assert.equal(hash(reportBytes), reportHash, "Capture report changed")
  const report = JSON.parse(reportBytes)
  assert(report.result === "pass" && report.scope === "release" && report.sourceUnchanged === true && report.cleanup.browserClosed === true && report.cleanup.serverClosed === true, "Require a complete passing release capture with cleanup")
  const manifestBytes = await readFile(report.manifestPath); assert.equal(hash(manifestBytes), report.manifestSha256, "Source manifest changed")
  const manifest = manifestSchema.parse(JSON.parse(manifestBytes)), source = dirname(resolve(reportPath))
  const inputsChanged = []
  for (const [file, expected] of Object.entries(report.inputs)) if (hash(await readFile(file)) !== expected) inputsChanged.push(file)
  assert.deepEqual(inputsChanged, [], "Capture dependencies changed; recapture instead of combining candidates")
  const destination = resolve(output), within = relative(resolve("build/qa"), destination)
  assert(within && !within.startsWith("..") && !isAbsolute(within), "Adoption destination must be a fresh private build/qa directory")
  const mobileProfile = `mobile-${mobileSource}`
  assert(report.profiles.includes("desktop-poster") && report.profiles.includes(mobileProfile), "Selected source profiles were not captured")
  const captures = new Map(), artifactBytes = new Map()
  for (const profile of report.profiles) for (const item of captureCases("release", profile, manifest)) {
    const found = report.captures.filter(capture => capture.profile === profile && capture.case === item.id)
    assert.equal(found.length, 1, "Missing/duplicated reference capture")
    const capture = found[0]; assertOfflineReceipt(capture, profile, item, manifest)
    assert(/^[a-z0-9-]+\.png$/.test(capture.filename), "Invalid private capture path")
    const bytes = await readFile(join(source, capture.filename)); assert.equal(hash(bytes), capture.sha256, "Source PNG changed")
    const metadata = await sharp(bytes).metadata(); assert.deepEqual([metadata.width, metadata.height], capture.receipt.frame.drawingBuffer)
    captures.set(`${profile}/${item.id}`, capture); artifactBytes.set(capture.filename, bytes)
  }
  const canonical = new Map([["poster-desktop.webp", "poster-desktop.webp"], ["poster-mobile.webp", `poster-${mobileProfile}.webp`]])
  for (const kind of Object.keys(manifest.specimens ?? {})) for (const pose of ["closed", "cutaway"]) canonical.set(`${kind}-${pose}.webp`, `${kind}-${pose}.webp`)
  const posters = {}, posterRecords = {}
  for (const [filename, original] of canonical) {
    const record = report.posters[original]; assert(record, `Missing encoded ${original}`)
    const bytes = await readFile(join(source, original)); assert.equal(hash(bytes), record.sha256); assert.equal(bytes.length, record.bytes)
    const dimensions = filename === "poster-mobile.webp" ? [680, 510] : [1360, 800]
    const ceiling = filename.startsWith("poster-") ? 150 * 1024 : 60 * 1024
    assert(bytes.length <= ceiling, "Poster byte ceiling")
    const metadata = await sharp(bytes).metadata(); assert.equal(metadata.format, "webp"); assert.deepEqual([metadata.width, metadata.height], dimensions)
    const capture = report.captures.find(candidate => candidate.filename === record.sourceCapture)
    assert(capture && capture.sha256 === record.sourceSha256, "Encoded poster source mismatch")
    posters[filename] = record.sha256; posterRecords[filename] = { ...record, selectedOriginal: original, offlineFramebufferEstimate: estimateOfflineFramebuffer(capture.receipt.frame) }; artifactBytes.set(filename, bytes)
  }
  // Retain the established visible-selection check at identical camera/time.
  const neutral = captures.get("desktop-poster/neutral"), pixels = await sharp(artifactBytes.get(neutral.filename)).removeAlpha().raw().toBuffer(), selectionPixels = {}
  for (const system of ["power", "cooling", "storage", "workloads"]) {
    const capture = captures.get(`desktop-poster/${system}`), selected = await sharp(artifactBytes.get(capture.filename)).removeAlpha().raw().toBuffer()
    assert.equal(selected.length, pixels.length)
    let changed = 0
    for (let index = 0; index < pixels.length; index += 3) if (Math.max(Math.abs(pixels[index] - selected[index]), Math.abs(pixels[index + 1] - selected[index + 1]), Math.abs(pixels[index + 2] - selected[index + 2])) >= 8) changed++
    assert(changed >= 100, `${system} selection is visually absent`); selectionPixels[system] = changed
  }
  const mobile = captures.get(`${mobileProfile}/neutral`), specimens = {}
  for (const [kind, descriptor] of Object.entries(manifest.specimens ?? {})) specimens[kind] = {
    modelSha256: manifest.files.find(file => file.file === `${kind}.glb`).sha256,
    profileSha256: hash(Buffer.from(JSON.stringify(descriptor.profile))),
    poses: Object.fromEntries(["closed", "cutaway", "service"].map(pose => { const capture = captures.get(`desktop-poster/${kind}-${pose}`); return [pose, { ...capture.receipt.frame.resources, receipt: capture.receipt }] })),
  }
  const captureProfile = {
    release: manifest.release, baseURL: "private-loopback-production-canvas", browser: report.browser, launch: report.launch,
    graphics: neutral.receipt.frame.graphics, viewport: [1360, 800], mobileViewport: [340, 255], reducedMotion: true,
    modelSha256: neutral.receipt.state.modelSha256, profileSha256: hash(Buffer.from(JSON.stringify(manifest.profile))), posters, selectionPixels, specimens,
    metadata: { ...neutral.receipt.frame.resources, receipt: neutral.receipt }, mobileMetadata: { ...mobile.receipt.frame.resources, receipt: mobile.receipt },
    offlineCapture: { version: 2, reportPath: resolve(reportPath), reportSha256: reportHash, bundleSha256: report.bundleHash, mobileSource, sourcePixelsVerified: true, exactRestorationVerified: true, actualCssBoundsVerified: true, posterRecords, noPublicRegistration: true },
  }
  await mkdir(dirname(destination), { recursive: true }); await mkdir(destination)
  for (const filename of canonical.keys()) await writeFile(join(destination, filename), artifactBytes.get(filename), { flag: "wx" })
  for (const [system, capture] of ["neutral", "power", "cooling", "storage", "workloads"].map(system => [system, captures.get(`desktop-poster/${system}`)])) await writeFile(join(destination, `state-${system}.png`), artifactBytes.get(capture.filename), { flag: "wx" })
  // This review image is explicitly delivery-sized; the raw master stays in reportPath.
  await sharp(artifactBytes.get(mobile.filename)).resize(680, 510, { kernel: "lanczos3" }).png().toFile(join(destination, "state-mobile-neutral.png"))
  for (const kind of Object.keys(specimens)) for (const pose of ["closed", "cutaway", "service"]) { const capture = captures.get(`desktop-poster/${kind}-${pose}`); await writeFile(join(destination, `${kind}-${pose}.png`), artifactBytes.get(capture.filename), { flag: "wx" }) }
  await writeFile(join(destination, "capture-profile.json"), JSON.stringify(captureProfile, null, 2) + "\n", { flag: "wx" })
  return { result: "pass", output: destination, posters, mobileSource, reportSha256: reportHash, publicRegistration: false }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { report: { type: "string" }, "report-hash": { type: "string" }, "mobile-source": { type: "string" }, output: { type: "string" } } })
  assert(values.report && values["report-hash"] && values["mobile-source"] && values.output, "Require --report --report-hash --mobile-source native|supersampled --output")
  console.log(JSON.stringify(await adoptOfflinePosters({ reportPath: values.report, reportHash: values["report-hash"], mobileSource: values["mobile-source"], output: values.output })))
}
