import { expect, test } from "@playwright/test"

test.describe("server-rendered navigation", () => {
  test("native active markers remain correct without hydration warnings", async ({ page }) => {
    const failures: string[] = []
    page.on("console", message => { if (message.type() === "error" && /hydrat|server rendered|did not match/i.test(message.text())) failures.push(message.text()) })
    page.on("pageerror", error => failures.push(error.message))
    for (const route of ["/demo", "/assessment", "/solutions/colocation"]) {
      await page.goto(route)
      await page.waitForLoadState("networkidle")
      await expect(page.locator('#site-header a[aria-current="page"]').first()).toHaveAttribute("href", route === "/demo" ? "/demo#decision-brief" : route)
    }
    expect(failures).toEqual([])
  })

  test("mobile destinations and assessment CTA work without JavaScript", async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    })
    try {
      const page = await context.newPage()
      await page.goto(baseURL ?? "http://127.0.0.1:3000")

      const menu = page.locator("[data-mobile-menu]")
      const trigger = menu.locator(":scope > summary")
      await expect(trigger).toBeVisible()
      await expect(menu).not.toHaveAttribute("open")
      await trigger.click()
      await expect(menu).toHaveAttribute("open", "")

      const dialog = page.getByRole("dialog", { name: "Site navigation" })
      const platform = dialog.locator("details > summary").filter({ hasText: "How it works" })
      await platform.click()
      await expect(platform.locator("..")).toHaveAttribute("open", "")
      await expect(dialog.getByRole("link", { name: "Platform direction" })).toHaveAttribute("href", "/platform")
      await expect(dialog.getByRole("link", { name: "Contact Us", exact: true })).toHaveAttribute("href", "/assessment?source=header#scope")
      await dialog.getByRole("link", { name: "Sample brief" }).click()
      await expect(page).toHaveURL(/\/demo#decision-brief$/)
    } finally {
      await context.close()
    }
  })

  test("Escape closes the enhanced mobile menu and restores trigger focus", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")

    const menu = page.locator("[data-mobile-menu]")
    const trigger = menu.locator(":scope > summary")
    await trigger.focus()
    await trigger.press("Enter")
    await expect(menu).toHaveAttribute("open", "")
    await expect(page.getByRole("dialog", { name: "Site navigation" })).toHaveAttribute("aria-modal", "true")
    await expect(page.getByRole("dialog", { name: "Site navigation" }).getByRole("button", { name: "Close navigation", exact: true })).toBeFocused()

    await page.keyboard.press("Shift+Tab")
    await expect(page.getByRole("dialog", { name: "Site navigation" })).toContainText("Capacity decisions")
    expect(await page.getByRole("dialog", { name: "Site navigation" }).evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)

    await page.keyboard.press("Escape")
    await expect(menu).not.toHaveAttribute("open")
    await expect(trigger).toBeFocused()
  })
})
