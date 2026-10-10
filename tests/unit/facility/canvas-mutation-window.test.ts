// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assessCanvasObservation, type CanvasObservation } from "../../support/canvas-mutation-window"

const budgets = { desktopPixels: 1_500_000, mobilePixels: 650_000 }
const state = (at: number, quality = "balanced", width = 902, height = 531) => ({ at, quality, width, height, x: 638, y: 330, cssWidth: 722.1875, cssHeight: 424.8125, hook: "undefined", framesAttribute: false, connected: true, ready: true })
const baseline = (): CanvasObservation => ({ duration: 3000, requestedDuration: 3000, deviceDpr: 2, desktop: true, samples: [state(0), state(3000)], mutations: [] })
const resize = (): CanvasObservation => ({ ...baseline(), samples: [state(0), state(100, "balanced", 722, 424), state(110, "economy", 722, 424), state(150, "economy", 722, 424), state(3000, "economy", 722, 424)], mutations: [
  { at: 100, sample: 1, name: "width", oldValue: "902", value: "722" }, { at: 100, sample: 1, name: "height", oldValue: "531", value: "424" },
  { at: 100, sample: 1, name: "width", oldValue: "722", value: "722" }, { at: 100, sample: 1, name: "height", oldValue: "424", value: "424" },
] })

describe("strict production canvas observation", () => {
  it("keeps the original zero-mutation assertion for a stable production canvas", () => {
    expect(assessCanvasObservation(baseline(), budgets)).toMatchObject({ failures: [], diagnostics: { hook: "undefined", framesAttribute: false, mutations: [] }, strictWindow: { duration: 350 } })
  })
  it("retains raw startup writes and permits only the observed matching DPR transition before the strict window", () => {
    const report = resize(), before = structuredClone(report)
    const result = assessCanvasObservation(report, budgets)
    expect(result.failures).toEqual([])
    expect(result.transitions).toHaveLength(1)
    expect(result.diagnostics.mutations).toEqual([])
    expect(report).toEqual(before)
    expect(report.mutations).toHaveLength(4)
  })
  it("rejects a dimension write with no directly observed quality or layout transition", () => {
    const report = resize(); report.samples.forEach(sample => { sample.quality = "balanced" })
    expect(assessCanvasObservation(report, budgets).failures).toContain("Unexplained or sustained canvas mutations")
  })
  it("rejects data and style writes even next to a legitimate transition", () => {
    for (const name of ["data-frames", "style"]) {
      const report = resize(); report.mutations[0].name = name
      expect(assessCanvasObservation(report, budgets).failures).toContain("Unexplained or sustained canvas mutations")
    }
  })
  it("rejects sustained per-frame resizing even when one quality change occurred", () => {
    const report = resize()
    for (let at = 116; at < 300; at += 16) report.mutations.push({ at, sample: 2, name: "width", oldValue: "722", value: "722" })
    expect(assessCanvasObservation(report, budgets).failures).toContain("Unexplained or sustained canvas mutations")
  })
  it("rejects a resize inconsistent with the actual quality and geometry", () => {
    const report = resize(); report.samples.slice(1).forEach(sample => { sample.width = 700 })
    expect(assessCanvasObservation(report, budgets).failures).toContain("Canvas writes do not match the observed quality/layout resize")
  })
  it("does not hide an unexplained intermediate dimension inside a legitimate resize batch", () => {
    const report = resize(); report.mutations[2].oldValue = "700"
    expect(assessCanvasObservation(report, budgets).failures).toContain("Canvas writes do not match the observed quality/layout resize")
  })
  it("allows an actual matching layout resize and still requires the strict quiet window", () => {
    const report = resize()
    report.samples.slice(1).forEach(sample => { sample.quality = "balanced"; sample.cssWidth = 578; sample.cssHeight = 339.5; sample.height = 424 })
    expect(assessCanvasObservation(report, budgets).failures).toEqual([])
  })
  it("requires350ms uninterrupted stability after the last real transition", () => {
    const report = resize(); report.samples.slice(1, -1).forEach(sample => { sample.at += 2800 }); report.mutations.forEach(mutation => { mutation.at += 2800 })
    expect(assessCanvasObservation(report, budgets).failures).toContain("No uninterrupted350ms stable observation before the deadline")
  })
  it("rejects diagnostic exposure at any point even when it disappears before the final sample", () => {
    const report = resize(); report.samples[1].hook = "function"
    expect(assessCanvasObservation(report, budgets).failures).toContain("Diagnostic exposure or lost ready canvas during observation")
  })
  it("rejects a delayed quality change that does not correlate with the writes", () => {
    const report = resize(); report.samples[2].at = 250; report.samples[3].at = 300
    expect(assessCanvasObservation(report, budgets).failures).toContain("Unexplained or sustained canvas mutations")
  })
})
