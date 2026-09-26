import { act, cleanup, renderHook } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { usePosterAcquisition, FACILITY_POSTER_PLACEHOLDER } from "@/components/facility/use-poster-acquisition"
import { createPosterDecoder } from "@/lib/facility/poster-decode"
import { testMatchMedia } from "../../support/match-media"

function viewport(top = 1500) {
  const element = document.createElement("div")
  const rect = { top, bottom: top + 255, height: 255, width: 340, left: 0, right: 340, x: 0, y: top, toJSON() {} }
  vi.spyOn(element, "getBoundingClientRect").mockImplementation(() => rect)
  let loaded = false, visible = true
  vi.spyOn(document, "readyState", "get").mockImplementation(() => loaded ? "complete" : "loading")
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible ? "visible" : "hidden")
  let intersect!: (entries: Partial<IntersectionObserverEntry>[]) => void
  const disconnect = vi.fn(), observe = vi.fn(), options: IntersectionObserverInit[] = []
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void, configuration: IntersectionObserverInit) { intersect = callback; options.push(configuration) }
    observe = observe; disconnect = disconnect
  })
  return {
    stage: { current: element }, rect, options, disconnect,
    load() { loaded = true; window.dispatchEvent(new Event("load")) },
    visibility(next: boolean) { visible = next; document.dispatchEvent(new Event("visibilitychange")) },
    enter() { intersect([{ isIntersecting: true }]) },
  }
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("v7 mobile poster acquisition candidate", () => {
  it("encodes the full placeholder SVG as one valid srcset URL token", () => {
    expect(FACILITY_POSTER_PLACEHOLDER).not.toMatch(/\s/)
    expect(decodeURIComponent(FACILITY_POSTER_PLACEHOLDER.slice("data:image/svg+xml,".length))).toBe('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"></svg>')
  })
  it("waits for loaded document, nearby illustration, and visible page before fetching once", async () => {
    testMatchMedia.setMatches("(max-width: 639px)", true)
    const view = viewport(), { result, unmount } = renderHook(() => usePosterAcquisition(view.stage, true))
    await act(async () => { await Promise.resolve() })
    expect(result.current.requested).toBe(false)
    expect(view.options).toEqual([{ rootMargin: "200px 0px", threshold: 0 }])
    act(() => view.enter())
    expect(result.current.requested).toBe(false)
    act(() => { view.visibility(false); view.rect.top = 800; view.rect.bottom = 1055; view.load() })
    expect(result.current.requested).toBe(false)
    act(() => view.visibility(true))
    expect(result.current.requested).toBe(true)
    expect(view.disconnect).toHaveBeenCalledOnce()
    unmount()
  })
  it("preserves immediate legacy behavior and manual activation independently of network/device policy", async () => {
    testMatchMedia.setMatches("(max-width: 639px)", true)
    const view = viewport(), { result } = renderHook(() => usePosterAcquisition(view.stage, true))
    await act(async () => { await Promise.resolve() })
    act(() => result.current.request())
    expect(result.current.requested).toBe(true)
    const legacy = renderHook(() => usePosterAcquisition(view.stage, false))
    expect(legacy.result.current.requested).toBe(true)
  })
  it("handles the 639/640 breakpoint without acquiring an offscreen mobile source", async () => {
    testMatchMedia.setMatches("(max-width: 639px)", false)
    const view = viewport(), { result } = renderHook(() => usePosterAcquisition(view.stage, true))
    await act(async () => { await Promise.resolve() })
    act(() => view.load())
    act(() => testMatchMedia.setMatches("(max-width: 639px)", true))
    expect(result.current.requested).toBe(false)
    act(() => { view.rect.top = 500; view.rect.bottom = 755; view.enter() })
    expect(result.current.requested).toBe(true)
    act(() => testMatchMedia.setMatches("(max-width: 639px)", false))
    expect(result.current.requested).toBe(true)
  })
  it("does not treat the lightweight placeholder as a decoded or failed approved poster", () => {
    const image = { src: FACILITY_POSTER_PLACEHOLDER, currentSrc: FACILITY_POSTER_PLACEHOLDER, naturalWidth: 4, complete: true, decode: vi.fn() } as unknown as HTMLImageElement
    const state = vi.fn(), decoder = createPosterDecoder(() => image, () => "https://gridninja.ai/mobile.webp", state)
    decoder.decode()
    expect(state.mock.calls).toEqual([["pending"]])
    expect(image.decode).not.toHaveBeenCalled(); expect(decoder.isDecoded()).toBe(false)
  })
  it("keeps the server-rendered desktop source while the mobile candidate begins without an external fetch", () => {
    function Picture() {
      const state = usePosterAcquisition({ current: null }, true)
      return <picture><source media="(max-width: 639px)" srcSet={state.requested ? "/mobile.webp" : FACILITY_POSTER_PLACEHOLDER} /><img src="/desktop.webp" alt="Facility" fetchPriority="high" /></picture>
    }
    const html = renderToStaticMarkup(<Picture />)
    expect(html).toContain('src="/desktop.webp"')
    expect(html).toContain('srcSet="data:image/svg+xml,')
    expect(html).not.toContain('href="/desktop.webp"')
    expect(html).not.toContain('srcSet="/mobile.webp"')
  })
})
