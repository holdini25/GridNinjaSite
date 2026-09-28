import { expect, test, type Locator } from "@playwright/test"
import { openAssessmentControls, scrollFacilityIntoView } from "../support/facility-viewer"

async function inspectSelection(inspector: Locator) {
  return inspector.evaluate(element => {
    const active = element.querySelector<HTMLElement>(".facility-explanation-copy > p:not([aria-hidden])")!
    const scope = element.querySelector<HTMLElement>(".facility-scope")!
    return {
      scopeTop: scope.getBoundingClientRect().top - element.getBoundingClientRect().top,
      copyHeight: active.clientHeight,
      copyScrollHeight: active.scrollHeight,
      visibleCopies: [...element.querySelectorAll(".facility-explanation-copy > p")].filter(copy => getComputedStyle(copy).visibility !== "hidden").length,
      overflow: element.scrollWidth - element.clientWidth,
    }
  })
}

test("explanations reflow without clipping and keep collapsed disclosures compact across current records", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
  for (const width of [320, 640, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const route of ["/", "/demo"]) {
      await page.goto(route)
      const inspector = page.getByTestId("facility-inspection")
      await scrollFacilityIntoView(inspector)
      await expect(inspector.getByRole("button", { name: "Power", exact: true })).toBeVisible()
      if (route === "/demo") await openAssessmentControls(page)
      for (const scenario of route === "/demo" ? ["a", "b", "c", "d"] : ["b"]) {
        if (route === "/demo") await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption(scenario)
        const clear = inspector.getByRole("button", { name: "Clear selection" })
        if (await clear.isEnabled()) await clear.click()
        const neutral = await inspectSelection(inspector)
        for (const system of ["Power", "Cooling", "Storage", "Workloads"]) {
          await inspector.getByRole("button", { name: system, exact: true }).click()
          const selected = await inspectSelection(inspector)
          if (await inspector.getAttribute("data-night-inspection")) {
            await expect(inspector.locator('.facility-explanation-copy > p')).toHaveCount(1)
            await expect(inspector.locator('.facility-contextual details[open]')).toHaveCount(0)
          } else expect(selected.scopeTop, `${width}px ${route} ${scenario} ${system}`).toBeCloseTo(neutral.scopeTop, 1)
          expect(selected.copyScrollHeight).toBeLessThanOrEqual(selected.copyHeight + 1)
          expect(selected.visibleCopies).toBe(1)
          expect(selected.overflow).toBeLessThanOrEqual(0)
        }
        await clear.click()
        expect((await inspectSelection(inspector)).scopeTop).toBeCloseTo(neutral.scopeTop, 1)
      }
    }
  }
})
