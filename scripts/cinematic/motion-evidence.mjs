import assert from "node:assert/strict"

export const CINEMATIC_MOTION_LIMITS = Object.freeze({
  durationSeconds: 10, fps: 30, minimumPresentedCallbacks: 120,
  maximumCallbackGapMs: 101, maximumBoundaryGapMs: 2000 / 30 + 1,
  maximumLoopSeekMs: 2000 / 30 + 1, maximumLoopSeekMediaTime: 1 / 30,
  timestampToleranceSeconds: 1e-6,
})
const nonnegative = value => Number.isFinite(value) && value >= 0

/** A native loop may emit `waiting` while seeking through already-buffered
 * frames. Accept that event only when its raw timings prove a bounded loop
 * transition. This never substitutes events for actual frame callbacks. */
export function assertCinematicMotion(motion) {
  const limits = CINEMATIC_MOTION_LIMITS, epsilon = limits.timestampToleranceSeconds
  assert(motion && nonnegative(motion.durationSeconds) && Math.abs(motion.durationSeconds - limits.durationSeconds) <= epsilon, "Cinematic motion requires the declared ten-second loop")
  assert(nonnegative(motion.elapsedMediaSeconds) && motion.elapsedMediaSeconds >= motion.durationSeconds, "No complete active cinematic loop")
  assert(Number.isInteger(motion.presentedCallbacks) && motion.presentedCallbacks >= limits.minimumPresentedCallbacks, "Too few actual video frame observations")
  assert(nonnegative(motion.callbackMaxMs) && motion.callbackMaxMs > 0 && motion.callbackMaxMs <= limits.maximumCallbackGapMs, "Cinematic callback gap exceeds its limit")
  assert(Number.isInteger(motion.waitingEvents) && motion.waitingEvents >= 0 && Array.isArray(motion.waitingEpisodes) && motion.waitingEvents === motion.waitingEpisodes.length, "Cinematic waiting event/episode counts disagree")
  assert(Array.isArray(motion.loopBoundaries) && motion.loopBoundaries.length > 0, "Missing observed cinematic loop boundary")
  let previousBoundary = -1
  for (const boundary of motion.loopBoundaries) {
    assert(nonnegative(boundary.atMs) && boundary.atMs > previousBoundary, "Invalid cinematic boundary timing")
    previousBoundary = boundary.atMs
    assert(nonnegative(boundary.fromMediaTime) && boundary.fromMediaTime >= motion.durationSeconds - limits.maximumBoundaryGapMs / 1000 && boundary.fromMediaTime <= motion.durationSeconds + epsilon && nonnegative(boundary.toMediaTime) && boundary.toMediaTime <= limits.maximumLoopSeekMediaTime + epsilon, "Observed cinematic boundary is not an end-to-start transition")
    assert(nonnegative(boundary.callbackGapMs) && boundary.callbackGapMs > 0 && boundary.callbackGapMs <= limits.maximumBoundaryGapMs && boundary.callbackGapMs <= motion.callbackMaxMs + epsilon, "Cinematic loop boundary callback gap exceeds its limit")
  }
  const usedBoundaries = new Set(), toleratedLoopSeeks = []
  let previousEnd = -1
  for (const [episodeIndex, episode] of motion.waitingEpisodes.entries()) {
    assert(nonnegative(episode.startMs) && nonnegative(episode.endMs) && episode.endMs >= episode.startMs && episode.startMs >= previousEnd, "Unclosed or invalid cinematic waiting episode")
    previousEnd = episode.endMs
    const durationMs = episode.endMs - episode.startMs
    assert(durationMs <= limits.maximumLoopSeekMs, "Cinematic waiting episode exceeds the bounded loop-seek limit")
    assert(episode.seeking === true && nonnegative(episode.mediaTime) && episode.mediaTime <= limits.maximumLoopSeekMediaTime + epsilon, "Cinematic waiting was not a seek at loop start")
    assert(Array.isArray(episode.buffered) && episode.buffered.length > 0 && episode.buffered.every(range => Array.isArray(range) && range.length === 2 && nonnegative(range[0]) && nonnegative(range[1]) && range[1] >= range[0]), "Invalid cinematic buffered-range evidence")
    assert(episode.buffered.some(([start, end]) => start <= epsilon && end >= motion.durationSeconds - epsilon), "Cinematic waiting occurred without the entire loop already buffered")
    const boundaryIndex = motion.loopBoundaries.findIndex((boundary, index) => !usedBoundaries.has(index) && Math.abs(boundary.atMs - episode.startMs) <= limits.maximumBoundaryGapMs)
    assert(boundaryIndex !== -1, "Cinematic waiting has no corresponding observed loop boundary")
    usedBoundaries.add(boundaryIndex)
    toleratedLoopSeeks.push({ episodeIndex, boundaryIndex, durationMs, boundaryOffsetMs: motion.loopBoundaries[boundaryIndex].atMs - episode.startMs })
  }
  return {
    classification: motion.waitingEvents ? "bounded-buffered-loop-seek" : "continuous-without-waiting",
    rawCounts: { presentedCallbacks: motion.presentedCallbacks, waitingEvents: motion.waitingEvents, waitingEpisodes: motion.waitingEpisodes.length, loopBoundaries: motion.loopBoundaries.length },
    toleratedLoopSeeks, limits,
  }
}
