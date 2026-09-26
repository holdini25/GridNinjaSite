// @vitest-environment node
import { describe, expect, it } from "vitest"
import { TransferLedger, assertCompleteTransfer, assertFrameBudget, assertRendererBudget, assertSettlementEvidence, assertCadenceBudget, assertLighthouseProfile, assertSameBuild, settingsDigest, settleTransfers } from "../../../scripts/facility/performance-contract.mjs"

describe("complete HTTP transfer accounting", () => {
  it("retains cross-origin redirect hops without double-counting compressed chunks", () => {
    const ledger = new TransferLedger()
    ledger.request({ requestId: "r1", request: { url: "https://site.example/model" }, type: "Fetch" })
    ledger.response({ requestId: "r1", response: { status: 302, encodedDataLength: 100, headers: {} } })
    ledger.request({ requestId: "r1", request: { url: "https://cdn.example/model.glb" }, type: "Fetch", redirectResponse: { status: 302, encodedDataLength: 180 } })
    ledger.response({ requestId: "r1", response: { status: 200, encodedDataLength: 200, headers: { "Content-Encoding": "br" } } })
    ledger.data({ requestId: "r1", encodedDataLength: 500 })
    ledger.data({ requestId: "r1", encodedDataLength: 500 })
    ledger.finished({ requestId: "r1", encodedDataLength: 1_200 })
    const snapshot = ledger.snapshot()
    expect(snapshot.bytes).toBe(1_380)
    expect(snapshot.requests).toHaveLength(2)
    expect(snapshot.requests.map(request => request.hop)).toEqual([0, 1])
    expect(snapshot.complete).toBe(true)
    expect(() => assertCompleteTransfer(snapshot)).not.toThrow()
  })
  it("accounts for partial failed bytes and rejects the incomplete evidence", () => {
    const ledger = new TransferLedger()
    ledger.request({ requestId: "external", request: { url: "https://third-party.example/script.js" }, type: "Script" })
    ledger.response({ requestId: "external", response: { status: 200, encodedDataLength: 80, headers: {} } })
    ledger.data({ requestId: "external", encodedDataLength: 240 })
    ledger.failed({ requestId: "external", errorText: "net::ERR_CONNECTION_RESET" })
    const snapshot = ledger.snapshot()
    expect(snapshot.bytes).toBe(320)
    expect(snapshot.complete).toBe(false)
    expect(() => assertCompleteTransfer(snapshot)).toThrow("incomplete")
  })
  it("cannot turn pending or missing terminal byte counts into a passing zero", () => {
    const ledger = new TransferLedger()
    ledger.request({ requestId: "pending", request: { url: "https://example.com/slow" }, type: "Fetch" })
    expect(ledger.pending()).toBe(true)
    expect(() => assertCompleteTransfer(ledger.snapshot())).toThrow("incomplete")
    ledger.finished({ requestId: "pending" })
    expect(ledger.snapshot().complete).toBe(false)
  })
  it("fails a complete transfer that crosses the whole-page ceiling", () => {
    expect(() => assertCompleteTransfer({ complete: true, issues: [], bytes: 1_572_865 })).toThrow("exceeds")
  })
  it("fails the bounded settlement deadline when a request never completes", async () => {
    const ledger = new TransferLedger()
    ledger.request({ requestId: "pending", request: { url: "https://example.com/never-finishes" }, type: "Fetch" })
    await expect(settleTransfers(ledger, { timeout: 1, quiet: 0 })).rejects.toThrow("Network did not settle")
  })
})

describe("performance evidence gates", () => {
  const settlementSettings = { pauseIdleQuietMs: 250, pauseSettleTimeoutMs: 1000, pauseObservationMs: 500 }
  const stillEvidence = () => {
    const renderer = { frames: 180, schedulerPending: 0, transitionRemaining: 0, quality: "still", drawCalls: 39, triangles: 30_000, materials: 10, estimatedBytes: 5_000_000, peakEstimatedBytes: 7_000_000, environmentBytes: 2_359_296, equipment: { fans: [{ phase: .4 }], ledColors: [.5, .5, .5] } }
    return { mode: "adaptive-still", settle: { elapsedMs: 300 }, observationMs: 500, controls: { quality: "still", label: "Still for performance", pauseCount: 0, paused: false }, before: structuredClone(renderer), after: structuredClone(renderer) }
  }
  it("distinguishes actual Still settlement from an explicit user Pause", () => {
    const evidence = stillEvidence()
    expect(() => assertSettlementEvidence(evidence, settlementSettings)).not.toThrow()
    expect(() => assertSettlementEvidence({ ...evidence, mode: "explicit-pause" }, settlementSettings)).toThrow("Pause")
    const paused = { ...evidence, mode: "explicit-pause", controls: { ...evidence.controls, quality: "balanced", label: "Paused", pauseCount: 1, paused: true } }
    expect(() => assertSettlementEvidence(paused, settlementSettings)).not.toThrow()
    expect(() => assertSettlementEvidence({ ...evidence, controls: paused.controls }, settlementSettings)).toThrow()
  })
  it("rejects a still claim with continuing frames, changed equipment, missing evidence or a pending callback", () => {
    for (const mutation of [
      (e: ReturnType<typeof stillEvidence>) => { e.after.frames++ },
      (e: ReturnType<typeof stillEvidence>) => { e.after.equipment.fans[0].phase += .1 },
      (e: ReturnType<typeof stillEvidence>) => { e.after.equipment.ledColors[0] = 1 },
      (e: ReturnType<typeof stillEvidence>) => { e.after.equipment.fans = [] },
      (e: ReturnType<typeof stillEvidence>) => { e.after.schedulerPending = 1 },
      (e: ReturnType<typeof stillEvidence>) => { e.after.transitionRemaining = .1 },
      (e: ReturnType<typeof stillEvidence>) => { e.after.quality = "economy" },
    ]) { const evidence = stillEvidence(); mutation(evidence); expect(() => assertSettlementEvidence(evidence, settlementSettings)).toThrow() }
  })
  it("keeps settlement duration, allocation and independent capability/cadence gates intact", () => {
    const evidence = stillEvidence()
    for (const elapsedMs of [0, 249, 1001, Number.NaN]) expect(() => assertSettlementEvidence({ ...evidence, settle: { elapsedMs } }, settlementSettings)).toThrow("quiet interval")
    expect(() => assertSettlementEvidence({ ...evidence, observationMs: 499 }, settlementSettings)).toThrow("observation")
    expect(() => assertSettlementEvidence({ ...evidence, after: { ...evidence.after, peakEstimatedBytes: 32 * 1024 * 1024 + 1 } }, settlementSettings)).toThrow("allocation")
    expect(() => assertFrameBudget({ quality: "still", frameP95: 20.01, sampleCount: 120 }, 20)).toThrow("exceeds")
    expect(() => assertCadenceBudget({ quality: "balanced", targetFps: 30, sampleCount: 120, missedRatio: .1001, cpuP95: 1 })).toThrow("10%")
  })
  it("gates transient environment allocation and paused draw calls as well as retained assets", () => {
    const snapshot = { drawCalls: 39, triangles: 30_000, materials: 10, estimatedBytes: 5_000_000, peakEstimatedBytes: 7_000_000, environmentBytes: 2_359_296 }
    expect(() => assertRendererBudget(snapshot, false)).not.toThrow()
    expect(() => assertRendererBudget({ ...snapshot, peakEstimatedBytes: undefined })).toThrow("Missing")
    expect(() => assertRendererBudget({ ...snapshot, peakEstimatedBytes: 32 * 1024 * 1024 + 1 })).toThrow("peak allocation")
    expect(() => assertRendererBudget({ ...snapshot, peakEstimatedBytes: 4_000_000 })).toThrow("accounting")
    expect(() => assertRendererBudget({ ...snapshot, drawCalls: 41 }, false)).toThrow("draw-call")
    expect(() => assertRendererBudget({ ...snapshot, drawCalls: 41 }, true)).not.toThrow()
  })
  it("rejects desktop reports relabeled as mobile and mismatched actual settings", () => {
    const settings = { formFactor: "desktop", throttlingMethod: "simulate" }
    const report = { configSettings: settings, facilityEvidence: { provenance: { settings: { profile: "desktop", settings } } }, audits: { "heading-order": { score: 1 }, "color-contrast": { score: 1 } } }
    expect(() => assertLighthouseProfile(report, "desktop")).not.toThrow()
    expect(() => assertLighthouseProfile(report, "mobile")).toThrow("wrong device profile")
    expect(() => assertLighthouseProfile({ ...report, configSettings: { ...settings, formFactor: "mobile" } }, "desktop")).toThrow("actual form factor")
    expect(() => assertLighthouseProfile({ ...report, configSettings: { ...settings, throttlingMethod: "provided" } }, "desktop")).toThrow("Actual Lighthouse settings")
    for (const audit of ["heading-order", "color-contrast"]) expect(() => assertLighthouseProfile({ ...report, audits: { ...report.audits, [audit]: { score: 0 } } }, "desktop")).toThrow(`Required ${audit}`)
  })
  it("requires a complete positive frame window and enforces the native ceiling", () => {
    for (const frameP95 of [null, undefined, 0, Number.NaN]) expect(() => assertFrameBudget({ frameP95, sampleCount: 120 }, 20)).toThrow("Missing")
    expect(() => assertFrameBudget({ frameP95: 12, sampleCount: 119 }, 20)).toThrow("Missing")
    expect(() => assertFrameBudget({ frameP95: 20.01, sampleCount: 120 }, 20)).toThrow("exceeds")
    expect(() => assertFrameBudget({ frameP95: 20, sampleCount: 120 }, 20)).not.toThrow()
  })
  it("rejects mixed source/build/harness/release identities and tampered settings", () => {
    const settings = { profile: "desktop", freshBrowserProfile: true }
    const expected = { schemaVersion: "facility-performance.v2", sourceRevision: "source", buildId: "build", harnessRevision: "harness", releases: [{ release: "facility-v2", manifestSha256: "hash" }], buildSettings: { selectedRelease: "facility-v2", mode: "auto-desktop" }, browser: "149.0", settings, settingsSha256: settingsDigest(settings) }
    expect(() => assertSameBuild(expected, expected)).not.toThrow()
    for (const field of ["sourceRevision", "buildId", "harnessRevision"]) expect(() => assertSameBuild({ ...expected, [field]: "stale" }, expected)).toThrow("provenance")
    expect(() => assertSameBuild({ ...expected, releases: [] }, expected)).toThrow("release")
    expect(() => assertSameBuild({ ...expected, buildSettings: { selectedRelease: "facility-v1", mode: "poster" } }, expected)).toThrow("settings")
    expect(() => assertSameBuild({ ...expected, settings: { profile: "mobile" } }, expected)).toThrow("settings digest")
  })
})
