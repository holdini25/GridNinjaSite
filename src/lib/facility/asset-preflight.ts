import type { FacilityFile, FacilitySpecimenKind, FacilitySurfaceProfile } from "@/types/facility"
import { preflightSurfaceContract } from "./surface-contract"
import { parseSpecimen } from "./topology-runtime"

const MAX_MODEL_BYTES = 2_500_000
const SUPPORTED_EXTENSIONS = new Set([
  "KHR_mesh_quantization", "EXT_mesh_gpu_instancing", "KHR_texture_transform",
  "KHR_materials_emissive_strength", "KHR_materials_ior", "KHR_materials_specular",
])
const REQUIRED_IDS = ["GN_EXPORT", "GN_PLATFORM", ...["POWER", "COOLING", "STORAGE", "WORKLOADS"].flatMap(system =>
  [`GN_${system}`, `GN_ACCENT_${system}`, `GN_PICK_${system}`])]

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

/** A bounded, self-contained GLB is checked before any loader can fetch resources. */
export function preflightFacilityGlb(bytes: ArrayBuffer, requiredIds: readonly string[] = REQUIRED_IDS, surfaces?: FacilitySurfaceProfile, specimen?: FacilitySpecimenKind): Record<string, unknown> {
  if (bytes.byteLength < 20 || bytes.byteLength > MAX_MODEL_BYTES) throw new Error("model_size")
  const view = new DataView(bytes)
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) throw new Error("model_header")
  let offset = 12
  let document: Record<string, unknown> | undefined
  let binary: Uint8Array | undefined
  let chunks = 0
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error("model_chunk")
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    offset += 8
    if (length % 4 || offset + length > bytes.byteLength) throw new Error("model_chunk")
    if (chunks === 0) {
      if (type !== 0x4e4f534a) throw new Error("model_json")
      const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes, offset, length)))
      if (!record(parsed)) throw new Error("model_json")
      document = parsed
    } else {
      if (chunks !== 1 || type !== 0x004e4942) throw new Error("model_chunk")
      binary = new Uint8Array(bytes, offset, length)
    }
    offset += length
    chunks++
  }
  if (!document || !record(document.asset) || document.asset.version !== "2.0") throw new Error("model_version")
  for (const key of ["buffers", "images"]) {
    const resources = document[key] ?? []
    if (!Array.isArray(resources) || resources.some(resource => !record(resource) || "uri" in resource)) throw new Error("external_resource")
  }
  for (const key of ["extensionsUsed", "extensionsRequired"]) {
    const extensions = document[key] ?? []
    if (!Array.isArray(extensions) || extensions.some(extension => typeof extension !== "string" || !SUPPORTED_EXTENSIONS.has(extension))) throw new Error("unsupported_extension")
  }
  if (Array.isArray(document.animations) && document.animations.length) throw new Error("authored_animation")
  if (!Array.isArray(document.nodes) || document.nodes.length > 2048) throw new Error("model_nodes")
  if (!Array.isArray(document.materials) || document.materials.length > 10) throw new Error("model_materials")
  const ids = new Set<string>()
  for (const node of document.nodes) {
    if (!record(node)) throw new Error("model_node")
    const id = record(node.extras) ? node.extras.gnId : undefined
    if (id !== undefined) {
      if (typeof id !== "string" || ids.has(id)) throw new Error("model_identity")
      ids.add(id)
    }
    for (const key of ["translation", "rotation", "scale", "matrix"]) {
      if (node[key] !== undefined && (!Array.isArray(node[key]) || node[key].some(value => typeof value !== "number" || !Number.isFinite(value)))) throw new Error("model_transform")
    }
  }
  for (const id of requiredIds) if (!ids.has(id)) throw new Error(`model_missing_${id}`)
  if (specimen === "rack") for (const node of document.nodes) {
    if (!record(node) || !record(node.extras) || node.extras.gnId !== "GN_SPECIMEN_ROOT" || node.extras.gnSpecimen === undefined) continue
    const metadata: unknown = typeof node.extras.gnSpecimen === "string" ? JSON.parse(node.extras.gnSpecimen) : node.extras.gnSpecimen
    if (record(metadata) && metadata.rackMotion !== undefined) parseSpecimen(metadata)
  }
  if (surfaces) preflightSurfaceContract(document, binary, surfaces, specimen)
  return document
}

/** Exact decoded size bounds streaming allocation. Digests detect release mismatch. */
export async function fetchFacilityBytes(asset: FacilityFile, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<ArrayBuffer> {
  if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > MAX_MODEL_BYTES ||
      !asset.url.startsWith("/") || asset.url.startsWith("//") || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error("asset_contract")
  signal.throwIfAborted()
  const response = await fetcher(asset.url, { signal, credentials: "omit", mode: "same-origin", redirect: "error", cache: "force-cache" })
  if (!response.ok || !response.body) throw new Error("asset_response")
  const reader = response.body.getReader()
  const bytes = new Uint8Array(asset.bytes)
  let offset = 0
  let complete = false
  try {
    while (true) {
      signal.throwIfAborted()
      const part = await reader.read()
      if (part.done) break
      if (offset + part.value.byteLength > bytes.byteLength) throw new Error("asset_too_large")
      bytes.set(part.value, offset)
      offset += part.value.byteLength
    }
    signal.throwIfAborted()
    if (offset !== asset.bytes) throw new Error("asset_size_mismatch")
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("")
    signal.throwIfAborted()
    if (hash !== asset.sha256) throw new Error("asset_digest_mismatch")
    complete = true
    return bytes.buffer
  } finally {
    if (!complete) try { await reader.cancel() } catch { /* Preserve the original failure. */ }
    reader.releaseLock()
  }
}
