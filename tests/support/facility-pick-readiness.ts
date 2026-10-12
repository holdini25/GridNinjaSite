export type FacilityPickCamera = {
  cameraProjection: "orthographic" | "perspective"; cameraFov: number | null; cameraAspect: number
  cameraFrustum: [number, number, number, number] | null; cameraClip: [number, number]
  cameraPosition: [number, number, number]; cameraTarget: [number, number, number]
  rendererCssSize: [number, number]; dpr: number; transitionRemaining: number
  probeRendered: boolean; assetError: string | null; schedulerPending: number
  ecosystem?: { section: boolean }
}
type PickRect = { x: number; y: number; width: number; height: number }
export type FacilityPickSnapshot = {
  frame: FacilityPickCamera; box: PickRect; parentBox: PickRect
  backing: [number, number]; connected: boolean; ready: boolean
}

/** Passed directly to locator.evaluate: all reads and readiness logic are local
 * to the browser. This observes the existing resize owner without changing it.
 * A matching aspect alone is insufficient: 294x220.5 and 350x262.5 are both 4:3.
 */
export function waitForFacilityPickReadiness(element: HTMLCanvasElement): Promise<FacilityPickSnapshot> {
  const timeoutMs = 2_000, cssTolerance = .01, requiredFrames = 3
  const started = performance.now()
  const rect = (value: DOMRect): PickRect => ({ x: value.x, y: value.y, width: value.width, height: value.height })
  const tuple = (value: unknown, length: number): value is number[] => Array.isArray(value) && value.length === length && value.every(Number.isFinite)
  const near = (a: number, b: number) => Math.abs(a - b) <= cssTolerance
  const issue = (sample: FacilityPickSnapshot): string | null => {
    const { frame, box, parentBox, backing } = sample
    if (!sample.connected || !sample.ready) return "canvas is detached or not ready"
    if (![box, parentBox].every(value => Object.values(value).every(Number.isFinite) && value.width > 0 && value.height > 0)) return "invalid CSS geometry"
    if (!tuple(frame.rendererCssSize, 2) || frame.rendererCssSize.some(value => value <= 0)) return "invalid renderer size"
    if (!near(box.x, parentBox.x) || !near(box.y, parentBox.y) || !near(box.width, parentBox.width) || !near(box.height, parentBox.height) ||
      !near(box.width, frame.rendererCssSize[0]) || !near(box.height, frame.rendererCssSize[1])) return "canvas, parent and renderer sizes disagree"
    if (!Number.isFinite(frame.dpr) || frame.dpr <= 0 || !backing.every(value => Number.isInteger(value) && value > 0) ||
      backing.some((value, index) => value !== Math.floor(frame.rendererCssSize[index] * frame.dpr))) return "backing dimensions disagree with renderer DPR"
    if (frame.transitionRemaining !== 0 || frame.schedulerPending !== 0 || frame.probeRendered !== true || frame.assetError !== null) return "camera or model work remains pending"
    if (!tuple(frame.cameraPosition, 3) || !tuple(frame.cameraTarget, 3) || !tuple(frame.cameraClip, 2) ||
      frame.cameraClip[0] <= 0 || frame.cameraClip[1] <= frame.cameraClip[0] ||
      frame.cameraPosition.every((value, index) => value === frame.cameraTarget[index]) ||
      !Number.isFinite(frame.cameraAspect) || frame.cameraAspect <= 0 ||
      Math.abs(frame.cameraAspect - frame.rendererCssSize[0] / frame.rendererCssSize[1]) > 1e-6) return "invalid or incoherent camera"
    if (frame.cameraProjection === "perspective") {
      if (!Number.isFinite(frame.cameraFov) || frame.cameraFov! <= 0 || frame.cameraFov! >= 180 || frame.cameraFrustum !== null) return "invalid perspective projection"
    } else if (frame.cameraProjection === "orthographic") {
      const frustum = frame.cameraFrustum
      if (!tuple(frustum, 4) || frustum[1] <= frustum[0] || frustum[2] <= frustum[3] || frame.cameraFov !== null ||
        Math.abs((frustum[1] - frustum[0]) / (frustum[2] - frustum[3]) - frame.cameraAspect) > 1e-6) return "invalid orthographic projection"
    } else return "unknown camera projection"
    return null
  }
  const signature = ({ frame, box, parentBox, backing }: FacilityPickSnapshot) => JSON.stringify({
    box, parentBox, backing, rendererCssSize: frame.rendererCssSize, dpr: frame.dpr,
    projection: frame.cameraProjection, fov: frame.cameraFov, aspect: frame.cameraAspect,
    frustum: frame.cameraFrustum, clip: frame.cameraClip, position: frame.cameraPosition, target: frame.cameraTarget,
  })
  return new Promise((resolve, reject) => {
    let animationFrame = 0, consecutive = 0, previous = "", last: FacilityPickSnapshot | null = null
    let lastIssue = "no animation-frame sample", settled = false
    const cleanup = () => { clearTimeout(timer); cancelAnimationFrame(animationFrame) }
    const fail = () => {
      if (settled) return
      settled = true; cleanup()
      reject(new Error(`Facility pick readiness timed out after ${timeoutMs}ms: ${lastIssue}; last snapshot: ${JSON.stringify(last)}`))
    }
    const timer = setTimeout(fail, timeoutMs)
    const tick = () => {
      if (settled) return
      if (performance.now() - started >= timeoutMs) { fail(); return }
      try {
        const read = (element as unknown as { __gnFacilitySnapshot?: () => FacilityPickCamera }).__gnFacilitySnapshot
        if (!read || !element.parentElement) throw new Error("public diagnostics or canvas parent unavailable")
        // One synchronous sample: never combine a camera read with a later
        // Playwright boundingBox call across a pending ResizeObserver delivery.
        const frame = read(), box = rect(element.getBoundingClientRect()), parentBox = rect(element.parentElement.getBoundingClientRect())
        last = { frame, box, parentBox, backing: [element.width, element.height], connected: element.isConnected, ready: element.getAttribute("data-ready") === "true" }
        const problem = issue(last), current = problem ? "" : signature(last)
        consecutive = problem ? 0 : current === previous ? consecutive + 1 : 1
        previous = current
        lastIssue = problem ?? "camera and geometry have not remained stable for three animation frames"
        if (consecutive >= requiredFrames) { settled = true; cleanup(); resolve(last); return }
      } catch (error) { consecutive = 0; previous = ""; lastIssue = String(error) }
      animationFrame = requestAnimationFrame(tick)
    }
    animationFrame = requestAnimationFrame(tick)
  })
}
