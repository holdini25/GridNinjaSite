import { webcrypto } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchFacilityBytes, preflightFacilityGlb } from "@/lib/facility/asset-preflight"

const baseDocument = () => ({
  asset: { version: "2.0" },
  materials: [{}],
  nodes: ["GN_EXPORT", "GN_PLATFORM", ...["POWER", "COOLING", "STORAGE", "WORKLOADS"].flatMap(system =>
    [`GN_${system}`, `GN_ACCENT_${system}`, `GN_PICK_${system}`])].map(gnId => ({ extras: { gnId } })),
})
function glb(document: object) {
  const json = new TextEncoder().encode(JSON.stringify(document))
  const paddedLength = Math.ceil(json.length / 4) * 4
  const bytes = new Uint8Array(20 + paddedLength)
  const header = new DataView(bytes.buffer)
  header.setUint32(0, 0x46546c67, true)
  header.setUint32(4, 2, true)
  header.setUint32(8, bytes.length, true)
  header.setUint32(12, paddedLength, true)
  header.setUint32(16, 0x4e4f534a, true)
  bytes.fill(32, 20)
  bytes.set(json, 20)
  return bytes.buffer
}

afterEach(() => vi.unstubAllGlobals())

describe("facility asset preflight", () => {
  it("accepts the bounded embedded model contract", () => {
    expect(preflightFacilityGlb(glb(baseDocument())).nodes).toHaveLength(14)
  })
  it("requires the specimen family and every descriptor identity without weakening embedded-resource checks", () => {
    const document = { ...baseDocument(), nodes: ["GN_SPECIMEN_ROOT", "GN_RACK_FRAME"].map(gnId => ({ extras: { gnId } })) }
    expect(() => preflightFacilityGlb(glb(document))).toThrow("GN_EXPORT")
    expect(preflightFacilityGlb(glb(document), ["GN_SPECIMEN_ROOT", "GN_RACK_FRAME"]).nodes).toHaveLength(2)
    expect(() => preflightFacilityGlb(glb(document), ["GN_SPECIMEN_ROOT", "GN_RACK_DOOR"])).toThrow("GN_RACK_DOOR")
    expect(() => preflightFacilityGlb(glb({ ...document, images: [{ uri: "/unapproved.png" }] }), ["GN_SPECIMEN_ROOT"])).toThrow("external_resource")
  })
  it("rejects external resources before a loader can request them", () => {
    for (const key of ["buffers", "images"]) {
      expect(() => preflightFacilityGlb(glb({ ...baseDocument(), [key]: [{ uri: "https://example.org/resource.bin" }] }))).toThrow("external_resource")
    }
  })
  it("requires every stable binding and unique semantic identity", () => {
    const document = baseDocument()
    document.nodes.pop()
    expect(() => preflightFacilityGlb(glb(document))).toThrow("model_missing")
    document.nodes.push(document.nodes[0])
    expect(() => preflightFacilityGlb(glb(document))).toThrow("model_identity")
  })
  it("rejects malformed chunks, oversized assets, animation and runtime codecs", () => {
    const badHeader = glb(baseDocument())
    new DataView(badHeader).setUint32(12, 0xffffffff, true)
    expect(() => preflightFacilityGlb(badHeader)).toThrow("model_chunk")
    expect(() => preflightFacilityGlb(new ArrayBuffer(2_500_001))).toThrow("model_size")
    expect(() => preflightFacilityGlb(glb({ ...baseDocument(), animations: [{}] }))).toThrow("authored_animation")
    expect(() => preflightFacilityGlb(glb({ ...baseDocument(), extensionsRequired: ["KHR_draco_mesh_compression"] }))).toThrow("unsupported_extension")
  })
})

describe("facility asset transfer", () => {
  async function assetFor(bytes: ArrayBuffer) {
    vi.stubGlobal("crypto", webcrypto)
    const digest = await webcrypto.subtle.digest("SHA-256", bytes)
    return { url: "/assets/facility/test/model.glb", bytes: bytes.byteLength, sha256: Buffer.from(digest).toString("hex") }
  }
  it("checks exact decoded size and digest rather than trusting Content-Length", async () => {
    const bytes = glb(baseDocument())
    const asset = await assetFor(bytes)
    const fetcher = vi.fn().mockResolvedValue(new Response(bytes, { headers: { "content-length": "1" } }))
    expect(await fetchFacilityBytes(asset, new AbortController().signal, fetcher)).toEqual(bytes)
    expect(fetcher).toHaveBeenCalledWith(asset.url, expect.objectContaining({ mode: "same-origin", redirect: "error", credentials: "omit" }))
  })
  it("rejects extra, missing, and mismatched bytes", async () => {
    const bytes = glb(baseDocument())
    const asset = await assetFor(bytes)
    await expect(fetchFacilityBytes({ ...asset, bytes: asset.bytes - 1 }, new AbortController().signal, vi.fn().mockResolvedValue(new Response(bytes)))).rejects.toThrow("asset_too_large")
    await expect(fetchFacilityBytes({ ...asset, bytes: asset.bytes + 1 }, new AbortController().signal, vi.fn().mockResolvedValue(new Response(bytes)))).rejects.toThrow("asset_size_mismatch")
    await expect(fetchFacilityBytes({ ...asset, sha256: "0".repeat(64) }, new AbortController().signal, vi.fn().mockResolvedValue(new Response(bytes)))).rejects.toThrow("asset_digest_mismatch")
  })
  it("rejects a cancelled generation before transfer", async () => {
    const asset = await assetFor(glb(baseDocument()))
    const controller = new AbortController()
    controller.abort()
    const fetcher = vi.fn()
    await expect(fetchFacilityBytes(asset, controller.signal, fetcher)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
