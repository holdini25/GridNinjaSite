/** Offline conversion only. Source creation, art review and registration are separate. */
import assert from "node:assert/strict"
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import sharp from "sharp"
import { sha256 } from "../../src/lib/civic/files.mjs"
import { CIVIC_V2_IMAGE_BYTE_LIMIT, civicFormats, compositions, optionalV2Widths, requiredV2Widths, v2ManifestSchema } from "../../src/lib/civic/manifest-schema.mjs"

async function privateFile(root, input) {
  assert(typeof input === "string" && !isAbsolute(input), "Repository-relative private source path required")
  const path = resolve(root, input), local = relative(root, path)
  assert(["assets-source/civic/", "build/civic/", "build/civic-hybrid/"].some(prefix => local.startsWith(prefix)), "Private civic source required")
  assert((await lstat(path)).isFile() && await realpath(path) === path, "Private source must be a regular file without symlinks")
  return { path, bytes: await readFile(path) }
}

export async function packageCivicV2({ root = process.cwd(), record: recordPath, output, optional = /** @type {string[]} */ ([]) }) {
  root = await realpath(root)
  output = resolve(root, output)
  assert(output.startsWith(`${join(root, "build/civic")}/`), "Private civic packaging output required")
  const permitted = compositions.flatMap(composition => optionalV2Widths[composition].map(width => `${composition}-${width}`))
  assert(Array.isArray(optional) && new Set(optional).size === optional.length && optional.every(item => permitted.includes(item)), "Unknown or duplicate optional civic width")
  const production = await privateFile(root, recordPath), record = JSON.parse(production.bytes.toString("utf8"))
  assert(record.schema === "gridninja.civic-production.v2" && record.environment === "synthetic", "Synthetic civic production record required")
  assert(typeof record.native?.blenderVersion === "string" && record.native.blenderVersion.trim() && record.native.engine === "CYCLES" && record.native.device === "METAL", "Actual Cycles Metal provenance required")
  const scene = await privateFile(root, record.native.scene), receiptFile = await privateFile(root, record.native.renderRecord)
  assert(record.native.scene.endsWith(".blend") && scene.bytes.length > 0, "Saved Blender scene required")
  const receipt = JSON.parse(receiptFile.bytes.toString("utf8"))
  assert(receipt.schema === "gridninja.civic-native.v2" && receipt.status === "complete", "Completed native render receipt required")
  for (const key of ["blenderVersion", "engine", "device"]) assert.equal(receipt[key], record.native[key], `Native receipt ${key} mismatch`)
  assert.equal(receipt.scene, relative(root, scene.path), "Native receipt scene path mismatch")
  assert.equal(receipt.sceneSha256, sha256(scene.bytes), "Native receipt scene hash mismatch")
  assert(record.images?.length === 2 && new Set(record.images.map(image => image.composition)).size === 2, "Two distinct source compositions required")
  const prepared = []
  for (const composition of compositions) {
    const image = record.images.find(image => image.composition === composition)
    assert(image && typeof image.camera === "string" && image.camera.trim(), "Named source camera required")
    const master = await privateFile(root, image.master), native = await privateFile(root, image.nativeRender)
    const metadata = await sharp(master.bytes).metadata(), nativeMetadata = await sharp(native.bytes).metadata()
    for (const info of [metadata, nativeMetadata]) assert(info.format === "png" && info.channels === 3 && !info.hasAlpha && !info.pages, "Opaque static RGB PNG source required")
    const nativeRows = receipt.images?.filter(item => item.composition === composition && item.camera === image.camera && item.path === relative(root, native.path)) ?? []
    assert.equal(nativeRows.length, 1, "Unique matching native receipt image required")
    const nativeRow = nativeRows[0]
    assert.equal(nativeRow.sha256, sha256(native.bytes), "Native receipt image hash mismatch")
    assert.equal(nativeRow.pngBytes, native.bytes.length, "Native receipt image byte count mismatch")
    assert(nativeRow.width === nativeMetadata.width && nativeRow.height === nativeMetadata.height, "Native receipt image dimensions mismatch")
    const widths = [...requiredV2Widths[composition], ...optionalV2Widths[composition].filter(width => optional.includes(`${composition}-${width}`))]
    const ratio = composition === "landscape" ? 16 / 9 : 5 / 6, maximumWidth = Math.max(...widths)
    assert(metadata.width >= maximumWidth && metadata.height >= maximumWidth / ratio, "Source cannot be upscaled into delivery derivatives")
    assert(Math.abs(metadata.width / metadata.height / ratio - 1) <= .01, "Only minimal (at most 1%) aspect reconciliation is permitted")
    let finish
    if (image.finish?.kind === "native") {
      assert.equal(sha256(master.bytes), sha256(native.bytes), "Native finish must retain the recorded native render bytes")
      finish = { kind: "native" }
    } else {
      assert.equal(image.finish?.kind, "generated", "Explicit native or generated finish required")
      const generation = await privateFile(root, image.finish.record), generated = JSON.parse(generation.bytes.toString("utf8"))
      assert(generated.tool === "image_gen.imagegen" && generated.mode === "built-in" && generated.model === "not reported by tool", "Truthful built-in generation record required")
      assert(typeof generated.originalToolOutput === "string" && isAbsolute(generated.originalToolOutput) && generated.originalToolOutput.endsWith(".png"), "Original generated output path required")
      assert(typeof generated.arguments?.prompt === "string" && generated.arguments.prompt.trim() && generated.arguments.transparent_background === false, "Exact generation arguments required")
      assert(!Object.hasOwn(generated.arguments, "num_last_images_to_include"), "Generated finish requires explicit native reference paths")
      const reference = generated.nativeReference
      if (reference) {
        assert(typeof reference.originalPath === "string" && isAbsolute(reference.originalPath)
          && generated.arguments.referenced_image_paths?.includes(reference.originalPath), "Historical native reference must match exact generation arguments")
        assert(reference.nativePath === image.nativeRender && reference.nativePath === relative(root, native.path), "Historical native reference path mismatch")
        assert.equal(reference.sha256, sha256(native.bytes), "Historical native reference hash mismatch")
      } else {
        assert(generated.arguments.referenced_image_paths?.includes(native.path), "Generated finish must reference its recorded native render")
      }
      const rawRecord = generated.rawGeneratedOutput
      assert(rawRecord && typeof rawRecord.path === "string", "Preserved raw generated output required")
      const raw = await privateFile(root, rawRecord.path), rawMetadata = await sharp(raw.bytes).metadata()
      assert(rawMetadata.format === "png" && rawMetadata.channels === 3 && !rawMetadata.hasAlpha && !rawMetadata.pages, "Opaque static raw generated PNG required")
      assert.equal(rawRecord.sha256, sha256(raw.bytes), "Raw generated output hash mismatch")
      assert.equal(rawRecord.bytes, raw.bytes.length, "Raw generated output byte count mismatch")
      assert(rawRecord.width === rawMetadata.width && rawRecord.height === rawMetadata.height, "Raw generated output dimensions mismatch")
      assert.equal(sha256(master.bytes), rawRecord.sha256, "Generated master must preserve raw output bytes; resizing belongs only to the packager")
      finish = { kind: "generated", generationRecordSha256: sha256(generation.bytes), promptSha256: sha256(Buffer.from(generated.arguments.prompt, "utf8")),
        rawGeneratedOutput: { sha256: rawRecord.sha256, bytes: rawRecord.bytes, width: rawRecord.width, height: rawRecord.height } }
    }
    prepared.push({ composition, image, master, native, metadata, widths, ratio, finish })
  }
  // Complete source validation precedes writes. A prior package is never overwritten.
  await mkdir(join(root, "build/civic"), { recursive: true })
  assert(await realpath(join(root, "build/civic")) === join(root, "build/civic"), "Private output parent cannot be symlinked")
  assert(await realpath(dirname(output)) === dirname(output), "Private output parent cannot be symlinked")
  await mkdir(output, { recursive: false })
  const details = {}, files = []
  for (const source of prepared) {
    const { composition, image, master, native, metadata, widths, ratio, finish } = source
    details[composition] = { width: metadata.width, height: metadata.height, masterPngSha256: sha256(master.bytes), masterPngBytes: master.bytes.length,
      nativeRenderPngSha256: sha256(native.bytes), camera: image.camera, finish,
      transformation: { fit: "cover", position: "centre", aspectRatio: composition === "landscape" ? "16:9" : "5:6", colourSpace: "srgb" } }
    for (const width of widths) {
      const height = width / ratio, ceiling = CIVIC_V2_IMAGE_BYTE_LIMIT
      for (const format of civicFormats) {
        let encoded, selectedQuality
        const qualityLevels = format === "webp" ? [90, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70, 68] : [70, 65, 60, 55, 50, 45, 40]
        for (const quality of qualityLevels) {
          const pipeline = sharp(master.bytes).resize(width, height, { kernel: "lanczos3", fit: "cover", position: "centre", withoutEnlargement: true }).toColourspace("srgb")
          encoded = await (format === "webp" ? pipeline.webp({ quality, effort: 6 }) : pipeline.avif({ quality, effort: 6, chromaSubsampling: "4:4:4" })).toBuffer()
          selectedQuality = quality
          if (encoded.length <= ceiling) break
        }
        assert(encoded.length <= ceiling, `${composition}-${width}.${format}: delivery ceiling exceeded; review art or optional width`)
        const file = `${composition}-${width}.${format}`
        await writeFile(join(output, file), encoded, { flag: "wx" })
        files.push({ file, composition, width, height, bytes: encoded.length, sha256: sha256(encoded), mimeType: `image/${format}`, quality: selectedQuality })
      }
    }
  }
  const manifest = v2ManifestSchema.parse({ schemaVersion: "civic.v2", release: "civic-v2", environment: "synthetic",
    source: { kind: "hybrid-architectural-illustration", productionRecordSha256: sha256(production.bytes), packagerSha256: sha256(await readFile(new URL(import.meta.url))),
      native: { blenderVersion: record.native.blenderVersion, engine: record.native.engine, device: record.native.device, sceneSha256: sha256(scene.bytes), renderRecordSha256: sha256(receiptFile.bytes) },
      nodeVersion: process.version, sharpVersion: sharp.versions.sharp, webpVersion: sharp.versions.webp, avifEncoderVersion: sharp.versions.aom },
    compositions: details, files })
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(join(output, "manifest.json"), manifestBytes, { flag: "wx" })
  return { output, manifestSha256: sha256(manifestBytes), files: files.map(({ file, bytes, quality }) => ({ file, bytes, quality })) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  assert(args.length === 4 || args.length === 6, "Usage: package-v2.mjs --record PRIVATE_RECORD --output NEW_PRIVATE_DIRECTORY [--optional portrait-1360]")
  assert(args[0] === "--record" && args[2] === "--output" && (args.length === 4 || args[4] === "--optional"), "Unknown civic packaging arguments")
  console.log(JSON.stringify(await packageCivicV2({ record: args[1], output: args[3], optional: args[5]?.split(",") ?? [] }), null, 2))
}
