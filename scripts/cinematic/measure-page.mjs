import assert from "node:assert/strict"
import { assertCompleteTransfer, settleTransfers } from "../facility/performance-contract.mjs"
import { assertCinematicMotion } from "./motion-evidence.mjs"

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
  const motion = await stage.locator("video").evaluate(video => new Promise((accept, reject) => {
    const started = performance.now(), duration = video.duration
    let frames = 0, elapsedMedia = 0, previousTime = null, previousWall = started, callback = 0, waitingEvents = 0
    const intervals = [], waitingEpisodes = [], loopBoundaries = [], qualityStart = video.getVideoPlaybackQuality?.()
    const waiting = () => {
      waitingEvents++
      waitingEpisodes.push({ startMs: performance.now() - started, endMs: null, mediaTime: video.currentTime, seeking: video.seeking, buffered: Array.from({ length: video.buffered.length }, (_, index) => [video.buffered.start(index), video.buffered.end(index)]) })
    }
    const playing = () => {
      const episode = waitingEpisodes.at(-1)
      if (episode && episode.endMs === null) episode.endMs = performance.now() - started
    }
    video.addEventListener("waiting", waiting)
    video.addEventListener("playing", playing)
    const timeout = setTimeout(() => done(new Error("No complete visible cinematic loop before deadline")), (duration + 15) * 1000)
    const done = error => {
      clearTimeout(timeout); video.cancelVideoFrameCallback?.(callback); video.removeEventListener("waiting", waiting); video.removeEventListener("playing", playing)
      if (error) { reject(error); return }
      const quality = video.getVideoPlaybackQuality?.(), sorted = [...intervals].sort((a, b) => a - b)
      accept({ durationSeconds: duration, elapsedSeconds: (performance.now() - started) / 1000, elapsedMediaSeconds: elapsedMedia, presentedCallbacks: frames, waitingEvents, waitingEpisodes, loopBoundaries,
        callbackP95Ms: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)],
        callbackMaxMs: Math.max(...intervals),
        decodedFrames: quality && qualityStart ? quality.totalVideoFrames - qualityStart.totalVideoFrames : null,
        droppedFrames: quality && qualityStart ? quality.droppedVideoFrames - qualityStart.droppedVideoFrames : null,
      })
    }
    const tick = (now, metadata) => {
      const rect = video.getBoundingClientRect()
      const visibleWidth = Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left))
      const visibleHeight = Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top))
      if (document.visibilityState !== "visible" || video.paused || visibleWidth * visibleHeight < rect.width * rect.height * .25) { done(new Error("Cinematic loop was not continuously visible and playing")); return }
      const difference = previousTime === null ? 0 : metadata.mediaTime - previousTime
      if (difference < -duration / 2) loopBoundaries.push({ atMs: now - started, fromMediaTime: previousTime, toMediaTime: metadata.mediaTime, callbackGapMs: now - previousWall })
      const delta = difference < -duration / 2 ? duration + difference : Math.max(0, difference)
      elapsedMedia += Math.max(0, delta); previousTime = metadata.mediaTime
      intervals.push(now - previousWall); previousWall = now; frames++
      if (elapsedMedia >= duration && waitingEpisodes.every(episode => episode.endMs !== null)) { done(); return }
      callback = video.requestVideoFrameCallback(tick)
    }
    if (!(duration >= 8 && duration <= 12.001) || typeof video.requestVideoFrameCallback !== "function") { done(new Error("Missing native cinematic frame evidence")); return }
    callback = video.requestVideoFrameCallback(tick)
  }))
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
