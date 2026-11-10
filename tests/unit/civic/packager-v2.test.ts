// @vitest-environment node
import { access, cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, expect, it } from "vitest"
import sharp from "sharp"
import { packageCivicV2 } from "../../../scripts/civic/package-v2.mjs"
import { validateCivicDirectory } from "../../../scripts/civic/validate.mjs"
import { sha256 } from "../../../src/lib/civic/files.mjs"

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
type SourceImage = { composition: string; camera: string; master: string; nativeRender: string; finish: { kind: "native" } | { kind: "generated"; record: string } }

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "gridninja-native-civic-")); temporary.push(root)
  const base = "assets-source/civic/hybrid-v2", directory = join(root, base)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, "scene.blend"), "BLENDER fixture, never a production render")
  const native = { blenderVersion: "5.1.0", engine: "CYCLES", device: "METAL", scene: `${base}/scene.blend`, renderRecord: `${base}/render.json` }
  const images: SourceImage[] = []
  const rows = []
  for (const [composition, width, height] of [["landscape", 3840, 2160], ["portrait", 800, 960]] as const) {
    const master = `${base}/${composition}.png`
    await sharp({ create: { width, height, channels: 3, background: "#080808" } }).png().toFile(join(root, master))
    images.push({ composition, camera: composition, master, nativeRender: master, finish: { kind: "native" } })
    const bytes = await readFile(join(root, master))
    rows.push({ composition, camera: composition, path: master, sha256: sha256(bytes), pngBytes: bytes.length, width, height })
  }
  const record = { schema: "gridninja.civic-production.v2", environment: "synthetic", native, images }
  await writeFile(join(root, native.renderRecord), JSON.stringify({ schema: "gridninja.civic-native.v2", status: "complete",
    blenderVersion: native.blenderVersion, engine: native.engine, device: native.device, scene: native.scene,
    sceneSha256: sha256(await readFile(join(root, native.scene))), images: rows }))
  const recordPath = `${base}/production-record.json`
  await writeFile(join(root, recordPath), JSON.stringify(record))
  return { root, record: recordPath, output: "build/civic/package-test", data: record }
}

async function generatedFixture(width = 1672, height = 941) {
  const options = await fixture(), image = options.data.images[0], generationPath = "assets-source/civic/hybrid-v2/generation.json"
  const rawPath = "assets-source/civic/hybrid-v2/raw-generated.png"
  const raw = await sharp({ create: { width, height, channels: 3, background: "#171717" } }).png().toBuffer()
  await writeFile(join(options.root, rawPath), raw)
  image.master = rawPath
  image.finish = { kind: "generated", record: generationPath }
  const generation = { tool: "image_gen.imagegen", mode: "built-in", model: "not reported by tool",
    originalToolOutput: "/expired/tool/output.png", rawGeneratedOutput: { path: rawPath, sha256: sha256(raw), bytes: raw.length, width, height },
    arguments: { prompt: "Preserve native composition.", transparent_background: false, referenced_image_paths: [await realpath(join(options.root, image.nativeRender))] } }
  await writeFile(join(options.root, generationPath), JSON.stringify(generation))
  await writeFile(join(options.root, options.record), JSON.stringify(options.data))
  return { ...options, generation, generationPath }
}

it("packages genuine-size sources into immutable codec pairs with decodable dimensions", async () => {
  const options = await fixture()
  const packaged = await packageCivicV2(options)
  expect(packaged.files).toHaveLength(14)
  const validated = await validateCivicDirectory(packaged.output, "civic-v2", packaged.manifestSha256)
  expect(validated.manifest.schemaVersion).toBe("civic.v2")
  expect(validated.manifest.files.every(file => file.bytes <= 204800)).toBe(true)
  await expect(packageCivicV2(options)).rejects.toThrow("EEXIST")
}, 30000)

it("rejects optional upscaling and inconsistent native receipt before writing output", async () => {
  const options = await fixture()
  await expect(packageCivicV2({ ...options, optional: ["portrait-1360"] })).rejects.toThrow("cannot be upscaled")
  await expect(access(join(options.root, options.output))).rejects.toThrow()
  const receiptPath = join(options.root, options.data.native.renderRecord)
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"))
  receipt.device = "CPU"
  await writeFile(receiptPath, JSON.stringify(receipt))
  await expect(packageCivicV2(options)).rejects.toThrow("Native receipt device mismatch")
  await expect(access(join(options.root, options.output))).rejects.toThrow()
})

it("rejects a generated finish that is disconnected from its native render", async () => {
  const options = await generatedFixture()
  options.generation.arguments.referenced_image_paths = ["/private/unrelated.png"]
  await writeFile(join(options.root, options.generationPath), JSON.stringify(options.generation))
  await expect(packageCivicV2(options)).rejects.toThrow("must reference its recorded native render")
  await expect(access(join(options.root, options.output))).rejects.toThrow()
})

it("preserves both native and generated-finish provenance without relabeling the source", async () => {
  const options = await generatedFixture()
  const packaged = await packageCivicV2(options)
  const manifest = JSON.parse(await readFile(join(packaged.output, "manifest.json"), "utf8"))
  expect(manifest.source.native.device).toBe("METAL")
  expect(manifest.compositions.landscape.finish).toMatchObject({ kind: "generated", generationRecordSha256: expect.stringMatching(/^[a-f0-9]{64}$/), promptSha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
  expect(manifest.compositions.landscape.finish.rawGeneratedOutput).toMatchObject({ sha256: options.generation.rawGeneratedOutput.sha256, width: 1672, height: 941 })
  expect(manifest.compositions.portrait.finish.kind).toBe("native")
  expect(JSON.stringify(manifest)).not.toContain("/expired/tool/output.png")
  expect(JSON.stringify(manifest)).not.toContain("Preserve native composition.")
}, 30000)

it("rejects generated masters below the required native-resolution delivery gate", async () => {
  const options = await generatedFixture(1536, 864)
  await expect(packageCivicV2(options)).rejects.toThrow("cannot be upscaled")
  await expect(access(join(options.root, options.output))).rejects.toThrow()
})

it("rejects manually enlarged masters even when their output dimensions meet the gate", async () => {
  const options = await generatedFixture(1536, 864), enlarged = "assets-source/civic/hybrid-v2/enlarged.png"
  await sharp(join(options.root, options.generation.rawGeneratedOutput.path)).resize(1600, 900).png().toFile(join(options.root, enlarged))
  options.data.images[0].master = enlarged
  await writeFile(join(options.root, options.record), JSON.stringify(options.data))
  await expect(packageCivicV2(options)).rejects.toThrow("must preserve raw output bytes")
  await expect(access(join(options.root, options.output))).rejects.toThrow()
})

it.each(["running", "failed"])("rejects a %s native receipt before creating a package", async status => {
  const options = await fixture(), path = join(options.root, options.data.native.renderRecord)
  const receipt = JSON.parse(await readFile(path, "utf8")); receipt.status = status
  await writeFile(path, JSON.stringify(receipt))
  await expect(packageCivicV2(options)).rejects.toThrow("Completed native render receipt required")
  await expect(access(join(options.root, options.output))).rejects.toThrow()
})

it.each(["scene hash", "image hash", "dimensions", "camera", "path", "duplicate image"])("rejects stale native receipt %s", async fault => {
  const options = await fixture(), path = join(options.root, options.data.native.renderRecord)
  const receipt = JSON.parse(await readFile(path, "utf8"))
  if (fault === "scene hash") receipt.sceneSha256 = "0".repeat(64)
  if (fault === "image hash") receipt.images[0].sha256 = "0".repeat(64)
  if (fault === "dimensions") receipt.images[0].width--
  if (fault === "camera") receipt.images[0].camera = "unrelated"
  if (fault === "path") receipt.images[0].path = "assets-source/civic/unrelated.png"
  if (fault === "duplicate image") receipt.images.push(receipt.images[0])
  await writeFile(path, JSON.stringify(receipt))
  await expect(packageCivicV2(options)).rejects.toThrow(/Native receipt|matching native receipt/)
  await expect(access(join(options.root, options.output))).rejects.toThrow()
})

it.each(["hash", "dimensions", "bytes"])("rejects inconsistent raw generated %s", async fault => {
  const options = await generatedFixture()
  if (fault === "hash") options.generation.rawGeneratedOutput.sha256 = "0".repeat(64)
  if (fault === "dimensions") options.generation.rawGeneratedOutput.width--
  if (fault === "bytes") options.generation.rawGeneratedOutput.bytes--
  await writeFile(join(options.root, options.generationPath), JSON.stringify(options.generation))
  await expect(packageCivicV2(options)).rejects.toThrow(/Raw generated output/)
  await expect(access(join(options.root, options.output))).rejects.toThrow()
})

it("repackages moved sources through a hash-bound historical reference without rewriting tool arguments", async () => {
  const options = await generatedFixture(), nativePath = options.data.images[0].nativeRender
  const originalArguments = JSON.stringify(options.generation.arguments)
  const nativeReference = { originalPath: options.generation.arguments.referenced_image_paths[0], nativePath,
    sha256: sha256(await readFile(join(options.root, nativePath))) }
  const generation = { ...options.generation, nativeReference }
  await writeFile(join(options.root, options.generationPath), JSON.stringify(generation))
  const moved = await mkdtemp(join(tmpdir(), "gridninja-moved-civic-")); temporary.push(moved)
  await cp(options.root, moved, { recursive: true })
  await rm(options.root, { recursive: true })
  const packaged = await packageCivicV2({ ...options, root: moved })
  expect(packaged.files).toHaveLength(14)
  const preserved = JSON.parse(await readFile(join(moved, options.generationPath), "utf8"))
  expect(JSON.stringify(preserved.arguments)).toBe(originalArguments)
  preserved.nativeReference.sha256 = "0".repeat(64)
  await writeFile(join(moved, options.generationPath), JSON.stringify(preserved))
  await expect(packageCivicV2({ ...options, root: moved, output: "build/civic/reject-wrong-reference" })).rejects.toThrow("Historical native reference hash mismatch")
  await expect(access(join(moved, "build/civic/reject-wrong-reference"))).rejects.toThrow()
}, 30000)
