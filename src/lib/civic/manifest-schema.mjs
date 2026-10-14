import { z } from "zod"

export const releasePattern = /^civic-v[1-9][0-9]*$/
export const compositions = ["landscape", "portrait"]
export const deliveryWidths = { landscape: [640, 960, 1280], portrait: [400, 640, 800] }
export const allowedFiles = compositions.flatMap(composition => deliveryWidths[composition].map(width => `${composition}-${width}.webp`))
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const composition = aspectRatio => z.object({ width: z.number().int().positive().max(16384), height: z.number().int().positive().max(16384),
  masterPngSha256: digest, masterPngBytes: z.number().int().positive(), promptSha256: digest,
  transformation: z.object({ fit: z.literal("cover"), position: z.literal("centre"), aspectRatio: z.literal(aspectRatio), colourSpace: z.literal("srgb") }).strict(),
}).strict()

export const v1ManifestSchema = z.object({
  schemaVersion: z.literal("civic.v1"), release: z.string().regex(releasePattern), environment: z.literal("synthetic"),
  source: z.object({ kind: z.literal("generated-illustration"), tool: z.literal("image_gen.imagegen"), mode: z.literal("built-in"),
    model: z.literal("not reported by tool"), generationRecordSha256: digest, packagerSha256: digest,
    nodeVersion: z.string().min(1).max(40), sharpVersion: z.string().min(1).max(40), webpVersion: z.string().min(1).max(40),
  }).strict(),
  compositions: z.object({ landscape: composition("16:9"), portrait: composition("5:6") }).strict(),
  files: z.array(z.object({ file: z.enum(allowedFiles), composition: z.enum(compositions), width: z.number().int().positive(),
    height: z.number().int().positive(), bytes: z.number().int().positive().max(200 * 1024), sha256: digest,
    mimeType: z.literal("image/webp"), quality: z.number().int().min(68).max(90),
  }).strict()).length(6),
}).strict().superRefine((value, context) => {
  const fail = message => context.addIssue({ code: "custom", message })
  const names = value.files.map(file => file.file)
  if (new Set(names).size !== 6 || allowedFiles.some(file => !names.includes(file))) fail("Complete unique civic file set required")
  for (const file of value.files) {
    if (!deliveryWidths[file.composition].includes(file.width) || file.file !== `${file.composition}-${file.width}.webp`) fail("Civic file identity mismatch")
    const [width, height] = file.composition === "landscape" ? [16, 9] : [5, 6]
    if (file.height * width !== file.width * height) fail("Civic composition aspect ratio mismatch")
  }
})

export const requiredV2Widths = { landscape: [640, 960, 1280, 1600], portrait: [400, 640, 800] }
export const optionalV2Widths = { landscape: [], portrait: [1360] }
export const civicFormats = ["avif", "webp"]
export const v2AllowedFiles = compositions.flatMap(composition => [...requiredV2Widths[composition], ...optionalV2Widths[composition]]
  .flatMap(width => civicFormats.map(format => `${composition}-${width}.${format}`)))
export const allAllowedCivicFiles = [...new Set([...allowedFiles, ...v2AllowedFiles])]
export const CIVIC_V2_IMAGE_BYTE_LIMIT = 200 * 1024

const v2Composition = aspectRatio => z.object({
  width: z.number().int().positive().max(16384), height: z.number().int().positive().max(16384),
  masterPngSha256: digest, masterPngBytes: z.number().int().positive(), nativeRenderPngSha256: digest,
  camera: z.string().min(1).max(120),
  finish: z.discriminatedUnion("kind", [z.object({ kind: z.literal("native") }).strict(), z.object({
    kind: z.literal("generated"), generationRecordSha256: digest, promptSha256: digest,
    rawGeneratedOutput: z.object({ sha256: digest, bytes: z.number().int().positive(), width: z.number().int().positive().max(16384), height: z.number().int().positive().max(16384) }).strict(),
  }).strict()]),
  transformation: z.object({ fit: z.literal("cover"), position: z.literal("centre"), aspectRatio: z.literal(aspectRatio), colourSpace: z.literal("srgb") }).strict(),
}).strict()

/** V1 remains a frozen contract; native and hybrid art have separate provenance. */
export const v2ManifestSchema = z.object({
  schemaVersion: z.literal("civic.v2"), release: z.literal("civic-v2"), environment: z.literal("synthetic"),
  source: z.object({
    kind: z.literal("hybrid-architectural-illustration"), productionRecordSha256: digest, packagerSha256: digest,
    native: z.object({ blenderVersion: z.string().min(1).max(80), engine: z.literal("CYCLES"), device: z.literal("METAL"),
      sceneSha256: digest, renderRecordSha256: digest }).strict(),
    nodeVersion: z.string().min(1).max(40), sharpVersion: z.string().min(1).max(40),
    webpVersion: z.string().min(1).max(40), avifEncoderVersion: z.string().min(1).max(40),
  }).strict(),
  compositions: z.object({ landscape: v2Composition("16:9"), portrait: v2Composition("5:6") }).strict(),
  files: z.array(z.object({ file: z.enum(v2AllowedFiles), composition: z.enum(compositions),
    width: z.number().int().positive(), height: z.number().int().positive(), bytes: z.number().int().positive().max(CIVIC_V2_IMAGE_BYTE_LIMIT),
    sha256: digest, mimeType: z.enum(["image/avif", "image/webp"]), quality: z.number().int().min(40).max(90),
  }).strict()).min(14).max(16),
}).strict().superRefine((value, context) => {
  const fail = message => context.addIssue({ code: "custom", message })
  const names = value.files.map(file => file.file)
  if (new Set(names).size !== names.length) fail("Unique civic file set required")
  for (const composition of compositions) {
    const files = value.files.filter(file => file.composition === composition)
    const widths = [...new Set(files.map(file => file.width))]
    if (requiredV2Widths[composition].some(width => !widths.includes(width))) fail("Required civic widths missing")
    for (const width of widths) {
      if (![...requiredV2Widths[composition], ...optionalV2Widths[composition]].includes(width)) fail("Unexpected civic width")
      if (civicFormats.some(format => !names.includes(`${composition}-${width}.${format}`))) fail("Paired AVIF and WebP variants required")
    }
    const master = value.compositions[composition]
    if (master.finish.kind === "generated") {
      const raw = master.finish.rawGeneratedOutput
      if (raw.sha256 !== master.masterPngSha256 || raw.bytes !== master.masterPngBytes || raw.width !== master.width || raw.height !== master.height) fail("Generated master must match the preserved raw output")
    }
    const ratio = composition === "landscape" ? 16 / 9 : 5 / 6
    if (Math.abs(master.width / master.height / ratio - 1) > .01) fail("Civic master aspect reconciliation exceeds 1%")
    for (const file of files) {
      const format = file.mimeType === "image/avif" ? "avif" : "webp"
      if (file.file !== `${composition}-${file.width}.${format}`) fail("Civic file identity mismatch")
      if (file.height !== file.width / ratio) fail("Civic composition aspect ratio mismatch")
      if (file.width > master.width || file.height > master.height) fail("Civic source cannot be upscaled")
      if (format === "webp" && file.quality < 68) fail("Civic WebP quality below floor")
    }
  }
})

export const manifestSchema = z.union([v1ManifestSchema, v2ManifestSchema])

export const registrySchema = z.array(z.object({ release: z.string().regex(releasePattern), status: z.enum(["available", "withheld", "withdrawn"]), manifestSha256: digest.optional() }).strict()).superRefine((entries, context) => {
  if (new Set(entries.map(entry => entry.release)).size !== entries.length || entries.some(entry => entry.status === "available" && !entry.manifestSha256)) context.addIssue({ code: "custom", message: "Invalid civic registry" })
})
