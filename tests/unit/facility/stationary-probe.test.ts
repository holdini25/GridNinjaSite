import { describe, expect, it } from "vitest"
import { createStationaryProbe } from "@/lib/facility/stationary-probe"

describe("stationary startup probe ownership", () => {
  it.each([30, 60, 120])("requires two permitted stationary seconds at %i Hz after held interactions", fps => {
    const probe = createStationaryProbe()
    probe.reset(2)
    // Finite selection/camera frames can advance the scheduler's active clock
    // while reading. They must not qualify the stationary startup budget.
    for (let frame = 0; frame < fps * 12; frame++) {
      expect(probe.configure(false)).toBe(false)
      expect(probe.sample(1 / fps)).toBe(0)
    }
    expect(probe.remainingSeconds).toBe(2)
    expect(probe.configure(true)).toBe(true)
    expect(probe.sample(12)).toBe(0)
    for (let frame = 0; frame < fps * 2 - 1; frame++) {
      probe.sample(1 / fps)
      expect(probe.pending).toBe(true)
    }
    probe.sample(1 / fps)
    expect(probe.remainingSeconds).toBe(0)
    expect(probe.configure(true)).toBe(false)
  })

  it.each(["hidden", "offscreen", "paused", "reduced-motion", "equipment-off", "reading", "camera-transition", "mechanical-inspection"])("preserves unfinished budget across %s without charging the resume frame", () => {
    const probe = createStationaryProbe()
    probe.reset(2); probe.configure(true); probe.sample(0)
    expect(probe.sample(.5)).toBe(.5)
    probe.configure(false)
    // No frame callback is needed to suspend continuity while hidden.
    probe.configure(true)
    expect(probe.sample(90)).toBe(0)
    expect(probe.remainingSeconds).toBe(1.5)
    expect(probe.sample(.5)).toBe(.5)
    expect(probe.remainingSeconds).toBe(1)
  })

  it("resets the full duration on explicit retry and leaves desktop startup empty", () => {
    const probe = createStationaryProbe()
    probe.reset(0)
    expect(probe.configure(true)).toBe(false)
    expect(probe.pending).toBe(false)
    probe.reset(2); probe.configure(true); probe.sample(0); probe.sample(1)
    expect(probe.remainingSeconds).toBe(1)
    probe.reset(2); probe.configure(true)
    expect(probe.sample(10)).toBe(0)
    expect(probe.remainingSeconds).toBe(2)
    probe.sample(2)
    expect(probe.pending).toBe(false)
  })

  it("bounds delayed frame consumption and rejects invalid reset durations", () => {
    const probe = createStationaryProbe()
    probe.reset(2); probe.configure(true); probe.sample(0)
    expect(probe.sample(Number.NaN)).toBe(0)
    expect(probe.sample(-5)).toBe(0)
    expect(probe.sample(20)).toBe(2)
    expect(probe.remainingSeconds).toBe(0)
    for (const value of [-1, Number.NaN, Infinity]) expect(() => probe.reset(value)).toThrow("invalid_stationary_probe_duration")
  })
})
