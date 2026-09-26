// @vitest-environment node
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { brotliDecompressSync, gunzipSync } from "node:zlib"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Isolate release states from real publication approvals, including future releases.
const registry = vi.hoisted(() => ({ entries: [] as { release: string; status: "available" | "withheld" | "withdrawn"; manifestSha256?: string }[] }))
vi.mock("@/content/facility-releases/registry.json", () => ({ default: registry.entries }))
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }))

import { facilityAssetResponse, facilityManifestSchema, facilityMode, getFacilityRelease, readFacilityRelease } from "@/lib/facility/releases"
import { GET } from "@/app/assets/facility/[release]/[file]/route"
import frozenV1 from "@/content/facility-releases/facility-v1/manifest.json"
import frozenV2 from "@/content/facility-releases/facility-v2/manifest.json"
import frozenV3 from "@/content/facility-releases/facility-v3/manifest.json"
import frozenV4 from "@/content/facility-releases/facility-v4/manifest.json"
import { manifestSchema as packagingManifestSchema } from "../../../scripts/facility/validate-release.mjs"

const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex")
const id = "facility-v9"
const model = Buffer.from("glTF-route-integrity-fixture")
const desktop = Buffer.from("RIFF-desktop-poster-integrity-fixture")
const mobile = Buffer.from("RIFF-mobile-poster-integrity-fixture")
const directory = join(process.cwd(), "src/content/facility-releases", id)
const files = [
  { file: "facility.glb", bytes: model.length, sha256: hash(model) },
  { file: "poster-desktop.webp", bytes: desktop.length, sha256: hash(desktop) },
  { file: "poster-mobile.webp", bytes: mobile.length, sha256: hash(mobile) },
]

function validManifest() {
  return {
    schemaVersion: "facility.v1", release: id, environment: "synthetic",
    profile: {
      camera: [12, 10.5, 15], target: [0, 1.1, 0], padding: 1.12, background: "#0b1016", exposure: 1,
      colorSpace: "srgb", toneMapping: "aces-filmic",
      lighting: {
        hemisphere: { sky: "#e3edff", ground: "#1a2230", intensity: 2 },
        directional: [{ position: [8, 12, 10], color: "#ffffff", intensity: 3 }],
      },
    },
    systems: Object.fromEntries(["power", "cooling", "storage", "workloads"].map(system => [system, { root: `GN_${system.toUpperCase()}`, accent: `GN_ACCENT_${system.toUpperCase()}`, pick: `GN_PICK_${system.toUpperCase()}` }])),
    equipment: { rotors: Array.from({ length: 4 }, (_, index) => ({ id: `GN_FAN_ROTOR_${String(index).padStart(2, "0")}`, axis: [0, 1, 0] })), leds: Array.from({ length: 48 }, (_, index) => `GN_LED_${String(index).padStart(2, "0")}`) },
    files: structuredClone(files),
    source: { blender: "5.1.2", masterSha256: "1".repeat(64), generatorSha256: "2".repeat(64) },
  }
}

let disk: Map<string, Buffer>

function approve(manifest = validManifest(), path = directory) {
  const bytes = Buffer.from(JSON.stringify(manifest))
  disk.set(join(path, "manifest.json"), bytes)
  registry.entries.splice(0, registry.entries.length, { release: id, status: "available", manifestSha256: hash(bytes) })
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("FACILITY_PREVIEW", "")
  vi.stubEnv("FACILITY_ASSET_RELEASE", id)
  vi.stubEnv("FACILITY_3D_MODE", "")
  disk = new Map([[join(directory, "facility.glb"), model], [join(directory, "poster-desktop.webp"), desktop], [join(directory, "poster-mobile.webp"), mobile]])
  approve()
  vi.mocked(readFile).mockReset().mockImplementation(async path => {
    const value = disk.get(String(path))
    if (!value) throw new Error(`ENOENT /private/facility-authoring/${String(path)}`)
    return Buffer.from(value)
  })
})
afterEach(() => { vi.unstubAllEnvs(); registry.entries.splice(0); vi.mocked(readFile).mockReset() })

describe("approved facility manifest contract", () => {
  it("preserves v1–v4 and accepts only the explicit bounded v5 surface contract", () => {
    for (const manifest of [frozenV1, frozenV2, frozenV3, frozenV4]) expect(facilityManifestSchema.parse(manifest)).toEqual(manifest)
    const surfaces = { version: 1, pipeline: "pbr-semantic-v2", uvSet: 0, maxTextureBytes: 3145728 }
    const candidate = { ...frozenV4, profile: { ...frozenV4.profile, surfaces, lighting: { ...frozenV4.profile.lighting, environment: { ...frozenV4.profile.lighting.environment, preset: "industrial-softbox-v2" } } } }
    expect(facilityManifestSchema.parse(candidate)).toEqual(candidate)
    for (const invalid of [{ ...surfaces, version: 2 }, { ...surfaces, uvSet: 1 }, { ...surfaces, maxTextureBytes: 3145729 }]) expect(facilityManifestSchema.safeParse({ ...candidate, profile: { ...candidate.profile, surfaces: invalid } }).success).toBe(false)
    expect(facilityManifestSchema.safeParse({ ...candidate, profile: { ...candidate.profile, engineering: undefined } }).success).toBe(false)
  })
  it("preserves frozen v1/v2 profiles and accepts matching bounded v3 contracts in both validators", () => {
    for (const manifest of [frozenV1, frozenV2]) {
      expect(facilityManifestSchema.parse(manifest)).toEqual(manifest)
      expect(packagingManifestSchema.parse(manifest)).toEqual(manifest)
    }
    const manifest = {
      ...frozenV2,
      profile: {
        ...frozenV2.profile,
        framing: "projected-geometry",
        lighting: { ...frozenV2.profile.lighting, environment: { preset: "industrial-softbox-v1", resolution: 128, intensity: 0.65, rotationY: 0 } },
        motion: { fanRadiansPerSecond: 1.6, fanPhaseOffsets: [0, 1.57, 3.14, 4.71], ledPulseRadiansPerSecond: 1.8, ledPulseAmplitude: 0.06 },
        led: { color: "#ffc079", steadyIntensity: 0.9, size: [0.032, 0.022, 0.018] },
      },
    }
    expect(facilityManifestSchema.parse(manifest)).toEqual(packagingManifestSchema.parse(manifest))
    for (const invalid of [
      { ...manifest.profile, framing: "unbounded-camera" },
      { ...manifest.profile, lighting: { ...manifest.profile.lighting, environment: { ...manifest.profile.lighting.environment, preset: "remote-hdr" } } },
      { ...manifest.profile, lighting: { ...manifest.profile.lighting, environment: { ...manifest.profile.lighting.environment, resolution: 256 } } },
      { ...manifest.profile, motion: { ...manifest.profile.motion, fanRadiansPerSecond: 30 } },
      { ...manifest.profile, motion: { ...manifest.profile.motion, fanPhaseOffsets: [0, 1] } },
      { ...manifest.profile, motion: { ...manifest.profile.motion, ledPulseAmplitude: 0.5 } },
      { ...manifest.profile, led: { ...manifest.profile.led, size: [0.03, 0, 0.02] } },
    ]) for (const schema of [facilityManifestSchema, packagingManifestSchema]) expect(schema.safeParse({ ...manifest, profile: invalid }).success).toBe(false)
  })

  it("accepts a complete reproducible render profile and exact semantic bindings", () => {
    const parsed = facilityManifestSchema.parse(validManifest())
    expect(parsed.profile.padding).toBe(1.12)
    expect(parsed.profile.lighting.directional).toHaveLength(1)
    expect(parsed.files.map(file => file.file)).toEqual(["facility.glb", "poster-desktop.webp", "poster-mobile.webp"])
  })

  it("rejects source paths, duplicate assets, unknown claims and non-synthetic releases", () => {
    const traversal = validManifest(); traversal.files[0].file = "../../private.blend"
    expect(() => facilityManifestSchema.parse(traversal)).toThrow()
    const duplicate = validManifest(); duplicate.files[1].file = "facility.glb"
    expect(() => facilityManifestSchema.parse(duplicate)).toThrow(/unique/)
    expect(() => facilityManifestSchema.parse({ ...validManifest(), environment: "customer" })).toThrow()
    expect(() => facilityManifestSchema.parse({ ...validManifest(), acceptedMW: 5.8 })).toThrow()
    expect(() => facilityManifestSchema.parse({ ...validManifest(), release: "../facility-v9" })).toThrow()
  })

  it("enforces independent model/poster budgets and rejects missing or invalid rendering contracts", () => {
    const oversizeModel = validManifest(); oversizeModel.files[0].bytes = 2_500_001
    expect(() => facilityManifestSchema.parse(oversizeModel)).toThrow(/budget/)
    const oversizePoster = validManifest(); oversizePoster.files[1].bytes = 150 * 1024 + 1
    expect(() => facilityManifestSchema.parse(oversizePoster)).toThrow(/budget/)
    const invalidBinding = validManifest(); invalidBinding.systems.storage.root = "GN_POWER"
    expect(() => facilityManifestSchema.parse(invalidBinding)).toThrow(/mapping/)
    const invalidCamera = validManifest(); invalidCamera.profile.camera[0] = Infinity
    expect(() => facilityManifestSchema.parse(invalidCamera)).toThrow()
    const invalidPadding = validManifest(); invalidPadding.profile.padding = 0.12
    expect(() => facilityManifestSchema.parse(invalidPadding)).toThrow()
    const noLights = validManifest(); noLights.profile.lighting.directional = []
    expect(() => facilityManifestSchema.parse(noLights)).toThrow()
    const missingRotor = validManifest(); missingRotor.equipment.rotors.pop()
    expect(() => facilityManifestSchema.parse(missingRotor)).toThrow()
    const duplicateLed = validManifest(); duplicateLed.equipment.leds[1] = duplicateLed.equipment.leds[0]
    expect(() => facilityManifestSchema.parse(duplicateLed)).toThrow()
  })
})

describe("facility approval and asset route", () => {
  it("returns only approved visual URLs with exact bytes, digests and reproducible profile", async () => {
    const result = await readFacilityRelease(id)
    expect(result.status).toBe(200)
    if (result.status !== 200) throw new Error("Expected the fixture release")
    expect(result.release.model).toEqual({ url: `/assets/facility/${id}/facility.glb`, bytes: model.length, sha256: hash(model) })
    expect(result.release.profile).toEqual(validManifest().profile)
    expect(result.artifacts.get("poster-mobile.webp")).toEqual(mobile)
    expect(await getFacilityRelease()).toEqual(result.release)
  })

  it("serves correct MIME and ETags through GET without exposing source files or private metadata", async () => {
    for (const [file, bytes, mime] of [["facility.glb", model, "model/gltf-binary"], ["poster-desktop.webp", desktop, "image/webp"], ["poster-mobile.webp", mobile, "image/webp"]] as const) {
      const response = await GET(new Request(`https://gridninja.ai/assets/facility/${id}/${file}`), { params: Promise.resolve({ release: id, file }) })
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe(mime)
      expect(response.headers.get("etag")).toBe(`"${hash(bytes)}"`)
      expect(response.headers.get("cache-control")).toContain("must-revalidate")
      expect(response.headers.get("x-content-type-options")).toBe("nosniff")
      expect(response.headers.get("x-robots-tag")).toContain("noindex")
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
    }
  })

  it("rejects unapproved release IDs and every non-allowlisted filename before filesystem access", async () => {
    for (const release of ["facility-v999999", "candidate", "facility-v0", "../facility-v9", "%2e%2e"]) expect((await facilityAssetResponse(release, "facility.glb")).status).toBe(404)
    for (const file of ["manifest.json", "master.blend", "generator.py", "../facility.glb", "poster-desktop.webp/..", "facility.glb?preview=1"]) expect((await facilityAssetResponse(id, file)).status).toBe(404)
    expect(readFile).not.toHaveBeenCalled()
  })

  it("withholds and withdraws known releases before reading bytes, even for a matching previous ETag", async () => {
    registry.entries[0].status = "withheld"
    const withheld = await facilityAssetResponse(id, "facility.glb", `"${hash(model)}"`)
    expect(withheld.status).toBe(404)
    expect(withheld.headers.get("cache-control")).toBe("no-store")
    registry.entries[0].status = "withdrawn"
    const withdrawn = await facilityAssetResponse(id, "facility.glb", `"${hash(model)}"`)
    expect(withdrawn.status).toBe(410)
    expect(withdrawn.headers.get("cache-control")).toBe("no-store")
    expect(readFile).not.toHaveBeenCalled()
  })

  it("fails closed for ambiguous registry states or missing manifest approval", async () => {
    registry.entries[0].manifestSha256 = undefined
    expect((await facilityAssetResponse(id, "facility.glb")).status).toBe(503)
    expect(await getFacilityRelease()).toBeNull()
    approve()
    registry.entries.push({ release: id, status: "withdrawn" })
    expect((await facilityAssetResponse(id, "facility.glb")).status).toBe(503)
    expect(readFile).not.toHaveBeenCalled()
  })

  it("validates manifest approval before opening artifacts and rejects mismatched release identity", async () => {
    disk.set(join(directory, "manifest.json"), Buffer.from('{"private":"unapproved model"}'))
    const response = await facilityAssetResponse(id, "facility.glb")
    expect(response.status).toBe(503)
    expect(readFile).toHaveBeenCalledTimes(1)
    expect(await response.text()).not.toMatch(/private|manifest|unapproved/)
    const mismatch = validManifest(); mismatch.release = "facility-v10"
    approve(mismatch)
    await expect(readFacilityRelease(id)).rejects.toThrow(/identity mismatch/)
  })

  it("rejects corrupted, truncated or missing approved bytes and returns only a generic availability error", async () => {
    for (const bytes of [Buffer.from(model.toString().replace("glTF", "bad!")), Buffer.from("short")]) {
      disk.set(join(directory, "facility.glb"), bytes)
      await expect(readFacilityRelease(id)).rejects.toThrow(/artifact integrity/)
      const response = await facilityAssetResponse(id, "facility.glb")
      expect(response.status).toBe(503)
      expect(response.headers.get("cache-control")).toBe("no-store")
    }
    disk.delete(join(directory, "facility.glb"))
    const missing = await facilityAssetResponse(id, "facility.glb")
    expect(missing.status).toBe(503)
    expect(await missing.text()).not.toMatch(/ENOENT|private|authoring|src\//)
  })

  it("returns an empty 304 only after verifying the current approved artifacts", async () => {
    const response = await GET(new Request(`https://gridninja.ai/assets/facility/${id}/facility.glb`, { headers: { "If-None-Match": `"${hash(model)}"` } }), { params: Promise.resolve({ release: id, file: "facility.glb" }) })
    expect(response.status).toBe(304)
    expect(await response.text()).toBe("")
    expect(readFile).toHaveBeenCalledTimes(4)
    expect((await facilityAssetResponse(id, "facility.glb", '"outdated"')).status).toBe(200)
    disk.set(join(directory, "facility.glb"), Buffer.from("corrupt"))
    expect((await facilityAssetResponse(id, "facility.glb", `"${hash(model)}"`)).status).toBe(503)
  })
})

describe("facility release switches", () => {
  it("supports reversible presentation modes while retaining the agreed adaptive default", () => {
    expect(facilityMode()).toBe("auto-adaptive")
    vi.stubEnv("FACILITY_3D_MODE", "poster"); expect(facilityMode()).toBe("poster")
    vi.stubEnv("FACILITY_3D_MODE", "manual"); expect(facilityMode()).toBe("manual")
    vi.stubEnv("FACILITY_3D_MODE", "auto-desktop"); expect(facilityMode()).toBe("auto-desktop")
    vi.stubEnv("FACILITY_3D_MODE", "auto-adaptive"); expect(facilityMode()).toBe("auto-adaptive")
  })

  it("never allows the development candidate switch to bypass a production registry", async () => {
    registry.entries.splice(0)
    vi.stubEnv("FACILITY_PREVIEW", "1")
    expect((await readFacilityRelease("facility-v1")).status).toBe(404)
    expect(readFile).not.toHaveBeenCalled()
  })

  it("requires both development mode and an explicit switch, with preview restricted to the explicitly selected release", async () => {
    registry.entries.splice(0)
    vi.stubEnv("NODE_ENV", "development")
    expect((await readFacilityRelease("facility-v1")).status).toBe(404)
    vi.stubEnv("FACILITY_PREVIEW", "1")
    vi.stubEnv("FACILITY_ASSET_RELEASE", "facility-v2")
    const previewDirectory = join(process.cwd(), "build/facility/facility-v2/release")
    const manifest = validManifest(); manifest.release = "facility-v2"
    disk.set(join(previewDirectory, "manifest.json"), Buffer.from(JSON.stringify(manifest)))
    for (const [name, bytes] of [["facility.glb", model], ["poster-desktop.webp", desktop], ["poster-mobile.webp", mobile]] as const) disk.set(join(previewDirectory, name), bytes)
    expect((await readFacilityRelease("facility-v2")).status).toBe(200)
    expect((await readFacilityRelease("facility-v1")).status).toBe(404)
    expect(vi.mocked(readFile).mock.calls.every(([path]) => String(path).startsWith(previewDirectory))).toBe(true)
  })
})

describe("facility GLB content negotiation", () => {
  it("serves Brotli and gzip bodies that decode to the exact approved GLB through GET", async () => {
    for (const encoding of ["br", "gzip"] as const) {
      const response = await GET(new Request(`https://gridninja.ai/assets/facility/${id}/facility.glb`, { headers: { "Accept-Encoding": encoding } }), { params: Promise.resolve({ release: id, file: "facility.glb" }) })
      expect(response.status).toBe(200)
      expect(response.headers.get("content-encoding")).toBe(encoding)
      expect(response.headers.get("vary")).toBe("Accept-Encoding")
      const encoded = Buffer.from(await response.arrayBuffer())
      const decoded = encoding === "br" ? brotliDecompressSync(encoded) : gunzipSync(encoded)
      expect(decoded).toEqual(model)
      expect(response.headers.get("content-length")).toBe(String(encoded.length))
      expect(response.headers.get("etag")).toBe(`"${hash(encoded)}"`)
    }
    const release = await getFacilityRelease()
    expect(release?.model.bytes).toBe(model.length)
    expect(release?.model.sha256).toBe(hash(model))
  })

  it("prefers Brotli at equal weights, honors explicit preferences and never selects q=0 encodings", async () => {
    for (const [accept, encoding] of [
      ["gzip, br", "br"],
      ["br;q=0.5, gzip;q=1", "gzip"],
      ["BR;q=1, gzip;q=0.5", "br"],
      ["br;q=0, gzip;q=0.5", "gzip"],
      ["br;q=0, gzip;q=0", null],
      ["identity;q=1, br;q=0.5", null],
      ["*;q=0, br;q=1", "br"],
      ["br;q=0, *;q=0.5", "gzip"],
      ["br;q=1.1, gzip", "gzip"],
      ["x-gzip", "gzip"],
      ["identity", null],
      ["", null],
    ] as const) {
      const response = await facilityAssetResponse(id, "facility.glb", null, accept)
      expect(response.status, accept).toBe(200)
      expect(response.headers.get("content-encoding"), accept).toBe(encoding)
      expect(response.headers.get("vary")).toBe("Accept-Encoding")
    }
  })

  it("returns 406 when every available representation is excluded and keeps WebP uncompressed", async () => {
    for (const accept of ["br;q=0, gzip;q=0, identity;q=0", "*;q=0", "zstd, identity;q=0"]) {
      const response = await facilityAssetResponse(id, "facility.glb", null, accept)
      expect(response.status).toBe(406)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(response.headers.get("vary")).toBe("Accept-Encoding")
    }
    const poster = await facilityAssetResponse(id, "poster-desktop.webp", null, "br, gzip")
    expect(poster.headers.get("content-encoding")).toBeNull()
    expect(Buffer.from(await poster.arrayBuffer())).toEqual(desktop)
    expect((await facilityAssetResponse(id, "poster-desktop.webp", null, "br, identity;q=0")).status).toBe(406)
  })

  it("uses representation-specific ETags and supports weak validators, lists and wildcard GETs", async () => {
    const responses = await Promise.all([null, "br", "gzip"].map(encoding => facilityAssetResponse(id, "facility.glb", null, encoding)))
    const [identityTag, brotliTag, gzipTag] = responses.map(response => response.headers.get("etag")!)
    expect(new Set([identityTag, brotliTag, gzipTag]).size).toBe(3)
    for (const condition of [brotliTag, `W/${brotliTag}`, `"old-version", W/${brotliTag}, "other-version"`, "*"]) {
      const response = await facilityAssetResponse(id, "facility.glb", condition, "br")
      expect(response.status).toBe(304)
      expect(response.headers.get("etag")).toBe(brotliTag)
      expect(response.headers.get("content-encoding")).toBe("br")
      expect(response.headers.get("vary")).toBe("Accept-Encoding")
      expect(await response.text()).toBe("")
    }
    expect((await facilityAssetResponse(id, "facility.glb", identityTag, "br")).status).toBe(200)
    expect((await facilityAssetResponse(id, "facility.glb", brotliTag, "gzip")).status).toBe(200)
  })

  it("revalidates approval and decoded bytes before using a warm compression cache or returning 304", async () => {
    const initial = await facilityAssetResponse(id, "facility.glb", null, "br")
    const tag = initial.headers.get("etag")
    expect(initial.status).toBe(200)
    disk.set(join(directory, "facility.glb"), Buffer.from("corrupted after first request"))
    expect((await facilityAssetResponse(id, "facility.glb", tag, "br")).status).toBe(503)
    disk.set(join(directory, "facility.glb"), model)
    registry.entries[0].status = "withdrawn"
    expect((await facilityAssetResponse(id, "facility.glb", tag, "br")).status).toBe(410)
  })
})
