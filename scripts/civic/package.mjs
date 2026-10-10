/** Responsive delivery only. Exact generation prompts/inputs remain in the
 * hashed private record; this packager never claims local rendering. */
import assert from "node:assert/strict"
import { mkdir, readFile, realpath, lstat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import sharp from "sharp"
import { sha256 } from "../../src/lib/civic/files.mjs"
import { deliveryWidths, manifestSchema } from "../../src/lib/civic/manifest-schema.mjs"

export async function packageGeneratedCivic({ root = process.cwd(), output }) {
  root = await realpath(root)
  output = resolve(root, output)
  assert(output.startsWith(`${join(root, "build/civic")}/`), "Private civic packaging output required")
  const sourceDirectory = join(root, "assets-source/civic")
  const recordBytes = await readFile(join(sourceDirectory, "generation-record.json"))
  const record = JSON.parse(recordBytes)
  assert(record.schema === "gridninja.civic-generation.v1" && record.tool === "image_gen.imagegen" && record.mode === "built-in"
    && record.model === "not reported by tool" && record.environment === "synthetic", "Truthful built-in image-generation record required")
  assert(record.images?.length === 2 && new Set(record.images.map(image => image.composition)).size === 2, "Two distinct generated compositions required")
  const landscape = record.images.find(image => image.composition === "landscape")
  const portrait = record.images.find(image => image.composition === "portrait")
  assert(landscape?.arguments && portrait?.arguments, "Landscape and portrait generation arguments required")
  assert(!Object.hasOwn(landscape.arguments, "referenced_image_paths") && !Object.hasOwn(landscape.arguments, "num_last_images_to_include"), "Landscape must be an original generation without image references")
  assert(!Object.hasOwn(portrait.arguments, "num_last_images_to_include"), "Portrait must use the explicit landscape reference")
  assert.deepEqual(portrait.arguments.referenced_image_paths, [landscape.originalToolOutput], "Portrait reference must exactly match the landscape tool output")
  const prepared = []
  for (const composition of ["landscape", "portrait"]) {
    const image = record.images.find(image => image.composition === composition)
    assert(image?.master === `assets-source/civic/generated-v1/${composition}.png`, "Unexpected generated master source")
    assert(typeof image.originalToolOutput === "string" && image.originalToolOutput.endsWith(".png"), "Original tool output reference required")
    assert(typeof image.arguments?.prompt === "string" && image.arguments.prompt.trim().length > 0 && image.arguments.transparent_background === false, "Exact generation prompt and opaque-image setting required")
    const path = join(root, image.master)
    assert((await lstat(path)).isFile() && await realpath(path) === path, "Generated master must be a regular source file")
    const bytes = await readFile(path), metadata = await sharp(bytes).metadata()
    assert(metadata.format === "png" && metadata.channels === 3 && !metadata.hasAlpha && !metadata.pages, "Opaque static RGB PNG source required")
    const ratio = composition === "landscape" ? 16 / 9 : 5 / 6
    const maximumWidth = Math.max(...deliveryWidths[composition])
    assert(metadata.width >= maximumWidth && metadata.height >= maximumWidth / ratio, "Generated source cannot be upscaled into a delivery master")
    assert(Math.abs(metadata.width / metadata.height / ratio - 1) <= .01, "Only minimal (at most 1%) aspect reconciliation is permitted")
    prepared.push({ composition, image, bytes, width: metadata.width, height: metadata.height, ratio })
  }
  // Validate both sources before output; never replace an earlier package.
  // Registration and art approval remain separate from this format conversion.
  await mkdir(join(root, "build/civic"), { recursive: true })
  await mkdir(output, { recursive: false })
  const compositions = {}, files = []
  for (const source of prepared) {
    const { composition, bytes, width, height, ratio, image } = source
    compositions[composition] = { width, height, masterPngSha256: sha256(bytes), masterPngBytes: bytes.length,
      promptSha256: sha256(Buffer.from(image.arguments.prompt, "utf8")),
      transformation: { fit: "cover", position: "centre", aspectRatio: composition === "landscape" ? "16:9" : "5:6", colourSpace: "srgb" },
    }
    for (const deliveredWidth of deliveryWidths[composition]) {
      const deliveredHeight = Math.round(deliveredWidth / ratio)
      let encoded, quality
      for (quality = 90; quality >= 68; quality -= 2) {
        encoded = await sharp(bytes).resize(deliveredWidth, deliveredHeight, { kernel: "lanczos3", fit: "cover", position: "centre", withoutEnlargement: true })
          .toColourspace("srgb").webp({ quality, effort: 6 }).toBuffer()
        if (encoded.length <= 200 * 1024) break
      }
      assert(encoded.length <= 200 * 1024, "Civic delivery ceiling exceeded; review art before changing the budget")
      const file = `${composition}-${deliveredWidth}.webp`
      await writeFile(join(output, file), encoded, { flag: "wx" })
      files.push({ file, composition, width: deliveredWidth, height: deliveredHeight, bytes: encoded.length, sha256: sha256(encoded), mimeType: "image/webp", quality })
    }
  }
  const manifest = manifestSchema.parse({
    schemaVersion: "civic.v1", release: "civic-v1", environment: "synthetic",
    source: { kind: "generated-illustration", tool: record.tool, mode: record.mode, model: record.model,
      generationRecordSha256: sha256(recordBytes), packagerSha256: sha256(await readFile(new URL(import.meta.url))),
      nodeVersion: process.version, sharpVersion: sharp.versions.sharp, webpVersion: sharp.versions.webp },
    compositions, files,
  })
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(join(output, "manifest.json"), manifestBytes, { flag: "wx" })
  return { output, manifestSha256: sha256(manifestBytes), files: files.map(({ file, bytes, quality }) => ({ file, bytes, quality })) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv.length === 3, "Usage: package.mjs NEW_PRIVATE_OUTPUT_DIRECTORY")
  console.log(JSON.stringify(await packageGeneratedCivic({ output: process.argv[2] }), null, 2))
}
