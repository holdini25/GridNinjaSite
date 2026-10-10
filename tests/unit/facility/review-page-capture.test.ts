import { afterEach, expect, it, vi } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import type { Page, PageScreenshotOptions } from "@playwright/test"
import { captureVisitedReviewPage } from "../../../scripts/facility/review-page-capture.mjs"

const temporaryDirectories: string[] = []
afterEach(async () => {
  document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals()
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

function fixture(options: { sizeChange?: number; screenshotError?: boolean; mutationError?: boolean; documentHeight?: number; scale?: number; tileErrorAt?: number; wrongTileHeight?: boolean } = {}) {
  const documentHeight = options.documentHeight ?? 2000, scale = options.scale ?? 1, maxScroll = documentHeight - 1000
  vi.stubGlobal("innerHeight", 1000); vi.stubGlobal("scrollX", 0); vi.stubGlobal("scrollY", 125)
  vi.stubGlobal("devicePixelRatio", scale)
  vi.stubGlobal("scrollTo", (position: { top: number; left: number }) => { globalThis.scrollY = Math.max(0, Math.min(maxScroll, position.top)); globalThis.scrollX = position.left })
  vi.stubGlobal("scrollBy", (position: { top: number }) => { globalThis.scrollY = Math.min(maxScroll, scrollY + position.top) })
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(documentHeight)
  vi.spyOn(document.documentElement, "scrollWidth", "get").mockReturnValue(20)
  const original = [null, "", "color: red; --verbatim: 1;"]
  // JSDOM does not implement content-visibility layout. Model only whether the
  // owned stylesheet is present; native capture verifies the real CSS engine.
  const paintRule = () => [...document.head.querySelectorAll("style")]
    .flatMap(style => [...style.sheet?.cssRules ?? []])
    .find((rule): rule is CSSStyleRule => "selectorText" in rule && typeof rule.selectorText === "string" && rule.selectorText.includes(".gn-content-auto"))
  const painting = () => paintRule()?.style.getPropertyValue("content-visibility") === "visible"
  vi.stubGlobal("getComputedStyle", () => ({ contentVisibility: painting() ? "visible" : "auto" }) as CSSStyleDeclaration)
  const home = document.createElement("div"); home.className = "gn-home"; document.body.append(home)
  const sections = original.map((style, index) => {
    const section = document.createElement("section"); section.className = ["gn-content-auto", "gn-home-fit", "gn-home-evidence"][index]
    if (style !== null) section.setAttribute("style", style)
    section.getBoundingClientRect = () => ({ top: 1100 + index * 100 - scrollY, left: 0, width: 900, height: 100 + (getComputedStyle(section).contentVisibility === "visible" ? options.sizeChange ?? 0 : 0) }) as DOMRect
    home.append(section); return section
  })
  if (options.mutationError) vi.spyOn(document.head, "appendChild").mockImplementation(() => { throw new Error("mutation interrupted") })
  let tile = 0
  const disposed = vi.fn(), screenshot = vi.fn(async (capture: PageScreenshotOptions) => {
    expect(sections.every(section => getComputedStyle(section).contentVisibility === "visible")).toBe(true)
    // Eager paint must preserve the formatting context without adding size
    // containment; otherwise margin collapse can change the reviewed layout.
    expect(paintRule()?.style.getPropertyValue("contain").split(/\s+/).sort()).toEqual(["layout", "paint", "style"])
    if (options.screenshotError) throw new Error("capture interrupted")
    if (capture.clip) {
      tile++
      if (options.tileErrorAt === tile) throw new Error("later tile interrupted")
      return sharp({ create: { width: Math.ceil(capture.clip.width * scale), height: Math.ceil(capture.clip.height * scale) + (options.wrongTileHeight ? 1 : 0), channels: 3, background: { r: tile * 40, g: 0, b: 0 } } }).png().toBuffer()
    }
    return Buffer.from("image")
  })
  const mouse = { wheel: vi.fn(async (_x: number, y: number) => { globalThis.scrollY = Math.min(maxScroll, scrollY + y) }) }
  const page = {
    mouse, screenshot, waitForTimeout: vi.fn(async () => {}),
    evaluate: async <T, A>(callback: (arg: A) => T, arg: A) => callback(arg),
    evaluateHandle: async <T, A>(callback: (arg: A) => T, arg: A) => { const value = callback(arg); return { evaluate: async <R>(read: (state: T) => R) => read(value), dispose: disposed } },
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

it("supports mobile WebKit scroll warmup without requiring a mouse wheel", async () => {
  const f = fixture()
  f.mouse.wheel.mockRejectedValue(new Error("Mouse wheel is not supported in mobile WebKit"))
  const result = await captureVisitedReviewPage(f.page, "/tmp/review.png", { scrollMethod: "programmatic" })
  expect(f.mouse.wheel).not.toHaveBeenCalled()
  expect(result).toMatchObject({ warmupScrollMethod: "programmatic", scrollSteps: 2, exactStylesRestored: true })
  expect(f.sections.map(section => section.getAttribute("style"))).toEqual(f.original)
  expect(scrollY).toBe(125)
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

it("keeps the native full-page call unchanged at the device-pixel side limit", async () => {
  const f = fixture({ documentHeight: 32767 })
  const result = await captureVisitedReviewPage(f.page, "/tmp/review.png", { scrollMethod: "programmatic" })
  expect(f.screenshot).toHaveBeenCalledOnce()
  expect(f.screenshot).toHaveBeenCalledWith({ path: "/tmp/review.png", fullPage: true, animations: "disabled", caret: "hide" })
  expect(result).not.toHaveProperty("tiledCapture")
  expect(result).toHaveProperty("exactStylesRestored", true)
})

it.each([3, 2.75])("stitches complete native-scale document coverage beyond the limit at DPR %s without changing layout or styles", async scale => {
  const directory = await mkdtemp(join(tmpdir(), "review-page-capture-")); temporaryDirectories.push(directory)
  const path = join(directory, "page.png"), documentHeight = 12003
  const f = fixture({ documentHeight, scale })
  const result = await captureVisitedReviewPage(f.page, path, { scrollMethod: "programmatic" })
  expect(result).toMatchObject({ beforeDocumentHeight: documentHeight, afterDocumentHeight: documentHeight, exactStylesRestored: true, tiledCapture: { method: "document-coordinate-png-tiles-stitched-with-sharp", document: { scale }, pixels: { width: Math.ceil(20 * scale), height: Math.ceil(documentHeight * scale) } } })
  expect(f.screenshot).toHaveBeenCalledTimes(3)
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  expect(info.height).toBe(Math.ceil(documentHeight * scale))
  let row = 0, cssY = 0
  for (const [index, call] of f.screenshot.mock.calls.entries()) {
    const options = call[0], clip = options.clip!
    expect(options).toMatchObject({ fullPage: true, animations: "disabled", caret: "hide", type: "png" })
    expect(clip).toMatchObject({ x: 0, y: cssY, width: 20 })
    const rows = Math.ceil(clip.height * scale)
    expect(rows).toBeLessThanOrEqual(16000)
    // Inspect every stitched row, including both sides of each join. Resizing,
    // missed rows, duplicated padding and a missing final tile cannot pass.
    for (let y = row; y < row + rows; y++) expect(data[y * info.width * info.channels]).toBe((index + 1) * 40)
    row += rows; cssY += clip.height
  }
  expect(row).toBe(info.height); expect(cssY).toBe(documentHeight)
  expect(f.sections.map(section => section.getAttribute("style"))).toEqual(f.original)
  expect(scrollY).toBe(125); expect(f.disposed).toHaveBeenCalledOnce()
})

it("restores exact styles and original scroll when a later native tile fails", async () => {
  const f = fixture({ documentHeight: 12003, scale: 3, tileErrorAt: 2 })
  await expect(captureVisitedReviewPage(f.page, "/tmp/review.png", { scrollMethod: "programmatic" })).rejects.toThrow("later tile interrupted")
  expect(f.screenshot).toHaveBeenCalledTimes(2)
  expect(f.sections.map(section => section.getAttribute("style"))).toEqual(f.original)
  expect(document.head.querySelectorAll("style")).toHaveLength(0)
  expect(scrollY).toBe(125); expect(f.disposed).toHaveBeenCalledOnce()
})

it("rejects a tile with different dimensions rather than stretching it, and restores exact styles", async () => {
  const f = fixture({ documentHeight: 12003, scale: 3, wrongTileHeight: true })
  await expect(captureVisitedReviewPage(f.page, "/tmp/review.png", { scrollMethod: "programmatic" })).rejects.toThrow("Review tile height differs from its document clip")
  expect(f.screenshot).toHaveBeenCalledOnce()
  expect(f.sections.map(section => section.getAttribute("style"))).toEqual(f.original)
  expect(scrollY).toBe(125); expect(f.disposed).toHaveBeenCalledOnce()
})
