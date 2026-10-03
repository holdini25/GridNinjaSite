// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assertCinematicMotion, CINEMATIC_MOTION_LIMITS } from "../../../scripts/cinematic/motion-evidence.mjs"

// Captured on the actual native Chrome loop in qualification03. It emitted
// seeking/waiting with the full [0,10] buffer, then presented frame zero without
// a visible-length cadence gap. The failed zero-event probe is retained.
const diagnosed = () => ({
  durationSeconds: 10, elapsedMediaSeconds: 11.966667, presentedCallbacks: 360, callbackMaxMs: 50,
  waitingEvents: 1,
  waitingEpisodes: [{ startMs: 9991.39999999106, endMs: 9999.89999999106, mediaTime: 0, seeking: true, buffered: [[0, 10]] }],
  loopBoundaries: [{ atMs: 9995.799999991059, fromMediaTime: 9.966667, toMediaTime: 0, callbackGapMs: 33.29999999999927 }],
})

describe("cinematic loop evidence classification", () => {
  it("classifies the observed short, fully buffered native seek while retaining raw evidence and limits", () => {
    const motion = diagnosed(), result = assertCinematicMotion(motion)
    expect(result.classification).toBe("bounded-buffered-loop-seek")
    expect(result.rawCounts).toEqual({ presentedCallbacks: 360, waitingEvents: 1, waitingEpisodes: 1, loopBoundaries: 1 })
    expect(result.toleratedLoopSeeks).toHaveLength(1)
    expect(result.toleratedLoopSeeks[0]).toMatchObject({ episodeIndex: 0, boundaryIndex: 0, durationMs: 8.5 })
    expect(result.limits.maximumLoopSeekMs).toBeCloseTo(67.666667)
    expect(motion.waitingEvents).toBe(1)
  })
  it("accepts an observed full loop without waiting while still requiring frame and boundary evidence", () => {
    const motion = { ...diagnosed(), waitingEvents: 0, waitingEpisodes: [] }
    expect(assertCinematicMotion(motion)).toMatchObject({ classification: "continuous-without-waiting", toleratedLoopSeeks: [] })
  })
  it("rejects real starvation even when the waiting episode is short and near a loop", () => {
    const motion = diagnosed(); motion.waitingEpisodes[0].buffered = [[0, .2]]
    expect(() => assertCinematicMotion(motion)).toThrow("entire loop already buffered")
    motion.waitingEpisodes[0].buffered = [[0, 4], [4.01, 10]]
    expect(() => assertCinematicMotion(motion)).toThrow("entire loop already buffered")
  })
  it("rejects nonseeking, mid-clip and unclosed waiting", () => {
    const motion = diagnosed(); motion.waitingEpisodes[0].seeking = false
    expect(() => assertCinematicMotion(motion)).toThrow("not a seek")
    motion.waitingEpisodes[0].seeking = true; motion.waitingEpisodes[0].mediaTime = .2
    expect(() => assertCinematicMotion(motion)).toThrow("not a seek")
    const unclosed = { ...diagnosed(), waitingEpisodes: [{ ...diagnosed().waitingEpisodes[0], endMs: null }] }
    expect(() => assertCinematicMotion(unclosed)).toThrow("Unclosed")
  })
  it("rejects slow seeks, missing/distant boundaries and duplicate matching", () => {
    const slow = diagnosed(); slow.waitingEpisodes[0].endMs = slow.waitingEpisodes[0].startMs + CINEMATIC_MOTION_LIMITS.maximumLoopSeekMs + .01
    expect(() => assertCinematicMotion(slow)).toThrow("bounded loop-seek limit")
    const missing = diagnosed(); missing.loopBoundaries = []
    expect(() => assertCinematicMotion(missing)).toThrow("Missing observed")
    const distant = diagnosed(); distant.loopBoundaries[0].atMs += 100
    expect(() => assertCinematicMotion(distant)).toThrow("no corresponding")
    const duplicate = diagnosed(); duplicate.waitingEvents = 2; duplicate.waitingEpisodes.push({ ...duplicate.waitingEpisodes[0], startMs: 10000, endMs: 10001 })
    expect(() => assertCinematicMotion(duplicate)).toThrow("no corresponding")
  })
  it("rejects actual callback gaps independently of waiting events", () => {
    const gap = diagnosed(); gap.callbackMaxMs = 101.01
    expect(() => assertCinematicMotion(gap)).toThrow("callback gap")
    const boundary = diagnosed(); boundary.callbackMaxMs = 100; boundary.loopBoundaries[0].callbackGapMs = CINEMATIC_MOTION_LIMITS.maximumBoundaryGapMs + .01
    expect(() => assertCinematicMotion(boundary)).toThrow("boundary callback gap")
    const contradictory = diagnosed(); contradictory.loopBoundaries[0].callbackGapMs = 60
    expect(() => assertCinematicMotion(contradictory)).toThrow("boundary callback gap")
  })
  it("bounds the full compositor interval without averaging across a skipped callback", () => {
    const motion = diagnosed(); motion.callbackMaxMs = 83.4
    Object.assign(motion.loopBoundaries[0], {
      callbackGapMs: 83.4, fromMediaTime: 9.966667, toMediaTime: .033333,
      expectedDisplayGapMs: 66.7, presentedFramesDelta: 2,
      fromFrame: { expectedDisplayTimeMs: 10377.7, presentedFrames: 300, mediaTime: 9.966667 },
      toFrame: { expectedDisplayTimeMs: 10444.4, presentedFrames: 302, mediaTime: .033333 },
    })
    const result = assertCinematicMotion(motion)
    expect(result.boundaryTimings[0]).toMatchObject({ basis: "compositor-expected-display-endpoints", unobservedFrames: 1 })
    expect(result.boundaryTimings[0].gapMs).toBeCloseTo(66.7)
    expect(result.limits).toEqual(CINEMATIC_MOTION_LIMITS)
    const boundary = motion.loopBoundaries[0] as typeof motion.loopBoundaries[0] & { expectedDisplayGapMs: number; toFrame: { expectedDisplayTimeMs: number } }
    boundary.expectedDisplayGapMs = 80
    boundary.toFrame.expectedDisplayTimeMs = 10457.7
    expect(() => assertCinematicMotion(motion)).toThrow("boundary display gap")
  })
  it("rejects unsubstantiated compositor timing and retains the independent callback ceiling", () => {
    const native = () => {
      const motion = diagnosed(); motion.callbackMaxMs = 83.4
      Object.assign(motion.loopBoundaries[0], { callbackGapMs: 83.4, expectedDisplayGapMs: 50, presentedFramesDelta: 1,
        fromFrame: { expectedDisplayTimeMs: 10000, presentedFrames: 300, mediaTime: 9.966667 },
        toFrame: { expectedDisplayTimeMs: 10050, presentedFrames: 301, mediaTime: 0 } })
      return motion
    }
    const fabricated = native(); Object.assign(fabricated.loopBoundaries[0], { expectedDisplayGapMs: 20 })
    expect(() => assertCinematicMotion(fabricated)).toThrow("Contradictory native boundary display")
    const missing = native(); Object.assign(missing.loopBoundaries[0], { fromFrame: null })
    expect(() => assertCinematicMotion(missing)).toThrow("Missing native boundary")
    const counter = native(); Object.assign(counter.loopBoundaries[0], { presentedFramesDelta: 0 })
    expect(() => assertCinematicMotion(counter)).toThrow("frame counter")
    const stalled = native(); stalled.callbackMaxMs = 101.01
    expect(() => assertCinematicMotion(stalled)).toThrow("callback gap")
  })
  it("requires exact raw event counts, adequate observations and a full ten-second cycle", () => {
    expect(() => assertCinematicMotion({ ...diagnosed(), waitingEvents: 0 })).toThrow("counts disagree")
    expect(() => assertCinematicMotion({ ...diagnosed(), presentedCallbacks: 119 })).toThrow("Too few")
    expect(() => assertCinematicMotion({ ...diagnosed(), elapsedMediaSeconds: 9.9 })).toThrow("complete active")
    expect(() => assertCinematicMotion({ ...diagnosed(), durationSeconds: 9 })).toThrow("ten-second")
    expect(() => assertCinematicMotion({ ...diagnosed(), callbackMaxMs: NaN })).toThrow("callback gap")
    expect(() => assertCinematicMotion({ ...diagnosed(), loopBoundaries: [{ ...diagnosed().loopBoundaries[0], fromMediaTime: 5 }] })).toThrow("end-to-start")
  })
})
