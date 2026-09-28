import type { FacilityQuality } from "@/types/facility"

export const QUALITY_DPR = { still: 1, economy: 1, balanced: 1.25, high: 1.5 } as const
const tiers: FacilityQuality[] = ["still", "economy", "balanced", "high"]
export type FramePolicySample = { interval: number; targetFps: number; cpu: number }
export type QualityTransition = { activeSeconds: number; reason: string; from: FacilityQuality | null; to: FacilityQuality }
export type FrameMeasurementWindow = { activeSeconds: number; samples: number; cursor: number; recentCount: number; recentCursor: number; evaluatedAt: number; windowStartedAt: number; frameP95: number | null; cpuP95: number | null }

/** A new quality tier must be judged using frames rendered at that tier. */
export function resetFrameMeasurementWindow(state: FrameMeasurementWindow) {
  state.samples = state.cursor = state.recentCount = state.recentCursor = 0
  state.frameP95 = state.cpuP95 = null
  state.evaluatedAt = state.windowStartedAt = state.activeSeconds
}

/** Diagnostic capability probes bypass automatic quality fallback, never user preferences. */
export function equipmentMotionAllowed(enabled: boolean, paused: boolean, reducedMotion: boolean, quality: FacilityQuality, capability: 30 | 60 | null, readingHold = false) {
  return enabled && !paused && !reducedMotion && !readingHold && (quality !== "still" || capability !== null)
}

export function createQualityHistory() {
  const entries: QualityTransition[] = []
  return {
    record(entry: QualityTransition) { if (entries.length === 32) entries.shift(); entries.push(entry) },
    snapshot() { return entries.map(entry => ({ ...entry })) },
  }
}

/** Weight a long stall by every requested display slot it lost, not as one slow sample. */
export function missedFrameSlotRatio(samples: readonly FramePolicySample[]): number {
  let expected = 0, missed = 0
  for (const sample of samples) {
    if (sample.interval <= 0) continue
    const slots = Math.max(1, Math.round(sample.interval * sample.targetFps / 1000))
    expected += slots; missed += slots - 1
  }
  return expected ? missed / expected : 0
}

/** Cadence-aware bounded controller. Deliberate 30 fps is never interpreted as a slow 60 fps frame. */
export function createQualityPolicy(desktop: boolean, onChange: (tier: FacilityQuality, reason: string) => void) {
  let tier: FacilityQuality = desktop ? "balanced" : "economy"
  let good = 0, bad = 0, cooldown = 0
  const maximum = desktop ? 3 : 2
  return {
    get tier() { return tier },
    retry() { tier = desktop ? "balanced" : "economy"; good = bad = 0; cooldown = 30; onChange(tier, "explicit-motion-retry") },
    evaluate(samples: readonly FramePolicySample[], seconds: number) {
      if (!samples.length || tier === "still") return
      const missed = missedFrameSlotRatio(samples)
      const severe = samples.filter(sample => sample.interval > 100).length >= 3 || missed > .2
      cooldown = Math.max(0, cooldown - seconds)
      bad = missed > .1 ? bad + 1 : 0
      good = missed < .01 && !samples.some(sample => sample.interval > 100) ? good + seconds : 0
      if (severe || bad >= 2) {
        tier = tiers[Math.max(0, tiers.indexOf(tier) - 1)]; cooldown = 30; bad = good = 0
        onChange(tier, severe ? "sustained-frame-overload" : "missed-frame-deadlines")
      } else if (!cooldown && good >= 30 && tiers.indexOf(tier) < maximum) {
        tier = tiers[tiers.indexOf(tier) + 1]; good = 0; cooldown = 30
        onChange(tier, "stable-visible-performance")
      }
    },
  }
}

export type FrameClock = { now: () => number; raf: (callback: (time: number) => void) => number; cancelRaf: (id: number) => void; timer: (callback: () => void, delay: number) => number; cancelTimer: (id: number) => void }
export type ScheduledFrame = { activeSeconds: number; delta: number; interval: number; targetFps: number }

/** One RAF owner. Gate draws against a display-aligned deadline instead of racing a
 * timer against the next refresh slot. Only accepted visible frames advance time. */
export function createFrameScheduler(clock: FrameClock, draw: (frame: ScheduledFrame) => void) {
  let visible = false, moving = false, fps = 30, activeSeconds = 0, previous: number | null = null
  let raf: number | null = null, nextDue: number | null = null, closed = false, dirty = true
  let previousRaf: number | null = null, refreshInterval = 0
  let requests = 0
  const frame: ScheduledFrame = { activeSeconds: 0, delta: 0, interval: 0, targetFps: 30 }
  const cancel = () => { if (raf !== null) clock.cancelRaf(raf); raf = null }
  function onFrame(time: number) {
    raf = null
    if (closed || !visible) return
    if (previousRaf !== null && time > previousRaf) {
      const observed = Math.min(time - previousRaf, 1000 / 30)
      refreshInterval = refreshInterval === 0 ? observed : refreshInterval + (Math.min(observed, refreshInterval * 1.5) - refreshInterval) * .1
    }
    previousRaf = time
    // Choose the nearer refresh slot. ProMotion timestamps can vary by >1ms:
    // rejecting the slightly early slot creates an avoidable25ms/8ms draw pair.
    // The deadline still advances at the requested cadence; measured time is raw.
    const refreshSlack = Math.max(.5, Math.min(250 / fps, refreshInterval / 2))
    if (moving && nextDue !== null && time < nextDue - refreshSlack) { schedule(); return }
    const interval = previous === null ? 0 : Math.max(0, time - previous)
    const delta = moving && previous !== null ? interval / 1000 : 0
    previous = moving ? time : null
    if (moving) {
      const period = 1000 / fps
      nextDue = nextDue === null ? time + period : nextDue + period
      // A delayed callback gets one draw, never a burst to repay missed frames.
      if (nextDue <= time + .5) nextDue = time + period
    } else nextDue = null
    activeSeconds += delta; dirty = false
    frame.activeSeconds = activeSeconds; frame.delta = delta; frame.interval = interval; frame.targetFps = fps
    draw(frame)
    schedule()
  }
  function schedule() {
    if (closed || !visible || raf !== null || (!moving && !dirty)) return
    requests++; raf = clock.raf(onFrame)
  }
  return {
    configure(next: { visible: boolean; moving: boolean; fps: number }) {
      const changed = visible !== next.visible || moving !== next.moving || fps !== next.fps
      if (visible !== next.visible || moving !== next.moving) { previous = previousRaf = null; refreshInterval = 0 }
      visible = next.visible; moving = next.moving; fps = next.fps
      if (changed) { cancel(); nextDue = null; dirty = true }
      schedule()
    },
    request() { dirty = true; schedule() },
    dispose() { closed = true; cancel() },
    get activeSeconds() { return activeSeconds },
    get requestCount() { return requests },
    get pendingCount() { return Number(raf !== null) },
  }
}

export function cappedDpr(tier: FacilityQuality, deviceDpr: number, width: number, height: number, pixelCap: number) {
  return Math.min(Math.max(.1, deviceDpr), QUALITY_DPR[tier], Math.sqrt(pixelCap / Math.max(1, width * height)))
}
