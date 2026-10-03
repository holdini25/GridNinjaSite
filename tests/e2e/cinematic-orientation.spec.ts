import { expect, test, type Page } from "@playwright/test"

test.skip(process.env.CINEMATIC_E2E !== "1", "Requires the explicitly selected cinematic candidate; absence is not orientation evidence")

function mediaRequests(page: Page) {
  const movies = new Set<string>(), posters = new Set<string>()
  page.on("request", request => {
    const path = new URL(request.url()).pathname
    if (path.endsWith(".mp4")) movies.add(path)
    if (/\/poster-(mobile|desktop)\.webp$/.test(path)) posters.add(path)
  })
  return { movies, posters }
}

async function assertMobileFallback(page: Page, selectedPoster: string) {
  const player = page.getByTestId("cinematic-facility")
  await expect(player).toHaveAttribute("data-rendition", "mobile")
  await expect(player).toHaveAttribute("data-frame-ready", "false")
  await expect.poll(() => player.locator(".cinematic-poster img").evaluate(image => (image as HTMLImageElement).currentSrc)).toBe(selectedPoster)
  await expect(player.locator(".gn-home-annotations--mobile")).toBeVisible()
  await expect(player.locator(".gn-home-annotations--desktop")).toBeHidden()
  await expect(page.locator(".gn-home-decision")).toContainText("7.0 MW")
  await expect(page.locator(".gn-home-decision")).toContainText("5.8 MW")
  await expect(page.locator(".gn-home-decision a")).toHaveAttribute("href", "/evidence/assessments/demo-01-b/v1.0.0")
}

test("phone-to-landscape reduced-motion fallback retains the selected poster and projected annotations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  const requests = mediaRequests(page)
  await page.goto("/")
  const player = page.getByTestId("cinematic-facility"), poster = player.locator(".cinematic-poster img")
  await player.locator(".cinematic-stage").scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 20_000 })
  await expect(player).toHaveAttribute("data-rendition", "mobile")
  const selectedPoster = await poster.evaluate(image => (image as HTMLImageElement).currentSrc)
  const originalNode = await poster.elementHandle()
  expect(selectedPoster).toMatch(/\/poster-mobile\.webp$/)
  const decision = await page.locator(".gn-home-decision").textContent()
  await page.setViewportSize({ width: 844, height: 390 })
  await player.locator(".cinematic-stage").scrollIntoViewIfNeeded()
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(player).toHaveAttribute("data-reason", "reduced-motion")
  await assertMobileFallback(page, selectedPoster)
  expect(await poster.evaluate((image, previous) => image === previous, originalNode)).toBe(true)
  expect(requests.movies.size).toBe(1)
  expect([...requests.movies][0]).toMatch(/\/mobile\.mp4$/)
  expect([...requests.posters]).toEqual([new URL(selectedPoster).pathname])
  expect(await page.locator(".gn-home-decision").textContent()).toBe(decision)
  await originalNode?.dispose()
})

test("phone movie failure and Retry after rotation retain the matching poster until native presentation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  let allowMovie = false
  await page.route("**/assets/cinematic/**/*.mp4", route => allowMovie ? route.continue() : route.fulfill({ status: 503, contentType: "text/plain", body: "Temporary orientation recovery fixture" }))
  const requests = mediaRequests(page)
  await page.goto("/")
  const player = page.getByTestId("cinematic-facility")
  await player.locator(".cinematic-stage").scrollIntoViewIfNeeded()
  await expect(player).toHaveAttribute("data-state", "error", { timeout: 20_000 })
  const selectedPoster = await player.locator(".cinematic-poster img").evaluate(image => (image as HTMLImageElement).currentSrc)
  expect(selectedPoster).toMatch(/\/poster-mobile\.webp$/)
  await page.setViewportSize({ width: 844, height: 390 })
  await player.locator(".cinematic-stage").scrollIntoViewIfNeeded()
  await assertMobileFallback(page, selectedPoster)
  allowMovie = true
  await player.getByRole("button", { name: "Retry facility animation", exact: true }).click()
  await expect(player).toHaveAttribute("data-state", "playing", { timeout: 20_000 })
  await expect(player).toHaveAttribute("data-frame-evidence", "presented-frame")
  await expect(player).toHaveAttribute("data-rendition", "mobile")
  expect(requests.movies.size).toBe(1)
  expect([...requests.posters]).toEqual([new URL(selectedPoster).pathname])
})
