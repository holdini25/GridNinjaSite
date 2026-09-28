import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, it, vi } from "vitest"
import { FacilityPreviewPoster } from "@/components/facility/facility-preview-poster"
import { FACILITY_POSTER_PLACEHOLDER } from "@/components/facility/use-poster-acquisition"
import { DeferredAssessmentExplorer } from "@/components/assessment/deferred-assessment-explorer"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { resolveAssessmentSelection } from "@/lib/assessment/selectors"
import { testMatchMedia } from "../../support/match-media"

const { load, reload } = vi.hoisted(() => ({ load: vi.fn(), reload: vi.fn() }))
vi.mock("@/components/assessment/assessment-explorer-loader", () => ({ loadAssessmentExplorer: load, reloadAssessmentLocation: reload }))
const poster = { desktopUrl: "/assets/facility/example/poster-desktop.webp", mobileUrl: "/assets/facility/example/poster-mobile.webp", alt: "Synthetic facility illustration", deferMobile: true }
function viewport(top: number) {
  testMatchMedia.setMatches("(max-width: 639px)", true)
  let loaded = false, visible = true
  const box = { top, bottom: top + 255, height: 255, width: 340, left: 0, right: 340, x: 0, y: top, toJSON() {} }
  vi.spyOn(HTMLPictureElement.prototype, "getBoundingClientRect").mockImplementation(() => box)
  vi.spyOn(document, "readyState", "get").mockImplementation(() => loaded ? "complete" : "loading")
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible ? "visible" : "hidden")
  const observers: { callback: (entries: Partial<IntersectionObserverEntry>[]) => void; target?: Element }[] = []
  const disconnect = vi.fn()
  vi.stubGlobal("IntersectionObserver", class {
    observer: typeof observers[number]
    constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) { this.observer = { callback }; observers.push(this.observer) }
    observe(target: Element) { this.observer.target = target }
    disconnect = disconnect
  })
  return {
    disconnect,
    load() { loaded = true; window.dispatchEvent(new Event("load")) },
    enter() { box.top = 400; box.bottom = 655; for (const observer of observers) if (observer.target instanceof HTMLPictureElement) observer.callback([{ isIntersecting: true }]) },
    visibility(next: boolean) { visible = next; document.dispatchEvent(new Event("visibilitychange")) },
  }
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); load.mockReset(); reload.mockReset() })

it("keeps desktop SSR discovery and one scoped real responsive no-script fallback", () => {
  const markup = renderToStaticMarkup(<FacilityPreviewPoster {...poster} />)
  const document = new DOMParser().parseFromString(markup, "text/html")
  const enhanced = document.querySelector("picture.facility-preview-poster--deferred")!
  expect(enhanced.querySelector("source")?.getAttribute("srcset")).toBe(FACILITY_POSTER_PLACEHOLDER)
  expect(enhanced.querySelector("img")?.getAttribute("src")).toBe(poster.desktopUrl)
  expect(enhanced.querySelector("img")?.getAttribute("width")).toBe("1360")
  expect(enhanced.querySelector("img")?.getAttribute("height")).toBe("800")
  expect(document.querySelectorAll("noscript picture")).toHaveLength(1)
  expect(document.querySelector("noscript source")?.getAttribute("srcset")).toBe(poster.mobileUrl)
  expect(document.querySelector("noscript img")?.getAttribute("alt")).toBe(poster.alt)
  expect(document.querySelector("noscript style")?.textContent).toBe(".facility-preview-poster--deferred{display:none!important}")
  expect(document.querySelector('link[rel="preload"]')).toBeNull()
})

it("never assigns the external mobile URL before document load even when the illustration is nearby", async () => {
  const view = viewport(200), rendered = render(<FacilityPreviewPoster {...poster} />)
  const source = rendered.container.querySelector("picture > source")!
  await act(async () => { await Promise.resolve() })
  act(() => view.enter())
  expect(source).toHaveAttribute("srcset", FACILITY_POSTER_PLACEHOLDER)
  act(() => view.load())
  expect(source).toHaveAttribute("srcset", poster.mobileUrl)
  expect(view.disconnect).toHaveBeenCalledOnce()
})

it("keeps the loaded offscreen or hidden preview deferred until it is visible and nearby", async () => {
  const view = viewport(1800), rendered = render(<FacilityPreviewPoster {...poster} />)
  const source = rendered.container.querySelector("picture > source")!
  await act(async () => { await Promise.resolve() })
  act(() => view.load())
  expect(source).toHaveAttribute("srcset", FACILITY_POSTER_PLACEHOLDER)
  act(() => { view.visibility(false); view.enter() })
  expect(source).toHaveAttribute("srcset", FACILITY_POSTER_PLACEHOLDER)
  act(() => view.visibility(true))
  expect(source).toHaveAttribute("srcset", poster.mobileUrl)
})

it("acquires the real image independently after the optional explorer import fails", async () => {
  const view = viewport(1800), selection = resolveAssessmentSelection({})
  if (selection.status !== "ready") throw new Error("Default fixture missing")
  load.mockRejectedValue(new Error("blocked enhancement"))
  window.history.replaceState(null, "", "/demo")
  const rendered = render(<DeferredAssessmentExplorer initialSelection={selection} initialTarget={null} records={assessmentFixtures} facilityRelease={null} facilityMode="auto-adaptive" preview={<>
    <p>Fixture B: 7.0 MW requested; 5.8 MW modeled.</p><div className="facility-stage"><FacilityPreviewPoster {...poster} /></div>
    <a href="/demo?interactive=1&activate=1" data-assessment-preview-activate>Explore the facility in 3D</a>
  </>} />)
  await act(async () => { await Promise.resolve(); view.load() })
  const source = rendered.container.querySelector("picture > source")!
  expect(source).toHaveAttribute("srcset", FACILITY_POSTER_PLACEHOLDER)
  fireEvent.click(screen.getByRole("link", { name: "Explore the facility in 3D" }))
  expect(await screen.findByRole("button", { name: "Retry interactive inspection" })).toBeVisible()
  act(() => view.enter())
  expect(source).toHaveAttribute("srcset", poster.mobileUrl)
  expect(screen.getByText("Fixture B: 7.0 MW requested; 5.8 MW modeled.")).toBeVisible()
  expect(load).toHaveBeenCalledOnce()
})

function imageState(element: HTMLImageElement, source: string, width: number, complete = true) {
  Object.defineProperties(element, {
    currentSrc: { configurable: true, value: source.startsWith("data:") ? source : new URL(source, document.baseURI).href },
    naturalWidth: { configurable: true, value: width },
    complete: { configurable: true, value: complete },
  })
}

it("keeps deferred placeholders quiet, including their load and error events", async () => {
  viewport(1800)
  const rendered = render(<FacilityPreviewPoster {...poster} />)
  const img = rendered.container.querySelector("picture > img") as HTMLImageElement
  imageState(img, FACILITY_POSTER_PLACEHOLDER, 4)
  fireEvent.load(img)
  fireEvent.error(img)
  await act(async () => { await Promise.resolve() })
  expect(screen.getByRole("status")).toBeEmptyDOMElement()
  expect(screen.queryByRole("button", { name: "Retry illustration" })).toBeNull()
  expect(img).toHaveAttribute("loading", "lazy")
})

it("detects a cached real failure after hydration without waiting for another error event", async () => {
  vi.spyOn(HTMLImageElement.prototype, "currentSrc", "get").mockReturnValue(new URL(poster.desktopUrl, document.baseURI).href)
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0)
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true)
  render(<FacilityPreviewPoster {...poster} deferMobile={false} />)
  await act(async () => { await Promise.resolve() })
  expect(screen.getByRole("status")).toHaveTextContent("The still illustration couldn’t load")
  expect(screen.getByRole("button", { name: "Retry illustration" })).toBeEnabled()
})

it("refreshes a failed image explicitly, ignores obsolete events and preserves the image node and owned focus", async () => {
  const rendered = render(<FacilityPreviewPoster {...poster} deferMobile={false} />)
  const img = rendered.container.querySelector("picture > img") as HTMLImageElement
  imageState(img, poster.desktopUrl, 0)
  fireEvent.error(img)
  const button = screen.getByRole("button", { name: "Retry illustration" })
  button.focus()
  fireEvent.click(button)
  expect(screen.getByRole("group", { name: "Facility illustration" })).toHaveFocus()
  expect(img).toHaveAttribute("src", `${poster.desktopUrl}?poster-retry=1`)
  expect(rendered.container.querySelector("picture > source")).toHaveAttribute("srcset", `${poster.mobileUrl}?poster-retry=1`)
  expect(rendered.container.querySelector("picture > img")).toBe(img)
  expect(button).toBeDisabled()
  imageState(img, poster.desktopUrl, 1360)
  fireEvent.load(img)
  fireEvent.error(img)
  expect(screen.getByRole("status")).toHaveTextContent("Retrying")
  imageState(img, `${poster.desktopUrl}?poster-retry=1`, 1360)
  fireEvent.load(img)
  expect(screen.getByRole("status")).toHaveTextContent("Still illustration loaded.")
  expect(screen.queryByRole("button", { name: "Retry illustration" })).toBeNull()
  expect(screen.getByRole("group", { name: "Facility illustration" })).toHaveFocus()
  expect(img).not.toHaveAttribute("aria-hidden")
})

it("does not move focus from another control when a retry completes", () => {
  const rendered = render(<><FacilityPreviewPoster {...poster} deferMobile={false} /><button>Continue reading</button></>)
  const img = rendered.container.querySelector("picture > img") as HTMLImageElement
  imageState(img, poster.desktopUrl, 0)
  fireEvent.error(img)
  fireEvent.click(screen.getByRole("button", { name: "Retry illustration" }))
  const other = screen.getByRole("button", { name: "Continue reading" })
  other.focus()
  imageState(img, `${poster.desktopUrl}?poster-retry=1`, 1360)
  fireEvent.load(img)
  expect(other).toHaveFocus()
})

it("times out only explicit retries and stops after two attempts without automatic requests", async () => {
  vi.useFakeTimers()
  try {
    const rendered = render(<FacilityPreviewPoster {...poster} deferMobile={false} />)
    const img = rendered.container.querySelector("picture > img") as HTMLImageElement
    imageState(img, poster.desktopUrl, 0, false)
    await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(20_000) })
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
    fireEvent.error(img)
    expect(vi.getTimerCount()).toBe(0)
    fireEvent.click(screen.getByRole("button", { name: "Retry illustration" }))
    imageState(img, `${poster.desktopUrl}?poster-retry=1`, 0, false)
    act(() => vi.advanceTimersByTime(7_999))
    expect(screen.getByRole("status")).toHaveTextContent("Retrying")
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole("button", { name: "Retry illustration" })).toBeEnabled()
    imageState(img, `${poster.desktopUrl}?poster-retry=1`, 1360)
    fireEvent.load(img)
    expect(screen.getByRole("status")).toHaveTextContent("couldn’t load")
    const button = screen.getByRole("button", { name: "Retry illustration" })
    button.focus()
    fireEvent.click(button)
    imageState(img, `${poster.desktopUrl}?poster-retry=2`, 0, false)
    expect(img).toHaveAttribute("src", `${poster.desktopUrl}?poster-retry=2`)
    fireEvent.error(img)
    expect(screen.getByRole("status")).toHaveTextContent("Use the still-image link below")
    expect(screen.queryByRole("button", { name: "Retry illustration" })).toBeNull()
    expect(screen.getByRole("group", { name: "Facility illustration" })).toHaveFocus()
    act(() => vi.advanceTimersByTime(60_000))
    expect(img).toHaveAttribute("src", `${poster.desktopUrl}?poster-retry=2`)
    expect(vi.getTimerCount()).toBe(0)
  } finally { vi.useRealTimers() }
})

it("cleans up retry deadlines on teardown and does not transfer failure into another release", async () => {
  vi.useFakeTimers()
  try {
    const rendered = render(<FacilityPreviewPoster {...poster} deferMobile={false} />)
    const oldImage = rendered.container.querySelector("picture > img") as HTMLImageElement
    imageState(oldImage, poster.desktopUrl, 0)
    fireEvent.error(oldImage)
    fireEvent.click(screen.getByRole("button", { name: "Retry illustration" }))
    // Drain the DOM's focus/selection notification, retaining the retry deadline.
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(vi.getTimerCount()).toBe(1)
    rendered.rerender(<FacilityPreviewPoster {...poster} desktopUrl="/assets/facility/next/poster-desktop.webp" deferMobile={false} />)
    expect(vi.getTimerCount()).toBe(0)
    fireEvent.error(oldImage)
    fireEvent.load(oldImage)
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
    const img = rendered.container.querySelector("picture > img") as HTMLImageElement
    imageState(img, "/assets/facility/next/poster-desktop.webp", 0)
    fireEvent.error(img)
    fireEvent.click(screen.getByRole("button", { name: "Retry illustration" }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(vi.getTimerCount()).toBe(1)
    rendered.unmount()
    expect(vi.getTimerCount()).toBe(0)
  } finally { vi.useRealTimers() }
})

it.each([
  { input: "keyboard", action: "leave" },
  { input: "keyboard", action: "activate" },
  { input: "touch", action: "leave" },
  { input: "touch", action: "activate" },
  { input: "touch", action: "retry" },
])("holds deferred enhancement after $input retry activation, then permits $action", async ({ input, action }) => {
  vi.useFakeTimers()
  try {
    const selection = resolveAssessmentSelection({})
    if (selection.status !== "ready") throw new Error("Default fixture missing")
    const explorer = { AssessmentExplorer: () => <div data-testid="loaded-explorer"><div className="facility-stage" tabIndex={-1} /></div> }
    if (action === "retry") load.mockRejectedValueOnce(new Error("blocked explorer")).mockResolvedValueOnce(explorer)
    else load.mockResolvedValue(explorer)
    window.history.replaceState(null, "", "/demo")
    const rendered = render(<><DeferredAssessmentExplorer eager initialSelection={selection} initialTarget={null} records={assessmentFixtures} facilityRelease={null} facilityMode="auto-adaptive" preview={<>
      <p>Fixture B: 7.0 MW requested; 5.8 MW modeled.</p><div className="facility-stage"><FacilityPreviewPoster {...poster} deferMobile={false} /></div>
      <a href="/demo?interactive=1&activate=1" data-assessment-preview-activate>Explore the facility in 3D</a>
    </>} /><button>Continue reading</button></>)
    const img = rendered.container.querySelector("picture > img") as HTMLImageElement
    imageState(img, poster.desktopUrl, 0)
    fireEvent.error(img)
    const retry = screen.getByRole("button", { name: "Retry illustration" })
    if (input === "keyboard") {
      retry.focus()
      fireEvent.keyDown(retry, { key: "Enter" })
      fireEvent.click(retry)
      fireEvent.keyUp(retry, { key: "Enter" })
    } else {
      expect(document.body).toHaveFocus()
      fireEvent.pointerDown(retry, { pointerId: 23, pointerType: "touch" })
      fireEvent.pointerUp(retry, { pointerId: 23, pointerType: "touch" })
      fireEvent.click(retry)
    }
    imageState(img, `${poster.desktopUrl}?poster-retry=1`, 0, false)
    await act(async () => { await vi.advanceTimersByTimeAsync(350) })
    expect(load).toHaveBeenCalledOnce()
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
    expect(screen.getByRole("group", { name: "Facility illustration" })).toHaveFocus()
    expect(screen.getByText("Retrying the still illustration…")).toBeVisible()
    expect(img.isConnected).toBe(true)
    const destination = action === "leave" ? screen.getByRole("button", { name: "Continue reading" }) : action === "retry" ? screen.getByRole("button", { name: "Retry interactive inspection" }) : screen.getByRole("link", { name: "Explore the facility in 3D" })
    await act(async () => {
      if (input === "touch" && action !== "leave") {
        fireEvent.pointerDown(destination, { pointerId: 24, pointerType: "touch" })
        fireEvent.pointerUp(destination, { pointerId: 24, pointerType: "touch" })
        fireEvent.click(destination)
      } else {
        destination.focus()
        if (action === "activate") fireEvent.click(destination)
      }
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByTestId("loaded-explorer")).toBeVisible()
    expect(load).toHaveBeenCalledTimes(action === "retry" ? 2 : 1)
    if (action === "leave") expect(destination).toHaveFocus()
    // The intentional handoff can enqueue the DOM's selection notification.
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(vi.getTimerCount()).toBe(0)
  } finally { vi.useRealTimers() }
})
