// @vitest-environment node
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import sharp from "sharp"
import { describe, expect, it } from "vitest"
import { verifyV5MaterialAsset } from "../../../scripts/facility/verify-materials.mjs"

type Document = {
  buffers: { byteLength: number }[]
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number }[]
  images: { bufferView: number }[]
  textures: { source: number }[]
  materials: { pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[]
  nodes: { extras?: { gnId?: string; gnPresentation?: string } }[]
}
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
function asset(version = 7, filename = "facility.glb") {
  const path = `src/content/facility-releases/facility-v${version}`
  const bytes: Buffer = readFileSync(`${path}/${filename}`)
  const manifest = JSON.parse(readFileSync(`${path}/manifest.json`, "utf8"))
  const jsonLength = bytes.readUInt32LE(12)
  return { bytes, manifest, filename, document: JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()) as Document, binary: bytes.subarray(28 + jsonLength) }
}
function encode(document: Document, binary: Buffer) {
  const text = Buffer.from(JSON.stringify(document))
  const json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20); text.copy(json)
  const padded = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(padded)
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + padded.length, 8)
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  binHeader.writeUInt32LE(padded.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, json, binHeader, padded])
}
function approveFixture(input: ReturnType<typeof asset>, bytes: Buffer) {
  const file = input.manifest.files.find((entry: { file: string }) => entry.file === input.filename)
  file.bytes = bytes.length; file.sha256 = hash(bytes)
  return bytes
}
async function changeAtlas(input: ReturnType<typeof asset>, change: (data: Buffer, width: number) => void) {
  const texture = input.document.materials.find(material => material.pbrMetallicRoughness?.baseColorTexture)!.pbrMetallicRoughness!.baseColorTexture!.index
  const image = input.document.images[input.document.textures[texture].source]
  const view = input.document.bufferViews[image.bufferView]
  const png = input.binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  change(data, info.width)
  const changed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer()
  view.byteOffset = input.binary.length; view.byteLength = changed.length
  const binary = Buffer.concat([input.binary, changed]); input.document.buffers[0].byteLength = binary.length
  return approveFixture(input, encode(input.document, binary))
}

function changePixel(input: ReturnType<typeof asset>, x: number, y: number, rgba: number[]) {
  return changeAtlas(input, (data, width) => { data.set(rgba, (y * width + x) * 4) })
}
function clearFloor(input: ReturnType<typeof asset>) {
  return changeAtlas(input, (data, width) => {
    for (let y = 128; y < 256; y++) for (let x = 0; x < 128; x++) data.set([255, 255, 255, 255], (y * width + x) * 4)
  })
}
async function finiteFixture(filename = "facility.glb") {
  const input = asset(10, filename)
  const finite = { version: 1, type: "point", position: [-2.8, 6, -3.4], color: "#f5f5f3", intensity: 36, decay: 2, distance: 0 }
  for (const profile of [input.manifest.profile, ...Object.values(input.manifest.specimens).map(value => (value as { profile: typeof input.manifest.profile }).profile)]) {
    profile.lighting.environment.preset = "industrial-night-v3"
    profile.lighting.finite = { ...finite }
  }
  const bytes = await clearFloor(input), jsonLength = bytes.readUInt32LE(12)
  return { ...input, bytes, document: JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()) as Document, binary: bytes.subarray(28 + jsonLength) }
}

describe("versioned material atlas appearance", () => {
  it.each([5, 6])("keeps all v%s assets strict with and without their approved manifest", async version => {
    for (const filename of ["facility.glb", "rack.glb", "cooling.glb"]) {
      const input = asset(version, filename)
      for (const manifest of [undefined, input.manifest]) {
        expect((await verifyV5MaterialAsset(input.bytes, filename, manifest)).atlas.practicalFloorPixels).toBe(0)
      }
    }
  })

  it.each([7, 8, 9, 10].flatMap(version => ["facility.glb", "rack.glb", "cooling.glb"].map(filename => ({ version, filename }))))("accepts only the approved v$version floor bake for $filename", async ({ version, filename }) => {
    const input = asset(version, filename)
    expect((await verifyV5MaterialAsset(input.bytes, filename, input.manifest)).atlas.practicalFloorPixels).toBe(16148)
    await expect(verifyV5MaterialAsset(input.bytes, filename)).rejects.toThrow("unexpected colored texel")
  })

  it("requires matching served bytes before applying a newer profile", async () => {
    const input = asset(); const bytes = Buffer.from(input.bytes); bytes[bytes.length - 1] ^= 1
    await expect(verifyV5MaterialAsset(bytes, input.filename, input.manifest)).rejects.toThrow("approved manifest asset mismatch")
  })

  it.each([5, 6])("does not permit the floor exception for the v%s profile", async version => {
    const input = asset()
    input.manifest.profile = asset(version).manifest.profile
    await expect(verifyV5MaterialAsset(input.bytes, input.filename, input.manifest)).rejects.toThrow("unexpected colored texel")
  })

  it.each([[128, 128], [0, 127], [191, 40]])("rejects illumination outside the exact floor region at %s,%s", async (x, y) => {
    const input = asset(), bytes = await changePixel(input, x, y, [240, 238, 235, 255])
    await expect(verifyV5MaterialAsset(bytes, input.filename, input.manifest)).rejects.toThrow("unexpected colored texel")
  })

  it.each([[223, 223, 223, 255], [240, 245, 250, 255], [240, 238, 235, 0]])("rejects dark, cool or transparent floor pixels %j", async (...rgba) => {
    const input = asset(), bytes = await changePixel(input, 32, 160, rgba)
    await expect(verifyV5MaterialAsset(bytes, input.filename, input.manifest)).rejects.toThrow("invalid practical floor texel")
  })

  it("requires authored fixture metadata on the overview", async () => {
    const input = asset(), root = input.document.nodes.find(node => node.extras?.gnId === "GN_EXPORT")!
    delete root.extras!.gnPresentation
    const bytes = approveFixture(input, encode(input.document, input.binary))
    await expect(verifyV5MaterialAsset(bytes, input.filename, input.manifest)).rejects.toThrow("authored practical lighting presentation missing")
  })

  it.each([7, 9])("rejects an unknown appearance revision on v%s", async version => {
    const input = asset(version); input.manifest.profile.lighting.environment.preset = "unknown-night-v2"
    await expect(verifyV5MaterialAsset(input.bytes, input.filename, input.manifest)).rejects.toThrow("unsupported atlas appearance revision")
  })

  it.each(["facility.glb", "rack.glb", "cooling.glb"])("requires a neutral floor and authored finite profile for %s", async filename => {
    const input = await finiteFixture(filename)
    const report = await verifyV5MaterialAsset(input.bytes, filename, input.manifest)
    expect(report.floorLighting).toBe("runtime-finite-neutral")
    expect(report.atlas.practicalFloorPixels).toBe(0)
    expect(report.atlas.neutralFloorPixels).toBe(128 * 128)
    expect(report.finiteLight?.intensity).toBe(36)
  })

  it.each(["facility.glb", "rack.glb", "cooling.glb"])("rejects missing finite illumination for %s", async filename => {
    const input = await finiteFixture(filename)
    const profile = filename === "facility.glb" ? input.manifest.profile : input.manifest.specimens[filename.replace(".glb", "")].profile
    delete profile.lighting.finite
    await expect(verifyV5MaterialAsset(input.bytes, filename, input.manifest)).rejects.toThrow("neutral atlas requires an active authored finite light")
  })

  it.each([
    { intensity: 0 }, { intensity: 129 }, { position: [0, Number.NaN, 0] }, { decay: 1 }, { castShadow: true }, { color: "#ffc079" },
  ])("rejects invalid finite-light capability %j", async invalid => {
    const input = await finiteFixture()
    Object.assign(input.manifest.profile.lighting.finite, invalid)
    await expect(verifyV5MaterialAsset(input.bytes, input.filename, input.manifest)).rejects.toThrow(/finite.light|finite service/)
  })

  it.each([[240, 238, 235, 255], [255, 254, 255, 255], [255, 255, 255, 0]])("rejects colored or transparent v3 floor pixels %j", async (...rgba) => {
    const input = await finiteFixture(), bytes = await changePixel(input, 32, 160, rgba)
    await expect(verifyV5MaterialAsset(bytes, input.filename, input.manifest)).rejects.toThrow(/unexpected colored texel|neutral floor must remain opaque/)
  })

  it.each([7, 9, 10])("still rejects missing practical floor illumination for v%s", async version => {
    const input = asset(version), bytes = await clearFloor(input)
    await expect(verifyV5MaterialAsset(bytes, input.filename, input.manifest)).rejects.toThrow("practical floor illumination missing")
  })


  it("requires the overview finite-light slot before a specimen can bind it", async () => {
    const input = await finiteFixture("rack.glb")
    delete input.manifest.profile.lighting.finite
    await expect(verifyV5MaterialAsset(input.bytes, input.filename, input.manifest)).rejects.toThrow("neutral atlas requires an active authored finite light")
  })

  it("rejects slight off-floor tint in the neutral runtime atlas", async () => {
    const input = await finiteFixture(), bytes = await changePixel(input, 160, 180, [255, 254, 255, 255])
    await expect(verifyV5MaterialAsset(bytes, input.filename, input.manifest)).rejects.toThrow("unexpected colored texel in neutral finite-light atlas")
  })

  it("keeps authored presentation metadata mandatory for the runtime-lit overview", async () => {
    const input = await finiteFixture(), root = input.document.nodes.find(node => node.extras?.gnId === "GN_EXPORT")!
    delete root.extras!.gnPresentation
    const bytes = approveFixture(input, encode(input.document, input.binary))
    await expect(verifyV5MaterialAsset(bytes, input.filename, input.manifest)).rejects.toThrow("authored practical lighting presentation missing")
  })

})
