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

export const manifestSchema = z.object({
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

export const registrySchema = z.array(z.object({ release: z.string().regex(releasePattern), status: z.enum(["available", "withheld", "withdrawn"]), manifestSha256: digest.optional() }).strict()).superRefine((entries, context) => {
  if (new Set(entries.map(entry => entry.release)).size !== entries.length || entries.some(entry => entry.status === "available" && !entry.manifestSha256)) context.addIssue({ code: "custom", message: "Invalid civic registry" })
})
