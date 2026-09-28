// @vitest-environment node
import { describe, expect, it } from "vitest"
import { activateSustainedFacility, assertNativeMetal, NORMAL_POLICY_ARGS, sustainedSettings, summarizeSustained } from "../../../scripts/qa/native-sustained-contract.mjs"

function sample(seconds: number) {
  return { elapsedMs: seconds * 1000, documentVisibility: "visible", stage: { intersectionRatio: 1 }, events: { contextLost: 0, contextRestored: 0, presentationChanges: 0 }, controls: { paused: false, equipmentEnabled: true }, inspector: { phase: "ready" }, renderer: {
    frames: 150 + seconds * 30, activeSeconds: 5 + seconds, clockSeconds: 5 + seconds, hiddenFrameCount: 0, sampleCount: 120 + seconds * 30, geometries: 39, textures: 5, targetFps: 30, transitionRemaining: 0, sceneKind: "overview", readingHold: false, qualityProbe: false, quality: "balanced", frameP95: 33.4, cpuP95: 1, missedRatio: 0,
    drawCalls: 39, triangles: 36000, materials: 9, estimatedBytes: 10_000_000, peakEstimatedBytes: 10_000_000, environmentBytes: 2_000_000,
  } }
}
const complete = () => Array.from({ length: 181 }, (_, index) => sample(index * 5))

describe("native sustained activation identity", () => {
  function fixture(initialPhase: string, controlRole: "button" | "link" | null, race = false) {
    let phase = initialPhase
    const clicks: string[] = [], queries: unknown[] = []
    // The page also contains a visible story button with the same CSS class.
    // A regression to presentation-class selection deliberately selects it.
    const viewer = {
      getAttribute: async () => phase,
      locator: (selector: string) => selector === "canvas[data-ready=true]"
        ? { waitFor: async () => { if (!["loading", "staging", "ready"].includes(phase)) throw new Error("not ready") } }
        : { isVisible: async () => true, click: async () => { clicks.push("Follow one workload") } },
      getByRole: (role: string, options: { name: string; exact: boolean }) => {
        queries.push({ role, ...options })
        return {
          isVisible: async () => role === controlRole && options.name === "Explore in 3D" && options.exact,
          click: async () => {
            if (race) { phase = "loading"; throw new Error("activation removed") }
            clicks.push(`${role}:Explore in 3D`); phase = "loading"
          },
        }
      },
    }
    return { viewer, clicks, queries }
  }

  it.each(["loading", "staging", "ready"])("does not click the shared story action when graphics is %s", async phase => {
    const state = fixture(phase, null)
    expect(await activateSustainedFacility(state.viewer)).toMatchObject({ action: "Automatic graphics activation", initialPhase: phase })
    expect(state.clicks).toEqual([])
    expect(state.queries).toEqual([])
  })
  it.each(["button", "link"] as const)("activates only the exact native %s named Explore in 3D", async role => {
    const state = fixture("poster", role)
    expect(await activateSustainedFacility(state.viewer)).toMatchObject({ action: "Explore in 3D", role })
    expect(state.clicks).toEqual([`${role}:Explore in 3D`])
    expect(state.queries).toEqual(role === "button" ? [{ role, name: "Explore in 3D", exact: true }] : [{ role: "button", name: "Explore in 3D", exact: true }, { role, name: "Explore in 3D", exact: true }])
  })
  it("records automatic activation winning the race without clicking a replacement action", async () => {
    const state = fixture("poster", "button", true)
    expect(await activateSustainedFacility(state.viewer)).toMatchObject({ action: "Automatic graphics activation won the race" })
    expect(state.clicks).toEqual([])
  })
  it("fails instead of treating the only remaining story action as graphics activation", async () => {
    const state = fixture("poster", null)
    await expect(activateSustainedFacility(state.viewer)).rejects.toThrow("not ready")
    expect(state.clicks).toEqual([])
  })
})

describe("native sustained qualification contract", () => {
  it("requires actual local URLs and full duration unless explicitly developmental", () => {
    expect(() => sustainedSettings({ url: "https://gridninja.com/demo" })).toThrow("local")
    expect(() => sustainedSettings({ url: "http://localhost:3000/assessment" })).toThrow("home or demo")
    expect(() => sustainedSettings({ url: "http://secret@localhost:3000/demo" })).toThrow("local")
    expect(() => sustainedSettings({ seconds: 30 })).toThrow("--development")
    expect(() => sustainedSettings({ seconds: 15.5, development: true })).toThrow("integer")
    expect(sustainedSettings().seconds).toBe(900)
  })
  it("does not accept launch flags or generic software renderers as hardware evidence", () => {
    expect(() => assertNativeMetal({ renderer: "ANGLE (Apple, Apple M5 Pro, Metal)" })).not.toThrow()
    for (const renderer of ["SwiftShader M5 Pro Metal", "Apple M5", "Apple M5 Max Metal", "unavailable"]) expect(() => assertNativeMetal({ renderer })).toThrow()
    expect(NORMAL_POLICY_ARGS).toContain("--disable-background-timer-throttling")
    expect(NORMAL_POLICY_ARGS).toContain("--disable-backgrounding-occluded-windows")
    expect(NORMAL_POLICY_ARGS).toContain("--disable-renderer-backgrounding")
  })
  it("qualifies 900 observed seconds with a valid frame/clock progression", () => {
    const result = summarizeSustained(complete(), sustainedSettings())
    expect(result).toMatchObject({ status: "pass", qualificationEligible: true, observedSeconds: 900, activeSeconds: 900, visibleSeconds: 900, cadenceSeconds: 900, deliveredFpsAcrossActiveIntervals: 30 })
  })
  it("never qualifies a successful short smoke run", () => {
    const result = summarizeSustained([0, 5, 10, 15, 20].map(sample), sustainedSettings({ seconds: 20, development: true }))
    expect(result).toMatchObject({ status: "development-pass", qualificationEligible: false })
  })
  it.each(["hidden", "still", "pause", "equipment-off", "reading", "frozen-clock", "frozen-frames"])("rejects a long but inactive %s session", kind => {
    const samples = complete()
    for (const entry of samples) {
      if (kind === "hidden") entry.documentVisibility = "hidden"
      if (kind === "still") entry.renderer.quality = "still"
      if (kind === "pause") entry.controls.paused = true
      if (kind === "equipment-off") entry.controls.equipmentEnabled = false
      if (kind === "reading") entry.renderer.readingHold = true
      if (kind === "frozen-clock") entry.renderer.activeSeconds = 5
      if (kind === "frozen-frames") entry.renderer.frames = 150
    }
    expect(summarizeSustained(samples, sustainedSettings()).issues).toContain("insufficient-active-duration")
  })
  it("does not credit invisible gaps merely because both sampled endpoints are visible", () => {
    const samples = complete()
    samples.forEach((entry, index) => { entry.events.presentationChanges = index })
    expect(summarizeSustained(samples, sustainedSettings())).toMatchObject({ visibleSeconds: 0, activeSeconds: 0, qualificationEligible: false })
  })
  it("does not treat delayed sampling or advancing clocks alone as good cadence", () => {
    const samples = Array.from({ length: 91 }, (_, index) => sample(index * 10))
    expect(summarizeSustained(samples, sustainedSettings()).lateIntervals).toBe(90)
    const slow = complete().map(entry => ({ ...entry, renderer: { ...entry.renderer, frames: 150 + entry.elapsedMs / 1000 } }))
    expect(summarizeSustained(slow, sustainedSettings()).issues).toContain("insufficient-cadence-compliant-duration")
    const missed = complete().map(entry => ({ ...entry, renderer: { ...entry.renderer, missedRatio: .2 } }))
    expect(summarizeSustained(missed, sustainedSettings()).issues).toContain("insufficient-cadence-compliant-duration")
  })
  it("fails context loss, resource growth, and over-budget allocations", () => {
    const lost = complete(); lost[50].events.contextLost = 1
    expect(summarizeSustained(lost, sustainedSettings()).status).toBe("fail")
    const growth = complete(); growth[50].renderer.textures++
    expect(summarizeSustained(growth, sustainedSettings()).issues).toContain("retained-resource-counts-changed")
    const allocation = complete(); allocation[50].renderer.peakEstimatedBytes = 33 * 1024 * 1024
    expect(summarizeSustained(allocation, sustainedSettings()).status).toBe("fail")
  })
})
