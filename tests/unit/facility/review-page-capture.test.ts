import { afterEach, expect, it, vi } from "vitest"
import type { Page } from "@playwright/test"
import { captureVisitedReviewPage } from "../../../scripts/facility/review-page-capture.mjs"

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function fixture(options: { sizeChange?: number; screenshotError?: boolean; mutationError?: boolean } = {}) {
  vi.stubGlobal("innerHeight", 1000); vi.stubGlobal("scrollX", 0); vi.stubGlobal("scrollY", 125)
  vi.stubGlobal("scrollTo", (position: { top: number; left: number }) => { globalThis.scrollY = Math.max(0, Math.min(1000, position.top)); globalThis.scrollX = position.left })
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(2000)
  const original = [null, "", "color: red; --verbatim: 1;"]
  // JSDOM does not implement content-visibility layout. Model only whether the
  // owned stylesheet is present; native capture verifies the real CSS engine.
  const paintRule = () => [...document.head.querySelectorAll("style")]
    .flatMap(style => [...style.sheet?.cssRules ?? []])
    .find((rule): rule is CSSStyleRule => "selectorText" in rule && rule.selectorText === ".gn-content-auto")
  const painting = () => paintRule()?.style.getPropertyValue("content-visibility") === "visible"
  vi.stubGlobal("getComputedStyle", () => ({ contentVisibility: painting() ? "visible" : "auto" }) as CSSStyleDeclaration)
  const sections = original.map((style, index) => {
    const section = document.createElement("section"); section.className = "gn-content-auto"
    if (style !== null) section.setAttribute("style", style)
    section.getBoundingClientRect = () => ({ top: 1100 + index * 100 - scrollY, left: 0, width: 900, height: 100 + (getComputedStyle(section).contentVisibility === "visible" ? options.sizeChange ?? 0 : 0) }) as DOMRect
    document.body.append(section); return section
  })
  if (options.mutationError) vi.spyOn(document.head, "appendChild").mockImplementation(() => { throw new Error("mutation interrupted") })
  const disposed = vi.fn(), screenshot = vi.fn(async () => {
    expect(sections.every(section => getComputedStyle(section).contentVisibility === "visible")).toBe(true)
    // Eager paint must preserve the formatting context without adding size
    // containment; otherwise margin collapse can change the reviewed layout.
    expect(paintRule()?.style.getPropertyValue("contain").split(/\s+/).sort()).toEqual(["layout", "paint", "style"])
    if (options.screenshotError) throw new Error("capture interrupted")
    return Buffer.from("image")
  })
  const mouse = { wheel: vi.fn(async (_x: number, y: number) => { globalThis.scrollY = Math.min(1000, scrollY + y) }) }
  const page = {
    mouse, screenshot, waitForTimeout: vi.fn(async () => {}),
    evaluate: async <T, A>(callback: (arg: A) => T, arg: A) => callback(arg),
    evaluateHandle: async <T>(callback: () => T) => { const value = callback(); return { evaluate: async <R>(read: (state: T) => R) => read(value), dispose: disposed } },
  } as unknown as Page
  return { page, sections, original, disposed, screenshot, mouse }
}

it("visits normal scroll positions, captures only identical-sized eager paint and restores exact absent/empty/original attributes", async () => {
  const f = fixture(), result = await captureVisitedReviewPage(f.page, "/tmp/review.png")
  expect(f.mouse.wheel).toHaveBeenCalledTimes(2)
  expect(result).toMatchObject({ conditioning: "review-only-eager-paint-after-normal-scroll", exactStylesRestored: true, beforeDocumentHeight: 2000, afterDocumentHeight: 2000, scrollSteps: 2, image: "/tmp/review.png" })
  expect(result.sections).toHaveLength(3)
  expect(f.screenshot).toHaveBeenCalledWith({ path: "/tmp/review.png", fullPage: true, animations: "disabled", caret: "hide" })
  expect(f.sections.map(section => section.getAttribute("style"))).toEqual(f.original)
  expect(scrollY).toBe(125); expect(f.disposed).toHaveBeenCalledOnce()
})

it("rejects a layout change rather than capturing a misleading full page, and restores every style", async () => {
  const f = fixture({ sizeChange: 1.1 })
  await expect(captureVisitedReviewPage(f.page, "/tmp/review.png")).rejects.toThrow("Review conditioning changed section0 height")
  expect(f.screenshot).not.toHaveBeenCalled()
  expect(f.sections.map(section => section.getAttribute("style"))).toEqual(f.original)
  expect(scrollY).toBe(125); expect(f.disposed).toHaveBeenCalledOnce()
})

it("restores exact styles and scroll after screenshot rejection", async () => {
  const f = fixture({ screenshotError: true })
  await expect(captureVisitedReviewPage(f.page, "/tmp/review.png")).rejects.toThrow("capture interrupted")
  expect(f.sections.map(section => section.getAttribute("style"))).toEqual(f.original)
  expect(scrollY).toBe(125); expect(f.disposed).toHaveBeenCalledOnce()
})

it("owns the stylesheet before insertion so failed conditioning also cleans up", async () => {
  const f = fixture({ mutationError: true })
  await expect(captureVisitedReviewPage(f.page, "/tmp/review.png")).rejects.toThrow("mutation interrupted")
  expect(f.screenshot).not.toHaveBeenCalled()
  expect(f.sections.map(section => section.getAttribute("style"))).toEqual(f.original)
  expect(scrollY).toBe(125); expect(f.disposed).toHaveBeenCalledOnce()
})
