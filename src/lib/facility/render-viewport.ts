type RenderSize = { width: number; height: number; top: number; left: number }

/** Await R3F's existing resize owner at the asset boundary. Writing its size
 * directly races Canvas' pending measured rectangle. Layout is read initially
 * and on actual size changes only, never in the animation loop or other updates. */
export function waitForRenderViewport(
  container: Pick<HTMLElement, "getBoundingClientRect">,
  currentSize: () => RenderSize,
  subscribe: (changed: () => void) => () => void,
  signal: AbortSignal,
): Promise<RenderSize> {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {}
    let settled = false
    const cleanup = () => { unsubscribe(); signal.removeEventListener("abort", abort) }
    const fail = (reason: unknown) => { if (!settled) { settled = true; cleanup(); reject(reason) } }
    const abort = () => fail(signal.reason ?? new DOMException("Aborted", "AbortError"))
    if (signal.aborted) { abort(); return }
    const measure = () => {
      const { width, height } = container.getBoundingClientRect()
      if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error("facility_viewport_unavailable")
      return { width, height }
    }
    let expected: { width: number; height: number }
    try { expected = measure() } catch (error) { fail(error); return }
    let { width: observedWidth, height: observedHeight } = currentSize()
    const changed = () => {
      if (settled) return
      const size = currentSize()
      const resized = !Object.is(size.width, observedWidth) || !Object.is(size.height, observedHeight)
      observedWidth = size.width; observedHeight = size.height
      if (![size.width, size.height].every(Number.isFinite) || size.width <= 0 || size.height <= 0) return
      // A visitor can rotate during staging. Follow a genuinely new measured
      // size rather than waiting for an obsolete target until the asset deadline.
      if (resized) { try { expected = measure() } catch (error) { fail(error); return } }
      if (Math.abs(size.width - expected.width) > .01 || Math.abs(size.height - expected.height) > .01) return
      settled = true; cleanup(); resolve(size)
    }
    signal.addEventListener("abort", abort, { once: true })
    const detach = subscribe(changed)
    if (settled) detach()
    else unsubscribe = detach
    changed()
  })
}
