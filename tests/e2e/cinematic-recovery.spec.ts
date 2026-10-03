import { expect, test, type Page } from "@playwright/test"

test.skip(process.env.CINEMATIC_E2E !== "1", "Requires an explicitly selected cinematic candidate; a skipped run is not recovery evidence")

const moviePath = "**/assets/cinematic/**/*.mp4"
function acquisitions(page: Page) {
  const movies = new Set<string>(), models: string[] = []
  page.on("request", request => {
    const path = new URL(request.url()).pathname
    if (path.endsWith(".mp4")) movies.add(request.url())
    if (path.endsWith(".glb")) models.push(request.url())
  })
  return { movies, models }
}
async function openScene(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/", { waitUntil: "domcontentloaded" })
  const player = page.getByTestId("cinematic-facility")
  await player.locator(".cinematic-stage").scrollIntoViewIfNeeded()
  return { player, decision: await page.locator(".gn-home-decision").textContent() }
}
async function assertRecovered(page: Page, evidence: ReturnType<typeof acquisitions>, decision: string | null) {
  const player = page.getByTestId("cinematic-facility")
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 20_000 })
  await expect(player).toHaveAttribute("data-frame-ready", "true")
  await expect(player).toHaveAttribute("data-frame-evidence", "presented-frame")
  await expect.poll(() => player.locator("video").evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(.05)
  expect(evidence.movies.size).toBe(1)
  expect(evidence.models).toEqual([])
  expect(await page.locator(".gn-home-decision").textContent()).toBe(decision)
  await expect(page.locator(".gn-home-decision")).toContainText("7.0 MW")
  await expect(page.locator(".gn-home-decision")).toContainText("5.8 MW")
  await expect(page.locator(".gn-home-decision a")).toHaveAttribute("href", "/evidence/assessments/demo-01-b/v1.0.0")
}

for (const width of [390, 1440]) test(`an initial poster HTTP failure reloads the same picture and recovers after Retry at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 })
  const evidence = acquisitions(page), posterRequests: { url: string; allowed: boolean; at: number }[] = []
  let allow = false
  await page.route("**/assets/cinematic/**/poster-*.webp", route => {
    posterRequests.push({ url: route.request().url(), allowed: allow, at: Date.now() })
    return allow ? route.continue() : route.fulfill({ status: 503, contentType: "text/plain", headers: { "cache-control": "no-store" }, body: "Temporary poster test failure" })
  })
  const { player, decision } = await openScene(page)
  const poster = player.locator(".cinematic-poster img"), originalNode = await poster.elementHandle()
  await expect(player).toHaveAttribute("data-reason", "poster-unavailable")
  await expect(player).toContainText("Facility illustration unavailable")
  expect(await poster.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(0)
  expect(evidence.movies.size).toBe(0)
  const failedSource = await poster.evaluate(element => (element as HTMLImageElement).currentSrc)
  const retryAt = Date.now()
  allow = true
  await player.getByRole("button", { name: "Retry facility illustration", exact: true }).click()
  await assertRecovered(page, evidence, decision)
  await expect(player).toHaveAttribute("data-rendition", width === 390 ? "mobile" : "desktop")
  expect(await poster.evaluate((element, original) => element === original, originalNode)).toBe(true)
  expect(await poster.evaluate(element => (element as HTMLImageElement).currentSrc)).toBe(failedSource)
  expect(await poster.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  expect(posterRequests.filter(request => request.allowed)).toHaveLength(1)
  expect(new Set(posterRequests.map(request => request.url))).toEqual(new Set([failedSource]))
  expect(posterRequests.some(request => !request.allowed)).toBe(true)
  expect(posterRequests.find(request => request.allowed)!.at).toBeGreaterThanOrEqual(retryAt)
  await testInfo.attach("native-poster-retry", { body: Buffer.from(JSON.stringify({ width, retryAt, posterRequests, retainedImageNode: true, source: failedSource })), contentType: "application/json" })
})

test("an actual first MP4 HTTP failure preserves the poster and Retry presents native frames", async ({ page }) => {
  const evidence = acquisitions(page)
  let allow = false, failures = 0
  await page.route(moviePath, route => {
    if (allow) return route.continue()
    failures++
    return route.fulfill({ status: 503, contentType: "text/plain", headers: { "cache-control": "no-store" }, body: "Temporary cinematic test failure" })
  })
  const { player, decision } = await openScene(page)
  await expect(player).toHaveAttribute("data-state", "error", { timeout: 20_000 })
  await expect(player).toHaveAttribute("data-frame-ready", "false")
  await expect(player.locator(".cinematic-poster img")).toBeVisible()
  await expect(player).toContainText("Animation unavailable")
  expect(failures).toBeGreaterThan(0)
  const rendition = await player.getAttribute("data-rendition")
  allow = true
  await player.getByRole("button", { name: "Retry facility animation", exact: true }).click()
  await assertRecovered(page, evidence, decision)
  await expect(player).toHaveAttribute("data-rendition", rendition!)
})

test("injected play refusal requires intentional Play before native presentation", async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: "fault-injection", description: "One HTMLMediaElement.play() NotAllowedError is injected. This verifies application recovery, not operating-system autoplay policy." })
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play
    let refused = false
    HTMLMediaElement.prototype.play = function () {
      if (!refused && this instanceof HTMLVideoElement && this.classList.contains("cinematic-video")) {
        refused = true
        return Promise.reject(new DOMException("Injected autoplay refusal", "NotAllowedError"))
      }
      return original.call(this)
    }
  })
  const evidence = acquisitions(page), { player, decision } = await openScene(page)
  await expect(player).toHaveAttribute("data-state", "blocked")
  await expect(player).toHaveAttribute("data-reason", "autoplay")
  await expect(player).toHaveAttribute("data-frame-ready", "false")
  await expect(player).toContainText("Select Play")
  await page.locator(".gn-home-invitation").scrollIntoViewIfNeeded()
  await player.locator(".cinematic-stage").scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute("data-state", "blocked")
  await player.getByRole("button", { name: "Play facility animation", exact: true }).click()
  await assertRecovered(page, evidence, decision)
})

test("a supported Save-Data signal prevents automatic acquisition while intentional Play works", async ({ page }, testInfo) => {
  testInfo.annotations.push({ type: "preference-input", description: "A supported connection.saveData input is supplied through an EventTarget; this is not a physical device data-saving qualification." })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { configurable: true, value: Object.assign(new EventTarget(), { saveData: true, effectiveType: "4g" }) })
  })
  const evidence = acquisitions(page), { player, decision } = await openScene(page)
  await expect(player).toHaveAttribute("data-reason", "save-data")
  await expect(player.locator(".cinematic-poster img")).toBeVisible()
  await page.waitForTimeout(500)
  await expect(player.locator("video")).not.toHaveAttribute("src")
  expect(evidence.movies.size).toBe(0)
  await player.getByRole("button", { name: "Play facility animation", exact: true }).click()
  await assertRecovered(page, evidence, decision)
})

test("a genuinely stalled startup reaches its eligible deadline and recovers only after Retry", async ({ page }, testInfo) => {
  test.setTimeout(45_000)
  const evidence = acquisitions(page)
  let release = () => {}, requested = false
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(moviePath, async route => { requested = true; await gate; await route.continue().catch(() => {}) })
  try {
    const started = Date.now(), { player, decision } = await openScene(page)
    await expect.poll(() => requested).toBe(true)
    await expect(player).toHaveAttribute("data-state", "loading")
    await expect(player).toHaveAttribute("data-state", "error", { timeout: 20_000 })
    await expect(player).toHaveAttribute("data-reason", "timeout")
    const elapsedMs = Date.now() - started
    expect(elapsedMs).toBeGreaterThanOrEqual(14_000)
    await expect(player).toHaveAttribute("data-frame-ready", "false")
    await expect(player.locator(".cinematic-poster img")).toBeVisible()
    release()
    await page.unroute(moviePath)
    await page.waitForTimeout(300)
    await expect(player).toHaveAttribute("data-state", "error")
    await player.getByRole("button", { name: "Retry facility animation", exact: true }).click()
    await assertRecovered(page, evidence, decision)
    await testInfo.attach("native-startup-timeout", { body: Buffer.from(JSON.stringify({ elapsedMs, cause: "real held HTTP request", reason: "timeout", recoveredRenditions: [...evidence.movies] })), contentType: "application/json" })
  } finally { release(); await page.unroute(moviePath) }
})
