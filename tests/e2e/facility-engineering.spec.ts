import AxeBuilder from "@axe-core/playwright"
import { scrollFacilityIntoView, openFacilityDisplayOptions, chooseFacilityStillImage } from "../support/facility-viewer"
import { expect, test, type Page, type Locator } from "@playwright/test"

async function openEngineering(page: Page, scenario = "b") {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(`/demo?scenario=${scenario}&perspective=engineering`)
  const inspector = page.getByTestId("facility-inspection")
  await scrollFacilityIntoView(inspector)
  await expect(inspector).toHaveAttribute("data-engineering", "true")
  await expect(inspector).toHaveAttribute("data-phase", "ready")
  return inspector
}

test.describe("facility engineering inspection", () => {
  test("mobile assembly entry reveals the model while joint actions preserve reading position", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Exercises naturally offscreen mobile inspection controls")
    const inspector = await openEngineering(page)
    const stage = inspector.locator(".facility-stage")
    const choose = async (control: Locator, view: "overview" | "rack" | "cooling") => {
      // Reproduce reading/tapping the controls below the model. No stage scroll
      // helper runs after activation; the product must reveal its own response.
      await control.evaluate(element => element.scrollIntoView({ behavior: "instant", block: "center" }))
      await control.click()
      // The old scene remains usable while staging; measure only after the
      // requested view commits and its above-stage controls have changed.
      await expect(inspector).toHaveAttribute("data-view", view)
      await expect(stage).toBeFocused()
      await expect(stage).toBeInViewport({ ratio: 0.95 })
      await expect.poll(() => inspector.locator(".facility-heading").evaluate(element => {
        const header = document.querySelector("header")
        return element.getBoundingClientRect().top - (header?.getBoundingClientRect().bottom ?? 0)
      })).toBeGreaterThanOrEqual(0)
    }
    await choose(inspector.getByRole("button", { name: "Inspect rack construction", exact: true }), "rack")
    await expect(inspector).toHaveAttribute("data-view", "rack")
    for (const [name, pose] of [["Cutaway view", "cutaway"], ["Extend server tray", "service"], ["Close rack", "cutaway"], ["Restore side panel", "closed"]]) {
      const action = inspector.locator(".facility-rack-actions").getByRole("button", { name, exact: true })
      await action.scrollIntoViewIfNeeded()
      const scroll = await page.evaluate(() => window.scrollY)
      await action.click()
      await expect(inspector).toHaveAttribute("data-pose", pose)
      expect(Math.abs(await page.evaluate(() => window.scrollY) - scroll)).toBeLessThanOrEqual(2)
    }
    await inspector.locator("summary").filter({ hasText: /^Inspect assembly parts$/ }).click()
    const part = inspector.getByRole("group", { name: "Authored assembly parts" }).getByRole("button").last()
    await part.click()
    await expect(part).toHaveAttribute("aria-pressed", "true")
    await choose(inspector.getByRole("button", { name: "Return to facility", exact: true }), "overview")
    await expect(inspector).toHaveAttribute("data-view", "overview")
    await choose(inspector.getByRole("button", { name: "Inspect cooling construction", exact: true }), "cooling")
    await expect(inspector).toHaveAttribute("data-view", "cooling")
    await choose(inspector.getByRole("button", { name: await inspector.getAttribute("data-ecosystem") ? "Follow one workload" : "Explain this assessment", exact: true }), "overview")
    await expect(inspector).toHaveAttribute("data-view", "overview")
    await choose(inspector.getByRole("button", { name: "Inspect rack construction", exact: true }), "rack")
    await expect(inspector).toHaveAttribute("data-view", "rack")
    await choose(page.getByRole("button", { name: "Reset example", exact: true }), "overview")
    await expect(inspector).toHaveAttribute("data-view", "overview")
    await expect(inspector.getByRole("button", { name: /^(Pause|Resume)$/ })).toHaveCount(0)
    await expect(page.getByTestId("assessment-summary")).toContainText("5.8 MW")
  })

  test("mobile explicit assembly retry reveals the retained model before staging", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Exercises offscreen mobile Retry")
    const inspector = await openEngineering(page)
    await page.route("**/assets/facility/**/*.glb", route => route.request().url().endsWith("/facility.glb") ? route.continue() : route.abort())
    await inspector.getByRole("button", { name: "Inspect rack construction", exact: true }).click()
    const retry = inspector.getByRole("button", { name: "Retry assembly", exact: true })
    await expect(retry).toBeVisible()
    await page.unroute("**/assets/facility/**/*.glb")
    await retry.evaluate(element => element.scrollIntoView({ behavior: "instant", block: "center" }))
    await retry.click()
    await expect(inspector.locator(".facility-stage")).toBeInViewport({ ratio: 0.95 })
    await expect(inspector).toHaveAttribute("data-view", "rack")
    await expect(inspector.locator(".facility-stage")).toBeFocused()
    expect(await inspector.locator(".facility-heading").evaluate(element => element.getBoundingClientRect().top - (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0))).toBeGreaterThanOrEqual(0)
    await expect(retry).toHaveCount(0)
  })

  test("viewpoints, expansion and assembly poses reuse the canvas and preserve assessment quantities", async ({ page }) => {
    const inspector = await openEngineering(page)
    const initialCanvas = await inspector.locator("canvas").elementHandle()
    const caption = await page.getByTestId("assessment-summary").textContent()
    await inspector.getByRole("button", { name: "Expand model", exact: true }).click()
    await expect(inspector.getByRole("button", { name: "Compact model", exact: true })).toHaveAttribute("aria-expanded", "true")
    for (const system of ["Power", "Cooling", "Storage", "Workloads"]) {
      await inspector.locator(".facility-systems").getByRole("button", { name: system, exact: true }).click()
      if (await inspector.getAttribute("data-night-inspection")) {
        const detail = system === "Cooling" ? "View air-path cutaway" : "View rack close-up"
        await inspector.getByRole("button", { name: detail, exact: true }).click()
        await expect(inspector.getByRole("button", { name: detail, exact: true })).toHaveAttribute("aria-pressed", "true")
      } else {
        await inspector.getByRole("button", { name: "Inspect closer", exact: true }).click()
        await expect(inspector.getByRole("button", { name: `${system} view`, exact: true })).toHaveAttribute("aria-pressed", "true")
      }
      await scrollFacilityIntoView(inspector)
      await expect(page.getByTestId("assessment-summary")).toHaveText(caption!)
    }
    await inspector.getByRole("button", { name: "Inspect rack construction", exact: true }).click()
    await scrollFacilityIntoView(inspector)
    await expect(inspector).toHaveAttribute("data-view", "rack")
    await expect(inspector).toContainText("Representative illustrative rack assembly")
    for (const [name, pose] of [["Cutaway view", "cutaway"], ["Extend server tray", "service"], ["Close rack", "cutaway"], ["Restore side panel", "closed"]]) {
      await inspector.locator(".facility-rack-actions").getByRole("button", { name, exact: true }).click()
      await expect(inspector).toHaveAttribute("data-pose", pose)
    }
    await inspector.locator("summary").filter({ hasText: /^Inspect assembly parts$/ }).click()
    await expect(inspector.getByRole("group", { name: "Authored assembly parts" }).getByRole("button")).toHaveCount(6)
    await inspector.getByRole("group", { name: "Authored assembly parts" }).getByRole("button").first().click()
    await expect(inspector.locator(".facility-target-connections")).toContainText("Authored connections")
    await inspector.getByRole("button", { name: "Return to facility", exact: true }).click()
    await scrollFacilityIntoView(inspector)
    await expect(inspector).toHaveAttribute("data-view", "overview")
    expect(await inspector.locator("canvas").evaluate((element, original) => element === original, initialCanvas)).toBe(true)
    await expect(page.getByTestId("assessment-summary")).toHaveText(caption!)
  })

  test("failed assembly transfer keeps the overview usable and retries explicitly", async ({ page }) => {
    const inspector = await openEngineering(page)
    const original = await inspector.locator("canvas").elementHandle()
    const requests: string[] = []
    await page.route("**/assets/facility/**/*.glb", route => {
      if (!route.request().url().endsWith("/facility.glb")) { requests.push(route.request().url()); return route.abort() }
      return route.continue()
    })
    await inspector.getByRole("button", { name: "Inspect rack construction", exact: true }).click()
    await expect(inspector.getByRole("button", { name: "Retry assembly", exact: true })).toBeVisible()
    await expect(inspector).toHaveAttribute("data-view", "overview")
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    await expect(inspector.getByRole("group", { name: "Authored assembly parts" })).toHaveCount(0)
    await expect(page.getByTestId("assessment-summary")).toContainText("5.8 MW")
    expect(requests.length).toBeGreaterThan(0)
    await page.unroute("**/assets/facility/**/*.glb")
    await inspector.getByRole("button", { name: "Retry assembly", exact: true }).click()
    await scrollFacilityIntoView(inspector)
    await expect(inspector).toHaveAttribute("data-view", "rack")
    expect(await inspector.locator("canvas").evaluate((element, before) => element === before, original)).toBe(true)
  })

  test("authored connections and manual walkthrough keep fixture D unknown and accessible", async ({ page }) => {
    const inspector = await openEngineering(page, "d")
    const ecosystem = Boolean(await inspector.getAttribute("data-ecosystem"))
    await inspector.getByRole("button", { name: ecosystem ? "Follow one workload" : "Explain this assessment", exact: true }).click()
    const walkthrough = inspector.getByTestId(ecosystem ? "facility-ecosystem-story" : "facility-walkthrough")
    if (ecosystem) {
      await expect(walkthrough).toContainText("Chapter 1 of 6")
      await expect(walkthrough.getByRole("heading", { name: "Request", exact: true })).toBeVisible()
      await walkthrough.getByRole("button", { name: "Chapter 3: Air and cooling", exact: true }).click()
      await expect(walkthrough).toContainText("Cooling evidence is missing")
      await expect(walkthrough.getByRole("button", { name: "Play story", exact: true })).toBeDisabled()
      await walkthrough.getByRole("button", { name: "Next chapter", exact: true }).click()
      await expect(walkthrough).toContainText("No attribution chart is available")
      await walkthrough.getByRole("button", { name: "Next chapter", exact: true }).click()
      await expect(walkthrough).toContainText("Unknown")
      await expect(walkthrough).not.toContainText("5.8 MW")
      await walkthrough.getByRole("button", { name: "Next chapter", exact: true }).click()
    } else {
    await expect(walkthrough).toContainText("Step 1 of 4")
    await expect(walkthrough.getByRole("heading", { name: "Request", exact: true })).toBeVisible()
    await inspector.getByRole("button", { name: "Next step", exact: true }).click()
    await expect(walkthrough.getByRole("heading", { name: "Conditions", exact: true })).toBeVisible()
    await expect(walkthrough).toContainText("No cooling evidence")
    await expect(walkthrough).toContainText("No attribution chart is available")
    await walkthrough.getByRole("button", { name: "Highlight cooling equipment", exact: true }).click()
    await expect(walkthrough).toContainText("Step 2 of 4")
    await inspector.getByRole("button", { name: "Next step", exact: true }).click()
    await expect(walkthrough.getByRole("heading", { name: "Screening result", exact: true })).toBeVisible()
    await expect(walkthrough).toContainText("Unknown")
    await expect(walkthrough).not.toContainText("5.8 MW")
    await inspector.getByRole("button", { name: "Next step", exact: true }).click()
    }
    await expect(walkthrough.getByRole("heading", { name: "Evidence", exact: true })).toBeVisible()
    await expect(walkthrough.getByRole("link", { name: "Read the versioned brief", exact: true })).toHaveAttribute("href", "/evidence/assessments/demo-01-d/v1.0.0")
    await expect(walkthrough.getByRole("link", { name: "Download this PDF", exact: true })).toHaveAttribute("href", "/downloads/assessment/demo-01-d/v1.0.0/pdf")
    await expect(walkthrough.getByRole("link", { name: "Download this technical record", exact: true })).toHaveAttribute("href", "/downloads/assessment/demo-01-d/v1.0.0/json")
    await inspector.locator(".facility-systems").getByRole("button", { name: "Power", exact: true }).click()
    await expect(walkthrough).toHaveCount(0)
    await expect(inspector.locator(".facility-equipment-identification").filter({ hasText: "Electrical cabinet 1" })).toBeVisible()
    await inspector.getByRole("button", { name: "Authored equipment connections", exact: true }).click()
    await inspector.getByRole("button", { name: "Show full topology", exact: true }).click()
    const groups = inspector.locator(".facility-diagram-groups > details")
    await expect(groups).toHaveCount(4)
    await expect(groups.first()).toHaveAttribute("open", "")
    await groups.first().getByRole("button").first().focus()
    await page.keyboard.press("Enter")
    await expect(inspector.locator(".facility-target-connections")).toContainText("Authored connections")
    await expect(page.getByTestId("assessment-summary")).toContainText("Unknown")
    if (await inspector.getAttribute("data-night-inspection")) {
      await inspector.getByTestId("facility-contextual-inspector").locator("summary").filter({ hasText: /^Evidence$/ }).click()
      await expect(inspector.getByRole("link", { name: "Read this versioned decision brief" })).toHaveAttribute("href", /demo-01-d\/v1.0.0/)
    } else await expect(inspector.getByRole("link", { name: /published decision brief/ })).toHaveAttribute("href", /demo-01-d\/v1.0.0/)
    const scan = await new AxeBuilder({ page }).include('[data-testid="facility-inspection"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    expect(scan.violations).toEqual([])
    await page.getByRole("button", { name: "Reset example", exact: true }).click()
    await expect(inspector.getByRole("button", { name: /^(Pause|Resume)$/ })).toHaveCount(0)
    await expect(inspector.locator('.facility-systems [aria-pressed="true"]')).toHaveCount(0)
    await expect(inspector).toHaveAttribute("data-scenario", "b")
  })

  test("Close and explicit motion preferences persist for this tab across navigation", async ({ page }) => {
    await page.goto("/")
    const inspector = page.getByTestId("facility-inspection")
    await scrollFacilityIntoView(inspector)
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    await inspector.getByRole("button", { name: "Pause", exact: true }).click()
    await openFacilityDisplayOptions(inspector)
    await inspector.getByRole("checkbox", { name: "Equipment motion" }).uncheck()
    await chooseFacilityStillImage(inspector)
    await page.goto("/demo")
    await scrollFacilityIntoView(inspector)
    await page.waitForTimeout(1800)
    await expect(inspector).toHaveAttribute("data-phase", "poster")
    await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    await expect(inspector.getByRole("button", { name: "Resume", exact: true })).toHaveAttribute("aria-pressed", "true")
    await openFacilityDisplayOptions(inspector)
    await expect(inspector.getByRole("checkbox", { name: "Equipment motion" })).not.toBeChecked()
  })
})
