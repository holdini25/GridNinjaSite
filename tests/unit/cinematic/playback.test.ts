import { afterEach, describe, expect, it, vi } from "vitest"
import { createCinematicPlayback, CINEMATIC_START_TIMEOUT_MS, type CinematicState } from "@/lib/cinematic/playback"
import type { CinematicRelease } from "@/types/cinematic"
import { testMatchMedia } from "../../support/match-media"

const asset = (url: string) => ({ url, bytes: 100, sha256: "a".repeat(64) })
const rendition = (kind: string) => ({ width: 1280, height: 800, poster: { ...asset(`/${kind}.webp`), width: 1280, height: 800 }, video: { ...asset(`/${kind}.mp4`), mimeType: "video/mp4" as const, width: 1280, height: 800, durationSeconds: 10, fps: 30 } })
const release: CinematicRelease = { release: "cinematic-v1", environment: "synthetic", mode: "auto", renditions: { desktop: rendition("desktop"), mobile: rendition("mobile") } }
const owned: ReturnType<typeof createCinematicPlayback>[] = []
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }

function setup({ offscreen = false, blocked = false, decoded = true } = {}) {
  const video = document.createElement("video"), poster = document.createElement("img"), stage = document.createElement("div")
  const states: CinematicState[] = []
  let paused = true, shown = true, callback: VideoFrameRequestCallback | null = null
  let decode!: () => void
  Object.defineProperty(poster, "decode", { value: vi.fn(() => decoded ? Promise.resolve() : new Promise<void>(resolve => { decode = resolve })) })
  const rectangle = { top: offscreen ? 2000 : 0, bottom: offscreen ? 2400 : 400, left: 0, right: 600, width: 600, height: 400, x: 0, y: 0, toJSON() {} }
  vi.spyOn(stage, "getBoundingClientRect").mockImplementation(() => rectangle)
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => shown ? "visible" : "hidden")
  Object.defineProperty(video, "paused", { get: () => paused })
  video.play = vi.fn(() => { if (blocked) return Promise.reject(new DOMException("Not permitted", "NotAllowedError")); paused = false; return Promise.resolve() })
  video.pause = vi.fn(() => { paused = true })
  video.load = vi.fn()
  video.requestVideoFrameCallback = vi.fn(fn => { callback = fn; return 1 })
  video.cancelVideoFrameCallback = vi.fn(() => { callback = null })
  const control = createCinematicPlayback({ video, poster, stage, release, onState: state => states.push(state) }); owned.push(control)
  return { video, poster, control, states, rectangle,
    decode: () => decode(), frame: () => callback?.(1, {} as VideoFrameCallbackMetadata),
    nativePlay() { paused = false; video.dispatchEvent(new Event("playing")) },
    visibility(next: boolean) { shown = next; document.dispatchEvent(new Event("visibilitychange")) },
    enter() { rectangle.top = 0; rectangle.bottom = 400; window.dispatchEvent(new Event("scroll")) },
    state: () => states.at(-1),
  }
}
afterEach(() => { owned.splice(0).forEach(controller => controller.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("cinematic native playback lifecycle", () => {
  it("waits for visibility and decoded poster, and commits only a presented frame", async () => {
    const view = setup({ offscreen: true, decoded: false }); await flush()
    expect(view.video.hasAttribute("src")).toBe(false)
    view.enter(); expect(view.video.hasAttribute("src")).toBe(false)
    view.decode(); await flush()
    expect(view.video.getAttribute("src")).toBe("/desktop.mp4")
    expect(view.state()?.phase).toBe("loading"); expect(view.state()?.frameReady).toBe(false)
    view.frame(); expect(view.state()).toMatchObject({ phase: "playing", frameReady: true, frameEvidence: "presented-frame" })
  })
  it("avoids acquisition for reduced motion and allows explicit playback", async () => {
    testMatchMedia.setMatches("(prefers-reduced-motion: reduce)", true)
    const view = setup(); await flush()
    expect(view.video.hasAttribute("src")).toBe(false); expect(view.state()?.reason).toBe("reduced-motion")
    view.control.play(); await flush(); view.frame(); expect(view.state()?.phase).toBe("playing")
    testMatchMedia.setMatches("(prefers-reduced-motion: reduce)", false)
    testMatchMedia.setMatches("(prefers-reduced-motion: reduce)", true)
    expect(view.video.paused).toBe(true); expect(view.state()?.frameReady).toBe(false)
  })
  it("does not download under Save-Data and honors changes during playback", async () => {
    const connection = Object.assign(new EventTarget(), { saveData: true })
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { connection }))
    const view = setup(); await flush()
    expect(view.video.hasAttribute("src")).toBe(false); expect(view.state()?.reason).toBe("save-data")
    view.control.play(); await flush(); view.frame(); expect(view.state()?.phase).toBe("playing")
    connection.saveData = false; connection.dispatchEvent(new Event("change"))
    connection.saveData = true; connection.dispatchEvent(new Event("change"))
    expect(view.video.paused).toBe(true); expect(view.state()?.reason).toBe("save-data")
  })
  it("honors a partial Save-Data capability without requiring connection event support", async () => {
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { connection: { saveData: true } }))
    const view = setup(); await flush()
    expect(view.video.hasAttribute("src")).toBe(false)
    expect(view.state()?.reason).toBe("save-data")
  })
  it("retains user Pause across page hiding and restores automatic playback only when eligible", async () => {
    const view = setup(); await flush(); view.frame()
    view.visibility(false); expect(view.state()?.phase).toBe("suspended"); expect(view.video.paused).toBe(true)
    view.visibility(true); await flush(); view.frame(); expect(view.state()?.phase).toBe("playing")
    view.control.pause(); view.visibility(false); view.visibility(true)
    expect(view.state()?.phase).toBe("paused"); expect(view.video.paused).toBe(true)
  })
  it("latches autoplay refusal across visibility changes until explicit Play", async () => {
    const view = setup({ blocked: true }); await flush()
    expect(view.state()?.phase).toBe("blocked"); expect(view.video.play).toHaveBeenCalledOnce()
    view.visibility(false); view.visibility(true); await flush()
    expect(view.state()?.phase).toBe("blocked"); expect(view.video.play).toHaveBeenCalledOnce()
    view.control.play(); await flush(); expect(view.video.play).toHaveBeenCalledTimes(2)
  })
  it("uses the selected rendition even after resize and Retry", async () => {
    const view = setup(); await flush()
    testMatchMedia.setMatches("(max-width: 639px)", true)
    view.control.retry(); await flush()
    expect(view.video.getAttribute("src")).toBe("/desktop.mp4")
    expect(view.state()?.rendition).toBe("desktop")
  })
  it("retains the selected phone rendition when rotation is followed by reduced-motion fallback and explicit Retry", async () => {
    testMatchMedia.setMatches("(max-width: 639px)", true)
    const view = setup(); await flush(); view.frame()
    testMatchMedia.setMatches("(max-width: 639px)", false)
    window.dispatchEvent(new Event("resize"))
    testMatchMedia.setMatches("(prefers-reduced-motion: reduce)", true)
    expect(view.state()).toMatchObject({ rendition: "mobile", phase: "poster", reason: "reduced-motion", frameReady: false })
    expect(view.video.getAttribute("src")).toBe("/mobile.mp4")
    view.control.retry(); await flush(); view.frame()
    expect(view.state()).toMatchObject({ rendition: "mobile", phase: "playing", frameReady: true })
    expect(view.video.getAttribute("src")).toBe("/mobile.mp4")
  })
  it("times out pending presentation and never retries automatically", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const view = setup(); await flush()
    await vi.advanceTimersByTimeAsync(CINEMATIC_START_TIMEOUT_MS)
    expect(view.state()).toMatchObject({ phase: "error", reason: "timeout", frameReady: false })
    view.visibility(false); view.visibility(true); await flush()
    expect(view.video.play).toHaveBeenCalledOnce()
    view.control.pause(); expect(view.state()?.phase).toBe("error")
    view.control.retry(); await flush(); view.frame(); expect(view.state()?.phase).toBe("playing")
  })
  it("counts 15 seconds of eligible startup time across hidden intervals and grants a fresh budget only on Retry", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] })
    const view = setup(); await flush()
    await vi.advanceTimersByTimeAsync(9_000)
    view.visibility(false)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(view.state()?.phase).toBe("suspended")
    view.visibility(true); await flush()
    await vi.advanceTimersByTimeAsync(5_999)
    expect(view.state()?.phase).toBe("loading")
    await vi.advanceTimersByTimeAsync(1)
    expect(view.state()).toMatchObject({ phase: "error", reason: "timeout" })
    view.nativePlay()
    expect(view.video.paused).toBe(true)
    expect(view.state()?.phase).toBe("error")
    view.control.retry(); await flush()
    await vi.advanceTimersByTimeAsync(14_999)
    expect(view.state()?.phase).toBe("loading")
    view.frame(); expect(view.state()?.phase).toBe("playing")
  })
  it("ignores a stale play rejection after a suspended startup successfully resumes", async () => {
    const view = setup()
    let reject!: (reason: Error) => void
    const nativePlay = view.video.play
    view.video.play = vi.fn(() => { void nativePlay.call(view.video); return new Promise<void>((_, fail) => { reject = fail }) })
    await flush()
    const staleReject = reject
    view.visibility(false); view.visibility(true); await flush(); view.frame()
    expect(view.state()?.phase).toBe("playing")
    staleReject(new DOMException("Late refusal", "NotAllowedError")); await flush()
    expect(view.state()).toMatchObject({ phase: "playing", frameReady: true })
  })
  it("labels an advancing-clock fallback distinctly and does not republish on every time update", async () => {
    const view = setup()
    Object.defineProperty(view.video, "requestVideoFrameCallback", { value: undefined })
    Object.defineProperty(view.video, "readyState", { value: 2 })
    await flush()
    view.video.currentTime = .1; view.video.dispatchEvent(new Event("timeupdate"))
    expect(view.state()).toMatchObject({ phase: "playing", frameEvidence: "advancing-clock", frameReady: true })
    const states = view.states.length
    view.video.currentTime = .2; view.video.dispatchEvent(new Event("timeupdate"))
    expect(view.states).toHaveLength(states)
  })
  it("stops media and ignores late decode completion on teardown", async () => {
    const view = setup({ decoded: false }); await flush()
    view.control.dispose(); view.decode(); await flush()
    expect(view.video.hasAttribute("src")).toBe(false); expect(view.video.play).not.toHaveBeenCalled()
  })
  it("latches an unavailable poster, never acquires a movie, and recovers only after Retry decodes the poster", async () => {
    const view = setup({ decoded: false }); await flush()
    view.poster.dispatchEvent(new Event("error")); view.decode(); await flush()
    expect(view.state()).toMatchObject({ phase: "error", reason: "poster-unavailable", posterReadyMs: null, frameReady: false })
    expect(view.video.hasAttribute("src")).toBe(false)
    view.visibility(false); view.visibility(true); view.poster.dispatchEvent(new Event("load")); await flush()
    expect(view.state()?.reason).toBe("poster-unavailable"); expect(view.video.play).not.toHaveBeenCalled()
    view.control.retry(); await flush()
    expect(view.video.play).not.toHaveBeenCalled()
    view.poster.dispatchEvent(new Event("load")); view.decode(); await flush(); view.frame()
    expect(view.state()).toMatchObject({ phase: "playing", frameReady: true })
  })
  it("resets a failed responsive poster without fetching its fallback or decoding the stale failure", async () => {
    const view = setup({ decoded: false }), picture = document.createElement("picture"), source = document.createElement("source")
    source.srcset = "/mobile.webp"; view.poster.src = "/desktop.webp"
    picture.append(source, view.poster)
    await flush(); view.poster.dispatchEvent(new Event("error"))
    const decodeCount = vi.mocked(view.poster.decode).mock.calls.length
    view.control.retry()
    expect(view.poster.hasAttribute("src")).toBe(false); expect(source.hasAttribute("srcset")).toBe(false)
    await flush()
    expect(picture.querySelector("img")).toBe(view.poster)
    expect(view.poster.getAttribute("src")).toBe("/desktop.webp"); expect(source.srcset).toBe("/mobile.webp")
    expect(view.poster.decode).toHaveBeenCalledTimes(decodeCount)
    view.control.pause(); view.poster.dispatchEvent(new Event("load")); view.decode(); await flush()
    expect(view.state()).toMatchObject({ phase: "paused", reason: "user" })
    expect(view.video.hasAttribute("src")).toBe(false)
  })
  it("pins the intended phone rendition before poster Retry, retaining it through a resize and fresh decode", async () => {
    testMatchMedia.setMatches("(max-width: 639px)", true)
    const view = setup({ decoded: false }); await flush()
    view.poster.dispatchEvent(new Event("error"))
    expect(view.state()?.rendition).toBe(null)
    view.control.retry()
    expect(view.state()?.rendition).toBe("mobile")
    expect(view.video.hasAttribute("src")).toBe(false)
    testMatchMedia.setMatches("(max-width: 639px)", false)
    window.dispatchEvent(new Event("resize")); await flush()
    expect(view.video.hasAttribute("src")).toBe(false)
    view.poster.dispatchEvent(new Event("load")); view.decode(); await flush()
    expect(view.video.getAttribute("src")).toBe("/mobile.mp4")
    expect(view.state()?.rendition).toBe("mobile")
  })
  it("bounds a stalled poster retry and cancels source restoration after disposal", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const view = setup({ decoded: false }); view.poster.src = "/desktop.webp"
    await flush(); view.poster.dispatchEvent(new Event("error")); view.control.retry(); await flush()
    await vi.advanceTimersByTimeAsync(CINEMATIC_START_TIMEOUT_MS)
    expect(view.state()).toMatchObject({ phase: "error", reason: "poster-unavailable" })
    expect(view.video.hasAttribute("src")).toBe(false)
    view.control.retry(); view.control.dispose(); await flush()
    expect(view.poster.hasAttribute("src")).toBe(false)
    expect(view.video.play).not.toHaveBeenCalled()
  })
  it("waits through a transient responsive-image decode rejection until the image loads", async () => {
    const view = setup()
    let complete = false
    Object.defineProperty(view.poster, "complete", { get: () => complete })
    vi.mocked(view.poster.decode).mockRejectedValueOnce(new DOMException("Image source changing", "EncodingError"))
    await flush()
    expect(view.state()?.phase).not.toBe("error")
    expect(view.video.hasAttribute("src")).toBe(false)
    complete = true; view.poster.dispatchEvent(new Event("load")); await flush(); view.frame()
    expect(view.state()?.phase).toBe("playing")
  })
})
