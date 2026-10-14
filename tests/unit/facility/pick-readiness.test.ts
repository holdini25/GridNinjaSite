import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { waitForFacilityPickReadiness, type FacilityPickCamera } from "../../support/facility-pick-readiness"

const camera = (): FacilityPickCamera => ({
  cameraProjection: "perspective", cameraFov: 32, cameraAspect: 4 / 3,
  cameraFrustum: null, cameraClip: [.1, 150], cameraPosition: [2, 3, 7], cameraTarget: [0, 1, 0],
  rendererCssSize: [350, 262.5], dpr: 1, transitionRemaining: 0,
  probeRendered: true, assetError: null, schedulerPending: 0,
})

describe("bounded public-camera pick readiness", () => {
  let frames: Map<number, FrameRequestCallback>, nextFrame: number
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] })
    frames = new Map(); nextFrame = 0
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame })
    vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id) })
  })
  afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); vi.unstubAllGlobals() })
  const tick = () => {
    const pending = [...frames.values()]; frames.clear()
    for (const callback of pending) callback(performance.now())
  }
  function fixture() {
    const parent = document.createElement("div"), canvas = document.createElement("canvas")
    parent.append(canvas); document.body.append(parent); canvas.dataset.ready = "true"
    canvas.width = 350; canvas.height = 262
    const frame = camera(), box = { x: 20, y: 100, width: 350, height: 262.5 }, parentBox = { ...box }
    canvas.getBoundingClientRect = () => new DOMRect(box.x, box.y, box.width, box.height)
    parent.getBoundingClientRect = () => new DOMRect(parentBox.x, parentBox.y, parentBox.width, parentBox.height)
    Object.defineProperty(canvas, "__gnFacilitySnapshot", { value: () => structuredClone(frame) })
    return { canvas, parent, frame, box, parentBox }
  }

  it("returns the final coherent sample only after three consecutive frames", async () => {
    const { canvas, box, parentBox } = fixture()
    const pending = waitForFacilityPickReadiness(canvas)
    let resolved = false; void pending.then(() => { resolved = true })
    tick(); tick(); await Promise.resolve(); expect(resolved).toBe(false)
    box.y = 120; parentBox.y = 120
    tick(); tick(); await Promise.resolve(); expect(resolved).toBe(false)
    tick()
    const sample = await pending
    expect(sample.box.y).toBe(120); expect(sample.parentBox.y).toBe(120)
    expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0)
  })

  it("rejects the observed same-4:3 stale canvas until canvas, parent and renderer agree", async () => {
    const { canvas, frame, box } = fixture()
    box.width = 294; box.height = 220.5; frame.rendererCssSize = [294, 220.5]; canvas.width = 294; canvas.height = 220
    const pending = waitForFacilityPickReadiness(canvas)
    tick(); tick(); tick()
    expect(frames.size).toBe(1)
    box.width = 350; box.height = 262.5; frame.rendererCssSize = [350, 262.5]; canvas.width = 350; canvas.height = 262
    tick(); tick(); tick()
    expect((await pending).box.width).toBe(350)
  })

  it("does not accept renderer lag or a stale backing buffer", async () => {
    const { canvas, frame } = fixture()
    frame.rendererCssSize = [294, 220.5]
    const pending = waitForFacilityPickReadiness(canvas)
    tick(); tick(); tick(); expect(frames.size).toBe(1)
    frame.rendererCssSize = [350, 262.5]; frame.dpr = 1.25
    tick(); tick(); tick(); expect(frames.size).toBe(1)
    canvas.width = 437; canvas.height = 328
    tick(); tick(); tick()
    expect((await pending).backing).toEqual([437, 328])
  })

  it("resets stability for a camera change even when the viewport is unchanged", async () => {
    const { canvas, frame } = fixture()
    const pending = waitForFacilityPickReadiness(canvas)
    tick(); tick(); frame.cameraPosition[0] += 1; tick(); tick()
    expect(frames.size).toBe(1)
    tick(); expect((await pending).frame.cameraPosition[0]).toBe(3)
  })

  it("requires three new valid frames after an invalid sample even when the signature recovers unchanged", async () => {
    const { canvas, frame } = fixture()
    const pending = waitForFacilityPickReadiness(canvas)
    let resolved = false; void pending.then(() => { resolved = true })
    tick(); tick()
    frame.schedulerPending = 1; tick()
    frame.schedulerPending = 0; tick(); tick()
    await Promise.resolve(); expect(resolved).toBe(false); expect(frames.size).toBe(1)
    tick()
    expect((await pending).frame.schedulerPending).toBe(0)
    expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0)
  })

  it("accepts a valid stable orthographic camera without requiring rendered-frame increments", async () => {
    const { canvas, frame } = fixture()
    frame.cameraProjection = "orthographic"; frame.cameraFov = null; frame.cameraFrustum = [-4, 4, 3, -3]
    const pending = waitForFacilityPickReadiness(canvas)
    tick(); tick(); tick()
    expect((await pending).frame.cameraProjection).toBe("orthographic")
  })

  it.each([
    ["invalid geometry", (f: ReturnType<typeof fixture>) => { f.box.width = NaN }],
    ["camera aspect mismatch", (f: ReturnType<typeof fixture>) => { f.frame.cameraAspect = 1.7 }],
    ["invalid camera", (f: ReturnType<typeof fixture>) => { f.frame.cameraPosition[0] = Infinity }],
    ["invalid FOV", (f: ReturnType<typeof fixture>) => { f.frame.cameraFov = null }],
    ["invalid frustum", (f: ReturnType<typeof fixture>) => { f.frame.cameraProjection = "orthographic"; f.frame.cameraFov = null; f.frame.cameraFrustum = [-4, 4, 0, 0] }],
    ["pending transition", (f: ReturnType<typeof fixture>) => { f.frame.transitionRemaining = .1 }],
    ["pending render", (f: ReturnType<typeof fixture>) => { f.frame.schedulerPending = 1 }],
    ["unpresented model", (f: ReturnType<typeof fixture>) => { f.frame.probeRendered = false }],
    ["detached canvas", (f: ReturnType<typeof fixture>) => { f.canvas.remove() }],
  ] as const)("fails closed at two seconds for %s", async (_name, change) => {
    const value = fixture(); change(value)
    const pending = waitForFacilityPickReadiness(value.canvas)
    const rejection = expect(pending).rejects.toThrow("Facility pick readiness timed out after 2000ms")
    tick(); tick(); tick(); await vi.advanceTimersByTimeAsync(2_000); await rejection
    expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0)
  })

  it("times out and cleans up if the browser never delivers an animation frame", async () => {
    const pending = waitForFacilityPickReadiness(fixture().canvas)
    const rejection = expect(pending).rejects.toThrow("no animation-frame sample")
    await vi.advanceTimersByTimeAsync(2_000); await rejection
    expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0)
  })
})
