import type { Camera, Object3D, Scene, WebGLRenderer } from "three"

type StagedModel = { scene: Object3D; dispose: () => void }

/** Own the staged asset until Three's parallel shader preparation completes.
 * The caller retains the existing readiness deadline and must still verify a
 * real first frame. Three's fallback handles missing KHR support; it cannot
 * promise nonblocking first use on those contexts. */
export function prewarmFacilityModel(
  renderer: Pick<WebGLRenderer, "compileAsync" | "getContext" | "domElement">,
  model: StagedModel,
  camera: Camera,
  targetScene: Scene,
  signal: AbortSignal,
  isCurrent: () => boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    let task: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => {
      if (task !== undefined) clearTimeout(task)
      signal.removeEventListener("abort", abort)
      renderer.domElement.removeEventListener("webglcontextlost", lost)
    }
    const fail = (error: unknown) => {
      if (settled) return
      settled = true; cleanup()
      // Disposal also lets Three's readiness poll drop disposed programs. Late
      // resolution is observed below and cannot publish or dispose a new asset.
      model.dispose()
      reject(error)
    }
    const abort = () => fail(signal.reason ?? new DOMException("Aborted", "AbortError"))
    const lost = () => fail(new Error("model_prewarm_context_lost"))
    const valid = () => {
      if (signal.aborted) { abort(); return false }
      if (!isCurrent()) { fail(new Error("model_prewarm_stale")); return false }
      if (renderer.getContext().isContextLost()) { lost(); return false }
      return true
    }
    signal.addEventListener("abort", abort, { once: true })
    renderer.domElement.addEventListener("webglcontextlost", lost, { once: true })
    if (!valid()) return
    // A promise-only yield would concatenate preparation with parsing/PMREM in
    // one task. This task boundary gives input and painting a chance to run.
    task = setTimeout(() => {
      task = undefined
      if (settled || !valid()) return
      try {
        void renderer.compileAsync(model.scene, camera, targetScene).then(() => {
          if (settled || !valid()) return
          settled = true; cleanup(); resolve()
        }, fail)
      } catch (error) { fail(error) }
    }, 0)
  })
}
