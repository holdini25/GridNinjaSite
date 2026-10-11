import { z } from "zod"

export const releasePattern = /^editorial-v[1-9][0-9]*$/
export const subjects = ["ai-workload", "colocation-hall", "platform-systems"]
export const widths = [480, 800, 1280]
export const allowedFiles = subjects.flatMap(subject => widths.map(width => `${subject}-${width}.webp`))
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
const subject = z.object({
  camera: z.object({ position: vector, rotation: vector, orthographicSpan: z.number().positive().finite(),
    width: z.literal(1600), height: z.literal(1000), azimuth: z.number().finite(), elevation: z.number().min(-90).max(90), padding: z.number().min(1).max(2) }).strict(),
  equipmentIds: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
  masterPngSha256: digest, masterExrSha256: digest, referencePngSha256: digest,
}).strict()

export const manifestSchema = z.object({
  schemaVersion: z.literal("editorial.v1"), release: z.string().regex(releasePattern), environment: z.literal("synthetic"),
  family: z.enum(["A-instrument", "B-architectural", "C-frontal"]),
  source: z.object({ masterIdentity: z.literal("gridninja-facility-shared-master"), masterSha256: digest,
    settingsSha256: digest, cinematicRendererSha256: digest, editorialRendererSha256: digest,
    computeSourceSha256: digest, supervisorSha256: digest, finalReportSha256: digest, referenceReportSha256: digest,
    packagerSha256: digest, blenderVersion: z.string().min(1).max(80), blenderBuildHash: z.string().regex(/^[a-f0-9]{7,40}$/),
    nodeVersion: z.string().min(1).max(40), sharpVersion: z.string().min(1).max(40), webpVersion: z.string().min(1).max(40),
  }).strict(),
  render: z.object({ width: z.literal(1600), height: z.literal(1000), samples: z.literal(128), referenceSamples: z.literal(256),
    adaptiveThreshold: z.literal(.005), threads: z.literal(4), device: z.literal("METAL"), colorTransform: z.literal("AgX"),
    look: z.literal("Medium High Contrast"), delivery: z.literal("sRGB"), motionBlur: z.literal(false),
  }).strict(),
  subjects: z.object({ "ai-workload": subject, "colocation-hall": subject, "platform-systems": subject }).strict(),
  files: z.array(z.object({ file: z.enum(allowedFiles), subject: z.enum(subjects), width: z.union(widths.map(width => z.literal(width))),
    height: z.number().int().positive(), bytes: z.number().int().positive().max(200 * 1024), sha256: digest,
    mimeType: z.literal("image/webp"), quality: z.number().int().min(68).max(90),
  }).strict()).length(9),
}).strict().superRefine((value, context) => {
  const fail = message => context.addIssue({ code: "custom", message })
  const names = value.files.map(file => file.file)
  if (new Set(names).size !== 9 || allowedFiles.some(file => !names.includes(file))) fail("Complete unique editorial file set required")
  for (const file of value.files) {
    if (file.file !== `${file.subject}-${file.width}.webp` || file.height * 8 !== file.width * 5) fail("Editorial file identity or 16:10 dimensions mismatch")
  }
})

export const registrySchema = z.array(z.object({ release: z.string().regex(releasePattern), status: z.enum(["available", "withheld", "withdrawn"]), manifestSha256: digest.optional() }).strict()).superRefine((entries, context) => {
  if (new Set(entries.map(entry => entry.release)).size !== entries.length || entries.some(entry => entry.status === "available" && !entry.manifestSha256)) context.addIssue({ code: "custom", message: "Invalid editorial registry" })
})
