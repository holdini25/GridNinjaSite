import "server-only"

import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib"
import { z } from "zod"
import registrySource from "@/content/facility-releases/registry.json"
import type { FacilityMode, FacilityVisualRelease } from "@/types/facility"

import { allowedFiles as fileNames, manifestSchema as facilityManifestSchema, registrySchema, releasePattern } from "./manifest-schema.mjs"
export { facilityManifestSchema }
const releaseId = z.string().regex(releasePattern)

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
const brotliAsync = promisify(brotliCompress)
const gzipAsync = promisify(gzip)
type Encoding = "br" | "gzip" | "identity"
// Four compressed representations retain at most about 10 MiB at the GLB limit.
// Approval and all artifact hashes are rechecked before consulting this cache.
const compressedArtifacts = new Map<string, Promise<Buffer>>()

function negotiateEncoding(header: string | null, compressed: boolean): Encoding | null {
  if (!header?.trim()) return "identity"
  const qualities = new Map<string, number>()
  for (const part of header.toLowerCase().split(",")) {
    const [rawName, ...parameters] = part.trim().split(";")
    const name = rawName === "x-gzip" ? "gzip" : rawName
    if (!name) continue
    let quality = 1
    for (const parameter of parameters) {
      const match = /^\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)\s*$/.exec(parameter)
      // Invalid weights must not accidentally enable an excluded encoding.
      quality = match ? Number(match[1]) : 0
    }
    qualities.set(name, Math.min(qualities.get(name) ?? 1, quality))
  }
  const wildcard = qualities.get("*")
  const identity = qualities.get("identity") ?? (wildcard === 0 ? 0 : undefined)
  let preferred: Encoding | null = null, quality = 0
  for (const encoding of compressed ? ["br", "gzip", "identity"] as const : ["identity"] as const) {
    // An unlisted identity is a fallback; an explicitly preferred identity wins.
    const candidate = encoding === "identity" ? identity ?? 0 : qualities.get(encoding) ?? wildcard ?? 0
    if (candidate > quality) { preferred = encoding; quality = candidate }
  }
  return preferred ?? (identity !== 0 ? "identity" : null)
}

async function encodeArtifact(bytes: Buffer, digest: string, encoding: Exclude<Encoding, "identity">): Promise<Buffer> {
  const key = `${digest}:${encoding}`
  const cached = compressedArtifacts.get(key)
  if (cached) { compressedArtifacts.delete(key); compressedArtifacts.set(key, cached); return cached }
  const pending = (encoding === "br" ? brotliAsync(bytes, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } }) : gzipAsync(bytes, { level: 6 })).catch(error => {
    if (compressedArtifacts.get(key) === pending) compressedArtifacts.delete(key)
    throw error
  })
  compressedArtifacts.set(key, pending)
  if (compressedArtifacts.size > 4) compressedArtifacts.delete(compressedArtifacts.keys().next().value!)
  return pending
}

function matchesEtag(condition: string | null, etag: string) {
  return condition?.trim() === "*" || !!condition?.split(",").some(value => value.trim().replace(/^W\//, "") === etag)
}

export function facilityMode(): FacilityMode {
  const mode = process.env.FACILITY_3D_MODE
  return mode === "poster" || mode === "manual" || mode === "auto-desktop" ? mode : "auto-adaptive"
}

export async function readFacilityRelease(id: string) {
  if (!releaseId.safeParse(id).success) return { status: 404 as const }
  // Authoring previews require an explicit local development switch. They are
  // excluded from production traces and cannot bypass the production registry.
  const preview = process.env.NODE_ENV === "development" && process.env.FACILITY_PREVIEW === "1" && id === process.env.FACILITY_ASSET_RELEASE
  const entry = preview ? { release: id, status: "available" as const, manifestSha256: undefined } : registrySchema.parse(registrySource).find(item => item.release === id)
  if (!entry || entry.status === "withheld") return { status: 404 as const }
  if (entry.status === "withdrawn") return { status: 410 as const }
  const directory = preview ? join(process.cwd(), "build/facility", id, "release") : join(process.cwd(), "src/content/facility-releases", entry.release)
  const raw = await readFile(join(directory, "manifest.json"))
  if (!preview && sha256(raw) !== entry.manifestSha256) throw new Error("Facility manifest integrity failure")
  const manifest = facilityManifestSchema.parse(JSON.parse(raw.toString("utf8")))
  if (manifest.release !== id) throw new Error("Facility release identity mismatch")
  const artifacts = new Map<string, Buffer>()
  for (const item of manifest.files) {
    const bytes = await readFile(join(directory, item.file))
    if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) throw new Error("Facility artifact integrity failure")
    artifacts.set(item.file, bytes)
  }
  const file = (name: string) => {
    const item = manifest.files.find(item => item.file === name)!
    return { url: `/assets/facility/${id}/${name}`, bytes: item.bytes, sha256: item.sha256 }
  }
  const release: FacilityVisualRelease = {
    schemaVersion: "facility.v1", release: id, environment: "synthetic", profile: manifest.profile,
    ...(manifest.equipmentIndex ? { equipmentIndex: manifest.equipmentIndex } : {}),
    systems: manifest.systems, equipment: manifest.equipment, model: file("facility.glb"),
    ...(manifest.specimens ? { specimens: Object.fromEntries(Object.entries(manifest.specimens).map(([kind, specimen]) => [kind, { ...specimen, profile: specimen.profile, model: file(`${kind}.glb`), posters: { closed: file(`${kind}-closed.webp`), cutaway: file(`${kind}-cutaway.webp`) } }])) as FacilityVisualRelease["specimens"] } : {}),
    posters: { desktop: file("poster-desktop.webp"), mobile: file("poster-mobile.webp") },
  }
  return { status: 200 as const, manifest, release, artifacts }
}

/** Only a reviewed registry entry may become a public URL. Candidate work is never traced. */
export async function getFacilityRelease(): Promise<FacilityVisualRelease | null> {
  const id = process.env.FACILITY_ASSET_RELEASE ?? "facility-v10"
  try {
    const result = await readFacilityRelease(id)
    return result.status === 200 ? result.release : null
  } catch {
    return null
  }
}

export async function facilityAssetResponse(id: string, file: string, ifNoneMatch: string | null = null, acceptEncoding: string | null = null) {
  const failure = (status: number) => new Response(status === 410 ? "Visual release withdrawn" : status === 503 ? "Visual temporarily unavailable" : status === 406 ? "Visual encoding not acceptable" : "Visual not found", { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff", Vary: "Accept-Encoding" } })
  if (!(fileNames as readonly string[]).includes(file)) return failure(404)
  try {
    const result = await readFacilityRelease(id)
    if (result.status !== 200) return failure(result.status)
    const artifact = result.manifest.files.find(item => item.file === file)
    if (!artifact) return failure(404)
    const encoding = negotiateEncoding(acceptEncoding, file.endsWith(".glb"))
    if (!encoding) return failure(406)
    const approved = result.artifacts.get(file)!
    const bytes = encoding === "identity" ? approved : await encodeArtifact(approved, artifact.sha256, encoding)
    // Strong validators identify the actual encoded representation; public
    // manifest sizes and SHA-256 still describe the decoded, approved GLB.
    const etag = `"${encoding === "identity" ? artifact.sha256 : sha256(bytes)}"`
    const headers = new Headers({ "Content-Type": file.endsWith(".glb") ? "model/gltf-binary" : "image/webp", "Cache-Control": "public, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex", Vary: "Accept-Encoding", ETag: etag })
    if (encoding !== "identity") headers.set("Content-Encoding", encoding)
    if (matchesEtag(ifNoneMatch, etag)) return new Response(null, { status: 304, headers })
    headers.set("Content-Length", String(bytes.length))
    return new Response(new Uint8Array(bytes), { headers })
  } catch {
    return failure(503)
  }
}
