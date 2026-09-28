// @vitest-environment node
import { describe, expect, it } from "vitest"
import v1 from "@/content/facility-releases/facility-v1/manifest.json"
import v2 from "@/content/facility-releases/facility-v2/manifest.json"
import v3 from "@/content/facility-releases/facility-v3/manifest.json"
import v4 from "@/content/facility-releases/facility-v4/manifest.json"
import v5 from "@/content/facility-releases/facility-v5/manifest.json"
import { manifestSchema, profileSchema } from "@/lib/facility/manifest-schema.mjs"

const ecosystem = {
  version: 1, seed: 61427, ambientIntervalSeconds: [12, 18], sequenceSeconds: 8,
  chapterSeconds: [4, 4, 5, 4, 4, 3],
  colors: { electrical: "#e3e7e4", cooling: "#76abb4", heat: "#c98554" },
  fanModulation: .1, maxEquipment: 96, maxRoutes: 128, maxTraces: 2,
}

describe("ecosystem release contract", () => {
  it("preserves all frozen profiles and permits an independently versioned overview extension", () => {
    for (const previous of [v1, v2, v3, v4, v5]) expect(manifestSchema.parse(previous)).toEqual(previous)
    const next = { ...v5, release: "facility-v6", profile: { ...v5.profile, ecosystem } }
    expect(manifestSchema.parse(next)).toEqual(next)
    expect(next.specimens.rack.profile).not.toHaveProperty("ecosystem")
  })
  it.each([
    { maxEquipment: 97 }, { maxRoutes: 129 }, { maxTraces: 3 },
    { ambientIntervalSeconds: [18, 12] }, { sequenceSeconds: 30 },
    { fanModulation: .11 }, { chapterSeconds: [4, 4, 5, 4, 4, 4] },
    { colors: { electrical: "white", cooling: "#76abb4", heat: "#c98554" } },
  ])("rejects unsupported or unbounded ecosystem settings %j", invalid => {
    expect(profileSchema.safeParse({ ...v5.profile, ecosystem: { ...ecosystem, ...invalid } }).success).toBe(false)
  })
  it("requires the validated semantic surface pipeline", () => {
    expect(profileSchema.safeParse({ ...v3.profile, ecosystem }).success).toBe(false)
    const withoutSurfaces: Record<string, unknown> = { ...v5.profile }
    delete withoutSurfaces.surfaces
    expect(profileSchema.safeParse({ ...withoutSurfaces, ecosystem }).success).toBe(false)
  })
})
