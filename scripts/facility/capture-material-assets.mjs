import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createServer } from "node:http"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import ts from "typescript"
import { chromium } from "@playwright/test"
import sharp from "sharp"

const release = process.env.FACILITY_ASSET_RELEASE ?? "facility-v5"
const directory = process.env.FACILITY_MATERIAL_ASSET_DIRECTORY ?? `build/facility/${release}/release`
const output = process.env.FACILITY_MATERIAL_ASSET_OUTPUT ?? `build/facility/${release}/asset-material-benchmark`
const kinds = (process.env.FACILITY_MATERIAL_BENCHMARK_KINDS ?? "rack,cooling").split(",")
assert(kinds.length && kinds.every(kind => ["overview", "rack", "cooling"].includes(kind)), "Unsupported material benchmark subject")
const modes = (process.env.FACILITY_MATERIAL_BENCHMARK_MODES ?? "final,gray,normal,roughness").split(",")
assert(modes.length && modes.every(mode => ["final", "gray", "normal", "roughness"].includes(mode)), "Unsupported material benchmark mode")
const sizes = (process.env.FACILITY_MATERIAL_BENCHMARK_SIZES ?? "desktop").split(",").map(name => {
  assert(["desktop", "mobile"].includes(name), "Unsupported material benchmark size")
  return { name, cssSize: name === "mobile" ? [390, 459] : [1020, 600] }
})
const serviceDetail = process.env.FACILITY_MATERIAL_BENCHMARK_SERVICE_DETAIL === "1"
const digest = bytes => createHash("sha256").update(bytes).digest("hex")
const runtimeFiles = ["asset-runtime", "asset-preflight", "surface-contract", "surface-coverage", "topology-runtime", "engineering-materials", "render-environment", "render-framing", "inspection-camera", "inspection-contract", "rack-motion", "finite-light"]
const manifestBytes = await readFile(join(directory, "manifest.json"))
const manifest = JSON.parse(manifestBytes)
assert.equal(manifest.release, release)
const resources = new Map(), hashes = {}
hashes["scripts/facility/capture-material-assets.mjs"] = digest(await readFile("scripts/facility/capture-material-assets.mjs"))
async function moduleFile(url, file, transpile = false) {
  const bytes = await readFile(file); hashes[file] = digest(bytes)
  const body = transpile ? ts.transpileModule(bytes.toString(), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replaceAll('"@/types/facility"', '"/runtime/types"') : bytes
  resources.set(url, { type: "text/javascript", body })
}
for (const name of runtimeFiles) await moduleFile(`/runtime/${name}`, `src/lib/facility/${name}.ts`, true)
await moduleFile("/runtime/types", "src/types/facility.ts", true)
await moduleFile("/fixture.js", "tests/support/facility-asset-material-fixture.mjs")
for (const name of ["build/three.module.js", "build/three.core.js", "examples/jsm/loaders/GLTFLoader.js", "examples/jsm/utils/BufferGeometryUtils.js", "examples/jsm/utils/SkeletonUtils.js"]) await moduleFile(`/vendor/three/${name}`, `node_modules/three/${name}`)
resources.set("/", { type: "text/html", body: '<!doctype html><meta charset="utf-8"><title>Facility asset material benchmark</title><style>body{margin:0;background:#080808}canvas{display:block}</style><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/":"/vendor/three/"}}</script><script type="module" src="/fixture.js"></script>' })
resources.set("/favicon.ico", { type: "image/x-icon", body: "" })
const files = new Map()
for (const filename of ["facility.glb", "rack.glb", "cooling.glb"]) {
  const bytes = await readFile(join(directory, filename)), entry = manifest.files.find(file => file.file === filename)
  assert(entry && entry.bytes === bytes.length && entry.sha256 === digest(bytes), `${filename}: staged manifest mismatch`)
  files.set(filename, { url: `/assets/${filename}`, bytes: bytes.length, sha256: digest(bytes) })
  resources.set(`/assets/${filename}`, { type: "model/gltf-binary", body: bytes })
}
const visualRelease = { ...manifest, model: files.get("facility.glb"), specimens: Object.fromEntries(Object.entries(manifest.specimens).map(([kind, descriptor]) => [kind, { ...descriptor, model: files.get(`${kind}.glb`) }])) }
const server = createServer((request, response) => {
  const resource = resources.get(request.url)
  if (request.method !== "GET" || !resource) { response.writeHead(404); response.end(); return }
  response.writeHead(200, { "Content-Type": resource.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(resource.body)
})
await new Promise((accept, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", accept) })
const angle = process.env.FACILITY_ANGLE
assert(!angle || angle === "metal", "FACILITY_ANGLE supports only metal")
const browser = await chromium.launch({ channel: "chrome", headless: process.env.FACILITY_HEADED !== "1", ...(angle ? { args: [`--use-angle=${angle}`, "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] } : {}) })
const report = { schemaVersion: "facility-asset-material-benchmark.v1", release, measuredAt: new Date().toISOString(), browser: browser.version(), manifestSha256: digest(manifestBytes), assetHashes: Object.fromEntries([...files].map(([name, file]) => [name, file.sha256])), sourceDigests: hashes, result: "incomplete", captures: [], errors: [] }
await mkdir(output, { recursive: true })
try {
  const context = await browser.newContext({ viewport: { width: 1020, height: 600 }, deviceScaleFactor: 1 })
  try {
    const page = await context.newPage()
    page.on("pageerror", error => report.errors.push(error.message))
    page.on("console", message => { if (message.type() === "error") report.errors.push(`${message.text()} ${message.location().url ?? ""}`.trim()) })
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.waitForFunction(() => typeof window.prepareAssetMaterialBenchmark === "function")
    report.graphics = await page.evaluate(release => window.prepareAssetMaterialBenchmark(release), visualRelease)
    if (angle === "metal") assert(/Apple M5.*Metal|Metal.*Apple M5/i.test(report.graphics.renderer) && !/SwiftShader|llvmpipe|software/i.test(report.graphics.renderer), `Actual Metal renderer required: ${report.graphics.renderer}`)
    for (const size of sizes) for (const kind of kinds) for (const pose of kind === "overview" ? ["overview"] : kind === "rack" && serviceDetail ? ["service-connection"] : ["closed", "cutaway", "service"]) for (const dpr of [1, 1.5]) {
      for (const mode of modes) {
        const result = await page.evaluate(options => window.captureAssetMaterial(options), { kind, pose, dpr, mode, cssSize: size.name === "mobile" && kind !== "rack" ? [390, 293] : size.cssSize })
        const filename = `${kind}-${pose}-dpr${dpr}-${mode}${size.name === "mobile" ? "-mobile" : ""}.png`
        const bytes = Buffer.from(result.png.split(",")[1], "base64")
        await writeFile(join(output, filename), bytes)
        delete result.png
        report.captures.push({ filename, ...result, sha256: digest(bytes) })
      }
    }
    await page.evaluate(() => window.disposeAssetMaterialBenchmark())
    assert.deepEqual(report.errors, [], "Asset material render errors")
    for (const kind of kinds) {
      const images = report.captures.filter(capture => capture.kind === kind && capture.dpr === 1 && capture.cssSize[0] === sizes[0].cssSize[0])
      const tiles = await Promise.all(images.map(async (capture, index) => ({ input: await sharp(join(output, capture.filename)).resize(510, 300, { fit: "contain", background: "#080808" }).png().toBuffer(), left: index % 4 * 510, top: Math.floor(index / 4) * 300 })))
      await sharp({ create: { width: 2040, height: Math.ceil(images.length / 4) * 300, channels: 4, background: "#080808" } }).composite(tiles).png().toFile(join(output, `${kind}-channels-contact-sheet.png`))
    }
    report.contactSheetOrder = { columns: ["final", "gray", "normal", "roughness"], rows: ["closed", "cutaway", "service"] }
    report.result = "pass"
  } finally { await context.close() }
} catch (error) { report.result = "fail"; report.failure = error.message; process.exitCode = 1 }
finally {
  await browser.close(); await new Promise(accept => server.close(accept))
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n")
  console.log(JSON.stringify({ result: report.result, failure: report.failure, captures: report.captures.length, output }))
}
