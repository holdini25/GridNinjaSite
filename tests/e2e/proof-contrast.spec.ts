import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`proof page keeps boundaries readable with ${reducedMotion} motion`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Focused automated contrast and motion verification.")
    await page.emulateMedia({ reducedMotion })
    await page.goto("/proof")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Evidence informs a decision. Authority stays explicit.")
    await expect(page.locator("main")).toContainText("labels do not authorize equipment changes")
    await expect(page.getByRole("heading", { name: "Report acceptance", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Operating permission", exact: true })).toBeVisible()
    const results = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
    expect(results.violations).toEqual([])
    await expect(page.locator('main a[href="/assessment"]').first()).toBeVisible()
    expect(await page.locator("main h1").evaluate(node => getComputedStyle(node).opacity)).toBe("1")
  })
}
