import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { openAssessmentControls, scrollFacilityIntoView } from "../support/facility-viewer"

test.describe("facility ecosystem narrative", () => {
  test("A–D chapters remain useful without graphics and never change authoritative results", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
    await page.goto("/demo")
    const inspector = page.getByTestId("facility-inspection")
    await scrollFacilityIntoView(inspector)
    await expect(inspector).toHaveAttribute("data-ecosystem", "true")
    await openAssessmentControls(page)
    for (const [scenario, outcome, requested, modeled] of [["a", "ALLOW", "5.0 MW", "5.8 MW"], ["b", "REPAIR", "7.0 MW", "5.8 MW"], ["c", "REJECT", "7.0 MW", "5.8 MW"], ["d", "NO-PROOF", "5.0 MW", "Unknown"]]) {
      await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption(scenario)
      const caption = await page.getByTestId("assessment-summary").textContent()
      await inspector.getByRole("button", { name: "Follow one workload", exact: true }).click()
      const story = inspector.getByTestId("facility-ecosystem-story")
      await expect(story).toHaveAttribute("data-chapter", "0")
      await expect(story).toContainText(requested)
      await expect(story).toContainText("whole facility")
      await expect(story.getByRole("button", { name: "Play story", exact: true })).toBeDisabled()
      for (let chapter = 1; chapter < 6; chapter++) {
        await story.getByRole("button", { name: "Next chapter", exact: true }).click()
        await expect(story).toHaveAttribute("data-chapter", String(chapter))
        expect(await page.getByTestId("assessment-summary").textContent()).toBe(caption)
        if (chapter === 3) await expect(story).toContainText("Independent storage capacity, contribution and dispatchability are unassessed")
        if (chapter === 4) {
          await expect(story).toContainText(outcome)
          await expect(story).toContainText(modeled)
          const compare = story.locator(".facility-ecosystem-comparison")
          if (scenario === "b") { await compare.locator("summary").click(); await expect(compare).toContainText("7.0 MW"); await expect(compare).toContainText("5.8 MW") }
          else await expect(compare).toHaveCount(0)
        }
        if (scenario === "d") await expect(story).not.toContainText("5.8 MW")
      }
      await expect(story.getByRole("link", { name: "Read the versioned brief", exact: true })).toHaveAttribute("href", `/evidence/assessments/demo-01-${scenario}/v1.0.0`)
      await story.getByRole("button", { name: "Finish story", exact: true }).click()
      await expect(inspector.getByRole("button", { name: "Follow one workload", exact: true })).toBeFocused()
    }
    await expect(inspector.locator("canvas")).toHaveCount(0)
    await inspector.getByRole("button", { name: "Follow one workload", exact: true }).click()
    await page.getByRole("combobox", { name: "Perspective", exact: true }).selectOption("engineering")
    await expect(inspector.getByTestId("facility-ecosystem-story")).toHaveCount(0)
  })

  test("reduced-motion inspection and an air-path section share one canvas without specimen downloads", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    const models: string[] = []
    page.on("request", request => { if (request.url().endsWith(".glb")) models.push(request.url()) })
    await page.goto("/demo")
    const inspector = page.getByTestId("facility-inspection")
    await scrollFacilityIntoView(inspector)
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    const original = await inspector.locator("canvas").elementHandle()
    await inspector.getByRole("button", { name: "Show air-path section", exact: true }).click()
    await expect(inspector.getByRole("button", { name: "Close air-path section", exact: true })).toHaveAttribute("aria-pressed", "true")
    await inspector.getByRole("button", { name: "Authored equipment connections", exact: true }).click()
    await inspector.getByRole("button", { name: "Follow one workload", exact: true }).focus()
    await page.keyboard.press("Enter")
    const story = inspector.getByTestId("facility-ecosystem-story")
    await expect(story).toHaveAttribute("data-playing", "false")
    await expect(story.getByRole("button", { name: "Play story", exact: true })).toBeDisabled()
    await story.getByRole("button", { name: "Chapter 2: Electrical path", exact: true }).click()
    await expect(inspector.locator('[data-story-equipment="rack-02"]')).toHaveCount(1)
    const electricalSegments = await inspector.locator("path[data-story-route]").evaluateAll(paths => paths.map(path => ({ id: path.getAttribute("data-story-route"), to: Number(path.getAttribute("data-to-s")) })))
    expect(electricalSegments.some(segment => segment.to < 1)).toBe(true)
    expect(electricalSegments.some(segment => segment.id === "rack-feed-0-0")).toBe(false)
    await story.getByRole("button", { name: "Chapter 3: Air and cooling", exact: true }).click()
    await expect(story).toContainText("separate water circuit")
    expect(new Set(await inspector.locator("path[data-story-route]").evaluateAll(paths => paths.map(path => path.getAttribute("data-medium"))))).toEqual(new Set(["air", "water"]))
    await expect(inspector.getByRole("list", { name: "Connection media", exact: true })).toContainText("Air · dashed")
    await inspector.locator(".facility-diagram-relationships > summary").click()
    await expect(inspector.locator(".facility-diagram-relationships")).toContainText("does not join the fluid circuits")
    expect(await inspector.locator("canvas").evaluate((canvas, before) => canvas === before, original)).toBe(true)
    expect(models.every(url => url.endsWith("/facility.glb"))).toBe(true)
    const scan = await new AxeBuilder({ page }).include('[data-testid="facility-inspection"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    expect(scan.violations).toEqual([])
    await inspector.getByRole("button", { name: "Exit story", exact: true }).click()
    await expect(inspector.getByRole("button", { name: "Follow one workload", exact: true })).toBeFocused()
  })

  test("optional playback respects the D evidence stop and adaptive Still fallback", async ({ page }) => {
    await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.goto("/demo?scenario=d")
    const inspector = page.getByTestId("facility-inspection")
    await scrollFacilityIntoView(inspector)
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    await inspector.getByRole("button", { name: "Follow one workload", exact: true }).click()
    const story = inspector.getByTestId("facility-ecosystem-story")
    if (await inspector.getAttribute("data-quality") !== "still") {
      try { await story.getByRole("button", { name: "Play story", exact: true }).click({ timeout: 1_500 }) }
      catch (error) { if (await inspector.getAttribute("data-quality") !== "still") throw error }
    }
    await expect.poll(async () => await story.getAttribute("data-playing") === "true" || await inspector.getAttribute("data-quality") === "still").toBe(true)
    await scrollFacilityIntoView(inspector)
    await expect(inspector.locator(".facility-stage")).toBeInViewport({ ratio: .25 })
    await expect.poll(async () => (await story.getAttribute("data-chapter")) === "2" || await inspector.getAttribute("data-quality") === "still", { timeout: 15_000 }).toBe(true)
    const adaptiveStill = await inspector.getAttribute("data-quality") === "still"
    await test.info().attach("d-story-playback-path.json", { contentType: "application/json", body: JSON.stringify({ path: adaptiveStill ? "adaptive-still" : "active-cooling-evidence-stop", chapter: await story.getAttribute("data-chapter"), renderer: await inspector.locator("canvas").evaluate((canvas: HTMLCanvasElement) => canvas.__gnFacilitySnapshot?.(true)) }, null, 2) })
    if (process.env.FACILITY_REQUIRE_ACTIVE_READING_PATH === "1") expect(adaptiveStill, "Native qualification requires actual playback to stop at D's missing cooling evidence").toBe(false)
    if (adaptiveStill) {
      test.info().annotations.push({ type: "adaptive-fallback", description: "This browser demoted to interactive Still before the cooling chapter; fallback and manual evidence navigation are verified. Active cooling-stop playback is not claimed." })
      await expect(story).toHaveAttribute("data-playing", "false")
      await expect(inspector).toHaveAttribute("data-phase", "ready")
      await expect(inspector).toContainText("Equipment motion is resting")
      await story.getByRole("button", { name: "Chapter 3: Air and cooling", exact: true }).click()
    } else test.info().annotations.push({ type: "active-story-path", description: "Actual playback reached and stopped at D's missing cooling evidence." })
    await expect(story).toHaveAttribute("data-playing", "false")
    await expect(story).toContainText("Cooling evidence is missing")
    await expect(inspector.getByRole("button", { name: "Show air-path section", exact: true })).toHaveAttribute("aria-pressed", "false")
    await expect(story.getByRole("button", { name: "Play story", exact: true })).toBeDisabled()
    await story.getByRole("button", { name: "Chapter 5: Screening result", exact: true }).click()
    await expect(story).toContainText("Unknown")
    await expect(story).not.toContainText("5.8 MW")
    await inspector.getByRole("button", { name: "Storage", exact: true }).click()
    await expect(story).toHaveCount(0)
    await expect(inspector).toContainText("Independent storage capacity and dispatchability are unassessed")
  })

  test("the no-JavaScript transcript contains the same record, constraints and publications", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
    try {
      const page = await context.newPage()
      await page.goto("/demo?scenario=d")
      const transcript = page.locator(".facility-ecosystem-transcript")
      await transcript.locator("summary").click()
      await expect(transcript.getByRole("heading")).toHaveCount(6)
      await expect(transcript).toContainText("Unknown")
      await expect(transcript).not.toContainText("5.8 MW")
      await expect(transcript.getByRole("link", { name: "Read the versioned brief", exact: true })).toHaveAttribute("href", "/evidence/assessments/demo-01-d/v1.0.0")
      await expect(page.locator("canvas")).toHaveCount(0)
    } finally { await context.close() }
  })
})
