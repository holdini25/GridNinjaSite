import assert from "node:assert/strict"
import { assertCompleteTransfer, settleTransfers } from "../facility/performance-contract.mjs"
import { assertCinematicMotion } from "./motion-evidence.mjs"

/** Browser-side observer: retain callback scheduling and native presentation
 * timestamps separately. Visibility observation must not force layout every frame. */
export function observeCinematicLoop(video) {
  return new Promise((accept, reject) => {
    const started = performance.now(), duration = video.duration
    let frames = 0, elapsedMedia = 0, previous = null, previousWall = started, callback = 0, waitingEvents = 0, finished = false
    const intervals = [], waitingEpisodes = [], loopBoundaries = [], nativeFrames = [], qualityStart = video.getVideoPlaybackQuality?.()
    let observer = null
    const waiting = () => {
      waitingEvents++
      waitingEpisodes.push({ startMs: performance.now() - started, endMs: null, mediaTime: video.currentTime, seeking: video.seeking, buffered: Array.from({ length: video.buffered.length }, (_, index) => [video.buffered.start(index), video.buffered.end(index)]) })
    }
    const playing = () => {
      const episode = waitingEpisodes.at(-1)
      if (episode && episode.endMs === null) episode.endMs = performance.now() - started
    }
    const visibility = () => { if (document.visibilityState !== "visible") done(new Error("Cinematic loop was not continuously visible and playing")) }
    const paused = () => done(new Error("Cinematic loop was not continuously visible and playing"))
    const timeout = setTimeout(() => done(new Error("No complete visible cinematic loop before deadline")), (duration + 15) * 1000)
    const done = error => {
      if (finished) return
      finished = true
      clearTimeout(timeout); video.cancelVideoFrameCallback?.(callback); observer?.disconnect()
      video.removeEventListener("waiting", waiting); video.removeEventListener("playing", playing); video.removeEventListener("pause", paused)
      document.removeEventListener("visibilitychange", visibility)
      if (error) { reject(error); return }
      const quality = video.getVideoPlaybackQuality?.(), sorted = [...intervals].sort((a, b) => a - b)
      accept({ durationSeconds: duration, elapsedSeconds: (performance.now() - started) / 1000, elapsedMediaSeconds: elapsedMedia, presentedCallbacks: frames, waitingEvents, waitingEpisodes, loopBoundaries,
        nativeFrames,
        nativeTimingBasis: "requestVideoFrameCallback browser timestamps; expectedDisplayTime is a compositor proxy, not physical display measurement. Skipped callback frames remain explicitly unobserved.",
        skippedCallbackFrames: nativeFrames.reduce((sum, frame, index) => index ? sum + Math.max(0, frame.presentedFrames - nativeFrames[index - 1].presentedFrames - 1) : sum, 0),
        callbackP95Ms: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)],
        callbackMaxMs: Math.max(...intervals),
        decodedFrames: quality && qualityStart ? quality.totalVideoFrames - qualityStart.totalVideoFrames : null,
        droppedFrames: quality && qualityStart ? quality.droppedVideoFrames - qualityStart.droppedVideoFrames : null,
      })
    }
    const tick = (now, metadata) => {
      if (finished) return
      // Register first so observer bookkeeping cannot leave a callback unarmed.
      callback = video.requestVideoFrameCallback(tick)
      const observedAt = performance.now()
      if (document.visibilityState !== "visible" || video.paused) { paused(); return }
      const sample = { callbackNowMs: now, observedAtMs: observedAt, mediaTime: metadata.mediaTime,
        expectedDisplayTimeMs: metadata.expectedDisplayTime, presentationTimeMs: metadata.presentationTime, presentedFrames: metadata.presentedFrames,
        observerLatenessMs: Math.max(0, observedAt - metadata.expectedDisplayTime), callbackTimestampLagMs: observedAt - now }
      nativeFrames.push(sample)
      const difference = previous === null ? 0 : sample.mediaTime - previous.mediaTime
      if (difference < -duration / 2) {
        const presentedFramesDelta = sample.presentedFrames - previous.presentedFrames
        loopBoundaries.push({ atMs: now - started, fromMediaTime: previous.mediaTime, toMediaTime: sample.mediaTime, callbackGapMs: now - previousWall,
          expectedDisplayGapMs: sample.expectedDisplayTimeMs - previous.expectedDisplayTimeMs,
          presentationGapMs: sample.presentationTimeMs - previous.presentationTimeMs, presentedFramesDelta,
          nativePresentationEvidence: presentedFramesDelta === 1 ? "consecutive-frame-observations" : "inconclusive-skipped-callback-frames",
          fromFrame: previous, toFrame: sample })
      }
      const delta = difference < -duration / 2 ? duration + difference : Math.max(0, difference)
      elapsedMedia += Math.max(0, delta); previous = sample
      intervals.push(now - previousWall); previousWall = now; frames++
      if (elapsedMedia >= duration && waitingEpisodes.every(episode => episode.endMs !== null)) done()
    }
    if (!(duration >= 8 && duration <= 12.001) || typeof video.requestVideoFrameCallback !== "function" || typeof IntersectionObserver !== "function") { done(new Error("Missing native cinematic frame or visibility evidence")); return }
    const rect = video.getBoundingClientRect()
    const visibleWidth = Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left))
    const visibleHeight = Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top))
    if (document.visibilityState !== "visible" || video.paused || rect.width * rect.height <= 0 || visibleWidth * visibleHeight < rect.width * rect.height * .25) { paused(); return }
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => !entry.isIntersecting || entry.intersectionRatio < .25)) paused()
    }, { threshold: [0, .25] })
    observer.observe(video)
    video.addEventListener("waiting", waiting); video.addEventListener("playing", playing); video.addEventListener("pause", paused)
    document.addEventListener("visibilitychange", visibility)
    callback = video.requestVideoFrameCallback(tick)
  })
}

/** The home movie is qualified separately from the demo's renderer. A decoded
 * still, play() promise or canplay event can never stand in for a visible loop. */
export async function measureCinematicPage(page, ledger, { identity, profile }) {
  await page.bringToFront()
  const stage = page.getByTestId("cinematic-facility")
  await stage.locator(".cinematic-stage").scrollIntoViewIfNeeded()
  await stage.locator("img").evaluate(image => image.decode())
  const selected = identity.buildSettings.cinematic
  assert.equal(await stage.getAttribute("data-release"), selected.selectedRelease, "Served cinematic release differs from build")
  if (selected.mode === "poster") {
    const transfer = await settleTransfers(ledger)
    assertCompleteTransfer(transfer, { route: "/", profile, buildSettings: identity.buildSettings })
    assert(!transfer.requests.some(item => /\.(mp4|glb)(?:\?|$)/.test(item.url)), "Poster mode acquired motion assets")
    return { kind: "cinematic", status: "fallback", reason: "configured-poster", transfer, throughReady: true, release: selected.selectedRelease }
  }
  await page.waitForFunction(() => {
    const root = document.querySelector('[data-testid="cinematic-facility"]')
    return root?.getAttribute("data-state") === "playing" && root.getAttribute("data-frame-evidence") === "presented-frame"
  }, null, { timeout: 18_000 })
  const motion = await stage.locator("video").evaluate(observeCinematicLoop)
  const first = await stage.evaluate(root => ({ rendition: root.dataset.rendition, posterReadyMs: Number(root.dataset.posterReadyMs), firstFrameMs: Number(root.dataset.firstFrameMs), posterPaintMs: window.__cinematicPosterPaint ?? null, visibleFrame: window.__cinematicVisibleFrame ?? null }))
  assert(Number.isFinite(first.posterReadyMs) && first.posterReadyMs > 0 && Number.isFinite(first.firstFrameMs) && first.firstFrameMs >= first.posterReadyMs, "Missing first-frame timing evidence")
  // A native loop emits seeking/waiting even with the whole movie buffered.
  // Preserve those events and accept only short, observed continuous boundaries.
  let motionValidation
  try { motionValidation = assertCinematicMotion(motion) }
  catch (error) { error.cinematicEvidence = { first, motion }; throw error }
  assert(first.visibleFrame?.observedAtMs > 0, "Missing native callback after the video became visible")
  const transfer = await settleTransfers(ledger)
  assertCompleteTransfer(transfer, { route: "/", profile, buildSettings: identity.buildSettings })
  const videos = new Set(transfer.requests.filter(item => /\.mp4(?:\?|$)/.test(item.url)).map(item => item.url))
  assert.equal(videos.size, 1, "Cinematic home must acquire exactly one video rendition")
  assert(!transfer.requests.some(item => /\.glb(?:\?|$)/.test(item.url)), "Cinematic home acquired a model")
  await stage.getByRole("button", { name: "Pause facility animation", exact: true }).click()
  const before = await stage.locator("video").evaluate(video => ({ time: video.currentTime, paused: video.paused }))
  await page.waitForTimeout(500)
  const after = await stage.locator("video").evaluate(video => ({ time: video.currentTime, paused: video.paused }))
  assert(before.paused && after.paused && Math.abs(after.time - before.time) < .001, "Pause did not settle cinematic motion")
  return { kind: "cinematic", status: "active", transfer, throughReady: true, release: selected.selectedRelease, first: { ...first, decodedPosterToFirstFrameMs: first.firstFrameMs - first.posterReadyMs, posterPaintToVisibleFrameMs: first.posterPaintMs > 0 ? Math.max(first.visibleFrame.observedAtMs, first.visibleFrame.expectedDisplayTimeMs) - first.posterPaintMs : null, posterPaintBasis: first.posterPaintMs > 0 ? "Element Timing image renderTime; same-origin poster" : "unavailable", timingBasis: "First native callback observed with opacity 1 and at least 25% visible; compositor expected display time is a browser proxy, not physical display measurement. Decode-to-first-callback recorded separately." }, motion, motionValidation, pause: { before, after } }
}
