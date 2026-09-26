import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createServer } from "node:http"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import ts from "typescript"
import { chromium } from "@playwright/test"
import sharp from "sharp"
import { profileSchema } from "../../src/lib/facility/manifest-schema.mjs"

const sha256 = value => createHash("sha256").update(value).digest("hex")
const sourceFiles = ["src/lib/facility/engineering-materials.ts", "tests/support/facility-material-fixtures.mjs", "scripts/facility/verify-materials.mjs", "tests/unit/facility/fixtures/ecosystem-topology.json", "src/lib/facility/manifest-schema.mjs"]

/** V5's exported appearance contract, deliberately independent of Blender's
 * current palette. A valid shader fixture cannot detect an exporter losing the
 * authored color factor, so check the actual served GLB and embedded pixels. */
export async function verifyV5MaterialAsset(bytes, filename, approvedManifest) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${filename}: GLB header`)
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${filename}: GLB length`)
  const jsonLength = bytes.readUInt32LE(12)
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, `${filename}: JSON chunk`)
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
  const binary = bytes.subarray(28 + jsonLength)
  let practicalFloor = false, neutralFloor = false, finiteLight = null
  if (approvedManifest) {
    // The caller supplies the registry-verified release manifest. A profile
    // alone must never grant an exception to arbitrary served model bytes.
    const files = approvedManifest.files?.filter(file => file.file === filename) ?? []
    assert(files.length === 1 && files[0].bytes === bytes.length && files[0].sha256 === sha256(bytes), `${filename}: approved manifest asset mismatch`)
    const preset = approvedManifest.profile?.lighting?.environment?.preset
    assert(preset === "industrial-softbox-v2" || preset === "industrial-night-v1" || preset === "industrial-night-v2" || preset === "industrial-night-v3", `${filename}: unsupported atlas appearance revision`)
    practicalFloor = preset === "industrial-night-v1" || preset === "industrial-night-v2"
    neutralFloor = preset === "industrial-night-v3"
    // Night v1/v2 carry the frozen warm direct-light floor bake. Night v3
    // deliberately uses neutral albedo with one session-owned finite source;
    // service-light housings alone do not imply baked direct illumination.
    if (neutralFloor) {
      const assetProfile = filename === "facility.glb" ? approvedManifest.profile : approvedManifest.specimens?.[filename.replace(/\.glb$/, "")]?.profile
      const validateFiniteProfile = profile => {
        const parsed = profileSchema.safeParse(profile)
        assert(parsed.success && parsed.data.lighting.environment?.preset === preset, `${filename}: valid matching finite-light asset profile required`)
        const finite = parsed.data.lighting.finite
        assert(finite && finite.intensity > 0, `${filename}: neutral atlas requires an active authored finite light`)
        const rgb = finite.color.match(/[a-f0-9]{2}/gi).map(channel => parseInt(channel, 16))
        assert(Math.max(...rgb) - Math.min(...rgb) <= 2 && Math.min(...rgb) >= 224, `${filename}: finite service illumination must remain neutral`)
        return finite
      }
      // Specimens reuse the overview session's one light slot. A specimen-only
      // declaration cannot establish that the slot was created at activation.
      validateFiniteProfile(approvedManifest.profile)
      finiteLight = validateFiniteProfile(assetProfile)
    }
    if (practicalFloor || neutralFloor) {
      const root = document.nodes.find(node => node.extras?.gnId === "GN_EXPORT")
      if (root) {
        const raw = root.extras.gnPresentation
        const presentation = typeof raw === "string" ? JSON.parse(raw) : raw
        assert(presentation?.version === 1, `${filename}: authored practical lighting presentation missing`)
        assert.deepEqual(presentation.fixtures?.map(fixture => fixture.id), ["service-light-0", "service-light-1"], `${filename}: authored practical lighting fixtures missing`)
      } else {
        // Both explicitly loaded specimens reuse the overview's shared atlas.
        assert(document.nodes.some(node => node.extras?.gnId === "GN_SPECIMEN_ROOT") && ["rack.glb", "cooling.glb"].includes(filename), `${filename}: practical atlas requires an authored overview or specimen`)
      }
    }
  }
  const paint = document.materials.filter(material => material.extras?.gnSurfaceRole === "powder-coat")
  const copper = document.materials.filter(material => material.extras?.gnSurfaceRole === "copper")
  assert(paint.length > 0 && copper.length > 0, `${filename}: expected v5 finish roles`)
  const factor = material => {
    const value = material.pbrMetallicRoughness?.baseColorFactor
    assert(Array.isArray(value) && value.length === 4 && value.every(Number.isFinite), `${filename}/${material.name}: explicit RGBA baseColorFactor required`)
    assert.equal(value[3], 1, `${filename}/${material.name}: opaque authored base factor`)
    return value.slice(0, 3)
  }
  for (const material of paint) {
    const color = factor(material)
    assert(color.every(channel => channel >= 0 && channel < .1), `${filename}/${material.name}: powder coating must remain black in linear RGB`)
    assert(Math.max(...color) - Math.min(...color) < .01, `${filename}/${material.name}: powder coating must remain neutral`)
  }
  for (const material of copper) {
    const [red, green, blue] = factor(material)
    assert(red > green * 1.2 && green > blue * 1.2 && blue >= 0, `${filename}/${material.name}: copper must retain a warm chromatic factor`)
  }
  const colorImages = new Set(document.materials.flatMap(material => {
    const info = material.pbrMetallicRoughness?.baseColorTexture
    return info ? [document.textures[info.index].source] : []
  }))
  assert.equal(colorImages.size, 1, `${filename}: one shared color atlas`)
  const atlas = document.images[[...colorImages][0]], view = document.bufferViews[atlas.bufferView]
  assert.equal(atlas.mimeType, "image/png", `${filename}: lossless color atlas`)
  assert(view.byteLength <= 24 * 1024 && (view.byteOffset ?? 0) + view.byteLength <= binary.length, `${filename}: bounded color atlas`)
  const encoded = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  const metadata = await sharp(encoded).metadata()
  assert(metadata.width === 256 && metadata.height === 256 && metadata.hasAlpha, `${filename}: 256² RGBA color atlas`)
  const { data, info } = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let printedPixels = 0, cutoutPixels = 0, practicalFloorPixels = 0, neutralFloorPixels = 0
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const offset = (y * info.width + x) * 4
    // V5's 64×32 label cell is x192..255, y32..63 in PNG top-left coordinates.
    const printedCell = x >= 192 && y >= 32 && y < 64
    // V7 bakes only the 128×128 floor tile (including its four-pixel gutter).
    // Blender's bottom-left origin becomes y128..255 in PNG coordinates.
    const floorCell = practicalFloor && x < 128 && y >= 128
    const neutralFloorCell = neutralFloor && x < 128 && y >= 128
    const white = data[offset] >= 250 && data[offset + 1] >= 250 && data[offset + 2] >= 250
    if (neutralFloor) {
      assert(printedCell || data[offset] === 255 && data[offset + 1] === 255 && data[offset + 2] === 255, `${filename}: unexpected colored texel in neutral finite-light atlas at ${x},${y}`)
      if (neutralFloorCell) {
        assert(data[offset + 3] === 255, `${filename}: neutral floor must remain opaque at ${x},${y}`)
        neutralFloorPixels++
      }
    }
    assert(printedCell || floorCell || white, `${filename}: unexpected colored texel outside authored atlas cells at ${x},${y}`)
    if (floorCell) {
      const [red, green, blue, alpha] = data.subarray(offset, offset + 4)
      // The frozen bake's .88..1 modulation is warm and opaque. Reject dark,
      // cool-colored or cutout pixels even inside the permitted floor tile.
      assert(red >= green && green >= blue && blue >= 224 && alpha === 255, `${filename}: invalid practical floor texel at ${x},${y}`)
      if (!white) practicalFloorPixels++
    }
    if (printedCell && !white) printedPixels++
    if (data[offset + 3] < 128) cutoutPixels++
  }
  assert(printedPixels > 0, `${filename}: printed label content missing`)
  assert(cutoutPixels > 0, `${filename}: grille coverage content missing`)
  if (practicalFloor) assert(practicalFloorPixels > 0, `${filename}: practical floor illumination missing`)
  return { filename, sha256: sha256(bytes), floorLighting: practicalFloor ? "baked-practical" : neutralFloor ? "runtime-finite-neutral" : "none", finiteLight, paint: paint.map(material => ({ name: material.name, linearRGB: factor(material) })), copper: copper.map(material => ({ name: material.name, linearRGB: factor(material) })), atlas: { bytes: encoded.length, width: info.width, height: info.height, printedPixels, cutoutPixels, practicalFloorPixels, neutralFloorPixels, sha256: sha256(encoded) } }
}

/** Local, exact-allowlist test server. Nothing is added to the application routes. */
export async function createMaterialHarness() {
  const sources = await Promise.all(sourceFiles.map(file => readFile(file)))
  const shader = ts.transpileModule(sources[0].toString(), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const resources = new Map([
    ["/", { type: "text/html", body: '<!doctype html><meta charset="utf-8"><title>Facility material verification</title><style>body{margin:0;background:#000}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/three.module.js"}}</script><script type="module" src="/fixtures.js"></script>' }],
    ["/engineering-materials.js", { type: "text/javascript", body: shader }],
    ["/v6-topology.json", { type: "application/json", body: sources[3] }],
    ["/fixtures.js", { type: "text/javascript", body: sources[1] }],
    ["/three.module.js", { type: "text/javascript", body: await readFile("node_modules/three/build/three.module.js") }],
    ["/three.core.js", { type: "text/javascript", body: await readFile("node_modules/three/build/three.core.js") }],
    ["/favicon.ico", { type: "image/x-icon", body: "" }],
  ])
  const server = createServer((request, response) => {
    const resource = resources.get(request.url)
    if (request.method !== "GET" || !resource) { response.writeHead(404); response.end(); return }
    response.writeHead(200, { "Content-Type": resource.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" })
    response.end(resource.body)
  })
  await new Promise((accept, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", accept) })
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    sourceDigests: Object.fromEntries(sourceFiles.map((file, index) => [file, sha256(sources[index])])),
    close: () => new Promise((accept, reject) => server.close(error => error ? reject(error) : accept())),
  }
}

export async function runMaterialHarness(page, harness, { output } = {}) {
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
  await page.goto(harness.url)
  await page.waitForFunction(() => typeof window.runMaterialFixtures === "function")
  const report = await page.evaluate(() => window.runMaterialFixtures())
  report.sourceDigests = harness.sourceDigests
  report.errors = errors
  if (output) {
    await mkdir(output, { recursive: true })
    for (const name of report.captures) {
      await page.evaluate(name => window.showMaterialCapture(name), name)
      await page.locator("canvas").screenshot({ path: `${output}/${name}.png` })
    }
  }
  try {
    assert.deepEqual(errors, [], "Shader or browser console errors")
    for (const result of report.checks) assert.equal(result.pass, true, `${result.name}: ${JSON.stringify(result.evidence)}`)
  } catch (error) { error.materialReport = report; throw error }
  return report
}

async function main() {
  const output = process.env.FACILITY_MATERIAL_OUTPUT ?? "build/facility/facility-v5/material-benchmark"
  const harness = await createMaterialHarness()
  const native = process.env.FACILITY_ANGLE === "metal"
  const browser = await chromium.launch({ channel: "chrome", headless: process.env.FACILITY_HEADED !== "1", ...(native ? { args: ["--use-angle=metal", "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] } : {}) })
  const report = { schemaVersion: "facility-material-benchmark.v1", measuredAt: new Date().toISOString(), browser: browser.version(), sourceDigests: harness.sourceDigests, result: "incomplete", runs: [] }
  try {
    for (const dpr of [1, 1.5]) {
      const context = await browser.newContext({ viewport: { width: 1000, height: 750 }, deviceScaleFactor: dpr })
      try {
        const page = await context.newPage()
        const result = await runMaterialHarness(page, harness, { output: `${output}/dpr-${dpr}` })
        if (native) assert(/Apple.*Metal|Metal.*Apple/i.test(result.renderer), "Native Apple Metal requested but unavailable")
        report.runs.push({ dpr, ...result })
      } finally { await context.close() }
    }
    report.result = "pass"
  } catch (error) { report.result = "fail"; report.failure = error.message; if (error.materialReport) report.runs.push(error.materialReport); process.exitCode = 1 }
  finally {
    await browser.close(); await harness.close(); await mkdir(output, { recursive: true })
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + "\n")
    console.log(JSON.stringify({ result: report.result, failure: report.failure, checks: report.runs.map(run => run.checks.length), output }))
  }
}

// Playwright compiles imported support modules as CommonJS. Keep the CLI guard
// free of import.meta/top-level await so the same helpers work in its loader.
if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/facility/verify-materials.mjs")) {
  main().catch(error => { console.error(error); process.exitCode = 1 })
}
