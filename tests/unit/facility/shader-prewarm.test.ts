import { afterEach, describe, expect, it, vi } from "vitest"
import { Group, OrthographicCamera, Scene, Texture, type WebGLRenderer } from "three"
import { prewarmFacilityModel } from "@/lib/facility/shader-prewarm"

function fixture() {
  let resolve!: (scene: Group) => void, reject!: (error: Error) => void
  const compilation = new Promise<Group>((done, fail) => { resolve = done; reject = fail })
  const context = { isContextLost: vi.fn(() => false) }
  const renderer = { domElement: document.createElement("canvas"), getContext: () => context, compileAsync: vi.fn(() => compilation) }
  const model = { scene: new Group(), dispose: vi.fn() }, camera = new OrthographicCamera(), target = new Scene()
  target.environment = new Texture()
  const controller = new AbortController(), current = vi.fn(() => true)
  const start = () => prewarmFacilityModel(renderer as unknown as WebGLRenderer, model, camera, target, controller.signal, current)
  return { renderer, model, camera, target, controller, current, context, start, resolve: () => resolve(model.scene), reject }
}
afterEach(() => vi.useRealTimers())

describe("v6 staged shader prewarming", () => {
  it("starts in a new task, compiles against the final environment, and retains ownership on success", async () => {
    vi.useFakeTimers(); const f = fixture(), pending = f.start()
    await Promise.resolve(); expect(f.renderer.compileAsync).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(0)
    expect(f.renderer.compileAsync).toHaveBeenCalledWith(f.model.scene, f.camera, f.target)
    expect(f.model.scene.parent).toBeNull()
    f.resolve(); await pending
    expect(f.model.dispose).not.toHaveBeenCalled()
    f.controller.abort(); expect(f.model.dispose).not.toHaveBeenCalled()
  })
  it("disposes synchronously on abort and ignores the later compiler resolution", async () => {
    vi.useFakeTimers(); const f = fixture(), pending = f.start(), rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" })
    await vi.advanceTimersByTimeAsync(0); f.controller.abort()
    expect(f.model.dispose).toHaveBeenCalledOnce()
    await rejection; f.resolve(); await Promise.resolve()
    expect(f.model.dispose).toHaveBeenCalledOnce()
  })
  it("cancels the pending task when navigation aborts before compilation", async () => {
    vi.useFakeTimers(); const f = fixture(), pending = f.start(), rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" })
    f.controller.abort(); await rejection; await vi.runAllTimersAsync()
    expect(f.renderer.compileAsync).not.toHaveBeenCalled(); expect(f.model.dispose).toHaveBeenCalledOnce()
  })
  it("rejects a replaced generation even if its shader completes successfully", async () => {
    vi.useFakeTimers(); const f = fixture(), pending = f.start(), rejection = expect(pending).rejects.toThrow("model_prewarm_stale")
    await vi.advanceTimersByTimeAsync(0); f.current.mockReturnValue(false); f.resolve(); await rejection
    expect(f.model.dispose).toHaveBeenCalledOnce()
  })
  it("obeys the caller's existing deadline without waiting for the compiler", async () => {
    vi.useFakeTimers(); const f = fixture()
    // Parsing has already consumed seven seconds of the shared eight-second budget.
    setTimeout(() => f.controller.abort(new Error("readiness_timeout")), 1000)
    const pending = f.start(), rejection = expect(pending).rejects.toThrow("readiness_timeout")
    await vi.advanceTimersByTimeAsync(1000); await rejection
    expect(f.model.dispose).toHaveBeenCalledOnce(); f.resolve(); await Promise.resolve()
    expect(f.model.dispose).toHaveBeenCalledOnce()
  })
  it("delegates Three's no-extension fallback without requiring a second compile or render", async () => {
    vi.useFakeTimers(); const f = fixture()
    f.renderer.compileAsync.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(f.model.scene), 10)))
    const pending = f.start(); await vi.advanceTimersByTimeAsync(10); await pending
    expect(f.renderer.compileAsync).toHaveBeenCalledOnce(); expect(f.model.dispose).not.toHaveBeenCalled()
  })
  it.each(["throw", "reject"] as const)("disposes a %s from shader preparation", async mode => {
    vi.useFakeTimers(); const f = fixture()
    if (mode === "throw") f.renderer.compileAsync.mockImplementation(() => { throw new Error("unsupported_shader_anchor") })
    const pending = f.start(), rejection = expect(pending).rejects.toThrow("unsupported_shader_anchor")
    await vi.advanceTimersByTimeAsync(0)
    if (mode === "reject") f.reject(new Error("unsupported_shader_anchor"))
    await rejection; expect(f.model.dispose).toHaveBeenCalledOnce()
  })
  it("disposes pending resources immediately on context loss", async () => {
    vi.useFakeTimers(); const f = fixture(), pending = f.start(), rejection = expect(pending).rejects.toThrow("model_prewarm_context_lost")
    await vi.advanceTimersByTimeAsync(0)
    f.renderer.domElement.dispatchEvent(new Event("webglcontextlost"))
    expect(f.model.dispose).toHaveBeenCalledOnce(); await rejection
    f.resolve(); await Promise.resolve(); expect(f.model.dispose).toHaveBeenCalledOnce()
  })
})
