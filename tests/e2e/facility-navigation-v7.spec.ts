import { expect, test } from "@playwright/test"
import { openAssessmentControls, scrollFacilityIntoView } from "../support/facility-viewer"

test.describe("v7 contextual inspection journeys", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
  })

  test("home keeps inspection journeys native and loads no specimen before an explicit demo action", async ({ page }) => {
    const models: string[] = []
    page.on("request", request => { if (request.url().endsWith(".glb")) models.push(request.url()) })
    await page.goto("/")
    const inspector = page.getByTestId("facility-inspection")
    const journeys = inspector.getByRole("navigation", { name: "Continue facility inspection" })
    await expect(inspector.getByRole("button", { name: "Follow one workload", exact: true })).toHaveCount(0)
    await expect(inspector.getByRole("button", { name: "Inspect rack construction", exact: true })).toHaveCount(0)
    await expect(journeys.getByRole("link", { name: "Inspect rack construction", exact: true })).toHaveAttribute("href", "/demo?scenario=b&version=1.0.0&perspective=business&focus=rack-02#facility-construction")
    await expect(journeys.getByRole("link", { name: "Follow one workload", exact: true })).toHaveAttribute("href", "/demo?scenario=b&version=1.0.0&perspective=business&focus=rack-02#workload-story")
    for (const [label, id] of [["Inspect rack construction", "facility-construction"], ["Follow one workload", "workload-story"]]) {
      if (id === "workload-story") await page.goto("/")
      await journeys.getByRole("link", { name: label, exact: true }).click()
      await expect(page).toHaveURL(url => url.searchParams.get("focus") === "rack-02" && url.hash === `#${id}`)
      await expect(page.getByTestId("facility-inspection").locator(".facility-systems button").first()).toBeVisible()
      const destination = page.locator(`#${id}`)
      await expect(destination).toBeFocused()
      await expect.poll(async () => (await destination.boundingBox())!.y).toBeGreaterThan(70)
      await expect.poll(async () => (await destination.boundingBox())!.y).toBeLessThan(110)
      await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "b")
      await expect(page.getByTestId("assessment-summary")).toContainText("Decision still to make")
      await expect(page.getByTestId("facility-inspection").locator(".facility-target-label")).toHaveText("Selected equipment: Rack 03")
      expect(models).toEqual([])
    }
  })

  test("deep links restore authored focus without graphics and preserve exact records across history", async ({ page }) => {
    await page.goto("/demo?scenario=d&version=1.0.0&perspective=engineering&focus=rack-02&topic=ai-cloud")
    const inspector = page.getByTestId("facility-inspection")
    await expect(inspector).toHaveAttribute("data-night-inspection", "true")
    await scrollFacilityIntoView(inspector)
    await expect(inspector.getByRole("button", { name: "Cooling", exact: true })).toBeVisible()
    await openAssessmentControls(page)
    await expect(inspector).toHaveAttribute("data-phase", "poster")
    await expect(inspector.locator(".facility-target-label")).toHaveText("Selected equipment: Rack 03")
    const original = await page.getByTestId("assessment-summary").textContent()
    await inspector.locator(".facility-systems").getByRole("button", { name: "Cooling", exact: true }).click()
    await expect(page).toHaveURL(/focus=cooling/)
    await expect(page.getByTestId("assessment-summary")).toHaveText(original!)
    await page.goBack()
    await expect(inspector.locator(".facility-target-label")).toHaveText("Selected equipment: Rack 03")
    await expect(page.getByTestId("assessment-summary")).toContainText("Unknown")
    await page.getByRole("combobox", { name: "Perspective", exact: true }).selectOption("business")
    expect(new URL(page.url()).searchParams.has("focus")).toBe(false)
    await expect(inspector.locator('.facility-systems [aria-pressed="true"]')).toHaveCount(0)
    await expect(inspector).not.toContainText("5.8 MW")
  })

  test("unknown focus clears only selection; conflicting assessment identities remain unavailable", async ({ page }) => {
    await page.goto("/demo?scenario=d&focus=unlisted&topic=private@example.com")
    const inspector = page.getByTestId("facility-inspection")
    await expect(page.getByTestId("assessment-summary")).toContainText("Unknown")
    await expect(inspector.locator('.facility-systems [aria-pressed="true"]')).toHaveCount(0)
    await page.goto("/demo?scenario=d&scenario=b&focus=power")
    await expect(page.getByRole("heading", { name: "Requested example unavailable" })).toBeVisible()
    await expect(inspector).toHaveCount(0)
  })

  test("solution still entry carries an editable public topic through named scoping navigation", async ({ page }) => {
    const models: string[] = []
    page.on("request", request => { if (request.url().endsWith(".glb")) models.push(request.url()) })
    await page.goto("/solutions/colocation")
    const entry = page.locator('a[href^="/demo?"][href*="focus=workloads"][href*="topic=colocation"]')
    await expect(entry).toHaveAttribute("href", /scenario=b.*focus=workloads.*topic=colocation/)
    expect(models).toEqual([])
    await entry.click()
    const inspector = page.getByTestId("facility-inspection")
    await scrollFacilityIntoView(inspector)
    await expect(inspector.locator('.facility-systems button[aria-pressed="true"]')).toContainText("Workloads")
    const context = inspector.getByTestId("facility-contextual-inspector")
    await context.locator("summary").filter({ hasText: /^Evidence$/ }).click()
    await expect(context.getByRole("link", { name: "Read this versioned decision brief" })).toHaveAttribute("href", "/evidence/assessments/demo-01-b/v1.0.0")
    await context.locator("summary").filter({ hasText: /^Next step$/ }).click()
    await context.getByRole("link", { name: "Scope an assessment" }).click()
    await expect(page.getByLabel("Topic (optional)")).toHaveValue("colocation")
    await page.getByLabel("Topic (optional)").selectOption("cooling")
    await expect(page.getByLabel("Topic (optional)")).toHaveValue("cooling")
    expect(models).toEqual([])
  })

  test("no-JavaScript focus and evidence remain usable as HTML", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
    try {
      const page = await context.newPage()
      await page.goto("/demo?scenario=d&focus=cooling")
      const inspector = page.getByTestId("facility-inspection")
      await expect(inspector.locator(".facility-explanation-copy")).toContainText("No cooling evidence")
      await inspector.getByTestId("facility-contextual-inspector").locator("summary").filter({ hasText: /^Evidence$/ }).click()
      await expect(inspector.getByRole("link", { name: "Read this versioned decision brief" })).toHaveAttribute("href", "/evidence/assessments/demo-01-d/v1.0.0")
      await expect(inspector.locator("canvas")).toHaveCount(0)
    } finally { await context.close() }
  })
})
