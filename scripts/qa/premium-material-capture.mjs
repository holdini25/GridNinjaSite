/** Isolated browser diagnostics; never adds a website route or registers a release. */
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { chromium } from "@playwright/test"
import sharp from "sharp"
import { hash } from "../../assets-source/facility/benchmark-surfaces.mjs"

const RUNTIME = ["asset-runtime", "asset-preflight", "surface-contract", "surface-coverage", "topology-runtime", "engineering-materials", "render-environment", "render-framing", "inspection-camera", "inspection-contract", "rack-motion", "finite-light"]
const MODES = ["final", "gray", "normal", "roughness", "ao", "metalness", "uv"]
const POSES = { overview: ["overview"], rack: ["closed", "cutaway", "service", "service-connection"], cooling: ["closed", "cutaway", "service"] }
const PATCHES = new Set(["profile.lighting.finite.position", "profile.lighting.finite.intensity", "profile.lighting.directional.0.intensity", "profile.lighting.directional.1.intensity", "profile.lighting.hemisphere.intensity", ...["rack", "cooling"].flatMap(kind => [`specimens.${kind}.profile.lighting.finite.position`, `specimens.${kind}.profile.lighting.finite.intensity`])])
export function patchLighting(manifest, patches = []) {
  const candidate = structuredClone(manifest), paths = new Set()
  for (const { path, value } of patches) {
    assert(PATCHES.has(path) && !paths.has(path), `Unsupported/repeated lighting patch: ${path}`); paths.add(path)
    assert(path.endsWith(".position") ? Array.isArray(value) && value.length === 3 && value.every(n => Number.isFinite(n) && Math.abs(n) <= 20) : Number.isFinite(value) && value >= 0 && value <= (path.includes(".finite.") ? 50 : 5), `Invalid lighting value: ${path}`)
    const parts = path.split("."), leaf = parts.pop(); let owner = candidate
    for (const part of parts) { assert(owner && Object.hasOwn(owner, part), `Missing lighting path: ${path}`); owner = owner[part] }
    assert(Object.hasOwn(owner, leaf), `Missing lighting field: ${path}`); owner[leaf] = value
  }
  return candidate
}

export async function prepareCapture(config) {
  assert.equal(config.schemaVersion, "premium-material-capture.v1")
  assert(config.variants?.length > 0 && config.variants.length <= 8)
  assert(config.cases?.length > 0 && config.cases.length <= 24)
  assert(config.modes?.length > 0 && config.modes.every(mode => MODES.includes(mode)) && new Set(config.modes).size === config.modes.length)
  assert(config.dprs?.length > 0 && config.dprs.every(dpr => [1, 1.5].includes(dpr)))
  const resources = new Map(), sourceDigests = {}, variants = [], ids = new Set()
  async function moduleFile(url, file, transpile = false) {
    const bytes = await readFile(file); sourceDigests[file] = hash(bytes)
    const body = transpile ? ts.transpileModule(bytes.toString(), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replaceAll('"@/types/facility"', '"/runtime/types"') : bytes
    resources.set(url, { type: "text/javascript", body })
  }
  for (const name of RUNTIME) await moduleFile(`/runtime/${name}`, `src/lib/facility/${name}.ts`, true)
  await moduleFile("/runtime/types", "src/types/facility.ts", true)
  await moduleFile("/fixture.js", "scripts/qa/premium-material-fixture.mjs")
  for (const name of ["build/three.module.js", "build/three.core.js", "examples/jsm/loaders/GLTFLoader.js", "examples/jsm/utils/BufferGeometryUtils.js", "examples/jsm/utils/SkeletonUtils.js"]) await moduleFile(`/vendor/three/${name}`, `node_modules/three/${name}`)
  for (const file of ["package-lock.json", "scripts/qa/premium-material-capture.mjs"]) sourceDigests[file] = hash(await readFile(file))
  resources.set("/", { type: "text/html", body: '<!doctype html><meta charset="utf-8"><title>Private material comparison</title><style>body{margin:0;background:#080808}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/":"/vendor/three/"}}</script><script type="module" src="/fixture.js"></script>' })
  resources.set("/favicon.ico", { type: "image/x-icon", body: "" })
  for (const variant of config.variants) {
    assert(/^[a-z0-9-]+$/.test(variant.id) && !ids.has(variant.id), "Unique safe variant ID required"); ids.add(variant.id)
    const bytes = await readFile(join(variant.directory, "manifest.json")); assert.equal(hash(bytes), variant.manifestSha256, `${variant.id}: manifest hash changed`)
    const input = JSON.parse(bytes), manifest = patchLighting(input, variant.patches), files = new Map()
    for (const filename of ["facility.glb", "rack.glb", "cooling.glb"]) {
      const model = await readFile(join(variant.directory, filename)), entry = input.files.find(file => file.file === filename)
      assert(entry && entry.bytes === model.length && entry.sha256 === hash(model), `${variant.id}/${filename}: model identity mismatch`)
      const url = `/assets/${variant.id}/${filename}`
      files.set(filename, { url, bytes: model.length, sha256: hash(model) })
      resources.set(url, { type: "model/gltf-binary", body: model })
    }
    const visualRelease = { ...manifest, model: files.get("facility.glb"), specimens: Object.fromEntries(Object.entries(manifest.specimens).map(([kind, descriptor]) => [kind, { ...descriptor, model: files.get(`${kind}.glb`) }])) }
    variants.push({ id: variant.id, hypothesis: variant.hypothesis, sourceManifestSha256: hash(bytes), effectiveProfileSha256: hash(Buffer.from(JSON.stringify({ profile: manifest.profile, specimens: Object.fromEntries(Object.entries(manifest.specimens).map(([kind, descriptor]) => [kind, descriptor.profile])) }))), patches: variant.patches ?? [], assetHashes: Object.fromEntries([...files].map(([name, file]) => [name, file.sha256])), visualRelease })
  }
  for (const item of config.cases) assert(/^[a-z0-9-]+$/.test(item.id) && POSES[item.kind]?.includes(item.pose) && Array.isArray(item.cssSize) && item.cssSize.length === 2 && item.cssSize.every(value => Number.isInteger(value) && value >= 240 && value <= 1920), "Invalid capture case")
  assert.equal(new Set(config.cases.map(item => item.id)).size, config.cases.length, "Case IDs must be unique")
  return { resources, sourceDigests, variants }
}

async function run(configPath, expectedHash, output, validateOnly) {
  const configBytes = await readFile(configPath); assert.equal(hash(configBytes), expectedHash, "Capture configuration changed")
  const config = JSON.parse(configBytes), prepared = await prepareCapture(config)
  if (validateOnly) { console.log(JSON.stringify({ validated: true, variants: prepared.variants.map(v => v.id), cases: config.cases.length, captureCount: config.cases.length * config.modes.length * config.dprs.length * prepared.variants.length, gpuStarted: false })); return }
  const destination = resolve(output), inside = relative(resolve("build/qa"), destination)
  assert(inside && !inside.startsWith("..") && !isAbsolute(inside), "Capture output must remain under build/qa")
  await mkdir(dirname(destination), { recursive: true }); await mkdir(destination)
  const variantRecords = prepared.variants.map(variant => { const record = { ...variant }; delete record.visualRelease; return record })
  const report = { schemaVersion: "premium-material-review.v1", purpose: "Hash-bound local diagnostic comparison; no public registration, performance qualification or art approval", capturedAt: new Date().toISOString(), configSha256: hash(configBytes), sourceDigests: prepared.sourceDigests, variants: variantRecords, graphics: [], captures: [], errors: [], result: "incomplete" }
  const server = createServer((request, response) => {
    const resource = prepared.resources.get(request.url)
    if (request.method !== "GET" || !resource) { response.writeHead(404); response.end(); return }
    response.writeHead(200, { "Content-Type": resource.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(resource.body)
  })
  let browser
  try {
    await new Promise((accept, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", accept) })
    browser = await chromium.launch({ channel: "chrome", headless: process.env.FACILITY_HEADED !== "1", args: ["--use-angle=metal", "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] })
    report.browser = browser.version()
    const session = await browser.newBrowserCDPSession(); report.systemInfo = await session.send("SystemInfo.getInfo"); await session.detach()
    for (const variant of prepared.variants) {
      const context = await browser.newContext({ viewport: { width: 1020, height: 600 }, deviceScaleFactor: 1, reducedMotion: "reduce" })
      try {
        const page = await context.newPage()
        page.on("pageerror", error => report.errors.push({ variant: variant.id, error: error.message }))
        page.on("console", message => { if (message.type() === "error") report.errors.push({ variant: variant.id, error: message.text() }) })
        await page.goto(`http://127.0.0.1:${server.address().port}`, { timeout: 8000 })
        await page.waitForFunction(() => typeof window.prepareAssetMaterialBenchmark === "function", null, { timeout: 8000 })
        const graphics = await page.evaluate(release => window.prepareAssetMaterialBenchmark(release), variant.visualRelease)
        assert(/Apple M5.*Metal|Metal.*Apple M5/i.test(graphics.renderer) && !/SwiftShader|llvmpipe|software/i.test(graphics.renderer), `Actual M5 Metal required: ${graphics.renderer}`)
        report.graphics.push({ variant: variant.id, ...graphics })
        for (const item of config.cases) for (const dpr of config.dprs) for (const mode of config.modes) {
          const result = await page.evaluate(options => window.captureAssetMaterial(options), { ...item, dpr, mode })
          assert.deepEqual(result.cssSize, item.cssSize, `CSS capture dimensions drifted: ${item.id}`)
          assert.deepEqual(result.drawingBuffer, item.cssSize.map(value => Math.floor(value * dpr)), `Drawing buffer dimensions drifted: ${item.id}/${dpr}`)
          const filename = `${variant.id}-${item.id}-dpr${dpr}-${mode}.png`, image = Buffer.from(result.png.split(",")[1], "base64"); delete result.png
          const imageMetadata = await sharp(image).metadata()
          assert.deepEqual([imageMetadata.width, imageMetadata.height], result.drawingBuffer, `PNG dimensions drifted: ${item.id}/${dpr}`)
          await writeFile(join(destination, filename), image)
          report.captures.push({ variant: variant.id, case: item.id, filename, sha256: hash(image), ...result })
        }
        await page.evaluate(() => window.disposeAssetMaterialBenchmark())
      } finally { await context.close() }
    }
    assert.deepEqual(report.errors, [], "Browser material diagnostics emitted errors")
    // Comparative sheets use exact same case/DPR across variant columns.
    report.sheets = []
    for (const item of config.cases) for (const mode of config.modes) {
      const captures = report.captures.filter(capture => capture.case === item.id && capture.mode === mode && capture.dpr === config.dprs[0])
      const width = Math.min(item.cssSize[0], 706), height = Math.round(width * item.cssSize[1] / item.cssSize[0])
      const layers = await Promise.all(captures.map(async (capture, index) => ({ input: await sharp(join(destination, capture.filename)).resize(width, height).png().toBuffer(), left: index * width, top: 32 })))
      const labels = `<svg width="${width * captures.length}" height="32">${captures.map((capture, i) => `<text x="${i * width + 8}" y="22" fill="#eee" font-size="15" font-family="sans-serif">${capture.variant}</text>`).join("")}</svg>`
      layers.push({ input: Buffer.from(labels), left: 0, top: 0 })
      const filename = `compare-${item.id}-${mode}.png`
      await sharp({ create: { width: width * captures.length, height: height + 32, channels: 4, background: "#080808" } }).composite(layers).png().toFile(join(destination, filename))
      report.sheets.push({ filename, sha256: hash(await readFile(join(destination, filename))), variants: captures.map(capture => capture.variant), case: item.id, mode })
    }
    report.result = "pass"
  } catch (error) { report.result = "fail"; report.failure = error.message; process.exitCode = 1 }
  finally { await browser?.close(); if (server.listening) await new Promise(accept => server.close(accept)); await writeFile(join(destination, "report.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify({ result: report.result, failure: report.failure, captures: report.captures.length, output: destination })) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { config: { type: "string" }, "config-hash": { type: "string" }, output: { type: "string" }, "validate-only": { type: "boolean", default: false } } })
  assert(values.config && values["config-hash"] && (values.output || values["validate-only"]), "--config, --config-hash and --output (or --validate-only) required")
  await run(values.config, values["config-hash"], values.output, values["validate-only"])
}
