import type { FacilityRenderProfile } from "@/types/facility"

/** Small reproducible PRNG: animation never depends on wall time or Math.random. */
export function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let word = value
    word = Math.imul(word ^ word >>> 15, word | 1)
    word ^= word + Math.imul(word ^ word >>> 7, word | 61)
    return ((word ^ word >>> 14) >>> 0) / 4294967296
  }
}

export function createLedActivity(count: number, profile: NonNullable<FacilityRenderProfile["engineering"]>) {
  const random = seededRandom(profile.seed)
  const starts = new Float64Array(count).fill(-Infinity), ends = new Float64Array(count).fill(-Infinity)
  // Four anchors per rack: three activity indicators and one steady status lamp.
  const bag = new Uint16Array(Array.from({ length: count }, (_, index) => index).filter(index => index % 4 !== 3))
  const remainingByRack = new Uint8Array(Math.ceil(count / 4))
  const { activity } = profile
  let cursor = bag.length, previous = -1, nextEvent = activity.eventMs[0] / 1000
  const range = (pair: [number, number]) => pair[0] + (pair[1] - pair[0]) * random()
  const take = () => {
    if (cursor === bag.length) {
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); const value = bag[i]; bag[i] = bag[j]; bag[j] = value }
      cursor = 0
      remainingByRack.fill(0)
      for (const index of bag) remainingByRack[Math.floor(index / 4)]++
    }
    // Avoid the same rack on consecutive events, including shuffled-bag boundaries.
    for (let i = cursor; i < bag.length; i++) {
      const rack = Math.floor(bag[i] / 4), after = bag.length - cursor - 1
      if (bag[i] === previous || rack === Math.floor(previous / 4)) continue
      let feasible = true
      for (let other = 0; other < remainingByRack.length; other++) if (remainingByRack[other] - (other === rack ? 1 : 0) > (other === rack ? Math.floor(after / 2) : Math.ceil(after / 2))) feasible = false
      if (feasible) { const value = bag[cursor]; bag[cursor] = bag[i]; bag[i] = value; break }
    }
    previous = bag[cursor++]
    remainingByRack[Math.floor(previous / 4)]--
    return previous
  }
  return {
    sample(activeSeconds: number, moving: boolean, output: Float32Array) {
      if (output.length < count * 3) throw new Error("activity_buffer")
      if (moving && activeSeconds >= nextEvent && bag.length) {
        let active = 0
        for (let index = 0; index < count; index++) if (ends[index] > activeSeconds) active++
        if (active < activity.maxPulses) { const index = take(); starts[index] = activeSeconds; ends[index] = activeSeconds + range(activity.pulseMs) / 1000 }
        // No catch-up bursts after a slow frame: one event per accepted frame.
        nextEvent = activeSeconds + range(activity.eventMs) / 1000
      }
      for (let index = 0; index < count; index++) {
        const duration = ends[index] - starts[index]
        const phase = moving && ends[index] > activeSeconds && duration > 0 ? (activeSeconds - starts[index]) / duration : -1
        const envelope = phase >= 0 ? Math.sin(Math.PI * phase) ** 2 : 0
        const strength = !moving || index % 4 === 3 ? activity.steady : activity.resting + envelope * (activity.peak - activity.resting)
        output[index * 3] = output[index * 3 + 1] = output[index * 3 + 2] = strength
      }
    },
  }
}

export function createRouteActivity(count: number, profile: NonNullable<FacilityRenderProfile["engineering"]>, ambientRoutes: readonly number[] = Array.from({ length: count }, (_, index) => index)) {
  const random = seededRandom(profile.seed ^ 0x349beef)
  const starts = new Float64Array(2).fill(-Infinity), routes = new Int16Array(2).fill(-1)
  const interval = () => { const [low, high] = profile.activity.ambientTraceSeconds; return low + random() * (high - low) }
  let next = interval(), selectedNext = 0, immediate = false
  let selected: readonly number[] = [], preview: readonly number[] = []
  const begin = (seconds: number, eligible: readonly number[]) => {
    if (!eligible.length) return
    let slot = -1
    for (let i = 0; i < 2; i++) if (seconds >= starts[i] + 1.5) { slot = i; break }
    if (slot < 0) return
    const offset = Math.floor(random() * eligible.length)
    for (let i = 0; i < eligible.length; i++) {
      const candidate = eligible[(offset + i) % eligible.length]
      if (candidate < 0 || candidate >= count || routes.some((route, index) => route === candidate && seconds < starts[index] + 1.5)) continue
      routes[slot] = candidate; starts[slot] = seconds; return
    }
  }
  return {
    focus(nextSelected: readonly number[], nextPreview: readonly number[]) {
      const changed = nextSelected.length !== selected.length || nextPreview.length !== preview.length || nextSelected.some((value, index) => selected[index] !== value) || nextPreview.some((value, index) => preview[index] !== value)
      selected = nextSelected; preview = nextPreview; immediate ||= changed && (selected.length > 0 || preview.length > 0)
    },
    sample(seconds: number, moving: boolean, _selectedRoutes: readonly number[], output: Float32Array) {
      output.fill(-1)
      if (!moving || !count) return
      if (immediate) { begin(seconds, preview.length ? preview : selected); immediate = false; selectedNext = seconds + 1.5 + profile.activity.selectedTraceQuietSeconds }
      if (selected.length && seconds >= selectedNext) { begin(seconds, selected); selectedNext = seconds + 1.5 + profile.activity.selectedTraceQuietSeconds }
      if (!selected.length && !preview.length && seconds >= next) { begin(seconds, ambientRoutes); next = seconds + interval() }
      for (let i = 0; i < 2; i++) if (routes[i] >= 0 && seconds < starts[i] + 1.5) output[routes[i]] = (seconds - starts[i]) / 1.5
    },
  }
}
