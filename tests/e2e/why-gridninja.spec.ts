import { expect, test } from "@playwright/test"

test.describe("GridNinja assessment positioning and evidence boundaries", () => {
  test("describes the scoped role and keeps comparisons conditional", async ({ page }) => {
    await page.goto("/why-gridninja")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connect a capacity question to its evidence.")
    await expect(page.locator("main")).toContainText("does not replace DCIM")
    await expect(page.locator("main")).toContainText("cannot establish superiority")
    await expect(page.locator("main")).toContainText("not a command or permission to operate")
    await expect(page.locator("[data-testid=competitor-rail]")).toHaveCount(0)
    const policy = page.locator('main a[href="/methodology/comparison-policy"]').first()
    await policy.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByText("Publication pending", { exact: true })).toBeVisible()
    await expect(page.locator('main a[href^="/evidence/releases/"]')).toHaveCount(0)
  })

  test("offers an ungated example and a scoped inquiry on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto("/why-gridninja")
    await expect(page.getByRole("link", { name: "See a sample decision brief", exact: true })).toHaveAttribute("href", "/demo?scenario=b&version=1.0.0&perspective=business#decision-brief")
    await expect(page.locator('main a[href="/assessment?source=why-gridninja-contextual#scope"]').first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test("withholds candidate evidence instead of exposing a noindex download", async ({ page }) => {
    await page.goto("/evidence/sample-rta-trace")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
    await expect(page.getByText("Publication pending", { exact: true })).toBeVisible()
    await expect(page.locator("main")).toContainText("This resource is not yet available")
    await expect(page.locator("main")).toContainText("establishes no customer result, site validation, or operating capability")
    await expect(page.locator('main a[href^="/downloads/"]')).toHaveCount(0)
    await expect(page.locator('main a[href="/demo#decision-brief"]')).toBeVisible()
  })
})
