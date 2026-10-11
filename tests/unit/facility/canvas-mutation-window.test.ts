// @vitest-environment node
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { assessCanvasObservation, type CanvasObservation } from "../../support/canvas-mutation-window"
import { cappedDpr } from "../../../src/lib/facility/frame-policy"

const budgets = { desktopPixels: 1_500_000, mobilePixels: 650_000 }
const state = (at: number, quality = "balanced", width = 902, height = 531) => ({ at, quality, width, height, x: 638, y: 330, cssWidth: 722.1875, cssHeight: 424.8125, hook: "undefined", framesAttribute: false, connected: true, ready: true })
const baseline = (): CanvasObservation => ({ duration: 3000, requestedDuration: 3000, deviceDpr: 2, desktop: true, samples: [state(0), state(3000)], mutations: [] })
const resize = (): CanvasObservation => ({ ...baseline(), samples: [state(0), state(18, "balanced", 722, 424), state(100, "balanced", 722, 424), state(185, "economy", 722, 424), state(3000, "economy", 722, 424)], mutations: [
  { at: 18, sample: 1, name: "width", oldValue: "902", value: "722" }, { at: 18, sample: 1, name: "height", oldValue: "531", value: "424" },
  { at: 18, sample: 1, name: "width", oldValue: "722", value: "722" }, { at: 18, sample: 1, name: "height", oldValue: "424", value: "424" },
] })
// Reduced boundary samples from quality-remediation-02/c2 invocation 5:
// the retained report has 183 samples, no writes, and this label change at2853ms.
// This fixture preserves those timings/values; it is not the complete raw report.
const lateLabel = (): CanvasObservation => ({ ...baseline(), deviceDpr: 3, desktop: false,
  samples: [0, 2853, 3000].map((at, index) => ({ ...state(at, index ? "still" : "economy", 353, 264), x: 20, y: 196.390625, cssWidth: 353, cssHeight: 264.75 })) })
const rejected = (report: CanvasObservation) => expect(assessCanvasObservation(report, budgets).failures.length).toBeGreaterThan(0)

describe("ordered production canvas observation", () => {
  it.each([
    [0, "8286ebc6fa319b15829792eab5e0c0265caa7b83772687a4b1124033b9a80d94", 1],
    [1, "ba5de7d105f2ee6179cf6cf05852c9852fa9b57f7fc829613f3ce37490929808", 0],
  ] as const)("reconciles immutable saved attempt %i without altering the retained failure evidence", (attempt, sha256, transitions) => {
    const bytes = readFileSync(new URL(`./fixtures/canvas-attempt-${attempt}.json`, import.meta.url))
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256)
    const saved = JSON.parse(bytes.toString()) as { observation: CanvasObservation; assessment: { failures: string[] } }
    const before = structuredClone(saved)
    const result = assessCanvasObservation(saved.observation, budgets)
    expect(result.failures).toEqual([])
    expect(result.transitions).toHaveLength(transitions)
    expect(result.initialReconciliation !== null).toBe(attempt === 1)
    expect(saved).toEqual(before)
    if (attempt === 0) expect(saved.assessment.failures).toContain("Unexplained or sustained canvas mutations")
  })
  it("preserves the exact 183-sample c2 attachment while assessing its no-write economy-to-still commit", () => {
    const bytes = readFileSync(new URL("./fixtures/canvas-quality-remediation-02-c2.json", import.meta.url))
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("a1d2917d881c45484b40eb3fc1bbcf6b10faacfe5aeafce317bd167a69d03b80")
    const saved = JSON.parse(bytes.toString()) as { observation: CanvasObservation; assessment: { failures: string[] } }
    const before = structuredClone(saved)
    expect(saved.observation.samples).toHaveLength(183)
    expect(saved.observation.mutations).toEqual([])
    expect([...new Set(saved.observation.samples.map(sample => JSON.stringify([sample.cssWidth, sample.cssHeight, sample.width, sample.height])))])
      .toEqual([JSON.stringify([353, 264.75, 353, 264])])
    expect([...new Set(saved.observation.samples.map(sample => sample.quality))]).toEqual(["economy", "still"])
    for (const sample of saved.observation.samples) {
      expect(cappedDpr(sample.quality as "economy" | "still", saved.observation.deviceDpr, sample.cssWidth, sample.cssHeight,
        saved.observation.desktop ? budgets.desktopPixels : budgets.mobilePixels)).toBe(1)
    }
    expect(saved.assessment.failures).toEqual(["No uninterrupted350ms stable observation before the deadline"])
    expect(assessCanvasObservation(saved.observation, budgets)).toMatchObject({ failures: [], transitions: [], initialReconciliation: null,
      strictWindow: { start: 2650, end: 3000, duration: 350 }, diagnostics: { mutations: [] } })
    expect(saved).toEqual(before)
  })
  it("preserves zero writes and full quiet observation for valid stable pixels", () => {
    expect(assessCanvasObservation(baseline(), budgets)).toMatchObject({ failures: [], transitions: [], initialReconciliation: null,
      diagnostics: { hook: "undefined", framesAttribute: false, mutations: [] }, strictWindow: { start: 2650, end: 3000, duration: 350 } })
  })
  it("matches delayed renderer-first commits without increasing the intragroup limit", () => {
    const report = resize(), before = structuredClone(report)
    const result = assessCanvasObservation(report, budgets)
    expect(result.failures).toEqual([])
    expect(result.transitions).toHaveLength(1)
    expect(result.transitions[0]).toMatchObject({ at: 185, before: { width: 902, height: 531 }, after: { quality: "economy", width: 722, height: 424 } })
    expect(result.correlationMs).toBe(100)
    expect(report).toEqual(before)
  })
  it("matches an earlier policy commit only to the immediately following exact resize", () => {
    const report = resize()
    report.samples = [state(0), state(18, "economy"), state(185, "economy", 722, 424), state(3000, "economy", 722, 424)]
    report.mutations.forEach(mutation => { mutation.at = 185; mutation.sample = 2 })
    expect(assessCanvasObservation(report, budgets).failures).toEqual([])
  })
  it("matches a simultaneous exact CSS layout resize", () => {
    const report = resize()
    report.samples.slice(1).forEach(sample => { sample.quality = "balanced"; sample.cssWidth = 578; sample.cssHeight = 339.5 })
    expect(assessCanvasObservation(report, budgets).failures).toEqual([])
  })
  it("accepts a no-write economy-to-still commit because their exact DPR pixels agree", () => {
    const report = baseline()
    report.samples = [state(0, "economy", 722, 424), state(100, "still", 722, 424), state(3000, "still", 722, 424)]
    expect(assessCanvasObservation(report, budgets).failures).toEqual([])
  })
  it("retains the full quiet window across the observed late label-only commit", () => {
    const report = lateLabel(), before = structuredClone(report)
    expect(assessCanvasObservation(report, budgets)).toMatchObject({ failures: [], transitions: [], initialReconciliation: null,
      correlationMs: 100, maximumTransitionGroups: 2, strictWindow: { start: 2650, end: 3000, duration: 350 },
      diagnostics: { hook: "undefined", framesAttribute: false, mutations: [] } })
    expect(report).toEqual(before)
  })
  it("still rejects an actual resize late in the final quiet window", () => {
    const report = resize()
    report.samples[1].at = 2800; report.samples[2].at = 2810; report.samples[3].at = 2853
    report.mutations.forEach(mutation => { mutation.at = 2800 })
    const result = assessCanvasObservation(report, budgets)
    expect(result.transitions).toHaveLength(1)
    expect(result.failures).toContain("No uninterrupted350ms stable observation before the deadline")
    expect(result.diagnostics.mutations).toHaveLength(4)
  })
  it("a same-value canvas write still resets the quiet window beside a label-only commit", () => {
    const report = lateLabel()
    report.mutations = [{ at: 2853, sample: 1, name: "width", oldValue: "353", value: "353" }]
    const result = assessCanvasObservation(report, budgets)
    expect(result.failures).toContain("No uninterrupted350ms stable observation before the deadline")
    expect(result.diagnostics.mutations).toEqual(report.mutations)
  })
  it.each(["before", "after"] as const)("does not exempt a label change with an invalid %s pixel policy", side => {
    const report = lateLabel()
    if (side === "before") report.samples[0].quality = "balanced"
    else report.samples.slice(1).forEach(sample => { sample.quality = "balanced" })
    expect(assessCanvasObservation(report, budgets).failures).toContain("No uninterrupted350ms stable observation before the deadline")
  })
  it("does not exempt different effective DPR values that floor to identical tiny buffers", () => {
    const report = lateLabel()
    report.samples.forEach((sample, index) => {
      sample.cssWidth = sample.cssHeight = sample.width = sample.height = 1
      sample.quality = index ? "balanced" : "economy"
    })
    expect(assessCanvasObservation(report, budgets).failures).toContain("No uninterrupted350ms stable observation before the deadline")
  })
  it("does not exempt a quality commit accompanied by canvas-origin movement", () => {
    const report = lateLabel()
    report.samples.slice(1).forEach(sample => { sample.x += 1 })
    expect(assessCanvasObservation(report, budgets).failures).toContain("No uninterrupted350ms stable observation before the deadline")
  })
  it("does not exempt a late subpixel CSS resize even when backing floors stay identical", () => {
    const report = lateLabel()
    report.samples.slice(1).forEach(sample => { sample.cssWidth += .1; sample.cssHeight += .1 })
    expect(assessCanvasObservation(report, budgets).failures).toEqual(["No uninterrupted350ms stable observation before the deadline"])
  })
  it.each([
    ["balanced", "high"], ["high", "balanced"], ["balanced", "economy"], ["economy", "balanced"],
  ] as const)("does not exempt a device-clamped %s-to-%s commit", (before, after) => {
    const report = lateLabel(); report.deviceDpr = 1
    report.samples.forEach((sample, index) => { sample.quality = index ? after : before })
    expect(assessCanvasObservation(report, budgets).failures).toEqual(["No uninterrupted350ms stable observation before the deadline"])
  })
  it.each([
    ["balanced", "high"], ["high", "balanced"], ["balanced", "economy"], ["economy", "balanced"],
  ] as const)("does not exempt a pixel-budget-clamped %s-to-%s commit", (before, after) => {
    const report = lateLabel()
    report.samples.forEach((sample, index) => {
      sample.quality = index ? after : before
      sample.cssWidth = sample.cssHeight = 1000
      sample.width = sample.height = 806
    })
    expect(assessCanvasObservation(report, budgets).failures).toEqual(["No uninterrupted350ms stable observation before the deadline"])
  })
  it("still counts otherwise-valid no-write label commits against the two-change limit", () => {
    const report = lateLabel()
    report.samples = [report.samples[0], { ...report.samples[1], at: 100 }, { ...report.samples[0], at: 200 }, { ...report.samples[1], at: 300 }, report.samples[2]]
    expect(assessCanvasObservation(report, budgets).failures).toContain("Sustained or repeated canvas/quality/layout changes")
  })
  it("validates device DPR and mobile pixel-budget-limited steady states", () => {
    const report = baseline(); report.desktop = false
    report.samples.forEach(sample => { sample.cssWidth = 1000; sample.cssHeight = 1000; sample.width = 806; sample.height = 806 })
    expect(assessCanvasObservation(report, budgets).failures).toEqual([])
    report.samples[1].width = 807; rejected(report)
    const lowDpr = baseline(); lowDpr.deviceDpr = 1
    lowDpr.samples.forEach(sample => { sample.width = 722; sample.height = 424 })
    expect(assessCanvasObservation(lowDpr, budgets).failures).toEqual([])
  })
  it("permits exactly two separate, one-to-one policy resize groups", () => {
    const report = resize()
    report.samples = [...report.samples.slice(0, -1), state(500, "high", 722, 424), state(600, "high", 1083, 637), state(3000, "high", 1083, 637)]
    report.mutations.push({ at: 600, sample: 5, name: "width", oldValue: "722", value: "1083" }, { at: 600, sample: 5, name: "height", oldValue: "424", value: "637" })
    expect(assessCanvasObservation(report, budgets)).toMatchObject({ failures: [], maximumTransitionGroups: 2 })
    expect(assessCanvasObservation(report, budgets).transitions).toHaveLength(2)
  })
  it.each(["data-frames", "style", "data-ready"])("rejects a %s write next to a valid transition", name => {
    const report = resize(); report.mutations[0].name = name; rejected(report)
  })
  it("rejects missing, wrong-policy, or unresolved commits rather than searching farther ahead", () => {
    const missing = resize(); missing.samples.forEach(sample => { sample.quality = "balanced" }); rejected(missing)
    const wrong = resize(); wrong.samples.slice(3).forEach(sample => { sample.quality = "high" }); rejected(wrong)
    const skipped = resize(); skipped.samples.splice(3, 0, state(120, "high", 722, 424)); rejected(skipped)
    const labelOnly = baseline(); labelOnly.samples = [state(0), state(100, "economy"), state(3000, "economy")]; rejected(labelOnly)
  })
  it("rejects ambiguous groups spanning multiple policy changes", () => {
    const report = resize()
    report.samples = [state(0), state(18, "economy", 722, 424), state(50, "still", 722, 424), state(70, "still", 722, 424), state(3000, "still", 722, 424)]
    report.mutations[2].at = report.mutations[3].at = 70
    report.mutations[2].sample = report.mutations[3].sample = 3
    rejected(report)
  })
  it("cannot reuse a matched policy commit for a second write group", () => {
    const report = resize(); report.samples.splice(4, 0, state(500, "economy", 722, 424))
    report.mutations.push({ at: 500, sample: 4, name: "width", oldValue: "722", value: "722" })
    expect(assessCanvasObservation(report, budgets).failures).toContain("Unexplained or ambiguous canvas transition ownership")
  })
  it("rejects unchanged-size writes, a fifth write, per-frame writes and a third group", () => {
    const noResize = baseline(); noResize.samples.splice(1, 0, state(100)); noResize.mutations = [{ at: 100, sample: 1, name: "width", oldValue: "902", value: "902" }]; rejected(noResize)
    const fifth = resize(); fifth.mutations.push({ ...fifth.mutations[2] }); rejected(fifth)
    const repeated = resize()
    for (const at of [300, 500]) {
      repeated.samples.splice(-1, 0, state(at, "economy", 722, 424))
      repeated.mutations.push({ at, sample: repeated.samples.length - 2, name: "width", oldValue: "722", value: "722" })
    }
    rejected(repeated)
    const perFrame = resize()
    perFrame.samples = [state(0), state(18, "balanced", 722, 424)]
    for (let at = 34; at < 180; at += 16) {
      perFrame.samples.push(state(at, "balanced", 722, 424))
      perFrame.mutations.push({ at, sample: perFrame.samples.length - 1, name: "width", oldValue: "722", value: "722" })
    }
    perFrame.samples.push(state(185, "economy", 722, 424), state(3000, "economy", 722, 424)); rejected(perFrame)
  })
  it("retains the 100ms total group span, even if each adjacent gap is shorter", () => {
    const report = resize()
    report.samples = [state(0), state(18, "balanced", 722, 424), state(90, "balanced", 722, 424), state(150, "balanced", 722, 424), state(185, "economy", 722, 424), state(3000, "economy", 722, 424)]
    report.mutations[2].at = 90; report.mutations[2].sample = 2
    report.mutations[3].at = 150; report.mutations[3].sample = 3; rejected(report)
  })
  it("rejects transient intermediate values and reversals hidden by MutationObserver's final values", () => {
    const intermediate = resize(); intermediate.mutations[2].oldValue = "700"; rejected(intermediate)
    const reverse = resize(); reverse.mutations[2].oldValue = "902"; rejected(reverse)
    const wrongFinal = resize(); wrongFinal.mutations[0].value = "700"; rejected(wrongFinal)
    const malformed = resize(); malformed.mutations[0].oldValue = "0902"; rejected(malformed)
  })
  it("rejects a hidden pre-to-post-to-pre-to-post reversal even when every callback-final value is correct", () => {
    const report = resize()
    report.mutations = [
      { at: 18, sample: 1, name: "width", oldValue: "902", value: "722" },
      { at: 18, sample: 1, name: "width", oldValue: "722", value: "722" },
      { at: 18, sample: 1, name: "width", oldValue: "902", value: "722" },
      { at: 18, sample: 1, name: "height", oldValue: "531", value: "424" },
    ]
    expect(assessCanvasObservation(report, budgets).failures).toContain("Unexplained or ambiguous canvas transition ownership")
  })
  it("rejects buffer changes without mutation records and geometry drift during pending ownership", () => {
    const missing = resize(); missing.mutations = []
    expect(assessCanvasObservation(missing, budgets).failures).toContain("Unrecorded canvas dimension change")
    const hidden = resize(); hidden.samples[2].width = 700; rejected(hidden)
    const geometry = resize(); geometry.samples[2].cssWidth += .1; rejected(geometry)
  })
  it("never blesses an invalid no-write baseline or final state", () => {
    const invalid = baseline(); invalid.samples.forEach(sample => { sample.width = 722; sample.height = 424 })
    expect(assessCanvasObservation(invalid, budgets).failures).toEqual(expect.arrayContaining(["Invalid stable canvas pixel policy or unresolved transition", "Invalid final canvas pixel policy"]))
    const final = baseline(); final.samples[1].width = 700; rejected(final)
    const initial = baseline(); initial.samples = [state(0, "balanced", 700, 424), state(50, "economy", 700, 424), state(3000, "economy", 700, 424)]; rejected(initial)
  })
  it("entry reconciliation rejects unrelated layout commits, intervening writes and skipped quality commits", () => {
    const layout = baseline(); layout.samples = [state(0, "balanced", 722, 424), state(50, "balanced", 722, 424), state(3000, "balanced", 722, 424)]
    layout.samples.slice(1).forEach(sample => { sample.cssWidth = 578; sample.cssHeight = 339.5 }); rejected(layout)
    const writes = resize(); writes.samples[0].width = 722; writes.samples[0].height = 424; writes.mutations[0].oldValue = "722"; writes.mutations[1].oldValue = "424"; rejected(writes)
    const skipped = baseline(); skipped.samples = [state(0, "balanced", 722, 424), state(20, "high", 722, 424), state(50, "economy", 722, 424), state(3000, "economy", 722, 424)]; rejected(skipped)
  })
  it.each(["hook", "framesAttribute", "connected", "ready"] as const)("rejects transient loss of the %s invariant", key => {
    const report = resize()
    if (key === "hook") report.samples[2].hook = "function"
    else report.samples[2][key] = key === "framesAttribute"
    rejected(report)
  })
  it("requires the full observation and final uninterrupted350ms after writes or commits", () => {
    const late = resize(); late.samples[3].at = 2800; rejected(late)
    const short = baseline(); short.duration = 2999; rejected(short)
    const missingFinal = baseline(); missingFinal.samples[1].at = 2000; rejected(missingFinal)
    const empty = baseline(); empty.samples = []; rejected(empty)
  })
  it("rejects malformed sample/mutation ordering, association and numeric policy inputs", () => {
    const reversed = resize(); reversed.samples[2].at = 10; rejected(reversed)
    const badIndex = resize(); badIndex.mutations[0].sample = 99; rejected(badIndex)
    const badTime = resize(); badTime.mutations[0].at = 19; rejected(badTime)
    const unordered = resize(); unordered.mutations[1].sample = 2; unordered.mutations[1].at = 100; rejected(unordered)
    const unknown = baseline(); unknown.samples[0].quality = "constructor"; rejected(unknown)
    for (const deviceDpr of [NaN, Infinity, 0, -1]) rejected({ ...baseline(), deviceDpr })
    const nan = baseline(); nan.samples[1].cssWidth = NaN; rejected(nan)
    expect(assessCanvasObservation(baseline(), { ...budgets, desktopPixels: Infinity }).failures.length).toBeGreaterThan(0)
  })
})
