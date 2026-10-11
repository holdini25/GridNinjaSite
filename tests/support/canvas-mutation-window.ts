type CanvasState = {
  at: number; quality: string | null; x: number; y: number; cssWidth: number; cssHeight: number
  width: number; height: number; hook: string; framesAttribute: boolean; connected: boolean; ready: boolean
}
type CanvasMutation = { at: number; sample: number; name: string | null; oldValue: string | null; value: string | null }
export type CanvasObservation = {
  duration: number; requestedDuration: number; deviceDpr: number; desktop: boolean
  samples: CanvasState[]; mutations: CanvasMutation[]
}

/** Passed directly to locator.evaluate: read-only and self-contained. The full
 * bounded observation is retained, including startup writes and every RAF. */
export async function observeProductionCanvas(element: HTMLCanvasElement): Promise<CanvasObservation> {
  const inspector = element.closest('[data-testid="facility-inspection"]')!
  const start = performance.now(), requestedDuration = 3_000
  const samples: CanvasState[] = [], mutations: CanvasMutation[] = []
  const sample = () => {
    const rect = element.getBoundingClientRect()
    samples.push({ at: performance.now() - start, quality: inspector.getAttribute("data-quality"), x: rect.x, y: rect.y,
      cssWidth: rect.width, cssHeight: rect.height, width: element.width, height: element.height,
      hook: typeof element.__gnFacilitySnapshot, framesAttribute: element.hasAttribute("data-frames"),
      connected: element.isConnected && inspector.contains(element), ready: inspector.getAttribute("data-phase") === "ready" && element.getAttribute("data-ready") === "true" })
    return samples.length - 1
  }
  sample()
  const record = (records: MutationRecord[]) => {
    const index = sample()
    for (const record of records) if (record.target === element) mutations.push({ at: samples[index].at, sample: index, name: record.attributeName, oldValue: record.oldValue, value: element.getAttribute(record.attributeName!) })
  }
  const observer = new MutationObserver(record)
  observer.observe(element, { attributes: true, attributeOldValue: true })
  observer.observe(inspector, { attributes: true, attributeFilter: ["data-quality", "data-phase"] })
  let frame = 0
  const tick = () => { sample(); frame = requestAnimationFrame(tick) }
  frame = requestAnimationFrame(tick)
  try {
    // This timer bounds active observation; it is not a pre-observation sleep.
    await new Promise(resolve => setTimeout(resolve, requestedDuration))
    record(observer.takeRecords())
  } finally { observer.disconnect(); cancelAnimationFrame(frame) }
  return { duration: performance.now() - start, requestedDuration, deviceDpr: devicePixelRatio,
    desktop: matchMedia("(hover: hover) and (pointer: fine)").matches, samples, mutations }
}

/** Read-only startup correlation, never an exemption for arbitrary canvas
 * writes. Two finite DPR/layout transitions may precede the strict window;
 * every write must belong to an observed transition and match its pixel size. */
export function assessCanvasObservation(report: CanvasObservation, pixelBudgets: { desktopPixels: number; mobilePixels: number }) {
  const failures: string[] = [], transitions: { at: number; before: CanvasState; after: CanvasState }[] = []
  const correlationMs = 100, quietMs = 350
  const samples = report.samples, last = samples.at(-1)!
  const changed = (a: CanvasState, b: CanvasState) => a.quality !== b.quality || Math.abs(a.cssWidth - b.cssWidth) > .25 || Math.abs(a.cssHeight - b.cssHeight) > .25
  const caps: Record<string, number> = { still: 1, economy: 1, balanced: 1.25, high: 1.5 }
  const validPixels = (state: CanvasState) => {
    const cap = state.quality && caps[state.quality]
    if (!cap || state.cssWidth <= 0 || state.cssHeight <= 0) return false
    const dpr = Math.min(Math.max(.1, report.deviceDpr), cap, Math.sqrt((report.desktop ? pixelBudgets.desktopPixels : pixelBudgets.mobilePixels) / (state.cssWidth * state.cssHeight)))
    return state.width === Math.floor(state.cssWidth * dpr) && state.height === Math.floor(state.cssHeight * dpr)
  }
  if (!last || report.requestedDuration !== 3_000 || report.duration < report.requestedDuration) failures.push("Incomplete bounded observation")
  if (samples.some(state => state.hook !== "undefined" || state.framesAttribute || !state.connected || !state.ready)) failures.push("Diagnostic exposure or lost ready canvas during observation")
  const changes = samples.flatMap((state, index) => index && changed(samples[index - 1], state) ? [{ index, at: state.at }] : [])
  const groups: CanvasMutation[][] = []
  for (const mutation of report.mutations) {
    const group = groups.at(-1)
    if (group && mutation.at - group.at(-1)!.at <= correlationMs) group.push(mutation)
    else groups.push([mutation])
  }
  if (groups.length > 2 || changes.length > 2) failures.push("Sustained or repeated canvas/quality/layout changes")
  for (const group of groups) {
    const first = group[0], final = group.at(-1)!
    const correlated = changes.filter(change => Math.abs(change.at - first.at) <= correlationMs && Math.abs(change.at - final.at) <= correlationMs)
    if (group.length > 4 || final.at - first.at > correlationMs || group.some(mutation => mutation.name !== "width" && mutation.name !== "height") || correlated.length !== 1) {
      failures.push("Unexplained or sustained canvas mutations"); continue
    }
    const change = correlated[0]
    const before = samples[Math.max(0, Math.min(change.index, first.sample) - 1)]
    const after = samples.findLast(state => state.at <= Math.max(change.at, final.at) + correlationMs)!
    const unexplainedValue = group.some(mutation => {
      const dimension = mutation.name as "width" | "height"
      const allowed = [String(before[dimension]), String(after[dimension])]
      return !allowed.includes(mutation.oldValue ?? "") || !allowed.includes(mutation.value ?? "")
    })
    if (!changed(before, after) || !validPixels(before) || !validPixels(after) || unexplainedValue || (before.width === after.width && before.height === after.height)) {
      failures.push("Canvas writes do not match the observed quality/layout resize"); continue
    }
    transitions.push({ at: change.at, before, after })
  }
  const lastChange = Math.max(0, ...changes.map(change => change.at), ...report.mutations.map(mutation => mutation.at))
  if (!last || last.at - lastChange < quietMs) failures.push("No uninterrupted350ms stable observation before the deadline")
  const windowStart = (last?.at ?? 0) - quietMs
  const mutations = report.mutations.filter(mutation => mutation.at >= windowStart)
  return { failures, transitions, correlationMs, maximumTransitionGroups: 2, strictWindow: { start: windowStart, end: last?.at ?? 0, duration: quietMs },
    diagnostics: { hook: last?.hook, framesAttribute: last?.framesAttribute, mutations } }
}
