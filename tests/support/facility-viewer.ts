import { expect, type Locator, type Page } from "@playwright/test"

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

/** Native GET controls exist before the interactive island. Wait for its actual
 * Reset action before changing a scenario, then open the visitor's disclosure. */
export async function openAssessmentControls(page: Page) {
  const controls = page.locator("[data-assessment-controls]")
  await expect(controls.locator("button").filter({ hasText: /^Reset example$/ })).toHaveCount(1)
  if (await controls.getAttribute("open") === null) await controls.locator(":scope > summary").click()
  await expect(page.getByRole("combobox", { name: "Scenario", exact: true })).toBeVisible()
}
