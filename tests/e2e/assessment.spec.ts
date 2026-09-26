import { readFile } from "node:fs/promises"
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { openAssessmentControls } from "../support/facility-viewer"

const scenarios = ["a", "b", "c", "d"] as const
const outcomes = { a: "ALLOW", b: "REPAIR", c: "REJECT", d: "NO-PROOF" }

test.describe("capacity assessment", () => {
  test("all ordered transitions keep the explanation, quantities, and exact exports synchronized", async ({ page, request }) => {
    await page.goto("/demo?scenario=b&version=1.0.0&perspective=engineering&interactive=1")
    await openAssessmentControls(page)
    const control = page.getByRole("combobox", { name: "Scenario", exact: true })
    for (const from of scenarios) {
      await control.selectOption(from)
      for (const to of scenarios) {
        await control.selectOption(to)
        const summary = page.getByTestId("assessment-summary")
        await expect(summary).toHaveAttribute("data-scenario", to)
        await expect(summary).toContainText(`Model screen: ${outcomes[to]}`)
        const target = `/downloads/assessment/demo-01-${to}/v1.0.0/json`
        await expect(page.getByRole("link", { name: "Download this technical record" })).toHaveAttribute("href", target)
        await expect(page.getByRole("link", { name: "Download this PDF" })).toHaveAttribute("href", `/downloads/assessment/demo-01-${to}/v1.0.0/pdf`)
        const response = await request.get(target)
        expect(response.ok()).toBe(true)
        const record = await response.json()
        expect(record.scenario).toBe(to)
        expect(record.screeningOutcome).toBe(outcomes[to])
        expect(record.publication.id).toBe(`demo-01-${to}`)
        expect(record.operatorAccepted.status).toBe("not-applicable")
        expect(record.economics.status).toBe("unestimated")
        if (to === "d") {
          await expect(summary).toContainText("Unknown")
          await expect(summary).not.toContainText("5.8 MW")
          await expect(page.getByTestId("assessment-attribution")).toHaveCount(0)
          expect(record.modeledEligible).not.toHaveProperty("valueKW")
          expect(record.attribution).toEqual([])
        } else {
          await expect(page.getByTestId("assessment-attribution")).toContainText("5.8 MW remaining")
          expect(record.modeledEligible.valueKW).toBe(5_800)
        }
        if (to === "c") {
          expect(record.revisedProfile).toBeNull()
          await expect(page.getByTestId("assessment-capacity-table")).toContainText("6.5 MW")
        }
        await control.selectOption(from)
      }
    }
  })

  test("technical download serves the current record and its publication version", async ({ page, request, browserName }) => {
    await page.goto("/demo?scenario=c&version=1.0.0")
    const target = "/downloads/assessment/demo-01-c/v1.0.0/json"
    const link = page.getByRole("link", { name: "Download this technical record" })
    await expect(link).toHaveAttribute("href", target)
    const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === target)
    // Linux WebKit can render an attachment navigation without reporting a download.
    // Check the browser response there; other engines still verify the saved file.
    const downloadPromise = browserName === "webkit" && process.platform === "linux"
      ? null
      : page.waitForEvent("download")
    await link.click()
    const response = await responsePromise
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/json")
    expect(response.headers()["content-disposition"]).toBe('attachment; filename="gridninja-demo-01-c-v1.0.0.json"')
    let bytes: Buffer
    if (downloadPromise) {
      const download = await downloadPromise
      expect(download.suggestedFilename()).toBe("gridninja-demo-01-c-v1.0.0.json")
      const file = await download.path()
      expect(file).toBeTruthy()
      bytes = await readFile(file!)
    } else {
      const artifact = await request.get(target)
      expect(artifact.status()).toBe(200)
      bytes = await artifact.body()
    }
    const record = JSON.parse(bytes.toString("utf8"))
    expect(record.scenario).toBe("c")
    expect(record.publication).toMatchObject({ id: "demo-01-c", version: "1.0.0" })
    expect(record.screeningOutcome).toBe("REJECT")
    expect(record.minimumViableIncrementKW).toBe(6_500)
    expect(record.revisedProfile).toBeNull()
  })

  test("history and reset restore the same record, perspective, interval, and disclosure state", async ({ page }) => {
    await page.goto("/demo?scenario=b&version=1.0.0&perspective=engineering&interactive=1")
    await openAssessmentControls(page)
    await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("d")
    await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("c")
    await page.goBack()
    await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "d")
    await expect(page.getByRole("combobox", { name: "Perspective", exact: true })).toHaveValue("engineering")
    await page.getByText("Options to investigate · all unassessed", { exact: true }).click()
    await page.getByRole("button", { name: "Reset example" }).click()
    await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "b")
    await expect(page.getByRole("combobox", { name: "Perspective", exact: true })).toHaveValue("business")
    await expect(page.getByTestId("assessment-summary")).toContainText("2026-09-22 · 00:00–01:00 UTC")
    await expect(page.locator("summary").filter({ hasText: /^Options to investigate · all unassessed$/ }).locator("..")).not.toHaveAttribute("open", "")
    await expect(page.locator("summary").filter({ hasText: /^Conditions and assessment evidence$/ }).locator("..")).not.toHaveAttribute("open", "")
    await expect(page).toHaveURL(/scenario=b&version=1.0.0&perspective=business/)
  })

  test("unavailable and ambiguous deep links never display a substituted result", async ({ page }) => {
    for (const query of ["scenario=x", "scenario=b&version=99.0.0", "scenario=a&scenario=b", "perspective=operator"]) {
      await page.goto(`/demo?${query}`)
      await expect(page.getByRole("heading", { name: "Requested example unavailable" })).toBeVisible()
      await expect(page.getByTestId("assessment-summary")).toHaveCount(0)
      await expect(page.getByRole("link", { name: "Download this PDF" })).toHaveCount(0)
    }
    await page.getByRole("link", { name: "Open the default example" }).click()
    await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "b")
  })

  test("keyboard focus and accessible alternatives survive reduced-motion scenario changes", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/demo?perspective=engineering&interactive=1")
    await openAssessmentControls(page)
    const scenario = page.getByRole("combobox", { name: "Scenario", exact: true })
    await scenario.focus()
    await scenario.selectOption("d")
    await expect(scenario).toBeFocused()
    await page.getByText("Result and assessment limits", { exact: true }).click()
    await expect(page.getByTestId("assessment-summary")).toContainText("Missing cooling evidence prevents assessment")
    const scan = await new AxeBuilder({ page }).include('[data-testid="assessment-explorer"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    expect(scan.violations).toEqual([])
  })

  test("server-rendered explanation and fixture navigation work without JavaScript", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
    try {
      const page = await context.newPage()
      await page.goto("/demo")
      await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "b")
      await expect(page.getByTestId("assessment-summary").getByText("Would the reduced 5.8 MW profile still meet the service and commercial requirement?", { exact: true })).toBeVisible()
      await page.getByText("Change scenario or perspective", { exact: true }).click()
      await page.getByRole("link", { name: "D", exact: true }).click()
      await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "d")
      await expect(page.getByTestId("assessment-summary")).not.toContainText("5.8 MW")
      // Native fragment scrolling is finite (~265 ms in the saved RC04 probe).
      // Sample from Node before asking Playwright's no-JS utility world to
      // establish actionability; preserve normal pointer activation afterwards.
      let previousY: number | undefined
      let stableSamples = 0
      const nativeControls = page.locator("[data-assessment-controls] > summary")
      await expect.poll(async () => {
        const box = await nativeControls.boundingBox()
        if (!box) return false
        stableSamples = previousY !== undefined && Math.abs(box.y - previousY) < 0.25 ? stableSamples + 1 : 0
        previousY = box.y
        return stableSamples >= 3
      }, { timeout: 2_000, intervals: [50], message: "Native fragment scroll must settle before disclosure activation" }).toBe(true)
      await page.getByText("Change scenario or perspective", { exact: true }).click()
      await page.getByRole("link", { name: "Engineering evidence", exact: true }).click()
      await expect(page.getByTestId("assessment-capacity-table")).toContainText("Unknown")
    } finally { await context.close() }
  })
})
