import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("mobile decision comes first and assessment scoping clears the header", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
  await page.goto("/demo?topic=ai-cloud")
  const summary = page.getByTestId("assessment-summary"), stage = page.locator(".facility-stage")
  expect((await summary.boundingBox())!.y).toBeLessThan((await stage.boundingBox())!.y)
  await expect(summary).toContainText("7.0 MW")
  await expect(summary).toContainText("5.8 MW")
  const link = page.locator('a[href*="source=demo-final"]')
  await expect(link).toHaveAttribute("href", /topic=ai-cloud.*#scope/)
  await link.click()
  await expect(page).toHaveURL(/assessment.*topic=ai-cloud.*#scope/)
  const scope = page.locator("#scope"), header = page.locator("body > header")
  await expect.poll(async () => (await scope.boundingBox())!.y).toBeGreaterThan(70)
  expect((await scope.boundingBox())!.y).toBeLessThan(110)
  if (await header.count()) expect((await scope.boundingBox())!.y).toBeGreaterThan((await header.boundingBox())!.height)
  await expect(page.getByLabel("Topic (optional)", { exact: true })).toHaveValue("ai-cloud")
})

test("a construction deep link offers activation without downloading the specimen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
  const models: string[] = []
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".glb")) models.push(request.url()) })
  await page.goto("/demo?focus=rack-02#facility-construction")
  const viewer = page.getByTestId("facility-inspection")
  await expect(viewer.getByRole("button", { name: "Load 3D to inspect construction", exact: true })).toBeVisible()
  expect(models).toEqual([])
  await viewer.getByRole("button", { name: "Load 3D to inspect construction", exact: true }).click()
  await expect(viewer).toHaveAttribute("data-phase", "ready")
  expect(models.every(url => url.endsWith("/facility.glb"))).toBe(true)
  await viewer.getByRole("button", { name: "Inspect rack construction", exact: true }).click()
  await expect(viewer).toHaveAttribute("data-view", "rack")
  await expect(viewer.getByRole("group", { name: "Representative rack assembly", exact: true })).toBeFocused()
  await viewer.getByRole("button", { name: "Return to facility", exact: true }).click()
  await expect(viewer).toHaveAttribute("data-view", "overview")
  await expect(viewer.getByRole("group", { name: "Facility model", exact: true })).toBeFocused()
})

test("decision and inquiry pages have no automated accessibility violations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
  for (const route of ["/", "/demo", "/assessment", "/contact"]) {
    await page.goto(route)
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    expect(result.violations, route).toEqual([])
  }
})
