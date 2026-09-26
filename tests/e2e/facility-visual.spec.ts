import { expect, test } from "@playwright/test"
import { scrollFacilityIntoView } from "../support/facility-viewer"

test("neutral surfaces and inspector controls remain readable at narrow widths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
  for (const width of [320, 640, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto("/")
    const inspector = page.getByTestId("facility-inspection")
    await scrollFacilityIntoView(inspector)
    await expect(inspector.locator(".facility-systems").getByRole("button", { name: "Workloads", exact: true })).toBeVisible()
    const result = await inspector.evaluate(element => {
      const neutral = (color: string) => {
        const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
        return channels?.length === 3 && Math.max(...channels) - Math.min(...channels) <= 2
      }
      const controls = [...element.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]
      return {
        controlCount: controls.length,
        neutralPage: neutral(getComputedStyle(document.body).backgroundColor),
        neutralInspector: neutral(getComputedStyle(element).backgroundColor),
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        minControlHeight: Math.min(...controls.map(control => control.getBoundingClientRect().height)),
        minControlFont: Math.min(...controls.map(control => parseFloat(getComputedStyle(control).fontSize))),
        scopeFont: parseFloat(getComputedStyle(element.querySelector(".facility-scope")!).fontSize),
      }
    })
    expect(result.neutralPage).toBe(true)
    expect(result.controlCount).toBeGreaterThan(0)
    expect(result.neutralInspector).toBe(true)
    expect(result.scrollWidth).toBeLessThanOrEqual(result.viewportWidth)
    expect(result.minControlHeight).toBeGreaterThanOrEqual(44)
    expect(result.minControlFont).toBeGreaterThanOrEqual(12)
    expect(result.scopeFont).toBeGreaterThanOrEqual(11)
    await expect(inspector.getByRole("button", { name: /Workloads/ })).toBeVisible()
    await expect(inspector.locator(".facility-poster")).toBeVisible()
  }
})
