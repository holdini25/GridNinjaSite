// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { observeCinematicLoop } from "../../../scripts/cinematic/measure-page.mjs"

type NativeFrame = { mediaTime: number; expectedDisplayTime: number; presentationTime: number; presentedFrames: number }
type Callback = (now: number, frame: NativeFrame) => void

function fixture() {
  const pending = new Map<number, Callback>()
  let token = 0, now = 100, observer: { notify: (entries: unknown[]) => void; disconnect: ReturnType<typeof vi.fn> } | undefined
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" })
  const video = Object.assign(new EventTarget(), {
    duration: 10, paused: false, currentTime: 0, seeking: false,
    buffered: { length: 1, start: () => 0, end: () => 10 },
    getBoundingClientRect: vi.fn(() => ({ top: 0, left: 0, right: 800, bottom: 500, width: 800, height: 500 })),
    getVideoPlaybackQuality: () => ({ totalVideoFrames: token, droppedVideoFrames: 0 }),
    requestVideoFrameCallback: vi.fn((callback: Callback) => { pending.set(++token, callback); return token }),
    cancelVideoFrameCallback: vi.fn((id: number) => { pending.delete(id) }),
  })
  vi.stubGlobal("document", document); vi.stubGlobal("innerWidth", 1000); vi.stubGlobal("innerHeight", 700)
  vi.stubGlobal("IntersectionObserver", class {
    disconnect = vi.fn()
    constructor(notify: (entries: unknown[]) => void) { observer = { notify, disconnect: this.disconnect } }
    observe() {}
  })
  vi.spyOn(performance, "now").mockImplementation(() => now)
  const fire = (time: number, mediaTime: number, presentedFrames: number) => {
    now = time + 4
    const [id, callback] = [...pending][0]
    pending.delete(id)
    callback(time, { mediaTime, expectedDisplayTime: time + 1, presentationTime: time - 2,
      get presentedFrames() { expect(pending.size).toBe(1); return presentedFrames } })
  }
  return { video, document, pending, fire, intersect: (ratio: number) => observer!.notify([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]), disconnected: () => observer!.disconnect }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("native cinematic loop observer", () => {
  it("retains skipped native frame evidence and separate timestamps without reading layout on every callback", async () => {
    const f = fixture(), result = observeCinematicLoop(f.video)
    f.fire(100, 0, 1); f.fire(10066.667, 9.966667, 300); f.fire(10100, 0, 302)
    const observed = await result
    expect(observed.elapsedMediaSeconds).toBe(10)
    expect(observed.presentedCallbacks).toBe(3)
    expect(observed.loopBoundaries).toHaveLength(1)
    expect(observed.loopBoundaries[0]).toMatchObject({ presentedFramesDelta: 2, nativePresentationEvidence: "inconclusive-skipped-callback-frames", fromMediaTime: 9.966667, toMediaTime: 0 })
    expect(observed.nativeFrames[2]).toMatchObject({ callbackNowMs: 10100, observedAtMs: 10104, expectedDisplayTimeMs: 10101, presentationTimeMs: 10098, presentedFrames: 302, observerLatenessMs: 3, callbackTimestampLagMs: 4 })
    expect(observed.skippedCallbackFrames).toBe(299)
    expect(f.video.getBoundingClientRect).toHaveBeenCalledTimes(1)
    expect(f.pending.size).toBe(0)
    expect(f.disconnected()).toHaveBeenCalledOnce()
  })
  it("rejects loss of viewport visibility even before another video callback arrives", async () => {
    const f = fixture(), result = observeCinematicLoop(f.video)
    const rejected = expect(result).rejects.toThrow("continuously visible")
    f.intersect(.24); await rejected
    expect(f.pending.size).toBe(0)
    expect(f.video.getBoundingClientRect).toHaveBeenCalledTimes(1)
    expect(f.disconnected()).toHaveBeenCalledOnce()
  })
  it("rejects document hiding and removes callbacks immediately", async () => {
    const f = fixture(), result = observeCinematicLoop(f.video)
    const rejected = expect(result).rejects.toThrow("continuously visible")
    f.document.visibilityState = "hidden"; f.document.dispatchEvent(new Event("visibilitychange")); await rejected
    expect(f.pending.size).toBe(0)
  })
  it("rejects a native pause during the measured loop", async () => {
    const f = fixture(), result = observeCinematicLoop(f.video)
    const rejected = expect(result).rejects.toThrow("continuously visible")
    f.video.paused = true; f.video.dispatchEvent(new Event("pause")); await rejected
    expect(f.pending.size).toBe(0)
  })
})
