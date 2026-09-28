import assert from "node:assert/strict"

const paintOpportunity = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

/** Review images need offscreen paint, which a full-page screenshot does not
 * request from content-visibility:auto. Visit the real page first, then change
 * paint eligibility only after proving the visited layout stays identical.
 * Never use this conditioning for layout, loading or performance qualification.
 * @param {import('@playwright/test').Page} page
 * @param {string} path
 */
export async function captureVisitedReviewPage(page, path) {
  const originalScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }))
  let owned, result, failure
  try {
    await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: "instant" }))
    await paintOpportunity(page)
    let steps = 0
    for (; steps < 160; steps++) {
      const position = await page.evaluate(() => ({ y: scrollY, height: innerHeight, documentHeight: document.documentElement.scrollHeight }))
      if (position.y + position.height >= position.documentHeight - 1) break
      await page.mouse.wheel(0, Math.max(100, Math.floor(position.height * .6)))
      await paintOpportunity(page)
    }
    assert(steps < 160, "Review normal-scroll warmup did not reach the page end")
    await page.waitForTimeout(250)
    await page.evaluate(position => scrollTo({ top: position.y, left: position.x, behavior: "instant" }), originalScroll)
    await paintOpportunity(page)
    // Retain exact element references. The owned stylesheet never touches their
    // inline CSSOM: Chromium can normalize a removed dirty style attribute to
    // an empty attribute, so mutating/restoring inline styles is not byte-exact.
    owned = await page.evaluateHandle(() => {
      const entries = [...document.querySelectorAll(".gn-content-auto")].map(element => {
        const rect = element.getBoundingClientRect()
        return { element, style: element.getAttribute("style"), before: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } }
      })
      const body = document.body.getBoundingClientRect()
      return { entries, beforeHeight: document.documentElement.scrollHeight, beforeWidth: document.documentElement.scrollWidth, beforeBody: { top: body.top, left: body.left, width: body.width, height: body.height } }
    })
    result = await owned.evaluate(state => {
      state.paintStyle = document.createElement("style")
      // Keep the formatting context supplied implicitly by content-visibility.
      // Removing layout containment could collapse child margins through their
      // parent and turn a paint-only capture into a different page layout.
      state.paintStyle.textContent = ".gn-content-auto { content-visibility: visible !important; contain: layout style paint !important; }"
      document.head.appendChild(state.paintStyle)
      const body = document.body.getBoundingClientRect()
      return {
        conditioning: "review-only-eager-paint-after-normal-scroll",
        override: ".gn-content-auto { content-visibility: visible !important; contain: layout style paint !important; }",
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
    await page.screenshot({ path, fullPage: true, animations: "disabled", caret: "hide" })
    result.screenshotOptions = { fullPage: true, animations: "disabled", caret: "hide" }
    result.scrollSteps = steps
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
