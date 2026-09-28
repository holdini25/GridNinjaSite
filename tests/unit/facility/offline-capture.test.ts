import { afterEach, describe, expect, it, vi } from "vitest"
import { createOfflineCapturePort, createOfflineCaptureSession, offlineCaptureIdentity, offlineCaptureProfile, type OfflineCaptureFrame, type OfflineCaptureRequest, type OfflineCaptureState } from "@/lib/facility/offline-capture"
import { cappedDpr } from "@/lib/facility/frame-policy"

const hash = "a".repeat(64)
function fixture(profile: OfflineCaptureRequest["profile"] = "mobile-native") {
  const definition = offlineCaptureProfile(profile), controller = new AbortController()
  const state: OfflineCaptureState = { release: "facility-v11", generation: 1, epoch: 3, modelSha256: hash, view: { kind: "overview" }, selected: null, target: null, preview: null, previewTarget: null, disposed: false, visible: true, ready: true, settled: true, still: true, cssSize: definition.cssSize, quality: "economy", dpr: 1, sampling: "true/1" }
  const frame: OfflineCaptureFrame = { frame: 9, drawingBuffer: definition.cssSize.map(value => value * definition.dpr) as [number, number], canvasSize: definition.cssSize.map(value => value * definition.dpr) as [number, number], actualCssSize: definition.cssSize, canvasCssSize: definition.cssSize, dpr: definition.dpr, sampling: { anisotropy: definition.sampling === "balanced" ? 2 : 1, alphaToCoverage: true }, camera: { projection: "orthographic", projectionMatrix: [1], matrixWorld: [1], target: [0, 0, 0] }, mechanism: null, color: { outputColorSpace: "srgb", toneMapping: 4, exposure: 1.18 }, resources: { drawCalls: 39, triangles: 35516, materials: 9, estimatedBytes: 10, peakEstimatedBytes: 10, environmentBytes: 1, geometries: 1, textures: 3 }, graphics: { renderer: "test", vendor: "test", samples: 4, antialias: true, maxRenderbufferSize: 8192, maxViewportDimensions: [8192, 8192], maxAnisotropy: 16 } }
  const order: string[] = []
  const adapter = {
    status: () => structuredClone(state),
    prepare: vi.fn(async () => { state.dpr = definition.dpr; order.push("prepare") }),
    restore: vi.fn(() => { state.dpr = 1; order.push("restore"); return { dpr: 1, quality: state.quality, sampling: "true/1" } }),
    requestFrame: vi.fn(() => { order.push("request") }),
    frame: () => { order.push("receipt"); return structuredClone(frame) },
    png: vi.fn(() => { order.push("png"); return "data:image/png;base64,test" }),
  }
  const request: OfflineCaptureRequest = { requestId: "test", profile, expectedRelease: state.release, expectedGeneration: 1, expectedModelSha256: hash, expectedView: state.view, expectedSelected: null, expectedTarget: null, signal: controller.signal }
  return { state, frame, request, adapter, controller, session: createOfflineCaptureSession(adapter), order }
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe("private frame-owner capture", () => {
  it.each(["desktop-poster", "mobile-native", "mobile-supersampled"] as const)("captures %s in the rendered callback before restoring", async profile => {
    const f = fixture(profile), result = f.session.capture(f.request)
    await Promise.resolve(); expect(f.adapter.png).not.toHaveBeenCalled()
    f.session.afterFrame(true)
    const capture = await result
    expect(capture.receipt.frame.drawingBuffer).toEqual(f.frame.drawingBuffer)
    expect(capture.receipt.state.dpr).toBe(offlineCaptureProfile(profile).dpr)
    expect(capture.receipt.restored.dpr).toBe(1)
    expect(capture.receipt.restored).toEqual(capture.receipt.previous)
    expect(f.order).toEqual(["prepare", "request", "receipt", "png", "restore"])
    expect(f.state.quality).toBe("economy")
    expect(f.adapter.restore).toHaveBeenCalledTimes(1)
    // Existing public review tiers keep their original production ceiling.
    expect(cappedDpr("economy", 3, 340, 255, 650000)).toBe(1)
    expect(cappedDpr("high", 3, 340, 255, 650000)).toBe(1.5)
  })
  it("rejects overlap without corrupting the first request", async () => {
    const f = fixture(), first = f.session.capture(f.request)
    await expect(f.session.capture({ ...f.request, requestId: "second" })).rejects.toThrow("offline_capture_busy")
    await Promise.resolve(); f.session.afterFrame(true); await first
    expect(f.adapter.restore).toHaveBeenCalledTimes(1)
  })
  it.each([
    ["epoch", 4, "offline_capture_stale_asset"], ["modelSha256", "b".repeat(64), "offline_capture_stale_asset"],
    ["visible", false, "offline_capture_hidden"], ["still", false, "offline_capture_requires_still_state"],
    ["selected", "cooling", "offline_capture_stale_presentation"], ["quality", "still", "offline_capture_quality_changed"],
    ["disposed", true, "offline_capture_disposed"],
  ] as const)("rejects changed %s and restores without capturing", async (field, value, error) => {
    const f = fixture(), result = f.session.capture(f.request)
    await Promise.resolve(); Object.assign(f.state, { [field]: value }); f.session.invalidate()
    await expect(result).rejects.toThrow(error); expect(f.adapter.png).not.toHaveBeenCalled(); expect(f.adapter.restore).toHaveBeenCalledTimes(1)
  })
  it.each(["drawingBuffer", "canvasSize"] as const)("rejects compositor-sized output with a wrong %s", async key => {
    const f = fixture(), result = f.session.capture(f.request)
    await Promise.resolve(); f.frame[key] = [340, 255]; f.session.afterFrame(true)
    await expect(result).rejects.toThrow("offline_capture_buffer_size"); expect(f.adapter.png).not.toHaveBeenCalled()
  })
  it("rejects wrong sampling even when source dimensions are correct", async () => {
    const f = fixture(), result = f.session.capture(f.request)
    await Promise.resolve(); f.frame.sampling.anisotropy = 2; f.session.afterFrame(true)
    await expect(result).rejects.toThrow("offline_capture_sampling")
  })
  it("rejects a DOM resize not yet observed by R3F", async () => {
    const f = fixture(), result = f.session.capture(f.request)
    await Promise.resolve(); f.frame.actualCssSize = [356, 267]; f.session.afterFrame(true)
    await expect(result).rejects.toThrow("offline_capture_unobserved_resize")
    expect(f.adapter.png).not.toHaveBeenCalled(); expect(f.adapter.restore).toHaveBeenCalledOnce()
  })
  it("rejects capture of a stale or invisible model frame", async () => {
    const f = fixture(), result = f.session.capture(f.request)
    await Promise.resolve(); f.session.afterFrame(false)
    await expect(result).rejects.toThrow("offline_capture_unsettled_frame")
  })
  it("restores and detaches on abort before deferred resize preparation finishes", async () => {
    const f = fixture(); let finish!: () => void
    f.adapter.prepare.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    const result = f.session.capture(f.request)
    f.controller.abort(new Error("test_abort")); await expect(result).rejects.toThrow("test_abort")
    finish(); await Promise.resolve(); f.session.afterFrame(true)
    expect(f.adapter.requestFrame).not.toHaveBeenCalled(); expect(f.adapter.png).not.toHaveBeenCalled(); expect(f.adapter.restore).toHaveBeenCalledOnce()
  })
  it("has one bounded deadline, preserving failures without a partial PNG", async () => {
    vi.useFakeTimers(); const f = fixture(), result = f.session.capture(f.request)
    const rejected = expect(result).rejects.toThrow("offline_capture_deadline")
    await vi.advanceTimersByTimeAsync(8000); await rejected
    expect(f.adapter.restore).toHaveBeenCalledOnce(); expect(f.adapter.png).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0)
  })
  it("rejects a late frame when the main thread has delayed the timeout callback", async () => {
    let now = 0; vi.spyOn(performance, "now").mockImplementation(() => now)
    const f = fixture(), result = f.session.capture(f.request)
    await Promise.resolve()
    // No timer is advanced: model a blocked task that reaches the frame owner
    // before the overdue timer has had a chance to run.
    now = 8001; f.session.afterFrame(true)
    await expect(result).rejects.toThrow("offline_capture_deadline")
    expect(f.adapter.png).not.toHaveBeenCalled(); expect(f.adapter.restore).toHaveBeenCalledOnce()
  })
  it("rejects encoding that crosses the deadline, even if its frame began on time", async () => {
    let now = 0; vi.spyOn(performance, "now").mockImplementation(() => now)
    const f = fixture(), result = f.session.capture(f.request)
    await Promise.resolve(); now = 7990
    f.adapter.png.mockImplementation(() => { now = 8001; return "data:image/png;base64,expired" })
    f.session.afterFrame(true)
    await expect(result).rejects.toThrow("offline_capture_deadline")
    expect(f.adapter.png).toHaveBeenCalledOnce(); expect(f.adapter.restore).toHaveBeenCalledOnce()
  })
  it("rejects context loss and disposal, then prohibits future requests", async () => {
    const f = fixture(), result = f.session.capture(f.request)
    f.session.cancel("offline_capture_context_lost")
    await expect(result).rejects.toThrow("offline_capture_context_lost")
    f.session.dispose(); await expect(f.session.capture(f.request)).rejects.toThrow("offline_capture_disposed")
  })
  it("does not turn a failed restoration into a successful capture", async () => {
    const f = fixture(); f.adapter.restore.mockImplementation(() => { throw new Error("restore_failed") })
    const result = f.session.capture(f.request); await Promise.resolve(); f.session.afterFrame(true)
    await expect(result).rejects.toThrow("restore_failed")
  })
  it("rejects restoration to a different DPR even when it remains under the public cap", async () => {
    const f = fixture(); f.adapter.restore.mockReturnValue({ dpr: 1.25, quality: "economy", sampling: "true/1" })
    const result = f.session.capture(f.request); await Promise.resolve(); f.session.afterFrame(true)
    await expect(result).rejects.toThrow("offline_capture_restore_mismatch")
  })
  it("accepts object-key permutations, rejects unknown profiles, and attaches only explicitly", async () => {
    expect(offlineCaptureIdentity({ kind: "specimen", pose: "service" })).toBe(offlineCaptureIdentity({ pose: "service", kind: "specimen" }))
    expect(() => offlineCaptureProfile("unbounded" as never)).toThrow("offline_capture_profile")
    const f = fixture(), bridge = createOfflineCapturePort()
    await expect(bridge.capture(f.request)).rejects.toThrow("offline_capture_not_attached")
    const detach = bridge.port.attach(f.session)
    expect(bridge.status()?.modelSha256).toBe(hash)
    expect(() => bridge.port.attach(f.session)).toThrow("offline_capture_port_in_use")
    detach(); expect(bridge.status()).toBeNull()
  })
})
