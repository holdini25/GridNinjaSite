import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { z } from "zod"
import registrySource from "@/content/assessment-publications/registry.json" with { type: "json" }
import { parseAssessment } from "@/lib/assessment/invariants"

const formats = { html: { file: "brief.html", mime: "text/html; charset=utf-8" }, pdf: { file: "brief.pdf", mime: "application/pdf" }, json: { file: "snapshot.json", mime: "application/json; charset=utf-8" } } as const
export type PublicationFormat = keyof typeof formats
const publicationIdSchema = z.string().regex(/^demo-01-[a-d]$/)
const versionSchema = z.string().regex(/^v\d+\.\d+\.\d+$/)
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/)
const artifactNames = ["snapshot.json", "narrative.json", "brief.html", "brief.pdf"] as const
const registrySchema = z.array(z.object({
  publicationId: publicationIdSchema,
  version: versionSchema,
  status: z.enum(["available", "withheld", "withdrawn"]),
  manifestSha256: digestSchema.optional(),
}).strict()).superRefine((entries, context) => {
  const identities = new Set<string>()
  entries.forEach((entry, index) => {
    const identity = `${entry.publicationId}/${entry.version}`
    if (identities.has(identity)) context.addIssue({ code: "custom", message: "Duplicate publication identity", path: [index] })
    identities.add(identity)
    if (entry.status === "available" && !entry.manifestSha256) context.addIssue({ code: "custom", message: "Available publication requires an approved manifest digest", path: [index, "manifestSha256"] })
  })
})

export function parsePublicationRegistry(input: unknown) { return registrySchema.parse(input) }
export function parsePublicationManifest(input: unknown) {
  return z.object({
    schemaVersion: z.literal("assessment-publication.v1"), publicationId: publicationIdSchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/), status: z.literal("available"), provenance: z.literal("synthetic"),
    narrativeVersion: z.string().min(1), templateVersion: z.string().min(1),
    artifacts: z.array(z.object({ file: z.enum(artifactNames), sha256: digestSchema, bytes: z.number().int().positive() }).strict()).length(4),
  }).strict().refine(manifest => new Set(manifest.artifacts.map(item => item.file)).size === 4, "Publication artifacts must be unique").parse(input)
}

const narrativeSchema = z.object({
  version: z.string().min(1), title: z.string().min(1), conclusion: z.string().min(1), businessQuestion: z.string().min(1),
  governingConditions: z.array(z.string().min(1)).min(1), economics: z.string().min(1), limitations: z.array(z.string().min(1)).min(1), nextStep: z.string().min(1),
}).strict()
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")

/** The reviewed registry pins the entire manifest. Old publications never use the current HTML template. */
export async function readAssessmentPublication(publicationId: string, version: string, format: string) {
  if (!publicationIdSchema.safeParse(publicationId).success || !versionSchema.safeParse(version).success || !Object.hasOwn(formats, format)) return { status: 404 as const }
  const registry = parsePublicationRegistry(registrySource)
  const entry = registry.find(item => item.publicationId === publicationId && item.version === version)
  if (!entry) return { status: 404 as const }
  if (entry.status === "withdrawn") return { status: 410 as const }
  if (entry.status !== "available") return { status: 404 as const }
  const directory = join(process.cwd(), "src/content/assessment-publications", entry.publicationId, entry.version)
  const manifestBytes = await readFile(join(directory, "manifest.json"))
  if (sha256(manifestBytes) !== entry.manifestSha256) throw new Error("Publication manifest approval mismatch")
  const manifest = parsePublicationManifest(JSON.parse(manifestBytes.toString("utf8")))
  if (manifest.publicationId !== publicationId || `v${manifest.version}` !== version) throw new Error("Invalid publication manifest identity")
  const files = new Map<string, Buffer>()
  for (const artifact of manifest.artifacts) {
    const bytes = await readFile(join(directory, artifact.file))
    if (bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256) throw new Error("Publication integrity check failed")
    files.set(artifact.file, bytes)
  }
  const record = parseAssessment(JSON.parse(files.get("snapshot.json")!.toString("utf8")))
  const narrative = narrativeSchema.parse(JSON.parse(files.get("narrative.json")!.toString("utf8")))
  if (record.publication.id !== publicationId || `v${record.publication.version}` !== version || record.publication.templateVersion !== manifest.templateVersion || record.publication.narrativeVersion !== manifest.narrativeVersion) throw new Error("Publication identity mismatch")
  // These are v1 snapshot/narrative invariants, not a comparison to a mutable
  // template or newly authored next-step wording. Registry hashes pin the latter.
  const expectedNarrative = {
    version: record.publication.narrativeVersion, title: record.title, conclusion: record.conclusion,
    businessQuestion: record.commercial.question, governingConditions: record.reasons.map(reason => `${reason.label}: ${reason.detail}`),
    economics: record.economics.reason, limitations: record.limitations,
  }
  if (!isDeepStrictEqual(narrative, { ...expectedNarrative, nextStep: narrative.nextStep })) throw new Error("Publication narrative and snapshot disagree")
  const selected = formats[format as PublicationFormat]
  return { status: 200 as const, bytes: files.get(selected.file)!, mime: selected.mime, extension: format, record, manifest }
}

export async function assessmentPublicationResponse(publicationId: string, version: string, format: string, download = false) {
  let result: Awaited<ReturnType<typeof readAssessmentPublication>>
  try { result = await readAssessmentPublication(publicationId, version, format) }
  catch { return new Response("This publication is temporarily unavailable. No alternate result has been substituted.", { status: 503, headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }) }
  if (result.status !== 200) return new Response(result.status === 410 ? "Publication withdrawn" : "Publication not found", { status: result.status, headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" } })
  return new Response(new Uint8Array(result.bytes), { headers: {
    "Content-Type": result.mime, "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, follow, noarchive",
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="gridninja-${publicationId}-${version}.${format}"`,
    Link: `<https://gridninja.ai/evidence/assessments/${publicationId}/${version}>; rel="canonical"`,
  } })
}
