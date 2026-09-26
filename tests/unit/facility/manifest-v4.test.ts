// @vitest-environment node
import { describe, expect, it } from "vitest"
import frozenV3 from "@/content/facility-releases/facility-v3/manifest.json"
import { manifestSchema, expectedReleaseFiles } from "@/lib/facility/manifest-schema.mjs"

function candidate() {
  const engineering = {
    version: 1, seed: 41727,
    accent: { resting: "#9d632f", hover: "#ffbe63", selected: "#ffd18a", previewWeight: .85, baseEmission: .035, activeEmission: 1, transitionMs: 150 },
    activity: { resting: .12, peak: 1, steady: .5, pulseMs: [120, 180], eventMs: [80, 180], maxPulses: 3, ambientTraceSeconds: [8, 12], selectedTraceQuietSeconds: 2.8 },
    cameraTransitionMs: 420, poseTransitionMs: 280,
    rendering: { ambientFps: 30, interactionFps: 60, mobilePixels: 1_000_000, desktopPixels: 1_500_000, probeSeconds: 2 },
  }
  const profile = { ...frozenV3.profile, engineering }
  const specimens = {
    rack: { kind: "rack", system: "workloads", label: "Representative rack", profile, requiredIds: ["GN_SPECIMEN_ROOT", "GN_RACK_FRAME"] },
    cooling: { kind: "cooling", system: "cooling", label: "Representative cooling assembly", profile, requiredIds: ["GN_SPECIMEN_ROOT", "GN_COOLING_COIL"] },
  }
  return { ...structuredClone(frozenV3), release: "facility-v4", profile, specimens, files: [...frozenV3.files, ...["rack.glb", "rack-closed.webp", "rack-cutaway.webp", "cooling.glb", "cooling-closed.webp", "cooling-cutaway.webp"].map(file => ({file,bytes:100,sha256:"a".repeat(64)}))] }
}

describe("progressive specimen publication contract", () => {
  it("preserves frozen legacy profiles and allowlists only described progressive assets", () => {
    expect(manifestSchema.parse(frozenV3)).toEqual(frozenV3)
    const manifest = candidate()
    expect(manifestSchema.parse(manifest)).toEqual(manifest)
    expect(expectedReleaseFiles(manifest)).toHaveLength(9)
  })
  it("rejects omitted or undeclared specimens and wrong family bindings", () => {
    const missing = candidate();missing.files.pop()
    expect(manifestSchema.safeParse(missing).success).toBe(false)
    const extra = candidate();extra.specimens = {rack:extra.specimens.rack} as typeof extra.specimens
    expect(manifestSchema.safeParse(extra).success).toBe(false)
    const wrong = candidate();wrong.specimens.rack.system = "storage"
    expect(manifestSchema.safeParse(wrong).success).toBe(false)
    const ids = candidate();ids.specimens.rack.requiredIds = ["GN_RACK_FRAME", "GN_RACK_FRAME"]
    expect(manifestSchema.safeParse(ids).success).toBe(false)
  })
  it("enforces progressive transfer and cadence limits independently of overview limits", () => {
    const model = candidate();model.files.find(file=>file.file === "rack.glb")!.bytes = 1_000_001
    expect(manifestSchema.safeParse(model).success).toBe(false)
    const poster = candidate();poster.files.find(file=>file.file === "cooling-cutaway.webp")!.bytes = 60*1024+1
    expect(manifestSchema.safeParse(poster).success).toBe(false)
    const pulse = candidate();pulse.profile.engineering.activity.maxPulses = 4
    expect(manifestSchema.safeParse(pulse).success).toBe(false)
    const interval = candidate();interval.profile.engineering.activity.eventMs = [180,80]
    expect(manifestSchema.safeParse(interval).success).toBe(false)
    const buffer = candidate();buffer.profile.engineering.rendering.mobilePixels = 1_000_001
    expect(manifestSchema.safeParse(buffer).success).toBe(false)
  })
})
