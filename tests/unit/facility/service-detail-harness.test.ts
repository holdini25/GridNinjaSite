// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assertMotionEvidence, assertServiceCapability, assertServiceEndpoint } from "../../../scripts/facility/verify-service-detail.mjs"

const camera = { camera: [1, 2, 3], target: [0, 1, 0], padding: 1.12 }
const detail = { version: 1, requiresCutaway: true, camera }
const finite = { position: [1.5, 2.8, 1.9], intensity: 6 }
const manifest = { specimens: { rack: { profile: { lighting: { finite } } } } }
const specimen = { kind: "rack", rackMotion: { serviceDetail: detail } }
const snapshot = {
  sceneKind: "rack", cameraProjection: "orthographic", transitionRemaining: 0,
  rackMotion: { moving: false, door: 1, tray: 1, cutaway: true }, view: { detail: "service-connection" },
  cameraPosition: [1, 2, 3], cameraTarget: [0, 1, 0], finiteLight: { ...finite, count: 1, shadows: false },
  peakEstimatedBytes: 9_000_000, estimatedBytes: 5_000_000, environmentBytes: 1_000_000, drawCalls: 26, materials: 9,
}
const intermediate = { quality: "balanced", rackMotion: { door: 1, tray: .5, moving: true }, transitionRemaining: 0, serviceDisabled: true, mechanicsDisabled: true, handlesDisabled: true }

describe("mandatory native service-view qualification assertions", () => {
  it("fails unavailable capabilities instead of registering a passing legacy skip", () => {
    expect(assertServiceCapability(manifest, specimen)).toEqual(detail)
    expect(() => assertServiceCapability(manifest, { kind: "rack" })).toThrow("capability")
    expect(() => assertServiceCapability({ specimens: { rack: { profile: { lighting: {} } } } }, specimen)).toThrow("illumination")
  })
  it("requires actual intermediate tray movement and a disabled close-up action", () => {
    expect(() => assertMotionEvidence([intermediate, intermediate], "extend")).not.toThrow()
    expect(() => assertMotionEvidence([{ ...intermediate, rackMotion: { ...intermediate.rackMotion, moving: false } }], "extend")).toThrow()
    expect(() => assertMotionEvidence([{ ...intermediate, serviceDisabled: false }, intermediate], "extend")).toThrow("enabled")
    expect(() => assertMotionEvidence([{ ...intermediate, quality: "still" }, intermediate], "extend")).toThrow("Still")
  })
  it("requires camera movement with both mechanisms stationary and all controls locked", () => {
    const cameraFrame = { ...intermediate, transitionRemaining: .2, rackMotion: { door: 1, tray: 1, moving: false } }
    expect(() => assertMotionEvidence([cameraFrame, cameraFrame], "detail")).not.toThrow()
    expect(() => assertMotionEvidence([cameraFrame, { ...cameraFrame, handlesDisabled: false }], "return")).toThrow("enabled")
    expect(() => assertMotionEvidence([cameraFrame, { ...cameraFrame, rackMotion: intermediate.rackMotion }], "detail")).toThrow("joints")
  })
  it("checks actual camera, cutaway, light, resource budgets and the completed view", () => {
    expect(() => assertServiceEndpoint(snapshot, detail, { camera, finite }, true)).not.toThrow()
    expect(() => assertServiceEndpoint({ ...snapshot, cameraPosition: [1.1, 2, 3] }, detail, { camera, finite }, true)).toThrow("authored")
    expect(() => assertServiceEndpoint({ ...snapshot, finiteLight: { ...snapshot.finiteLight, intensity: 42 } }, detail, { camera, finite }, true)).toThrow()
    expect(() => assertServiceEndpoint({ ...snapshot, rackMotion: { ...snapshot.rackMotion, cutaway: false } }, detail, { camera, finite }, true)).toThrow()
    expect(() => assertServiceEndpoint({ ...snapshot, peakEstimatedBytes: 33 * 1024 * 1024 }, detail, { camera, finite }, true)).toThrow("32 MiB")
    expect(() => assertServiceEndpoint({ ...snapshot, view: {} }, detail, { camera, finite }, false)).not.toThrow()
  })
})
