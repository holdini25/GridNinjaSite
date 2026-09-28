import { expect, test } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

// Ordinary CI does not publish or select unreviewed cinematic media. Explicit
// candidate qualification must opt in; a skipped run is not animation evidence.
test.skip(process.env.CINEMATIC_E2E !== "1", "Requires an explicitly selected cinematic candidate")

test("cinematic home preserves the offer and evidence without loading a Three viewer", async ({ page }) => {
  const models: string[] = []
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".glb")) models.push(request.url()) })
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Understand your capacity\.\s*Know the limits\./)
  const hero = page.locator(".gn-home-hero")
  await expect(hero.getByRole("link", { name: /Scope an assessment/ })).toHaveAttribute("href", /\/assessment/)
  await expect(hero.getByRole("link", { name: /See a sample decision brief/ })).toHaveAttribute("href", /\/demo.*#decision-brief/)
  await expect(hero.getByRole("link", { name: "Inspect the illustrative facility" })).toHaveAttribute("href", "/demo?scenario=b&version=1.0.0&perspective=business&activate=1#facility-construction")
  await expect(hero).toContainText("paid, bounded assessment")
  await expect(hero).toContainText("7.0 MW")
  await expect(hero).toContainText("5.8 MW")
  await expect(hero).toContainText("20.0 MW")
  await expect(hero).toContainText("Economics unestimated")
  await expect(hero).toContainText("No site action is authorized")
  await expect(page.locator("canvas")).toHaveCount(0)
  await expect(page.getByTestId("facility-inspection")).toHaveCount(0)
  expect(models).toEqual([])
})

test("native animation presents frames, pauses, and resumes without changing the decision", async ({ page, isMobile }, testInfo) => {
  if (!isMobile) await page.setViewportSize({ width: 1366, height: 768 })
  const models: string[] = []
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".glb")) models.push(request.url()) })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  const player = page.getByTestId("cinematic-facility"), video = player.locator("video")
  await player.scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 20_000 })
  await expect(player).toHaveAttribute("data-frame-ready", "true")
  await expect(player).toHaveAttribute("data-frame-evidence", "presented-frame")
  const decision = await page.locator(".gn-home-decision").textContent()
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(.2)
  await player.getByRole("button", { name: "Pause facility animation" }).click()
  await expect(player).toHaveAttribute("data-state", "paused")
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath("homepage-paused.png"), fullPage: isMobile })
  const paused = await video.evaluate(element => ({ time: (element as HTMLVideoElement).currentTime, paused: (element as HTMLVideoElement).paused }))
  expect(paused.paused).toBe(true)
  await page.locator(".gn-home-invitation").scrollIntoViewIfNeeded()
  await player.scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute("data-state", "paused")
  expect(await video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeCloseTo(paused.time, 1)
  await player.getByRole("button", { name: "Play facility animation" }).click()
  await expect(player).toHaveAttribute("data-state", "playing")
  await expect(page.locator("canvas")).toHaveCount(0)
  expect(models).toEqual([])
  expect(await page.locator(".gn-home-decision").textContent()).toBe(decision)
})

test("native playback suspends offscreen and resumes when the scene returns", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/")
  const player = page.getByTestId("cinematic-facility")
  await player.scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 20_000 })
  const selected = await player.locator("video").getAttribute("src")
  await page.locator(".gn-home-invitation").scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute("data-state", "suspended")
  await expect(player).toHaveAttribute("data-reason", "offscreen")
  expect(await player.locator("video").evaluate(element => (element as HTMLVideoElement).paused)).toBe(true)
  await player.scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute("data-state", "playing")
  await expect(player.locator("video")).toHaveAttribute("src", selected!)
})

test("homepage content reflows at 320px and exposes accessible controls and contrast", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
  expect(scan.violations).toEqual([])
  await page.addStyleTag({ content: ".gn-home :is(h1,h2,h3,p,li,dt,dd,a,button) { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .gn-home p { margin-bottom: 2em !important; }" })
  const clipped = await page.locator(".gn-home :is(h1,h2,h3,p,dt,dd), .gn-home-actions a").evaluateAll(nodes => nodes.filter(node => !node.closest('[aria-hidden="true"]')).filter(node => {
    const rect = node.getBoundingClientRect()
    return rect.left < -1 || rect.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 1
  }).map(node => node.textContent))
  expect(clipped).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test("cinematic media delivers exact ranges and revalidates before slicing", async ({ request }) => {
  const release = process.env.CINEMATIC_ASSET_RELEASE ?? "cinematic-v1"
  const url = `/assets/cinematic/${release}/desktop.mp4`
  const part = await request.get(url, { headers: { Range: "bytes=0-31" } })
  expect(part.status()).toBe(206)
  expect(part.headers()["content-type"]).toBe("video/mp4")
  expect(part.headers()["content-range"]).toMatch(/^bytes 0-31\/\d+$/)
  expect((await part.body()).length).toBe(32)
  const etag = part.headers().etag
  expect(etag).toMatch(/^"[a-f0-9]{64}"$/)
  const cached = await request.get(url, { headers: { "If-None-Match": etag, Range: "bytes=0-31" } })
  expect(cached.status()).toBe(304)
  const head = await request.head(url, { headers: { Range: "bytes=0-31" } })
  expect(head.status()).toBe(200)
  expect(Number(head.headers()["content-length"])).toBeGreaterThan(32)
  expect((await head.body()).length).toBe(0)
  const outside = await request.get(url, { headers: { Range: "bytes=99999999-" } })
  expect(outside.status()).toBe(416)
  expect(outside.headers()["content-range"]).toMatch(/^bytes \*\/\d+$/)
  expect((await request.get(`/assets/cinematic/${release}/manifest.json`)).status()).toBe(404)
})

test("reduced motion keeps the finished poster and acquires video only after deliberate Play", async ({ page }) => {
  const movies: string[] = []
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".mp4")) movies.push(request.url()) })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  const player = page.getByTestId("cinematic-facility")
  await player.scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute("data-reason", "reduced-motion")
  await expect(player.locator(".cinematic-poster img")).toBeVisible()
  await expect(player.locator("video")).not.toHaveAttribute("src")
  expect(movies).toEqual([])
  await player.getByRole("button", { name: "Play facility animation" }).click()
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 20_000 })
  expect(new Set(movies).size).toBe(1)
})

test("orientation reflow preserves the selected movie and keeps the page within its viewport", async ({ page }) => {
  const movies = new Set<string>()
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".mp4")) movies.add(request.url()) })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  const player = page.getByTestId("cinematic-facility")
  await player.scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 20_000 })
  await expect(player).toHaveAttribute("data-rendition", "mobile")
  const original = await player.locator("video").getAttribute("src")
  await page.setViewportSize({ width: 844, height: 390 })
  await player.scrollIntoViewIfNeeded()
  await expect(player.locator("video")).toHaveAttribute("src", original!)
  await expect(player).toHaveAttribute("data-rendition", "mobile")
  expect(movies.size).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test("no JavaScript retains the illustration, decision and native navigation", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const movies: string[] = []
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".mp4")) movies.push(request.url()) })
  try {
    await page.goto("/")
    await expect(page.locator(".cinematic-poster img")).toBeVisible()
    await expect(page.locator(".gn-home-decision")).toContainText("5.8 MW")
    await expect(page.getByRole("button", { name: /facility animation/ })).toHaveCount(0)
    expect(movies).toEqual([])
    await page.locator(".gn-home-hero").getByRole("link", { name: /See a sample decision brief/ }).click()
    await expect(page).toHaveURL(/\/demo.*#decision-brief/)
  } finally { await context.close() }
})
