/** CPU-only authored surface derivative. No Blender master, geometry, semantic
 * accessor, frozen release, registry or public directory is changed. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, writeFile, mkdir, access } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { manifestSchema, assetByteCeiling } from "../../src/lib/facility/manifest-schema.mjs"

export const digest = bytes => createHash("sha256").update(bytes).digest("hex")
const linear = byte => { const value = byte / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4 }
const smooth = value => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x) }
const exists = async path => { try { await access(path); return true } catch (error) { if (error.code === "ENOENT") return false; throw error } }

export function readGlb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(4), 2)
  assert.equal(bytes.readUInt32LE(8), bytes.length)
  const length = bytes.readUInt32LE(12)
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a)
  assert.equal(bytes.readUInt32LE(24 + length), 0x004e4942)
  return { document: JSON.parse(bytes.subarray(20, 20 + length).toString()), binary: bytes.subarray(28 + length) }
}
const viewBytes = ({ document, binary }, index) => { const view = document.bufferViews[index]; return binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength) }
const textureView = (document, info) => document.images[document.textures[info.index].source].bufferView
const encode = (document, binary) => {
  const text = Buffer.from(JSON.stringify(document)), json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20)
  text.copy(json)
  const padded = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(padded)
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + padded.length, 8)
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  binHeader.writeUInt32LE(padded.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, json, binHeader, padded])
}

function louverHeight(x, y, item, recipe) {
  const [width, height] = item.ventMetres, bevel = recipe.louverBevelMetres
  let value = 0
  for (let index = 0; index < item.count; index++) {
    const center = width * (.09 + .82 * index / (item.count - 1))
    const dx = width * recipe.louverWidthFraction / 2 - Math.abs(x - center)
    const dy = height * recipe.louverHeightFraction / 2 - Math.abs(y - height / 2)
    value = Math.max(value, recipe.louverDepthMetres * smooth(dx / bevel) * smooth(dy / bevel))
  }
  return value
}

/** The two existing metric vent tiles have enough space for 5/3 coarse louvers.
 * Preserve contact AO, perforation coverage and all surrounding atlas pixels. */
export function authorLouverTiles(normal, orm, recipe) {
  assert.equal(normal.length, 512 * 512 * 4); assert.equal(orm.length, normal.length)
  for (const item of recipe.louvers) {
    const [tx, ty, width, height] = item.tile, gutter = 8, nx = width - gutter * 2, ny = height - gutter * 2
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
      const u = (Math.max(0, Math.min(nx - 1, px - gutter)) + .5) / nx * item.metres[0]
      const v = (Math.max(0, Math.min(ny - 1, py - gutter)) + .5) / ny * item.metres[1]
      const offset = ((511 - ty - py) * 512 + tx + px) * 4
      // Integrate the formed surface over the output texel. Sub-texel bevels
      // must not alternate between flat and near-vertical sampled normals.
      const z = Math.max(.1, normal[offset + 2] / 127.5 - 1)
      const baseX = (normal[offset] / 127.5 - 1) / z, baseY = (normal[offset + 1] / 127.5 - 1) / z
      const samples = recipe.normalSamplesPerAxis, eu = item.metres[0] / nx / 2, ev = item.metres[1] / ny / 2
      let x = 0, y = 0, nz = 0, heightSum = 0
      for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
        const su = u + ((sx + .5) / samples - .5) * eu * 2, sv = v + ((sy + .5) / samples - .5) * ev * 2
        const h = louverHeight(su, sv, item, recipe)
        const du = (louverHeight(su + eu, sv, item, recipe) - louverHeight(su - eu, sv, item, recipe)) / (2 * eu)
        const dv = (louverHeight(su, sv + ev, item, recipe) - louverHeight(su, sv - ev, item, recipe)) / (2 * ev)
        const coverage = smooth(Math.max(h / recipe.louverDepthMetres, Math.abs(du) * eu / recipe.louverDepthMetres, Math.abs(dv) * ev / recipe.louverDepthMetres) * 4)
        const fine = 1 - coverage * (1 - recipe.louverPerforationNormalStrength)
        const sampleX = baseX * fine - du, sampleY = baseY * fine - dv, length = Math.hypot(sampleX, sampleY, 1)
        x += sampleX / length; y += sampleY / length; nz += 1 / length; heightSum += h
      }
      const length = Math.hypot(x, y, nz)
      normal[offset] = Math.round((x / length + 1) * 127.5)
      normal[offset + 1] = Math.round((y / length + 1) * 127.5)
      normal[offset + 2] = Math.round((nz / length + 1) * 127.5)
      orm[offset + 1] = Math.round(255 * (.55 - .065 * heightSum / samples ** 2 / recipe.louverDepthMetres))
    }
  }
  for (const finish of recipe.finishes) {
    const [tx, ty, width, height] = finish.tile
    let mean = 0
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) mean += orm[((511 - ty - y) * 512 + tx + x) * 4 + 1]
    mean /= width * height
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const offset = ((511 - ty - y) * 512 + tx + x) * 4
      orm[offset + 1] = Math.max(0, Math.min(255, Math.round(orm[offset + 1] - mean + finish.roughness * 255)))
      orm[offset + 2] = Math.round(finish.metalness * 255)
    }
  }
}

export async function deriveGlb(bytes, recipe) {
  const input = readGlb(bytes), document = structuredClone(input.document)
  const normalIndex = textureView(document, document.materials.find(material => material.normalTexture).normalTexture)
  const ormIndex = textureView(document, document.materials[0].pbrMetallicRoughness.metallicRoughnessTexture)
  const normal = await sharp(viewBytes(input, normalIndex)).ensureAlpha().raw().toBuffer()
  const orm = await sharp(viewBytes(input, ormIndex)).ensureAlpha().raw().toBuffer()
  const originalAo = Buffer.from(orm.filter((_, index) => index % 4 === 0))
  authorLouverTiles(normal, orm, recipe)
  assert.deepEqual(Buffer.from(orm.filter((_, index) => index % 4 === 0)), originalAo, "Contact AO must remain byte-identical")
  const png = data => sharp(data, { raw: { width: 512, height: 512, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer()
  const replacements = new Map([[normalIndex, await png(normal)], [ormIndex, await png(orm)]])
  for (const material of document.materials) {
    const hex = recipe.palette[material.name]; assert.match(hex, /^#[a-f0-9]{6}$/)
    material.pbrMetallicRoughness.baseColorFactor = [...[1, 3, 5].map(index => Number(linear(parseInt(hex.slice(index, index + 2), 16)).toFixed(8))), 1]
  }
  // The parent intentionally overlaps some geometry buffer views. Preserve
  // their shared byte ranges instead of duplicating that transport/storage.
  const ranges = input.document.bufferViews.flatMap((view, index) => replacements.has(index) ? [] : [{ start: view.byteOffset ?? 0, end: (view.byteOffset ?? 0) + view.byteLength }]).sort((a, b) => a.start - b.start)
  const segments = []
  for (const range of ranges) {
    const previous = segments.at(-1)
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end)
    else segments.push({ ...range, offset: 0 })
  }
  const chunks = []; let offset = 0
  const append = data => {
    const padding = (4 - offset % 4) % 4
    if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding }
    const start = offset; chunks.push(data); offset += data.length
    return start
  }
  for (const segment of segments) segment.offset = append(input.binary.subarray(segment.start, segment.end))
  for (const [index, view] of document.bufferViews.entries()) {
    if (replacements.has(index)) {
      const data = replacements.get(index)
      view.byteOffset = append(data); view.byteLength = data.length
    } else {
      const start = view.byteOffset ?? 0, segment = segments.find(item => item.start <= start && item.end >= start + view.byteLength)
      assert(segment, "Every unchanged view needs its preserved byte range")
      view.byteOffset = segment.offset + start - segment.start
    }
  }
  document.buffers[0].byteLength = offset
  const result = encode(document, Buffer.concat(chunks)), output = readGlb(result)
  const geometry = createHash("sha256")
  for (const [index] of input.document.bufferViews.entries()) if (!replacements.has(index)) {
    const original = viewBytes(input, index)
    assert.deepEqual(viewBytes(output, index), original, `Unchanged buffer ${index}`)
    geometry.update(original)
  }
  for (const key of ["nodes", "meshes", "accessors", "scenes", "scene", "animations", "extensions", "textures", "images", "samplers"]) assert.deepEqual(output.document[key], input.document[key], `Preserve ${key}`)
  return { bytes: result, preservation: { unchangedBuffers: input.document.bufferViews.length - replacements.size, unchangedBufferSha256: geometry.digest("hex"), nodes: document.nodes.length, meshes: document.meshes.length, materials: document.materials.length, aoPreserved: true, colorAtlasPreserved: true, normalSha256: digest(replacements.get(normalIndex)), ormSha256: digest(replacements.get(ormIndex)) } }
}

async function main() {
  assert.equal(process.argv.length, 2, "Usage: node scripts/facility/derive-surface-candidate.mjs")
  const root = process.cwd(), recipePath = join(root, "assets-source/facility/browser-v12-recipe.json")
  const recipeBytes = await readFile(recipePath), recipe = JSON.parse(recipeBytes)
  const source = join(root, "build/facility", recipe.parentRelease, "release"), output = join(root, "build/facility", recipe.release)
  const registry = JSON.parse(await readFile(join(root, "src/content/facility-releases/registry.json")))
  assert(!registry.some(item => item.release === recipe.release), "Never replace a registered visual release")
  assert(!await exists(join(output, "release")), "Candidate exists; preserve it and choose a new reviewed recipe/release")
  const parentBytes = await readFile(join(source, "manifest.json"))
  assert.equal(digest(parentBytes), recipe.parentManifestSha256, "Pinned parent manifest changed")
  const manifest = manifestSchema.parse(JSON.parse(parentBytes)); assert.equal(manifest.release, recipe.parentRelease)
  manifest.release = recipe.release
  manifest.source.derivation = { kind: "gltf-surface-derivative.v1", parentRelease: recipe.parentRelease, parentManifestSha256: digest(parentBytes), recipeSha256: digest(recipeBytes), toolSha256: digest(await readFile(fileURLToPath(import.meta.url))) }
  for (const profile of [manifest.profile, ...Object.values(manifest.specimens ?? {}).map(item => item.profile)]) profile.lighting.environment.preset = recipe.environmentPreset
  manifest.profile.padding = recipe.overviewPadding
  if (manifest.profile.inspection?.mobile) manifest.profile.inspection.mobile.padding = recipe.overviewPadding
  const report = { release: recipe.release, status: "private-unreviewed", derivation: manifest.source.derivation, sourceMasterUnchanged: true, geometryUnchanged: true, textureAllocationUnchanged: true, posters: "provisional-parent-posters; fresh native browser captures required", assets: {} }
  await mkdir(join(output, "release"), { recursive: true })
  for (const file of manifest.files) {
    const parent = await readFile(join(source, file.file))
    assert.equal(digest(parent), file.sha256); assert.equal(parent.length, file.bytes)
    const result = file.file.endsWith(".glb") ? await deriveGlb(parent, recipe) : { bytes: parent }
    assert(result.bytes.length <= assetByteCeiling(file.file), `Budget exceeded: ${file.file}`)
    report.assets[file.file] = { parentSha256: file.sha256, sha256: digest(result.bytes), bytes: result.bytes.length, deltaBytes: result.bytes.length - parent.length, ...result.preservation }
    file.bytes = result.bytes.length; file.sha256 = digest(result.bytes)
    await writeFile(join(output, "release", file.file), result.bytes, { flag: "wx" })
  }
  manifestSchema.parse(manifest)
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n")
  await writeFile(join(output, "release/manifest.json"), manifestBytes, { flag: "wx" })
  await writeFile(join(output, "derivation-report.json"), JSON.stringify({ ...report, manifestSha256: digest(manifestBytes) }, null, 2) + "\n", { flag: "wx" })
  assert.equal(digest(await readFile(join(source, "manifest.json"))), recipe.parentManifestSha256)
  console.log(JSON.stringify({ release: recipe.release, manifestSha256: digest(manifestBytes), assets: report.assets }, null, 2))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
