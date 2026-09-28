/** Local diagnostic derivatives. Inputs are hash-bound; this is never a release exporter. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import sharp from "sharp"

export const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const MODELS = ["facility.glb", "rack.glb", "cooling.glb"]
export function readGlb(bytes) {
  assert(bytes.length >= 28 && bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, "Invalid GLB header")
  const size = bytes.readUInt32LE(12), start = 20 + size
  assert(bytes.readUInt32LE(16) === 0x4e4f534a && start + 8 <= bytes.length && bytes.readUInt32LE(start + 4) === 0x004e4942, "Expected JSON and BIN chunks")
  assert.equal(start + 8 + bytes.readUInt32LE(start), bytes.length, "Unsupported trailing GLB chunks")
  const data = JSON.parse(bytes.subarray(20, start)), bin = bytes.subarray(start + 8)
  assert(data.buffers?.length === 1 && !data.buffers[0].uri && data.buffers[0].byteLength <= bin.length, "Expected one embedded buffer")
  for (const view of data.bufferViews ?? []) assert(view.buffer === 0 && (view.byteOffset ?? 0) >= 0 && view.byteLength > 0 && (view.byteOffset ?? 0) + view.byteLength <= bin.length, "Invalid buffer view")
  return { data, bin }
}
const viewBytes = (data, bin, index) => { const v = data.bufferViews[index]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength) }

export function validateLayout(metadata, roles) {
  assert.equal(metadata.schemaVersion, "facility-benchmark-surfaces.v1")
  assert.equal(metadata.coordinateOrigin, "bottom-left")
  assert.equal(metadata.roughnessChannel, 1)
  assert.equal(metadata.roughnessMultiplier, 1)
  const [width, height] = metadata.resolution ?? []
  assert(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= 2048 && height <= 2048, "Invalid atlas resolution")
  assert(Number.isInteger(metadata.gutterPixels) && metadata.gutterPixels >= 1, "Invalid atlas gutter")
  assert(roles.length > 0 && roles.length === new Set(roles).size, "Surface roles must be unique")
  const occupied = new Uint8Array(width * height)
  for (const role of roles) {
    const region = metadata.regions?.[role]
    assert(region && region.metalness === 0 && Number.isFinite(region.roughness) && region.roughness >= 0 && region.roughness <= 1, `Unsupported paint role: ${role}`)
    const [x, y, w, h] = region.rect ?? []
    assert([x, y, w, h].every(Number.isInteger) && x >= 0 && y >= 0 && w > 2 * metadata.gutterPixels && h > 2 * metadata.gutterPixels && x + w <= width && y + h <= height, `Invalid atlas rectangle: ${role}`)
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const index = yy * width + xx
      assert(!occupied[index], `Overlapping selected atlas region: ${role}`)
      occupied[index] = 1
    }
  }
  assert(/^[a-f0-9]{64}$/.test(metadata.ormSha256) && /^[a-f0-9]{64}$/.test(metadata.authoringSha256), "Missing atlas/source hashes")
  return { width, height }
}

export async function deriveRoughness(original, metadata, roles, roughness) {
  const { width, height } = validateLayout(metadata, roles)
  assert(Number.isFinite(roughness) && roughness >= .35 && roughness <= .60, "Paint roughness must remain within 0.35–0.60")
  const { data, bin } = readGlb(original)
  const candidates = data.images.map((image, index) => ({ image, index })).filter(({ image }) => Number.isInteger(image.bufferView) && hash(viewBytes(data, bin, image.bufferView)) === metadata.ormSha256)
  assert.equal(candidates.length, 1, "Embedded ORM does not uniquely match the source atlas hash")
  const { image, index: imageIndex } = candidates[0], ormView = image.bufferView
  assert.equal(image.mimeType, "image/png")
  assert(!data.accessors.some(accessor => accessor.bufferView === ormView), "Image view aliases geometry")
  const ormTextures = new Set(data.textures.map((texture, index) => texture.source === imageIndex ? index : -1).filter(index => index >= 0))
  assert(ormTextures.size, "Unbound ORM atlas")
  for (const material of data.materials) {
    const pbr = material.pbrMetallicRoughness
    if (ormTextures.has(pbr?.metallicRoughnessTexture?.index)) assert((pbr.roughnessFactor ?? 1) === 1 && (pbr.metallicRoughnessTexture.texCoord ?? 0) === 0, "Unexpected ORM factor/UV binding")
  }
  const imageBytes = viewBytes(data, bin, ormView)
  const decoded = await sharp(imageBytes).raw().toBuffer({ resolveWithObject: true })
  assert.equal(decoded.info.width, width); assert.equal(decoded.info.height, height)
  assert(decoded.info.channels >= 3 && decoded.info.channels <= 4, "ORM must contain RGB channels")
  const pixels = Buffer.from(decoded.data), coverage = new Uint8Array(width * height)
  for (const role of roles) {
    const region = metadata.regions[role], [x, y, w, h] = region.rect
    const delta = Math.round(roughness * 255) - Math.round(region.roughness * 255)
    for (let yy = height - y - h; yy < height - y; yy++) for (let xx = x; xx < x + w; xx++) {
      const pixel = yy * width + xx, offset = pixel * decoded.info.channels + 1
      assert(pixels[offset] + delta >= 0 && pixels[offset] + delta <= 255, "Roughness variation would clip")
      pixels[offset] += delta; coverage[pixel] = 1
    }
  }
  let changed = 0
  for (let i = 0; i < pixels.length; i++) if (pixels[i] !== decoded.data[i]) {
    assert(i % decoded.info.channels === 1 && coverage[Math.floor(i / decoded.info.channels)], "Mutation escaped selected roughness channels")
    changed++
  }
  if (!changed) return { bytes: original, changedTexels: 0, ormSha256: hash(imageBytes), preservedBufferViews: data.bufferViews.length - 1 }
  const replacement = await sharp(pixels, { raw: decoded.info }).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer()
  const sourceData = structuredClone(data), start = data.bufferViews[ormView].byteOffset ?? 0
  const end = start + imageBytes.length, paddedEnd = end + (4 - end % 4) % 4
  const paddedReplacement = Buffer.concat([replacement, Buffer.alloc((4 - replacement.length % 4) % 4)])
  const shift = paddedReplacement.length - (paddedEnd - start)
  for (let index = 0; index < data.bufferViews.length; index++) {
    if (index === ormView) continue
    const view = data.bufferViews[index], offset = view.byteOffset ?? 0
    assert(offset + view.byteLength <= start || offset >= paddedEnd, "ORM image overlaps another buffer view")
    if (offset >= paddedEnd) view.byteOffset = offset + shift
  }
  data.bufferViews[ormView].byteLength = replacement.length
  data.buffers[0].byteLength += shift
  // Splice only the isolated image range; retain all geometry aliases/offsets.
  const binary = Buffer.concat([bin.subarray(0, start), paddedReplacement, bin.subarray(paddedEnd)])
  const json = Buffer.from(JSON.stringify(data)), jsonPadded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)])
  const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonPadded.length + binary.length, 8)
  header.writeUInt32LE(jsonPadded.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  binaryHeader.writeUInt32LE(binary.length); binaryHeader.writeUInt32LE(0x004e4942, 4)
  const bytes = Buffer.concat([header, jsonPadded, binaryHeader, binary]), reread = readGlb(bytes)
  for (let index = 0; index < data.bufferViews.length; index++) if (index !== ormView) assert.deepEqual(viewBytes(reread.data, reread.bin, index), viewBytes(sourceData, bin, index), `Non-ORM view ${index} changed`)
  return { bytes, changedTexels: changed, ormSha256: hash(replacement), preservedBufferViews: data.bufferViews.length - 1 }
}

export async function prepareBenchmarks(options) {
  const source = resolve(options.source), output = resolve(options.output), buildRoot = resolve("build/qa")
  const outputRelative = relative(buildRoot, output)
  assert(outputRelative && !outputRelative.startsWith("..") && !isAbsolute(outputRelative), "Diagnostic output must be under build/qa")
  const inputRelative = relative(source, output)
  assert(inputRelative.startsWith("..") || isAbsolute(inputRelative), "Output must not modify an input directory")
  const manifestBytes = await readFile(join(source, "manifest.json"))
  assert.equal(hash(manifestBytes), options.manifestHash, "Source manifest changed")
  const manifest = JSON.parse(manifestBytes), metadataBytes = await readFile(options.metadata)
  assert.equal(hash(metadataBytes), options.metadataHash, "Surface metadata changed")
  const metadata = JSON.parse(metadataBytes), roles = options.roles ?? ["paint", "rack_panel", "collector", "collector_top", "cooler_panel"]
  validateLayout(metadata, roles)
  const inputs = new Map()
  for (const filename of MODELS) {
    const bytes = await readFile(join(source, filename)), entry = manifest.files.find(file => file.file === filename)
    assert(entry && entry.bytes === bytes.length && entry.sha256 === hash(bytes), `${filename}: source manifest mismatch`)
    inputs.set(filename, bytes)
  }
  const variants = options.roughness ?? [.42, .38, .46]
  assert(variants.length === new Set(variants).size && variants.every(value => Number.isFinite(value) && value >= .35 && value <= .60), "Invalid/repeated roughness variants")
  await mkdir(dirname(output), { recursive: true }); await mkdir(output)
  const report = { schemaVersion: "facility-surface-benchmark.v2", publishable: false, source, sourceRelease: manifest.release, sourceManifestSha256: hash(manifestBytes), surfaceMetadataSha256: hash(metadataBytes), roles, sourceOrmSha256: metadata.ormSha256, method: "Change selected ORM green regions, including their gutters, retaining source variation. All other view bytes, material values, topology and profile remain unchanged.", variants: [] }
  for (const roughness of variants) {
    const label = `roughness-${Math.round(roughness * 1000)}`, directory = join(output, label), candidate = structuredClone(manifest)
    candidate.benchmarkOnly = { sourceManifestSha256: hash(manifestBytes), roughness, publishable: false }
    await mkdir(directory)
    const records = []
    for (const [filename, original] of inputs) {
      const derived = await deriveRoughness(original, metadata, roles, roughness), entry = candidate.files.find(file => file.file === filename)
      entry.bytes = derived.bytes.length; entry.sha256 = hash(derived.bytes)
      await writeFile(join(directory, filename), derived.bytes)
      records.push({ file: filename, bytes: entry.bytes, sha256: entry.sha256, sourceSha256: hash(original), changedTexels: derived.changedTexels, ormSha256: derived.ormSha256, preservedBufferViews: derived.preservedBufferViews })
    }
    await writeFile(join(directory, "manifest.json"), JSON.stringify(candidate, null, 2) + "\n")
    report.variants.push({ label, roughness, directory, files: records })
  }
  await writeFile(join(output, "benchmark-report.json"), JSON.stringify(report, null, 2) + "\n")
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { source: { type: "string" }, output: { type: "string" }, metadata: { type: "string" }, "manifest-hash": { type: "string" }, "metadata-hash": { type: "string" }, roughness: { type: "string" }, roles: { type: "string" } } })
  for (const name of ["source", "output", "metadata", "manifest-hash", "metadata-hash"]) assert(values[name], `Required --${name}`)
  const report = await prepareBenchmarks({ source: values.source, output: values.output, metadata: values.metadata, manifestHash: values["manifest-hash"], metadataHash: values["metadata-hash"], ...(values.roughness ? { roughness: values.roughness.split(",").map(Number) } : {}), ...(values.roles ? { roles: values.roles.split(",") } : {}) })
  console.log(JSON.stringify({ variants: report.variants.length, output: resolve(values.output), publishable: false }))
}
