/** Private, hash-bound actual React/R3F capture; no public route or asset registration. */
import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { createServer } from "node:http"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { build, version as esbuildVersion } from "esbuild"
import { chromium } from "@playwright/test"
import sharp from "sharp"
import { manifestSchema } from "../../src/lib/facility/manifest-schema.mjs"

const digest = bytes => createHash("sha256").update(bytes).digest("hex")
const PROFILES = {
  "desktop-poster": { css: [1360, 800], dpr: 1, anisotropy: 2, viewport: [1600, 1100], mobile: false },
  "mobile-native": { css: [340, 255], dpr: 2, anisotropy: 1, viewport: [390, 844], mobile: true },
  "mobile-supersampled": { css: [340, 255], dpr: 3, anisotropy: 1, viewport: [390, 844], mobile: true },
}
const SCOPES = new Set(["sampling", "release", "contact"])
export function captureCases(scope, profile, manifest) {
  assert(SCOPES.has(scope) && Object.hasOwn(PROFILES, profile), "Unknown capture scope/profile")
  const cases = [{ id: "neutral", view: { kind: "overview" }, selected: null, target: null }]
  if (scope === "contact") {
    if (manifest.profile.inspection?.details?.["air-path"]) cases.push({ id: "air-path", view: { kind: "overview", detail: "air-path", section: "air-path" }, selected: null, target: null })
    if (manifest.specimens?.rack) {
      for (const pose of ["closed", "service"]) cases.push({ id: `rack-${pose}`, view: { kind: "specimen", specimen: "rack", pose }, selected: null, target: null })
      // The existing guard requires settled service joints and the explicit
      // cutaway before entering inspection-only connection framing.
      const rack = { door: "open", tray: "extended", cutaway: true }
      cases.push({ id: "rack-service-cutaway", view: { kind: "specimen", specimen: "rack", pose: "service", rack }, selected: null, target: null })
      cases.push({ id: "rack-service-connection", view: { kind: "specimen", specimen: "rack", pose: "service", rack, detail: "service-connection" }, selected: null, target: null })
    }
    if (manifest.specimens?.cooling) cases.push({ id: "cooling-closed", view: { kind: "specimen", specimen: "cooling", pose: "closed" }, selected: null, target: null })
  }
  if (scope === "release" && profile === "desktop-poster") {
    for (const system of ["power", "cooling", "storage", "workloads"]) cases.push({ id: system, view: { kind: "overview" }, selected: system, target: { system } })
    for (const kind of ["rack", "cooling"]) if (manifest.specimens?.[kind]) for (const pose of ["closed", "cutaway", "service"]) cases.push({ id: `${kind}-${pose}`, view: { kind: "specimen", specimen: kind, pose }, selected: null, target: null })
  }
  return cases
}
export function assertOfflineReceipt(result, profileId, item, manifest) {
  const profile = PROFILES[profileId], { receipt } = result
  assert(profile && receipt?.schemaVersion === "facility-offline-frame.v2", "Missing capture receipt with exact restoration proof")
  assert.equal(receipt.profile, profileId)
  const model = manifest.files.find(file => file.file === (item.view.kind === "overview" ? "facility.glb" : `${item.view.specimen}.glb`))
  assert.equal(receipt.state.release, manifest.release); assert.equal(receipt.state.modelSha256, model.sha256)
  assert.equal(receipt.state.generation, 1); assert.equal(receipt.state.selected, item.selected)
  assert.deepEqual(receipt.state.view, item.view); assert.deepEqual(receipt.state.target, item.target)
  assert(receipt.state.visible && receipt.state.ready && receipt.state.still && receipt.state.settled && !receipt.state.disposed, "Capture must be a visible settled still")
  assert.deepEqual(receipt.state.cssSize, profile.css)
  assert.deepEqual(receipt.frame.actualCssSize, profile.css); assert.deepEqual(receipt.frame.canvasCssSize, profile.css)
  assert.deepEqual(receipt.frame.drawingBuffer, profile.css.map(value => value * profile.dpr))
  assert.deepEqual(receipt.frame.canvasSize, receipt.frame.drawingBuffer)
  assert.equal(receipt.frame.dpr, profile.dpr)
  assert(receipt.frame.drawingBuffer[0] * receipt.frame.drawingBuffer[1] <= 4_000_000)
  assert.equal(receipt.frame.sampling.anisotropy, Math.max(1, Math.min(profile.anisotropy, receipt.frame.graphics.maxAnisotropy)))
  assert.equal(receipt.restored.quality, receipt.state.quality)
  assert.deepEqual(receipt.restored, receipt.previous, "Capture did not restore its exact prior DPR/quality/sampling")
  assert(receipt.restored.dpr > 0 && receipt.restored.dpr <= 1.5, "Capture did not restore live DPR")
  assert(/Apple M5.*Metal|Metal.*Apple M5/i.test(receipt.frame.graphics.renderer) && !/SwiftShader|llvmpipe|software/i.test(receipt.frame.graphics.renderer), "Actual M5 Metal rendering required")
  const resources = receipt.frame.resources, overview = item.view.kind === "overview", rack = item.view.kind === "specimen" && item.view.specimen === "rack"
  assert(resources.drawCalls > 0 && resources.drawCalls <= (overview ? 39 : rack ? 35 : 30), "Draw-call budget")
  assert(resources.triangles > 0 && resources.triangles <= (overview ? 40_000 : rack ? 24_000 : 18_000), "Triangle budget")
  assert(resources.materials > 0 && resources.materials <= 10, "Material budget")
  assert(resources.estimatedBytes > 0 && resources.peakEstimatedBytes >= resources.estimatedBytes && resources.peakEstimatedBytes <= 32 * 1024 * 1024, "Allocation budget")
  if (!overview) assert(resources.estimatedBytes - resources.environmentBytes <= 6 * 1024 * 1024, "Specimen allocation budget")
  assert.equal(receipt.frame.color.outputColorSpace, "srgb"); assert.equal(receipt.frame.color.toneMapping, 4)
  assert.equal(receipt.frame.color.exposure, overview ? manifest.profile.exposure : manifest.specimens[item.view.specimen].profile.exposure)
}

export async function prepareOfflineCapture({ manifestPath, manifestHash, scope = "sampling", profiles = scope === "contact" ? ["desktop-poster", "mobile-native"] : Object.keys(PROFILES) }) {
  assert(SCOPES.has(scope)); assert(profiles.length > 0 && new Set(profiles).size === profiles.length && profiles.every(id => Object.hasOwn(PROFILES, id)), "Invalid capture profiles")
  const manifestBytes = await readFile(manifestPath); assert.equal(digest(manifestBytes), manifestHash, "Manifest hash mismatch")
  const manifest = manifestSchema.parse(JSON.parse(manifestBytes)); assert(manifest.profile.engineering && manifest.profile.inspection, "Private poster capture requires an engineering inspection release")
  const inputs = { [resolve(manifestPath)]: manifestHash }, resources = new Map(), token = randomBytes(16).toString("hex"), prefix = `/capture-${token}`
  const source = dirname(resolve(manifestPath)), files = new Map()
  for (const file of manifest.files.filter(file => file.file.endsWith(".glb"))) {
    const path = join(source, file.file), bytes = await readFile(path)
    assert.equal(bytes.length, file.bytes, "Model byte count mismatch"); assert.equal(digest(bytes), file.sha256, "Model hash mismatch")
    inputs[path] = file.sha256
    const url = `${prefix}/assets/${file.sha256}/${file.file}`
    resources.set(url, { type: "model/gltf-binary", bytes }); files.set(file.file, { ...file, url })
  }
  const visualRelease = { ...manifest, model: files.get("facility.glb"), posters: { desktop: { url: "unused-private-poster", bytes: 0, sha256: "0".repeat(64) }, mobile: { url: "unused-private-poster", bytes: 0, sha256: "0".repeat(64) } }, specimens: Object.fromEntries(Object.entries(manifest.specimens ?? {}).map(([kind, descriptor]) => [kind, { ...descriptor, model: files.get(`${kind}.glb`) }])) }
  const bundle = await build({ entryPoints: ["scripts/qa/offline-facility-entry.tsx"], bundle: true, write: false, metafile: true, platform: "browser", format: "esm", target: "es2022", jsx: "automatic", tsconfig: "tsconfig.json", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" })
  assert.equal(bundle.errors.length, 0); assert.equal(bundle.warnings.length, 0, "Unexpected private bundle warning"); assert.equal(bundle.outputFiles.length, 1)
  const script = bundle.outputFiles[0].contents
  for (const file of [...Object.keys(bundle.metafile.inputs), "package-lock.json", "tsconfig.json", "scripts/qa/offline-facility-capture.mjs"]) inputs[resolve(file)] = digest(await readFile(file))
  assert(!Object.keys(bundle.metafile.inputs).some(file => file.includes("node_modules/next/")), "Private fixture must not add a Next runtime")
  resources.set(`${prefix}/entry.js`, { type: "text/javascript", bytes: script })
  resources.set(`${prefix}/`, { type: "text/html", bytes: Buffer.from(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Private facility capture</title><style>html,body{margin:0;background:#080808}#stage{position:relative}canvas{display:block}</style></head><body><div id="stage"></div><script type="module" src="${prefix}/entry.js"></script></body></html>`) })
  resources.set("/favicon.ico", { type: "image/x-icon", bytes: Buffer.alloc(0) })
  return { resources, inputs, manifest, visualRelease, prefix, script, bundleMetafile: bundle.metafile, bundleHash: digest(script), profiles, scope }
}

async function encodePoster(png, dimensions, ceiling) {
  let encoded, quality = 82
  do { encoded = await sharp(png).resize(...dimensions, { kernel: "lanczos3" }).webp({ quality, effort: 6 }).toBuffer(); if (encoded.length <= ceiling) break; quality -= 5 } while (quality >= 47)
  assert(encoded.length <= ceiling, "Poster cannot satisfy its unchanged byte ceiling")
  return { bytes: encoded, quality }
}

export async function runOfflineCapture(options) {
  const prepared = await prepareOfflineCapture(options)
  if (options.validateOnly) return { result: "validated", gpuStarted: false, esbuildVersion, bundleHash: prepared.bundleHash, inputCount: Object.keys(prepared.inputs).length, cases: prepared.profiles.flatMap(profile => captureCases(prepared.scope, profile, prepared.manifest).map(item => `${profile}/${item.id}`)) }
  const output = resolve(options.output), within = relative(resolve("build/qa"), output)
  assert(within && !within.startsWith("..") && !isAbsolute(within), "Fresh private output must be under build/qa")
  await mkdir(dirname(output), { recursive: true }); await mkdir(output)
  const report = { schemaVersion: "facility-offline-capture-run.v1", purpose: "Production Canvas/session, privately bundled. Source capture and poster evidence; not page, performance, human craft, or release qualification.", startedAt: new Date().toISOString(), result: "incomplete", manifestPath: resolve(options.manifestPath), manifestSha256: options.manifestHash, release: prepared.manifest.release, esbuildVersion, bundleHash: prepared.bundleHash, inputs: prepared.inputs, profiles: prepared.profiles, scope: prepared.scope, captures: [], posters: {}, errors: [], cleanup: {}, sourceUnchanged: null }
  await writeFile(join(output, "bundle-metafile.json"), JSON.stringify(prepared.bundleMetafile, null, 2) + "\n")
  await writeFile(join(output, "capture-bundle.js"), prepared.script)
  const server = createServer((request, response) => {
    const resource = prepared.resources.get(request.url)
    if (request.method !== "GET" || request.headers.host !== `127.0.0.1:${server.address().port}` || !resource) { response.writeHead(404); response.end(); return }
    // GLTFLoader's ImageBitmap path fetches its validated embedded texture blobs.
    response.writeHead(200, { "Content-Type": resource.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; object-src 'none'; frame-ancestors 'none'" }); response.end(resource.bytes)
  })
  let browser
  try {
    await new Promise((accept, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", accept) })
    const launch = { channel: "chrome", headless: process.env.FACILITY_HEADED !== "1", args: ["--use-angle=metal", "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] }
    browser = await chromium.launch(launch); report.browser = browser.version(); report.launch = launch
    for (const profileId of prepared.profiles) {
      const profile = PROFILES[profileId]
      const context = await browser.newContext({ viewport: { width: profile.viewport[0], height: profile.viewport[1] }, deviceScaleFactor: 1, isMobile: profile.mobile, hasTouch: profile.mobile, reducedMotion: "reduce" })
      try {
        const page = await context.newPage(); await page.bringToFront()
        page.on("pageerror", error => report.errors.push({ profile: profileId, message: error.message }))
        page.on("console", message => { if (message.type() === "error") report.errors.push({ profile: profileId, message: message.text() }) })
        await page.goto(`http://127.0.0.1:${server.address().port}${prepared.prefix}/`, { timeout: 8000 })
        await page.waitForFunction(() => !!window.__gnOfflineFacility, null, { timeout: 8000 })
        await page.evaluate(({ release, profileId }) => window.__gnOfflineFacility.mount(release, profileId), { release: prepared.visualRelease, profileId })
        for (const item of captureCases(prepared.scope, profileId, prepared.manifest)) {
          await page.evaluate(item => window.__gnOfflineFacility.present(item.view, item.selected, item.target), item)
          await page.waitForFunction(item => {
            const status = window.__gnOfflineFacility.status()
            if (status.failure) throw new Error(status.failure)
            const state = status.capture
            return state?.ready && state.settled && state.still && state.visible && JSON.stringify(state.view) === JSON.stringify(item.view) && state.selected === item.selected && JSON.stringify(state.target) === JSON.stringify(item.target)
          }, item, { timeout: 8000, polling: 50 })
          const result = await page.evaluate(profileId => window.__gnOfflineFacility.capture(profileId), profileId)
          assertOfflineReceipt(result, profileId, item, prepared.manifest)
          const png = Buffer.from(result.png.split(",")[1], "base64"), metadata = await sharp(png).metadata()
          assert.deepEqual([metadata.width, metadata.height], result.receipt.frame.drawingBuffer, "PNG must contain the asserted source pixels")
          const filename = `${profileId}-${item.id}.png`; await writeFile(join(output, filename), png)
          report.captures.push({ profile: profileId, case: item.id, filename, sha256: digest(png), bytes: png.length, receipt: result.receipt })
          let posterName
          if (item.id === "neutral") posterName = profileId === "desktop-poster" ? "poster-desktop.webp" : `poster-${profileId}.webp`
          else if (item.view.kind === "specimen" && item.view.pose !== "service") posterName = `${item.view.specimen}-${item.view.pose}.webp`
          if (posterName && prepared.scope !== "contact") {
            const dimensions = profile.mobile ? [680, 510] : [1360, 800], ceiling = item.view.kind === "overview" ? 150 * 1024 : 60 * 1024
            const encoded = await encodePoster(png, dimensions, ceiling)
            await writeFile(join(output, posterName), encoded.bytes)
            report.posters[posterName] = { sha256: digest(encoded.bytes), bytes: encoded.bytes.length, dimensions, quality: encoded.quality, sourceCapture: filename, sourceSha256: digest(png), kernel: "lanczos3" }
          }
          const restored = await page.evaluate(() => window.__gnOfflineFacility.status().capture)
          assert.equal(restored.quality, result.receipt.state.quality); assert(restored.dpr <= 1.5, "Live DPR did not remain restored")
        }
        await page.evaluate(() => window.__gnOfflineFacility.dispose())
      } finally { await context.close() }
    }
    assert.deepEqual(report.errors, [], "Private capture emitted browser errors")
    const changed = []
    for (const [file, expected] of Object.entries(prepared.inputs)) if (digest(await readFile(file)) !== expected) changed.push(file)
    report.sourceUnchanged = changed.length === 0; report.changedInputs = changed
    assert(report.sourceUnchanged, "Source changed during capture; candidate evidence is stale")
    report.result = "pass"
  } catch (error) { report.result = "fail"; report.failure = error.message }
  finally {
    try { await browser?.close(); report.cleanup.browserClosed = true } catch (error) { report.result = "fail"; report.cleanup.browserCloseError = error.message }
    if (server.listening) await new Promise(accept => server.close(accept))
    report.cleanup.serverClosed = true; report.finishedAt = new Date().toISOString()
    await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n")
  }
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { manifest: { type: "string" }, "manifest-hash": { type: "string" }, output: { type: "string" }, scope: { type: "string", default: "sampling" }, profiles: { type: "string" }, "validate-only": { type: "boolean", default: false } } })
  assert(values.manifest && values["manifest-hash"] && (values.output || values["validate-only"]), "Require --manifest --manifest-hash and --output (or --validate-only)")
  const report = await runOfflineCapture({ manifestPath: values.manifest, manifestHash: values["manifest-hash"], output: values.output, scope: values.scope, profiles: values.profiles?.split(","), validateOnly: values["validate-only"] })
  console.log(JSON.stringify({ result: report.result, output: values.output, captures: report.captures?.length, cases: report.cases, failure: report.failure, bundleHash: report.bundleHash, gpuStarted: report.gpuStarted }))
  if (!["pass", "validated"].includes(report.result)) process.exitCode = 1
}
