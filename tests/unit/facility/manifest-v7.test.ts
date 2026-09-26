// @vitest-environment node
import { describe, expect, it } from "vitest"
import v6 from "@/content/facility-releases/facility-v6/manifest.json"
import { equipmentIndexSchema, manifestSchema, profileSchema } from "@/lib/facility/manifest-schema.mjs"
import { validateInspectionContract } from "@/lib/facility/inspection-contract"
import type { FacilityRenderProfile, FacilityTopology } from "@/types/facility"

const bounds = { min: [-1, 0, -1], max: [1, 3, 1] }
const detail = { camera: [3, 4, 5], target: [0, 1, 0], padding: 1.12, projection: "perspective", fov: 32 }
const inspection = { version: 1, fitSubjects: { overview: bounds, "air-path": bounds }, mobile: { camera: [12, 10, 15], target: [0, 1, 0], padding: 1.12 }, details: { rack: detail, "air-path": detail } }
const index = { schemaVersion: "facility-equipment-index.v1", equipment: [{ id: "rack-02", label: "Rack 03", system: "workloads", role: "server rack", bounds }] }
const profile = { ...v6.profile, inspection, lighting: { ...v6.profile.lighting, environment: { ...v6.profile.lighting.environment, preset: "industrial-night-v1" } } }

describe("optional v7 inspection contract", () => {
  it("bounds the optional equipment-edge response while preserving absent legacy fields", () => {
    const equipmentEdge = { version: 1, viewDirection: "projection-correct", exponent: 5, intensity: .02 }
    const candidate = { ...profile, surfaces: { ...profile.surfaces, equipmentEdge } }
    expect(profileSchema.parse(candidate)).toEqual(candidate)
    for (const invalid of [{ ...equipmentEdge, exponent: 0 }, { ...equipmentEdge, exponent: 9 }, { ...equipmentEdge, intensity: .11 }, { ...equipmentEdge, intensity: -1 }, { ...equipmentEdge, intensity: Infinity }, { ...equipmentEdge, viewDirection: "unknown" }, { ...equipmentEdge, version: 2 }]) {
      expect(profileSchema.safeParse({ ...candidate, surfaces: { ...candidate.surfaces, equipmentEdge: invalid } }).success).toBe(false)
    }
    expect(profileSchema.parse(profile).surfaces).not.toHaveProperty("equipmentEdge")
  })
  it("leaves the frozen v6 release unchanged and accepts the bounded nighttime extension", () => {
    expect(manifestSchema.parse(v6)).toEqual(v6)
    const release = { ...v6, release: "facility-v7", profile, equipmentIndex: index }
    expect(manifestSchema.parse(release)).toEqual(release)
    expect(manifestSchema.safeParse({ ...release, equipmentIndex: undefined }).success).toBe(false)
  })
  it.each([
    { ...inspection, details: { ...inspection.details, rack: { ...detail, fov: 90 } } },
    { ...inspection, details: { ...inspection.details, rack: { ...detail, fov: undefined } } },
    { ...inspection, details: { ...inspection.details, rack: { ...detail, camera: detail.target } } },
    { ...inspection, fitSubjects: { ...inspection.fitSubjects, overview: { min: [0, 0, 0], max: [0, 1, 1] } } },
    { ...inspection, mobile: detail },
  ])("rejects invalid projection, fitting bounds, and mobile-camera settings", invalid => {
    expect(profileSchema.safeParse({ ...profile, inspection: invalid }).success).toBe(false)
  })
  it("requires an exact public identity projection and asset-authored construction bounds", () => {
    const parsed = profileSchema.parse(profile) as FacilityRenderProfile
    const publicIndex = equipmentIndexSchema.parse(index)
    const topology = { equipment: publicIndex.equipment } as FacilityTopology
    const presentation = { version: 1, fitSubjects: inspection.fitSubjects }
    expect(() => validateInspectionContract(parsed, topology, publicIndex, JSON.stringify(presentation))).not.toThrow()
    expect(() => validateInspectionContract(parsed, topology, { ...publicIndex, equipment: [{ ...publicIndex.equipment[0], label: "Wrong identity" }] }, presentation)).toThrow("camera_equipment_index")
    expect(() => validateInspectionContract(parsed, topology, publicIndex, { ...presentation, fitSubjects: { ...presentation.fitSubjects, overview: { ...bounds, max: [1, 10, 1] } } })).toThrow("camera_fit_subjects")
    expect(equipmentIndexSchema.safeParse({ ...index, equipment: [...index.equipment, ...index.equipment] }).success).toBe(false)
    expect(() => validateInspectionContract(v6.profile as FacilityRenderProfile, undefined, undefined, undefined)).not.toThrow()
  })
})
