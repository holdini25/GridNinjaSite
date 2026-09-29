import type { CinematicRelease } from "@/types/cinematic"

export type CinematicState = {
  phase: "poster" | "loading" | "playing" | "paused" | "suspended" | "blocked" | "error"
  reason: "initial" | "reduced-motion" | "save-data" | "user" | "offscreen" | "hidden" | "autoplay" | "network" | "decode" | "timeout" | "poster-unavailable" | "disabled" | "ready"
  frameReady: boolean
  frameEvidence: "none" | "presented-frame" | "advancing-clock"
  posterReadyMs: number | null
  firstFrameMs: number | null
  rendition: "desktop" | "mobile" | null
}
export const INITIAL_CINEMATIC_STATE: CinematicState = { phase: "poster", reason: "initial", frameReady: false, frameEvidence: "none", posterReadyMs: null, firstFrameMs: null, rendition: null }
export const CINEMATIC_START_TIMEOUT_MS = 15_000
type Connection = EventTarget & { saveData?: boolean }

/** Owns one native media element. No rendering loop or WebGL resources. Source
 * assignment follows decoded-poster, visibility and preference eligibility. */
export function createCinematicPlayback({ video, poster, stage, release, onState }: {
  video: HTMLVideoElement; poster: HTMLImageElement; stage: HTMLElement; release: CinematicRelease; onState: (state: CinematicState) => void
}) {
  let state = { ...INITIAL_CINEMATIC_STATE }
  let disposed = false, visible = false, posterReady = false, assigned = false, userPaused = false, intentionalPlay = false, attempting = false
  let generation = 0, frameHandle: number | null = null, deadline: ReturnType<typeof setTimeout> | null = null
  let posterGeneration = 0, posterDeadline: ReturnType<typeof setTimeout> | null = null
  let remainingStartMs = CINEMATIC_START_TIMEOUT_MS, eligibleStartedMs: number | null = null
  let failure: "error" | "blocked" | null = null
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
  const mobile = window.matchMedia("(max-width: 639px)")
  const connection = (navigator as Navigator & { connection?: Connection }).connection
  const publish = (patch: Partial<CinematicState>) => {
    if (disposed) return
    state = { ...state, ...patch }; onState(state)
  }
  const clearPending = () => {
    if (eligibleStartedMs !== null) remainingStartMs = Math.max(0, remainingStartMs - (performance.now() - eligibleStartedMs))
    eligibleStartedMs = null
    if (deadline) clearTimeout(deadline)
    deadline = null
    if (frameHandle !== null) video.cancelVideoFrameCallback?.(frameHandle)
    frameHandle = null
  }
  const suspend = (phase: CinematicState["phase"], reason: CinematicState["reason"]) => {
    ++generation; attempting = false; clearPending(); video.pause(); publish({ phase, reason })
  }
  const fail = (reason: "network" | "decode" | "timeout") => {
    failure = "error"
    suspend("error", reason)
    publish({ frameReady: false, frameEvidence: "none" })
  }
  const isEligible = () => !disposed && !failure && release.mode !== "poster" && posterReady && visible && document.visibilityState === "visible" && !userPaused && (intentionalPlay || (!motion.matches && !connection?.saveData))
  const presented = (token: number) => {
    if (token !== generation || !attempting || !isEligible() || video.paused) return
    attempting = false; clearPending(); remainingStartMs = CINEMATIC_START_TIMEOUT_MS
    publish({ phase: "playing", reason: "ready", frameReady: true, firstFrameMs: state.firstFrameMs ?? performance.now(), frameEvidence: typeof video.requestVideoFrameCallback === "function" ? "presented-frame" : "advancing-clock" })
  }
  const observePresentation = (token: number) => {
    if (typeof video.requestVideoFrameCallback === "function") {
      frameHandle = video.requestVideoFrameCallback(() => { frameHandle = null; presented(token) })
    }
    // On older engines, loadeddata + an advancing media clock is the fallback.
    // It is intentionally not called from canplay or the play() promise.
  }
  const advance = () => {
    if (disposed) return
    if (failure) { video.pause(); return }
    if (release.mode === "poster") { suspend("poster", "disabled"); return }
    if (userPaused) { suspend("paused", "user"); return }
    if (document.visibilityState !== "visible") { suspend("suspended", "hidden"); return }
    if (!visible) { suspend(assigned ? "suspended" : "poster", "offscreen"); return }
    if (!intentionalPlay && (motion.matches || connection?.saveData)) {
      suspend("poster", motion.matches ? "reduced-motion" : "save-data"); publish({ frameReady: false }); return
    }
    if (!posterReady || ["blocked", "error"].includes(state.phase) || attempting || !video.paused) return
    if (remainingStartMs <= 0) { fail("timeout"); return }
    if (!assigned) {
      const kind = state.rendition ?? (mobile.matches ? "mobile" : "desktop")
      const rendition = release.renditions[kind]
      video.width = rendition.width; video.height = rendition.height
      video.src = rendition.video.url
      assigned = true
      publish({ rendition: kind })
      video.load()
    }
    const token = ++generation
    attempting = true
    publish({ phase: "loading", reason: "network" })
    eligibleStartedMs = performance.now()
    deadline = setTimeout(() => { if (token === generation && isEligible()) fail("timeout") }, remainingStartMs)
    observePresentation(token)
    void video.play().catch(error => {
      if (disposed || token !== generation) return
      if (error instanceof DOMException && error.name === "NotAllowedError") { failure = "blocked"; suspend("blocked", "autoplay"); publish({ frameReady: false, frameEvidence: "none" }) }
      else fail("decode")
    })
  }
  const sampleVisibility = () => {
    const rect = stage.getBoundingClientRect()
    const width = Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left))
    const height = Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top))
    visible = rect.width > 0 && rect.height > 0 && width * height / (rect.width * rect.height) >= .25
    advance()
  }
  const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
    const entry = entries.at(-1)
    if (entry) { visible = entry.isIntersecting && entry.intersectionRatio >= .25; advance() }
  }, { threshold: [0, .25] })
  observer?.observe(stage)
  const clearPosterDeadline = () => { if (posterDeadline) clearTimeout(posterDeadline); posterDeadline = null }
  const posterFailed = () => {
    ++posterGeneration; clearPosterDeadline(); posterReady = false; failure = "error"
    suspend("error", "poster-unavailable")
    video.removeAttribute("src"); video.load(); assigned = false
    publish({ frameReady: false, frameEvidence: "none", posterReadyMs: null })
  }
  const decodePoster = () => {
    if (disposed || state.reason === "poster-unavailable") return
    const token = ++posterGeneration
    clearPosterDeadline()
    posterDeadline = setTimeout(() => { if (!disposed && token === posterGeneration && !posterReady) posterFailed() }, CINEMATIC_START_TIMEOUT_MS)
    const promise = typeof poster.decode === "function" ? poster.decode() : poster.complete && poster.naturalWidth > 0 ? Promise.resolve() : Promise.reject(new Error("Poster not loaded"))
    void promise.then(() => {
      if (disposed || token !== posterGeneration) return
      clearPosterDeadline(); posterReady = true; publish({ posterReadyMs: state.posterReadyMs ?? performance.now() }); advance()
    }, () => {
      // decode() may reject while a responsive image is still being selected.
      // A completed failed decode or an image error is terminal until Retry.
      if (!disposed && token === posterGeneration && poster.complete) posterFailed()
    })
  }
  const reloadPoster = () => {
    const token = ++posterGeneration
    clearPosterDeadline(); posterReady = false
    const source = poster.getAttribute("src")
    const sources = [...(poster.closest("picture")?.querySelectorAll<HTMLSourceElement>("source[srcset]") ?? [])]
      .map(element => ({ element, srcset: element.getAttribute("srcset")! }))
    // WebKit retains a failed picture selection when assigned the same src.
    // Clear the fallback first so removing a phone source cannot fetch desktop.
    poster.removeAttribute("src")
    for (const entry of sources) entry.element.removeAttribute("srcset")
    posterDeadline = setTimeout(() => { if (!disposed && token === posterGeneration && !posterReady) posterFailed() }, CINEMATIC_START_TIMEOUT_MS)
    queueMicrotask(() => {
      if (disposed || token !== posterGeneration) return
      for (const entry of sources) entry.element.setAttribute("srcset", entry.srcset)
      if (source) poster.setAttribute("src", source)
      // Decode only the fresh load event, never the previous failed request.
    })
  }
  const preferenceChanged = () => { intentionalPlay = false; advance() }
  const nativeError = () => { if (assigned && video.error) fail(video.error.code === 2 ? "network" : "decode") }
  const clockAdvanced = () => {
    if (typeof video.requestVideoFrameCallback !== "function" && video.readyState >= 2 && video.currentTime > 0) presented(generation)
  }
  const playing = () => { if (!isEligible()) video.pause() }
  const retry = () => {
    const retryPoster = state.reason === "poster-unavailable"
    ++generation; clearPending(); video.pause(); attempting = false
    remainingStartMs = CINEMATIC_START_TIMEOUT_MS
    video.removeAttribute("src"); video.load(); assigned = false
    failure = null
    userPaused = false; intentionalPlay = true
    // Pin the picture before restoring a failed source. Changing its media
    // selection after the fresh load can make Chromium request it twice.
    publish({ phase: "poster", reason: "user", frameReady: false, frameEvidence: "none", rendition: state.rendition ?? (mobile.matches ? "mobile" : "desktop") })
    if (retryPoster) reloadPoster()
    else decodePoster()
    advance()
  }
  video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true
  poster.addEventListener("load", decodePoster)
  poster.addEventListener("error", posterFailed)
  video.addEventListener("error", nativeError)
  video.addEventListener("timeupdate", clockAdvanced)
  video.addEventListener("playing", playing)
  motion.addEventListener("change", preferenceChanged)
  connection?.addEventListener?.("change", preferenceChanged)
  document.addEventListener("visibilitychange", sampleVisibility)
  window.addEventListener("resize", sampleVisibility)
  if (!observer) window.addEventListener("scroll", sampleVisibility, { passive: true })
  queueMicrotask(() => { if (!disposed) { sampleVisibility(); decodePoster() } })
  return {
    play() { if (failure) { retry(); return }; userPaused = false; intentionalPlay = true; advance() },
    pause() { if (failure) { video.pause(); return }; userPaused = true; intentionalPlay = false; suspend("paused", "user") },
    retry,
    dispose() {
      disposed = true; ++generation; ++posterGeneration; clearPending(); clearPosterDeadline(); observer?.disconnect(); video.pause(); video.removeAttribute("src"); video.load()
      poster.removeEventListener("load", decodePoster); poster.removeEventListener("error", posterFailed); video.removeEventListener("error", nativeError); video.removeEventListener("timeupdate", clockAdvanced); video.removeEventListener("playing", playing)
      motion.removeEventListener("change", preferenceChanged); connection?.removeEventListener?.("change", preferenceChanged)
      document.removeEventListener("visibilitychange", sampleVisibility); window.removeEventListener("resize", sampleVisibility); window.removeEventListener("scroll", sampleVisibility)
    },
  }
}
