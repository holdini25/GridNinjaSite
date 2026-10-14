import assert from "node:assert/strict"
import { devices } from "@playwright/test"
import { assertCompleteTransfer, collectTransfers, isProtectedMeasurement, measurementEnvironment, settleTransfers, verifyMeasurementDocument } from "./performance-contract.mjs"
import { LIGHTHOUSE_RESOURCE_BUDGETS } from "../seo/validate-lighthouse-budgets.mjs"
import { authorizeHostedContext } from "./hosted-auth.mjs"

export const SCROLLED_TRANSFER_PROTOCOL = Object.freeze({ protocol: "settled-viewport-visits", maximumSteps: 100, settleQuietMs: 750, settleTimeoutMs: 15_000 })

/** Apply resource ceilings to the cumulative ledger too: Lighthouse's initial
 * viewport alone cannot qualify the later lazy-loaded editorial illustrations. */
export function assertScrolledTransfer(transfer, options) {
  assertCompleteTransfer(transfer, options)
  const bytesOf = type => transfer.requests.filter(request => request.type?.toLowerCase() === type).reduce((sum, request) => sum + request.bytes, 0)
  assert(bytesOf("font") <= LIGHTHOUSE_RESOURCE_BUDGETS.fontBytes, "Full-scroll font transfer exceeds budget")
  for (const request of transfer.requests.filter(request => request.type?.toLowerCase() === "image")) assert(request.bytes <= LIGHTHOUSE_RESOURCE_BUDGETS.largestImageBytes, "Full-scroll image transfer exceeds budget")
  if (options.route.startsWith("/insights/")) assert(bytesOf("script") <= LIGHTHOUSE_RESOURCE_BUDGETS.insightScriptBytes, "Full-scroll insight script transfer exceeds budget")
}

/** Visit each viewport until its transfers settle before moving on. A rapid
 * programmatic fling can start and immediately suspend a native video request;
 * that measures cancellation, not the complete assets encountered by a reader.
 * The same cumulative ledger still rejects every failed or incomplete request.
 */
export async function visitScrolledPage(page, settle) {
  const steps = []
  for (let step = 0; step < SCROLLED_TRANSFER_PROTOCOL.maximumSteps; step++) {
    await page.evaluate(async () => {
      const bottom = Math.max(0, document.documentElement.scrollHeight - innerHeight)
      window.scrollTo({ top: Math.min(bottom, scrollY + Math.max(1, innerHeight * .8)), behavior: "instant" })
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    const transfer = await settle()
    // Lazy content can change the document during settlement. Test the current
    // bottom, never the stale height from before those resources arrived.
    const position = await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight, viewportHeight: innerHeight }))
    steps.push({ ...position, cumulativeBytes: transfer.bytes })
    if (position.y >= Math.max(0, position.height - position.viewportHeight) - 1) return { complete: true, steps, protocol: "settled-viewport-visits" }
  }
  return { complete: false, steps, protocol: "settled-viewport-visits" }
}

/** Separate transfer observations, not additional Lighthouse/LCP samples.
 * Each fresh context accounts for initial loading and every scroll-triggered
 * resource with one ledger, so the two cumulative totals must not be added. */
export async function measureScrolledRoutes(browser, { matrix, baseURL, buildSettings, desktopViewport, qualificationEnvironment = /** @type {Record<string, string> | undefined} */ (undefined) }) {
  const environment = await measurementEnvironment()
  if (qualificationEnvironment !== undefined) assert.deepEqual(environment, qualificationEnvironment, "Full-scroll qualification environment differs from page provenance")
  assert.equal(baseURL, environment.measurementOrigin, "Full-scroll URL differs from qualification environment")
  const results = []
  for (const route of matrix.routes) for (const profile of matrix.profiles) for (let run = 1; run <= matrix.runs; run++) {
    const context = await browser.newContext(profile === "desktop" ? { viewport: desktopViewport } : devices["Pixel 5"])
    if (isProtectedMeasurement()) await authorizeHostedContext(context, new URL(baseURL).origin)
    const page = await context.newPage()
    const ledger = await collectTransfers(await context.newCDPSession(page))
    const result = { route, profile, run, qualificationEnvironment: environment, documentIdentity: null, freshContext: true, complete: false, failure: null, pageErrors: [] }
    results.push(result)
    page.on("pageerror", error => result.pageErrors.push(error.message))
    try {
      const response = await page.goto(baseURL + route, { waitUntil: "load", timeout: 30_000 })
      result.initialTransfer = await settleTransfers(ledger)
      assertScrolledTransfer(result.initialTransfer, { route, profile, buildSettings })
      result.scroll = await visitScrolledPage(page, async () => {
        const snapshot = await settleTransfers(ledger, { quiet: SCROLLED_TRANSFER_PROTOCOL.settleQuietMs, timeout: SCROLLED_TRANSFER_PROTOCOL.settleTimeoutMs })
        assertScrolledTransfer(snapshot, { route, profile, buildSettings })
        return snapshot
      })
      assert(result.scroll.complete, "Full-page scroll exceeded its bounded step count")
      result.fullPageTransfer = await settleTransfers(ledger)
      assert(result.fullPageTransfer.bytes >= result.initialTransfer.bytes, "Full-page accounting omitted initial transfer")
      assertScrolledTransfer(result.fullPageTransfer, { route, profile, buildSettings })
      result.images = await page.locator("main img").evaluateAll(images => images.filter(image => image.getClientRects().length > 0).map(image => ({ src: image.currentSrc || image.src, complete: image.complete, width: image.naturalWidth, height: image.naturalHeight })))
      assert(result.images.every(image => image.complete && image.width > 0 && image.height > 0), "A visible page image failed or remained undecoded after full scrolling")
      if (route === "/") assert(!result.fullPageTransfer.requests.some(request => /\.glb$/.test(new URL(request.url).pathname)), "Cinematic homepage acquired a 3D model")
      assert.deepEqual(result.pageErrors, [], "Page errors occurred during full-scroll observation")
      if (environment.name === "public-production") {
        assert(response, "Missing navigation response for public full-scroll document proof")
        result.documentIdentity = await verifyMeasurementDocument(await response.body(), { url: response.url(), status: response.status(), headers: await response.allHeaders() })
        assert(result.documentIdentity, "Missing public full-scroll document identity")
      }
      result.complete = true
    } catch (error) {
      result.failure = error instanceof Error ? error.message : String(error)
      result.fullPageTransfer ??= ledger.snapshot()
    } finally { await context.close() }
    console.log(JSON.stringify({ kind: "scrolled-transfer", route, profile, run, complete: result.complete, bytes: result.fullPageTransfer?.bytes, failure: result.failure }))
  }
  return results
}
