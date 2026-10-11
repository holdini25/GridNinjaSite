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

/** Match bounded renderer writes to the directly adjacent policy commit, in
 * either order. React's label commit need not share the renderer's 100ms batch.
 * With at most two groups/commits, candidate interval scans are bounded by 4N:
 * O(samples + mutations), without sorting, retries, or omitted raw samples. */
export function assessCanvasObservation(report: CanvasObservation, pixelBudgets: { desktopPixels: number; mobilePixels: number }) {
  const failures: string[] = [], transitions: { at: number; before: CanvasState; after: CanvasState }[] = []
  const correlationMs = 100, quietMs = 350 // correlationMs bounds writes within a group only.
  const samples = report.samples, last = samples.at(-1)
  const fail = (message: string) => { if (!failures.includes(message)) failures.push(message) }
  const sameGeometry = (a: CanvasState, b: CanvasState) => a.cssWidth === b.cssWidth && a.cssHeight === b.cssHeight
  const changed = (a: CanvasState, b: CanvasState) => a.quality !== b.quality || !sameGeometry(a, b)
  const sameBuffer = (a: CanvasState, b: CanvasState) => a.width === b.width && a.height === b.height
  const caps: Record<string, number> = { still: 1, economy: 1, balanced: 1.25, high: 1.5 }
  const policyDpr = (state: CanvasState) => {
    const cap = state.quality && Object.hasOwn(caps, state.quality) && caps[state.quality]
    if (!cap || state.cssWidth <= 0 || state.cssHeight <= 0) return null
    return Math.min(Math.max(.1, report.deviceDpr), cap, Math.sqrt((report.desktop ? pixelBudgets.desktopPixels : pixelBudgets.mobilePixels) / (state.cssWidth * state.cssHeight)))
  }
  const validPixels = (state: CanvasState) => {
    const dpr = policyDpr(state)
    return dpr !== null && state.width === Math.floor(state.cssWidth * dpr) && state.height === Math.floor(state.cssHeight * dpr)
  }
  let lastChange = 0
  const changes: { index: number; at: number }[] = []
  const groups: CanvasMutation[][] = [], writesBySample = new Map<number, CanvasMutation[]>()
  let initialReconciliation: { at: number; before: CanvasState; after: CanvasState } | null = null
  const result = () => {
    if (!last || last.at - lastChange < quietMs) fail("No uninterrupted350ms stable observation before the deadline")
    const windowStart = (last?.at ?? 0) - quietMs
    return { failures, transitions, initialReconciliation, correlationMs, maximumTransitionGroups: 2,
      strictWindow: { start: windowStart, end: last?.at ?? 0, duration: quietMs },
      diagnostics: { hook: last?.hook, framesAttribute: last?.framesAttribute,
        mutations: report.mutations.filter(mutation => mutation.at >= windowStart) } }
  }
  if (!last || samples.length < 2 || report.requestedDuration !== 3_000 || !Number.isFinite(report.duration) || report.duration < report.requestedDuration || last.at < report.requestedDuration) fail("Incomplete bounded observation")
  if (![report.deviceDpr, pixelBudgets.desktopPixels, pixelBudgets.mobilePixels].every(value => Number.isFinite(value) && value > 0) || typeof report.desktop !== "boolean") fail("Invalid pixel policy inputs")
  for (let index = 0; index < samples.length; index++) {
    const state = samples[index], previous = samples[index - 1]
    if (![state.at, state.x, state.y, state.cssWidth, state.cssHeight, state.width, state.height].every(Number.isFinite) ||
      state.at < 0 || state.at > report.duration || (previous && state.at < previous.at) ||
      state.cssWidth <= 0 || state.cssHeight <= 0 || !Number.isInteger(state.width) || state.width <= 0 || !Number.isInteger(state.height) || state.height <= 0 ||
      !state.quality || !Object.hasOwn(caps, state.quality)) fail("Malformed or unordered canvas observation")
    if (state.hook !== "undefined" || state.framesAttribute || !state.connected || !state.ready) fail("Diagnostic exposure or lost ready canvas during observation")
    if (previous && changed(previous, state)) {
      changes.push({ index, at: state.at })
      // Only economy/still's equivalent sizing policy can preserve the quiet
      // window. Count every commit for ownership/limits; other quality pairs,
      // changed origins, or merely identical floored pixels are not exempt.
      const equivalentPair = (previous.quality === "economy" && state.quality === "still") ||
        (previous.quality === "still" && state.quality === "economy")
      const labelOnly = equivalentPair && sameGeometry(previous, state) && sameBuffer(previous, state) &&
        previous.x === state.x && previous.y === state.y && validPixels(previous) && validPixels(state) && policyDpr(previous) === policyDpr(state)
      if (!labelOnly) lastChange = state.at
    }
    if (previous && !sameBuffer(previous, state)) lastChange = state.at
  }
  let previousMutation: CanvasMutation | undefined
  for (const mutation of report.mutations) {
    const sample = samples[mutation.sample]
    if (!Number.isFinite(mutation.at) || !Number.isInteger(mutation.sample) || mutation.sample < 1 || !sample || mutation.at !== sample.at ||
      (previousMutation && (mutation.at < previousMutation.at || mutation.sample < previousMutation.sample))) fail("Malformed or unordered canvas observation")
    if (mutation.name !== "width" && mutation.name !== "height") fail("Unexplained or sustained canvas mutations")
    const sampleWrites = writesBySample.get(mutation.sample) ?? []
    sampleWrites.push(mutation); writesBySample.set(mutation.sample, sampleWrites)
    const group = groups.at(-1)
    if (group && mutation.at - group.at(-1)!.at <= correlationMs) group.push(mutation)
    else groups.push([mutation])
    previousMutation = mutation
    lastChange = Math.max(lastChange, mutation.at)
  }
  if (groups.length > 2 || changes.length > 2) fail("Sustained or repeated canvas/quality/layout changes")
  for (const group of groups) if (group.length > 4 || group.at(-1)!.at - group[0].at > correlationMs) fail("Unexplained or sustained canvas mutations")
  if (failures.length) return result()

  // MutationObserver reports the final attribute value for every record in a
  // callback. The next same-attribute oldValue reveals an intermediate write.
  // Batches are already limited to four records, so this lookahead is bounded.
  const current = { width: samples[0].width, height: samples[0].height }
  const writtenValues = new Map<CanvasMutation, string | null>()
  for (let index = 1; index < samples.length; index++) {
    const writes = writesBySample.get(index) ?? [], state = samples[index]
    for (let position = 0; position < writes.length; position++) {
      const mutation = writes[position], dimension = mutation.name as "width" | "height"
      const next = writes.slice(position + 1).find(write => write.name === dimension)
      const written = next ? next.oldValue : mutation.value
      writtenValues.set(mutation, written)
      if (mutation.oldValue !== String(current[dimension]) || mutation.value !== String(state[dimension]) ||
        written === null || !Number.isInteger(Number(written)) || Number(written) <= 0 || String(Number(written)) !== written) fail("Canvas writes do not match the observed quality/layout resize")
      current[dimension] = Number(written)
    }
    if (current.width !== state.width || current.height !== state.height) fail("Unrecorded canvas dimension change")
  }
  const explained = new Set<number>(), usedChanges = new Set<number>()
  if (!validPixels(samples[0]) && changes.length) {
    const change = changes[0], after = samples[change.index], before = samples[0]
    // Only a directly observed QUALITY commit can settle an already-resized
    // entry buffer. A layout change or any intervening write is not evidence.
    if (before.quality !== after.quality && sameGeometry(before, after) && sameBuffer(before, after) && validPixels(after) &&
      (!groups.length || groups[0][0].sample > change.index)) {
      let reconciles = true
      for (let index = 0; index < change.index; index++) if (changed(before, samples[index]) || !sameBuffer(before, samples[index])) reconciles = false
      if (reconciles) {
        for (let index = 0; index < change.index; index++) explained.add(index)
        usedChanges.add(0); initialReconciliation = { at: after.at, before, after }
      }
    }
  }
  let changeCursor = 0
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex], first = group[0], final = group.at(-1)!
    while (changeCursor < changes.length && changes[changeCursor].index < first.sample) changeCursor++
    const inside = changeCursor < changes.length && changes[changeCursor].index <= final.sample
    const candidates = inside ? [changeCursor] : [changeCursor - 1, changeCursor]
    const matches: { changeIndex: number; start: number; end: number; before: CanvasState; after: CanvasState }[] = []
    for (const changeIndex of candidates) {
      const change = changes[changeIndex]
      if (!change) continue
      const start = Math.min(change.index, first.sample), end = Math.max(change.index, final.sample)
      // One policy change and one mutation group, with no skipped intervening event.
      if ((changes[changeIndex - 1]?.index ?? -1) >= start || (changes[changeIndex + 1]?.index ?? Infinity) <= end ||
        (groups[groupIndex - 1]?.at(-1)?.sample ?? -1) >= start || (groups[groupIndex + 1]?.[0].sample ?? Infinity) <= end) continue
      const before = samples[start - 1], after = samples[end]
      if (!before || !validPixels(before) || !validPixels(after) || sameBuffer(before, after)) continue
      let matchesPolicy = true
      for (let index = start; index <= end; index++) {
        const state = samples[index], policy = index < change.index ? before : after
        if (changed(state, policy)) matchesPolicy = false
        if (index < first.sample && !sameBuffer(state, before)) matchesPolicy = false
        if (index >= final.sample && !sameBuffer(state, after)) matchesPolicy = false
        if (![before.width, after.width].includes(state.width) || ![before.height, after.height].includes(state.height)) matchesPolicy = false
      }
      for (const mutation of group) {
        const dimension = mutation.name as "width" | "height"
        // Every write must set its final policy value, including duplicate
        // renderer writes. Old values may only be the pre/post policy values.
        if (![String(before[dimension]), String(after[dimension])].includes(mutation.oldValue ?? "") ||
          writtenValues.get(mutation) !== String(after[dimension])) matchesPolicy = false
      }
      if (matchesPolicy) matches.push({ changeIndex, start, end, before, after })
    }
    if (matches.length !== 1 || usedChanges.has(matches[0].changeIndex)) {
      fail("Unexplained or ambiguous canvas transition ownership"); continue
    }
    const match = matches[0]
    usedChanges.add(match.changeIndex)
    for (let index = match.start; index <= match.end; index++) explained.add(index)
    transitions.push({ at: changes[match.changeIndex].at, before: match.before, after: match.after })
  }
  for (let index = 0; index < samples.length; index++) if (!validPixels(samples[index]) && !explained.has(index)) fail("Invalid stable canvas pixel policy or unresolved transition")
  if (!last || !validPixels(last)) fail("Invalid final canvas pixel policy")
  return result()
}
