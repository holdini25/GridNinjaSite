import assert from "node:assert/strict"
import { extname } from "node:path"

const reviewPaintSelector = ".gn-content-auto, .gn-home > :is(.gn-home-fit, .gn-home-evidence)"
const paintOpportunity = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const screenshotOptions = { fullPage: true, animations: "disabled", caret: "hide" }
const screenshotSideLimit = 32767
const tileSideLimit = 16000

/** Clip the document, never the viewport: no extra scrolling, resizing or
 * positional-style changes are needed between tiles. Keep native device pixels.
 * @param {import('@playwright/test').Page} page
 * @param {string} path
 */
async function captureReviewImage(page, path) {
  const dimensions = await page.evaluate(() => ({
    width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth, document.body.offsetWidth, document.documentElement.offsetWidth, document.body.clientWidth, document.documentElement.clientWidth),
    height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight, document.body.clientHeight, document.documentElement.clientHeight),
    scale: devicePixelRatio,
  }))
  const { width, height, scale } = dimensions
  assert(width > 0 && height > 0 && Number.isFinite(scale) && scale > 0, "Review capture has invalid document dimensions or device scale")
  // Chromium rasterizes an integer CSS extent to the nearest device pixel
  // (1471px at DPR 2.75 is 4045px, not 4046px). Plan in that integer
  // raster space, with aligned internal boundaries and one native final edge.
  const pixelWidth = Math.round(width * scale), pixelHeight = Math.round(height * scale)
  if (pixelWidth <= screenshotSideLimit && pixelHeight <= screenshotSideLimit) {
    await page.screenshot({ path, ...screenshotOptions })
    return { screenshotOptions }
  }
  assert(pixelWidth <= screenshotSideLimit, "Review capture exceeds the supported device-pixel width")
  // Whole CSS-pixel boundaries that also land on whole device pixels avoid
  // repeating/dropping a raster row at fractional DPR (e.g. 1.5 or 2.75).
  let alignment = 1
  while (alignment <= 1000 && Math.abs(alignment * scale - Math.round(alignment * scale)) > 1e-7) alignment++
  assert(alignment <= 1000, "Review capture cannot align tiles at this device scale")
  const tileHeight = Math.floor(tileSideLimit / scale / alignment) * alignment
  assert(tileHeight > 0, "Review capture device scale exceeds the tile budget")
  const { default: sharp } = await import("sharp")
  const inputs = [], tiles = []
  let pixelTop = 0
  for (let y = 0; y < height; y += tileHeight) {
    const cssBottom = Math.min(y + tileHeight, height)
    const pixelBottom = Math.round(cssBottom * scale)
    const expectedHeight = pixelBottom - pixelTop
    assert.equal(pixelTop, Math.round(y * scale), "Review tile starts outside its integer device-pixel boundary")
    const clip = { x: 0, y, width, height: cssBottom - y }
    const input = await page.screenshot({ ...screenshotOptions, type: "png", clip })
    const metadata = await sharp(input).metadata()
    assert.equal(metadata.width, pixelWidth, "Review tile width differs from the native device-pixel width")
    assert.equal(metadata.height, expectedHeight, "Review tile height differs from its document clip")
    assert(metadata.height <= tileSideLimit, "Review tile exceeds the device-pixel budget")
    inputs.push({ input, left: 0, top: pixelTop })
    tiles.push({ clip, pixels: { top: pixelTop, bottom: pixelBottom, width: pixelWidth, height: expectedHeight } })
    pixelTop = pixelBottom
  }
  assert.equal(pixelTop, pixelHeight, "Review tiles do not cover the complete document exactly")
  const format = [".jpg", ".jpeg"].includes(extname(path).toLowerCase()) ? "jpeg" : "png"
  await sharp({ create: { width: pixelWidth, height: pixelHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(inputs).toFormat(format).toFile(path)
  return {
    screenshotOptions,
    tiledCapture: {
      method: "document-coordinate-png-tiles-stitched-with-sharp", trigger: "device-pixel-height-exceeds-32767",
      interpretation: "Serial document clips preserve the conditioned layout and native scale; the stitched image is review paint evidence, not a simultaneous frame or performance evidence.",
      rasterBoundaries: "nearest-device-pixel-edges-with-aligned-interior-clips",
      document: dimensions, pixels: { width: pixelWidth, height: pixelHeight }, tileDevicePixelLimit: tileSideLimit,
      tileScreenshotOptions: { ...screenshotOptions, type: "png" }, outputFormat: format, tiles,
    },
  }
}

/** Review images need offscreen paint, which a full-page screenshot does not
 * request from content-visibility:auto. Visit the real page first, then change
 * paint eligibility only after proving the visited layout stays identical.
 * Never use this conditioning for layout, loading or performance qualification.
 * @param {import('@playwright/test').Page} page
 * @param {string} path
 * @param {{ scrollMethod?: "wheel" | "programmatic" }} options
 */
export async function captureVisitedReviewPage(page, path, { scrollMethod = "wheel" } = {}) {
  const originalScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }))
  let owned, result, failure
  try {
    await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: "instant" }))
    await paintOpportunity(page)
    let steps = 0
    for (; steps < 160; steps++) {
      const position = await page.evaluate(() => ({ y: scrollY, height: innerHeight, documentHeight: document.documentElement.scrollHeight }))
      if (position.y + position.height >= position.documentHeight - 1) break
      const distance = Math.max(100, Math.floor(position.height * .6))
      // Mobile WebKit has no mouse wheel. Visit the same scroll positions
      // before capture; this remains paint evidence, never input/performance QA.
      if (scrollMethod === "programmatic") await page.evaluate(top => scrollBy({ top, behavior: "instant" }), distance)
      else await page.mouse.wheel(0, distance)
      await paintOpportunity(page)
    }
    assert(steps < 160, "Review normal-scroll warmup did not reach the page end")
    await page.waitForTimeout(250)
    await page.evaluate(position => scrollTo({ top: position.y, left: position.x, behavior: "instant" }), originalScroll)
    await paintOpportunity(page)
    // Retain exact element references. The owned stylesheet never touches their
    // inline CSSOM: Chromium can normalize a removed dirty style attribute to
    // an empty attribute, so mutating/restoring inline styles is not byte-exact.
    owned = await page.evaluateHandle(selector => {
      const entries = [...document.querySelectorAll(selector)].map(element => {
        const rect = element.getBoundingClientRect()
        return { element, style: element.getAttribute("style"), before: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } }
      })
      const body = document.body.getBoundingClientRect()
      return { selector, entries, beforeHeight: document.documentElement.scrollHeight, beforeWidth: document.documentElement.scrollWidth, beforeBody: { top: body.top, left: body.left, width: body.width, height: body.height } }
    }, reviewPaintSelector)
    result = await owned.evaluate(state => {
      state.paintStyle = document.createElement("style")
      // Keep the formatting context supplied implicitly by content-visibility.
      // Removing layout containment could collapse child margins through their
      // parent and turn a paint-only capture into a different page layout.
      state.paintStyle.textContent = `${state.selector} { content-visibility: visible !important; contain: layout style paint !important; }`
      document.head.appendChild(state.paintStyle)
      const body = document.body.getBoundingClientRect()
      return {
        conditioning: "review-only-eager-paint-after-normal-scroll",
        override: state.paintStyle.textContent,
        interpretation: "Offscreen paint is forced for this image only; this is not normal-scroll, loading or performance evidence.",
        beforeDocumentHeight: state.beforeHeight, afterDocumentHeight: document.documentElement.scrollHeight,
        beforeDocumentWidth: state.beforeWidth, afterDocumentWidth: document.documentElement.scrollWidth,
        beforeBody: state.beforeBody, afterBody: { top: body.top, left: body.left, width: body.width, height: body.height },
        sections: state.entries.map(({ element, before, style }, index) => {
          const rect = element.getBoundingClientRect()
          return { index, originalStyle: style, conditionedVisibility: getComputedStyle(element).contentVisibility, before, after: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } }
        }),
      }
    })
    assert(Math.abs(result.beforeDocumentHeight - result.afterDocumentHeight) <= 1, "Review conditioning changed document height")
    assert(Math.abs(result.beforeDocumentWidth - result.afterDocumentWidth) <= 1, "Review conditioning changed document width")
    for (const key of ["top", "left", "width", "height"]) assert(Math.abs(result.beforeBody[key] - result.afterBody[key]) <= 1, `Review conditioning changed body ${key}`)
    for (const section of result.sections) {
      assert.equal(section.conditionedVisibility, "visible", `Review conditioning did not enable section${section.index} paint`)
      for (const key of ["top", "left", "width", "height"]) assert(Math.abs(section.before[key] - section.after[key]) <= 1, `Review conditioning changed section${section.index} ${key}`)
    }
    await paintOpportunity(page)
    Object.assign(result, await captureReviewImage(page, path))
    result.scrollSteps = steps
    result.warmupScrollMethod = scrollMethod
    result.image = path
  } catch (error) { failure = error }
  finally {
    if (owned) {
      try {
        const restored = await owned.evaluate(state => {
          state.paintStyle?.remove()
          return state.entries.map(({ element, style }, index) => ({ index, originalStyle: style, restoredStyle: element.getAttribute("style"), connected: element.isConnected }))
        })
        if (result) result.styleRestoration = restored
        assert(restored.every(entry => entry.originalStyle === entry.restoredStyle), `Review conditioning did not restore exact original styles: ${JSON.stringify(restored)}`)
        if (result) result.exactStylesRestored = true
      } catch (error) { failure = failure ? new AggregateError([failure, error], "Review capture and style restoration failed") : error }
      finally {
        try { await owned.dispose() }
        catch (error) { failure = failure ? new AggregateError([failure, error], "Review capture handle cleanup failed") : error }
      }
    }
    try {
      await page.evaluate(position => scrollTo({ top: position.y, left: position.x, behavior: "instant" }), originalScroll)
      await paintOpportunity(page)
    } catch (error) { failure = failure ? new AggregateError([failure, error], "Review capture and scroll restoration failed") : error }
  }
  if (failure) throw failure
  assert(result, "Review capture did not produce conditioning evidence")
  return result
}
