// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { Scene } from "three"
import { createFiniteLight } from "@/lib/facility/finite-light"
import { profileSchema } from "@/lib/facility/manifest-schema.mjs"
import v10 from "@/content/facility-releases/facility-v10/manifest.json"
import type { FacilityRenderProfile } from "@/types/facility"

const finite: NonNullable<FacilityRenderProfile["lighting"]["finite"]> = { version: 1, type: "point", position: [2.8, 5.1, 3.4], color: "#f5f5f3", intensity: 42, decay: 2, distance: 0 }

describe("bounded spatial service light", () => {
  it("preserves absent legacy profiles and rejects extra lights, shadows or nonphysical decay", () => {
    expect(profileSchema.parse(v10.profile)).toEqual(v10.profile)
    const profile = { ...v10.profile, lighting: { ...v10.profile.lighting, finite } }
    expect(profileSchema.parse(profile)).toEqual(profile)
    for (const invalid of [[finite, finite], { ...finite, decay: 1 }, { ...finite, distance: 10 }, { ...finite, castShadow: true }, { ...finite, intensity: 129 }, { ...finite, intensity: NaN }, { ...finite, type: "area" }]) {
      expect(profileSchema.safeParse({ ...profile, lighting: { ...profile.lighting, finite: invalid } }).success).toBe(false)
    }
    expect(profileSchema.safeParse({ ...profile, engineering: undefined }).success).toBe(false)
    expect(profileSchema.safeParse({ ...profile, lighting: { ...profile.lighting, directional: [...profile.lighting.directional, profile.lighting.directional[0]] } }).success).toBe(false)
  })
  it("keeps one session-owned source while binding and rolling back asset profiles", () => {
    const scene = new Scene(), rig = createFiniteLight(scene, finite)
    expect(scene.children).toEqual([rig.light])
    expect(rig.light.castShadow).toBe(false)
    expect(rig.light.shadow.map).toBeNull()
    const rack = { ...finite, position: [1.5, 2.8, 1.9] as [number, number, number], intensity: 6 }
    rig.bind(rack)
    expect(rig.light.position.toArray()).toEqual(rack.position)
    expect(rig.light.intensity).toBe(6)
    // A failed staged asset never calls bind. A failed first-frame switch uses
    // the same bind operation as model rollback, restoring its original rig.
    rig.bind(finite)
    expect(rig.light.position.toArray()).toEqual(finite.position)
    expect(rig.light.intensity).toBe(42)
    rig.bind(undefined)
    expect(rig.light.visible).toBe(true)
    expect(rig.light.intensity).toBe(0)
    expect(scene.children).toHaveLength(1)
    expect(rig.retainedBytes).toBe(4096)
    rig.dispose()
  })
  it("owns disposal once and never retains a light after teardown", () => {
    const scene = new Scene(), rig = createFiniteLight(scene, finite), dispose = vi.spyOn(rig.light, "dispose")
    rig.dispose(); rig.dispose()
    expect(dispose).toHaveBeenCalledOnce()
    expect(scene.children).toHaveLength(0)
    expect(() => rig.bind(finite)).toThrow("finite_light_disposed")
  })
})
