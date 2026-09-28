import { z } from "zod"

export const releasePattern = /^cinematic-v[1-9][0-9]*$/
export const requiredFiles = ["desktop.mp4", "mobile.mp4", "poster-desktop.webp", "poster-mobile.webp"]
export const allowedFiles = [...requiredFiles, "still-construction.webp", "still-cooling.webp"]
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const dimension = z.number().int().positive().max(4096)
const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
const composition = z.object({
  renderWidth: dimension, renderHeight: dimension, crop: z.literal("full-frame"),
  camera: z.object({
    projection: z.literal("orthographic"), fixed: z.literal(true),
    positionMetres: vector, rotationEulerRadians: vector,
    verticalSpanMetres: z.number().positive().finite(),
    azimuthDegrees: z.number().finite(), elevationDegrees: z.number().min(-90).max(90),
    padding: z.number().min(1).max(2),
  }).strict(),
}).strict()
export const encodingSchema = z.object({
  codec: z.literal("h264"), profile: z.literal("high"), pixelFormat: z.literal("yuv420p"),
  audio: z.literal(false), fastStart: z.literal(true),
  color: z.object({ primaries: z.literal("bt709"), transfer: z.literal("iec61966-2-1"), matrix: z.literal("bt709"), range: z.literal("limited"), dynamicRange: z.literal("sdr") }).strict(),
}).strict()
export const fileByteCeiling = file => file === "desktop.mp4" ? 4 * 1024 * 1024 : file === "mobile.mp4" ? 2 * 1024 * 1024 : file === "poster-mobile.webp" ? 100 * 1024 : 200 * 1024
const rendition = z.object({
  width: dimension, height: dimension, durationSeconds: z.literal(10),
  fps: z.literal(30), frameCount: z.literal(300), composition,
  video: z.enum(["desktop.mp4", "mobile.mp4"]), poster: z.enum(["poster-desktop.webp", "poster-mobile.webp"]),
  frame0Sha256: digest.optional(),
  posterCorrespondence: z.object({ method: z.literal("encoded-first-frame"), frameIndex: z.literal(0), decodedFrameSha256: digest, decodedFrameBytes: z.number().int().positive(), encodedVideoSha256: digest }).strict(),
}).strict().refine(value => Math.abs(value.frameCount / value.fps - value.durationSeconds) < .001, "Frame count and duration disagree")

export const manifestSchema = z.object({
  schemaVersion: z.literal("cinematic.v1"), release: z.string().regex(releasePattern), environment: z.literal("synthetic"),
  source: z.object({ masterIdentity: z.literal("gridninja-facility-shared-master"), masterSha256: digest, settingsSha256: digest, sourceRevision: digest.optional() }).strict(),
  encoding: encodingSchema,
  renditions: z.object({ desktop: rendition, mobile: rendition }).strict(),
  files: z.array(z.object({ file: z.enum(allowedFiles), bytes: z.number().int().positive(), sha256: digest,
    mimeType: z.enum(["video/mp4", "image/webp"]), width: dimension.optional(), height: dimension.optional(),
  }).strict()).min(4).max(6),
}).strict().superRefine((value, context) => {
  const fail = message => context.addIssue({ code: "custom", message })
  const names = value.files.map(file => file.file)
  if (new Set(names).size !== names.length || requiredFiles.some(file => !names.includes(file))) fail("A cinematic release needs its complete, unique file set")
  for (const [kind, view] of Object.entries(value.renditions)) {
    if (view.video !== `${kind}.mp4` || view.poster !== `poster-${kind}.webp`) fail("Rendition file identity mismatch")
    if (view.width % 2 || view.height % 2) fail("Video dimensions must be even")
    if (view.composition.renderWidth < view.width || view.composition.renderHeight < view.height || view.composition.renderWidth * view.height !== view.composition.renderHeight * view.width) fail("Full-frame delivery must retain its rendered composition and cannot be upscaled")
    if (view.posterCorrespondence.encodedVideoSha256 !== value.files.find(file => file.file === view.video)?.sha256) fail("Poster correspondence must bind its exact encoded video")
  }
  for (const file of value.files) {
    if (file.bytes > fileByteCeiling(file.file)) fail("Cinematic file exceeds its bounded allocation")
    if (file.mimeType !== (file.file.endsWith(".mp4") ? "video/mp4" : "image/webp")) fail("Cinematic MIME type mismatch")
    if (file.file.startsWith("still-") && (!file.width || !file.height)) fail("Supporting still dimensions are required")
  }
})

export const registrySchema = z.array(z.object({ release: z.string().regex(releasePattern), status: z.enum(["available", "withheld", "withdrawn"]), manifestSha256: digest.optional() }).strict()).superRefine((entries, context) => {
  if (new Set(entries.map(entry => entry.release)).size !== entries.length || entries.some(entry => entry.status === "available" && !entry.manifestSha256)) context.addIssue({ code: "custom", message: "Invalid cinematic registry" })
})
