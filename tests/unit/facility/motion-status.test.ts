import { describe, expect, it } from "vitest"
import { facilityMotionStatus } from "@/lib/facility/motion-status"
import type { FacilityView } from "@/types/facility"

const ready = { ready: true, loading: false, reducedMotion: false, paused: false, equipmentEnabled: true, quality: "balanced" as const, view: { kind: "overview" } as FacilityView }
describe("effective facility motion status", () => {
  it("keeps accessibility and explicit preferences ahead of adaptive activity", () => {
    expect(facilityMotionStatus(ready).active).toBe(true)
    expect(facilityMotionStatus({ ...ready, reducedMotion: true, paused: true })).toMatchObject({ label: "Reduced motion", active: false, canPause: false })
    expect(facilityMotionStatus({ ...ready, paused: true, quality: "still" })).toMatchObject({ label: "Paused", active: false, canPause: true })
    expect(facilityMotionStatus({ ...ready, quality: "still" }).label).toBe("Still for performance")
    expect(facilityMotionStatus({ ...ready, equipmentEnabled: false }).active).toBe(false)
  })
  it("offers Pause for finite rack actions without claiming ambient activity", () => {
    expect(facilityMotionStatus({ ...ready, view: { kind: "specimen", specimen: "rack", pose: "service", rack: { door: "open", tray: "extended", cutaway: false } } })).toEqual({ label: "Still for inspection", active: false, canPause: true })
    expect(facilityMotionStatus({ ...ready, ready: false, loading: true })).toMatchObject({ label: "Loading 3D…", canPause: false })
  })
  it("describes a transient reading hold without overriding explicit preferences", () => {
    expect(facilityMotionStatus({ ...ready, readingHold: true })).toMatchObject({ label: "Activity paused while reading", active: false })
    expect(facilityMotionStatus({ ...ready, readingHold: true, paused: true }).label).toBe("Paused")
    expect(facilityMotionStatus({ ...ready, readingHold: true, reducedMotion: true }).label).toBe("Reduced motion")
    expect(facilityMotionStatus({ ...ready, readingHold: false }).active).toBe(true)
  })
})
