import { expect, type Locator, type Page, type TestInfo } from "@playwright/test"

/** WebKit can replace its initial streamed node while a navigation settles.
 * Resolve a fresh locator after that transient detachment; never relax readiness.
 */
export async function scrollFacilityIntoView(inspector: Locator) {
  await expect(async () => { await inspector.locator(".facility-stage").scrollIntoViewIfNeeded() }).toPass({ timeout: 5_000, intervals: [50, 100, 250] })
}

/** Secondary graphics controls remain native and are usable while loading. */
export async function openFacilityDisplayOptions(inspector: Locator) {
  const summary = inspector.getByLabel("Display options", { exact: true })
  await expect(summary).toBeVisible()
  if (!await summary.evaluate(element => (element.parentElement as HTMLDetailsElement).open)) await summary.click()
  await expect(inspector.getByRole("button", { name: "Use still image", exact: true })).toBeVisible()
}

export async function chooseFacilityStillImage(inspector: Locator) {
  await openFacilityDisplayOptions(inspector)
  await inspector.getByRole("button", { name: "Use still image", exact: true }).click()
}

/** Verify the actual policy path without forcing a renderer tier. */
export async function settleFacilityActivity(page: Page, inspector: Locator, testInfo: TestInfo) {
  const pause = inspector.getByRole("button", { name: "Pause", exact: true })
  let mode: "explicit-pause" | "adaptive-still" = "explicit-pause"
  if (await inspector.getAttribute("data-quality") === "still") mode = "adaptive-still"
  else {
    try { await pause.click({ timeout: 2_000 }) }
    catch (error) {
      // The adaptive tier can change while the click waits for a stable target.
      if (await inspector.getAttribute("data-quality") !== "still") throw error
      mode = "adaptive-still"
    }
  }
  if (mode === "adaptive-still") {
    await expect(inspector).toHaveAttribute("data-quality", "still")
    await expect(inspector.locator(".facility-state-label")).toHaveText("Still for performance")
    await expect(inspector.getByRole("button", { name: /^(Pause|Resume)$/, exact: true })).toHaveCount(0)
    testInfo.annotations.push({ type: "adaptive-policy", description: "Verified Still fallback; no active-motion or explicit-Pause qualification is claimed." })
  } else await expect(inspector.getByRole("button", { name: "Resume", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.mouse.move(0, 0)
  const canvas = inspector.locator("canvas[data-ready=true]")
  await expect.poll(() => canvas.evaluate(element => {
    const state = (element as HTMLCanvasElement).__gnFacilitySnapshot!()
    return state.schedulerPending === 0 && state.transitionRemaining === 0 && state.clockSeconds >= state.interactionUntil
  }), { timeout: 2_000 }).toBe(true)
  const before = await canvas.evaluate(element => (element as HTMLCanvasElement).__gnFacilitySnapshot!(true))
  await page.waitForTimeout(350)
  const after = await canvas.evaluate(element => (element as HTMLCanvasElement).__gnFacilitySnapshot!(true))
  expect(after.frames).toBe(before.frames)
  expect(after.equipment).toEqual(before.equipment)
  expect(after.schedulerPending).toBe(0)
  return mode
}

/** Native GET controls exist before the interactive island. Wait for its actual
 * Reset action before changing a scenario, then open the visitor's disclosure. */
export async function openAssessmentControls(page: Page) {
  const controls = page.locator("[data-assessment-controls]")
  await expect(controls.locator("button").filter({ hasText: /^Reset example$/ })).toHaveCount(1)
  if (await controls.getAttribute("open") === null) await controls.locator(":scope > summary").click()
  await expect(page.getByRole("combobox", { name: "Scenario", exact: true })).toBeVisible()
}
