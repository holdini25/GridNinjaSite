import type { FacilityInspectionTarget, FacilityQuality, FacilitySystem, FacilityView } from "@/types/facility"

/** Private QA compositions. None is selected by an application URL or global. */
export const OFFLINE_CAPTURE_PROFILES = {
  "desktop-poster": { cssSize: [1360, 800], dpr: 1, sampling: "balanced" },
  "mobile-native": { cssSize: [340, 255], dpr: 2, sampling: "economy" },
  "mobile-supersampled": { cssSize: [340, 255], dpr: 3, sampling: "economy" },
} as const
export type OfflineCaptureProfileId = keyof typeof OFFLINE_CAPTURE_PROFILES
export type OfflineCaptureProfile = (typeof OFFLINE_CAPTURE_PROFILES)[OfflineCaptureProfileId]
export const OFFLINE_CAPTURE_PIXEL_CEILING = 4_000_000
export const OFFLINE_CAPTURE_DEADLINE_MS = 8_000

export type OfflineCaptureState = {
  release: string; generation: number; epoch: number; modelSha256: string | null
  view: FacilityView; selected: FacilitySystem | null; target: FacilityInspectionTarget | null
  preview: FacilitySystem | null; previewTarget: FacilityInspectionTarget | null
  disposed: boolean; visible: boolean; ready: boolean; settled: boolean; still: boolean
  cssSize: readonly [number, number]; quality: FacilityQuality; dpr: number; sampling: string
}
export type OfflineCaptureRequest = {
  requestId: string; profile: OfflineCaptureProfileId; expectedRelease: string
  expectedGeneration: number; expectedModelSha256: string; expectedView: FacilityView
  expectedSelected: FacilitySystem | null; expectedTarget: FacilityInspectionTarget | null
  signal: AbortSignal
}
export type OfflineCaptureFrame = {
  frame: number; drawingBuffer: readonly [number, number]; canvasSize: readonly [number, number]
  actualCssSize: readonly [number, number]; canvasCssSize: readonly [number, number]
  dpr: number; sampling: { anisotropy: number; alphaToCoverage: boolean }
  camera: { projection: string; projectionMatrix: number[]; matrixWorld: number[]; target: number[] | null }
  mechanism: unknown; color: { outputColorSpace: string; toneMapping: number; exposure: number }
  resources: { drawCalls: number; triangles: number; materials: number; estimatedBytes: number; peakEstimatedBytes: number; environmentBytes: number; geometries: number; textures: number }
  graphics: { renderer: string; vendor: string; samples: number; antialias: boolean; maxRenderbufferSize: number; maxViewportDimensions: number[]; maxAnisotropy: number }
}
export type OfflineCaptureResult = {
  png: string
  receipt: { schemaVersion: "facility-offline-frame.v2"; requestId: string; profile: OfflineCaptureProfileId; state: OfflineCaptureState; frame: OfflineCaptureFrame; previous: { dpr: number; quality: FacilityQuality; sampling: string }; restored: { dpr: number; quality: FacilityQuality; sampling: string } }
}
type CaptureHandler = { capture: (request: OfflineCaptureRequest) => Promise<OfflineCaptureResult>; status: () => OfflineCaptureState }
export type FacilityOfflineCapturePort = { attach: (handler: CaptureHandler) => () => void }

/** Constructed only by the private loopback entry. Public components get no port. */
export function createOfflineCapturePort() {
  let handler: CaptureHandler | null = null
  const port: FacilityOfflineCapturePort = {
    attach(next) {
      if (handler) throw new Error("offline_capture_port_in_use")
      handler = next
      return () => { if (handler === next) handler = null }
    },
  }
  return { port, status: () => handler?.status() ?? null, capture: (request: OfflineCaptureRequest) => handler ? handler.capture(request) : Promise.reject(new Error("offline_capture_not_attached")) }
}

/** Stable semantic comparison; key order in a transferred JSON object is immaterial. */
export function offlineCaptureIdentity(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(offlineCaptureIdentity).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${offlineCaptureIdentity(item)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}

export function offlineCaptureProfile(id: OfflineCaptureProfileId): OfflineCaptureProfile {
  if (!Object.hasOwn(OFFLINE_CAPTURE_PROFILES, id)) throw new Error("offline_capture_profile")
  const profile = OFFLINE_CAPTURE_PROFILES[id], dimensions = profile.cssSize.map(value => value * profile.dpr)
  if (dimensions.some(value => !Number.isInteger(value) || value <= 0 || value > 4096) || dimensions[0] * dimensions[1] > OFFLINE_CAPTURE_PIXEL_CEILING) throw new Error("offline_capture_pixel_budget")
  return profile
}

type Adapter = {
  status: () => OfflineCaptureState
  prepare: (profile: OfflineCaptureProfile, signal: AbortSignal) => Promise<void>
  restore: () => OfflineCaptureResult["receipt"]["restored"]
  requestFrame: () => void
  frame: () => OfflineCaptureFrame
  png: () => string
}
type Pending = {
  request: OfflineCaptureRequest; profile: OfflineCaptureProfile; epoch: number; quality: FacilityQuality; previous: OfflineCaptureResult["receipt"]["previous"]
  deadlineAt: number
  controller: AbortController; prepared: boolean; done: boolean; timeout: ReturnType<typeof setTimeout>
  resolve: (value: OfflineCaptureResult) => void; reject: (error: unknown) => void; abort: () => void
}

/** Transaction invoked by the existing session owner; it owns no animation loop. */
export function createOfflineCaptureSession(adapter: Adapter) {
  let pending: Pending | null = null, disposed = false
  const failure = (reason: string) => new Error(reason)
  // A timer cannot interrupt synchronous rendering/PNG encoding or a delayed
  // main thread. Check the monotonic deadline at each completion boundary too.
  const assertDeadline = (item: Pending) => { if (performance.now() >= item.deadlineAt) throw failure("offline_capture_deadline") }
  const assertIdentity = (item: Pending, state: OfflineCaptureState) => {
    const request = item.request
    if (disposed || state.disposed) throw failure("offline_capture_disposed")
    if (!state.visible) throw failure("offline_capture_hidden")
    if (!state.still) throw failure("offline_capture_requires_still_state")
    if (state.release !== request.expectedRelease || state.generation !== request.expectedGeneration || state.epoch !== item.epoch || state.modelSha256 !== request.expectedModelSha256) throw failure("offline_capture_stale_asset")
    if (offlineCaptureIdentity(state.view) !== offlineCaptureIdentity(request.expectedView) || state.selected !== request.expectedSelected || offlineCaptureIdentity(state.target) !== offlineCaptureIdentity(request.expectedTarget) || state.preview !== null || state.previewTarget !== null) throw failure("offline_capture_stale_presentation")
    if (state.quality !== item.quality) throw failure("offline_capture_quality_changed")
  }
  const finish = (item: Pending, result?: Omit<OfflineCaptureResult, "receipt"> & { receipt: Omit<OfflineCaptureResult["receipt"], "restored"> }, error?: unknown) => {
    if (item.done) return
    item.done = true; clearTimeout(item.timeout); item.request.signal.removeEventListener("abort", item.abort)
    item.controller.abort(error ?? failure("offline_capture_complete"))
    if (pending === item) pending = null
    let restored: OfflineCaptureResult["receipt"]["restored"] | undefined
    try {
      restored = adapter.restore()
      if (offlineCaptureIdentity(restored) !== offlineCaptureIdentity(item.previous)) error ??= failure("offline_capture_restore_mismatch")
    } catch (restoreError) { error ??= restoreError }
    if (error !== undefined) item.reject(error)
    else if (result && restored) item.resolve({ ...result, receipt: { ...result.receipt, restored } })
    else item.reject(failure("offline_capture_no_result"))
  }
  const invalidate = () => {
    if (!pending) return
    try { assertIdentity(pending, adapter.status()) } catch (error) { finish(pending, undefined, error) }
  }
  const capture = (request: OfflineCaptureRequest): Promise<OfflineCaptureResult> => {
    if (pending) return Promise.reject(failure("offline_capture_busy"))
    if (disposed) return Promise.reject(failure("offline_capture_disposed"))
    let profile: OfflineCaptureProfile
    try {
      profile = offlineCaptureProfile(request.profile)
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(request.requestId) || !/^[a-f0-9]{64}$/.test(request.expectedModelSha256) || !Number.isInteger(request.expectedGeneration) || request.expectedGeneration < 0) throw failure("offline_capture_request")
      request.signal.throwIfAborted()
    } catch (error) { return Promise.reject(error) }
    const initial = adapter.status()
    if (!initial.ready || !initial.settled) return Promise.reject(failure("offline_capture_not_settled"))
    return new Promise((resolve, reject) => {
      const item: Pending = { request, profile, epoch: initial.epoch, quality: initial.quality, previous: { dpr: initial.dpr, quality: initial.quality, sampling: initial.sampling }, deadlineAt: performance.now() + OFFLINE_CAPTURE_DEADLINE_MS, controller: new AbortController(), prepared: false, done: false, timeout: undefined as unknown as ReturnType<typeof setTimeout>, resolve, reject, abort: () => {} }
      pending = item
      item.abort = () => finish(item, undefined, request.signal.reason ?? failure("offline_capture_aborted"))
      request.signal.addEventListener("abort", item.abort, { once: true })
      item.timeout = setTimeout(() => finish(item, undefined, failure("offline_capture_deadline")), OFFLINE_CAPTURE_DEADLINE_MS)
      try { assertIdentity(item, initial) } catch (error) { finish(item, undefined, error); return }
      void adapter.prepare(profile, item.controller.signal).then(() => {
        if (item.done) return
        assertDeadline(item)
        assertIdentity(item, adapter.status())
        item.prepared = true; adapter.requestFrame()
      }).catch(error => finish(item, undefined, error))
    })
  }
  return {
    capture, status: adapter.status, invalidate,
    cancel(reason: string) { if (pending) finish(pending, undefined, failure(reason)) },
    afterFrame(renderedCurrentModel: boolean) {
      const item = pending
      if (!item?.prepared || item.done) return
      try {
        assertDeadline(item)
        const state = adapter.status(); assertIdentity(item, state)
        if (!state.ready || !state.settled || !renderedCurrentModel) throw failure("offline_capture_unsettled_frame")
        const frame = adapter.frame(), expected = item.profile.cssSize.map(value => value * item.profile.dpr)
        if (state.cssSize.some((value, index) => Math.abs(value - item.profile.cssSize[index]) > .01)) throw failure("offline_capture_css_size")
        if ([frame.actualCssSize, frame.canvasCssSize].some(size => size.some((value, index) => !Number.isFinite(value) || Math.abs(value - item.profile.cssSize[index]) > .01))) throw failure("offline_capture_unobserved_resize")
        if (frame.drawingBuffer.some((value, index) => value !== expected[index]) || frame.canvasSize.some((value, index) => value !== expected[index]) || frame.dpr !== item.profile.dpr) throw failure("offline_capture_buffer_size")
        if (frame.sampling.anisotropy !== Math.max(1, Math.min(frame.graphics.maxAnisotropy, item.profile.sampling === "balanced" ? 2 : 1))) throw failure("offline_capture_sampling")
        if (expected.some((value, index) => value > frame.graphics.maxRenderbufferSize || value > frame.graphics.maxViewportDimensions[index])) throw failure("offline_capture_device_limit")
        assertDeadline(item)
        const png = adapter.png()
        assertDeadline(item)
        if (!png.startsWith("data:image/png;base64,")) throw failure("offline_capture_png")
        finish(item, { png, receipt: { schemaVersion: "facility-offline-frame.v2", requestId: item.request.requestId, profile: item.request.profile, state, frame, previous: item.previous } })
      } catch (error) { finish(item, undefined, error) }
    },
    dispose() { disposed = true; if (pending) finish(pending, undefined, failure("offline_capture_disposed")) },
  }
}
