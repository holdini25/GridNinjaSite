// @vitest-environment node
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { CONTACT_TILES, PAINT_ROLES, readBakeReport, validateBakeContract, validateSpatialSamples } from "../../../assets-source/facility/validate-spatial.mjs"

function fixture(roughness = .45) {
  const fixed = { floor: [.78, 0], plinth: [.48, 0], rack_support: [.37, 1], rack_a: [.55, 0], face_a: [.55, 0], face_b: [.55, 0], coil: [.55, 0], label: [.45, 0], metal: [.37, 1], polished: [.34, 1], rubber: [.76, 0], copper: [.34, 1], indicator: [.4, 0], platform: [.78, 0], polymer: [.4, 0] }
  const report = {
    schemaVersion: 1, surfaceContractRevision: "facility-surfaces.v3-contact-candidate",
    atlasTiles: structuredClone(CONTACT_TILES),
    atlasLayoutSha256: createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(CONTACT_TILES).sort(([a], [b]) => a.localeCompare(b, "en"))))).digest("hex"),
    resolution: [512, 512], colorResolution: [256, 256], gutterPixels: 8, atlasOrigin: "bottom-left", noiseSeedNamespace: "facility-surfaces.v2",
    directIlluminationInColorAtlas: false, roughnessMultiplier: 1,
    ormFinishes: { ...fixed, ...Object.fromEntries(PAINT_ROLES.map(role => [role, [roughness, 0]])) },
    images: ["surface-color.png", "surface-normal.png", "surface-orm.png"].map(file => ({ file, bytes: 1, sha256: "a".repeat(64) })),
  }
  const orm = Buffer.alloc(512 * 512 * 4, 255), color = Buffer.alloc(256 * 256 * 4, 255)
  const coordinates: { material: string; uv: number[] }[] = []
  for (const name of [...PAINT_ROLES, "rack_support"]) {
    const [x, y, w, h] = CONTACT_TILES[name as keyof typeof CONTACT_TILES]
    const steel = name === "rack_support"
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const at = ((511 - yy) * 512 + xx) * 4
      orm[at] = 230 + (xx % 8); orm[at + 1] = Math.round((steel ? .37 : roughness) * 255); orm[at + 2] = steel ? 255 : 0
    }
    for (const u of [x + 9, x + w - 9]) for (const v of [y + 9, y + h - 9]) coordinates.push({ material: steel ? "Steel" : "Graphite", uv: [u / 512, 1 - v / 512] })
  }
  return { report, role: "rack", coordinates, orm, color }
}
const corePixel = ((511 - 140) * 512 + 400) * 4

describe("current contact atlas qualification", () => {
  it.each([.42, .45])("accepts split contact receivers and reviewed paint %s", roughness => {
    expect(validateSpatialSamples(fixture(roughness))).toHaveLength(7)
  })
  it("requires the explicitly pinned report bytes", () => {
    const bytes = Buffer.from(JSON.stringify(fixture().report)), digest = createHash("sha256").update(bytes).digest("hex")
    expect(readBakeReport(bytes, digest).ormFinishes.paint).toEqual([.45, 0])
    expect(() => readBakeReport(bytes, "0".repeat(64))).toThrow("hash mismatch")
    expect(() => readBakeReport(bytes, undefined)).toThrow("Explicit")
  })
  it("rejects the obsolete unsplit panel even if its layout hash is replaced", () => {
    const { report } = fixture(); report.atlasTiles = { ...report.atlasTiles, rack_panel: [384, 0, 128, 256] }
    report.atlasLayoutSha256 = createHash("sha256").update(JSON.stringify(report.atlasTiles)).digest("hex")
    expect(() => validateBakeContract(report)).toThrow("Unsupported atlas")
  })
  it("rejects out-of-range or inconsistent finish declarations", () => {
    expect(() => validateBakeContract(fixture(.7).report)).toThrow("outside reviewed")
    const { report } = fixture(); report.ormFinishes.rack_support = [.45, 0]
    expect(() => validateBakeContract(report)).toThrow("Unreviewed fixed finish")
  })
  it("rejects actual roughness inconsistent with the pinned declaration", () => {
    const input = fixture(); input.orm[corePixel + 1] = 180
    expect(() => validateSpatialSamples(input)).toThrow("Unexpected roughness")
  })
  it("rejects accidental metallic paint", () => {
    const input = fixture(); input.orm[corePixel + 2] = 255
    expect(() => validateSpatialSamples(input)).toThrow("Incorrect metalness")
  })
  it("rejects excessively dark contact occlusion", () => {
    const input = fixture(); input.orm[corePixel] = 0
    expect(() => validateSpatialSamples(input)).toThrow("AO floor")
  })
  it("rejects an erased contact field", () => {
    const input = fixture(); for (let i = 0; i < input.orm.length; i += 4) input.orm[i] = 255
    expect(() => validateSpatialSamples(input)).toThrow("Missing contact AO")
  })
  it("rejects collapsed or missing receiver UVs", () => {
    const input = fixture(); input.coordinates = input.coordinates.map(entry => ({ ...entry, uv: [393 / 512, 1 - 137 / 512] }))
    expect(() => validateSpatialSamples(input)).toThrow(/Missing|Collapsed/)
  })
  it("rejects color tint, cutouts or baked lighting on receivers", () => {
    const input = fixture(); input.color[((255 - 70) * 256 + 200) * 4] = 180
    expect(() => validateSpatialSamples(input)).toThrow("Direct illumination")
  })
  it("rejects malformed decoded texture allocation", () => {
    const input = fixture(); input.orm = Buffer.alloc(16)
    expect(() => validateSpatialSamples(input)).toThrow("dimensions")
  })
})
