import { expect, test } from "./support/client-health"

function isMobileProject(projectName: string) {
  return projectName.includes("mobile")
}

test.describe("desktop primary navigation", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo.project.name), "desktop navigation only")
    await page.goto("/")
  })

  test("uses deterministic disclosure buttons and switches open menus", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "Primary" })
    const platform = nav.getByRole("button", { name: "Platform", exact: true })
    const solutions = nav.getByRole("button", { name: "Solutions", exact: true })

    await expect(platform).toHaveAttribute("aria-expanded", "false")

    await platform.click()
    await expect(platform).toHaveAttribute("aria-expanded", "true")
    await expect(
      nav.getByRole("link", { name: "Platform Overview", exact: true })
    ).toBeVisible()

    await solutions.click()
    await expect(platform).toHaveAttribute("aria-expanded", "false")
    await expect(solutions).toHaveAttribute("aria-expanded", "true")
    await expect(
      nav.getByRole("link", { name: "Platform Overview", exact: true })
    ).toHaveCount(0)
    await expect(nav.getByRole("link", { name: "AI Cloud", exact: true })).toBeVisible()

    await solutions.click()
    await expect(solutions).toHaveAttribute("aria-expanded", "false")
    await expect(nav.getByRole("link", { name: "AI Cloud", exact: true })).toHaveCount(
      0
    )
  })

  test("supports pointer hover without making hover the only interaction", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "Primary" })
    const platform = nav.getByRole("button", { name: "Platform", exact: true })

    await platform.hover()
    await expect(platform).toHaveAttribute("aria-expanded", "true")
    await expect(
      nav.getByRole("link", { name: "Dispatch Envelope", exact: true })
    ).toBeVisible()
  })

  test("traverses submenu links and restores trigger focus on Escape", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "Primary" })
    const platform = nav.getByRole("button", { name: "Platform", exact: true })
    const overview = nav.getByRole("link", {
      name: "Platform Overview",
      exact: true,
    })

    await platform.focus()
    await platform.press("Enter")
    await expect(platform).toHaveAttribute("aria-expanded", "true")
    await page.keyboard.press("Tab")
    await expect(overview).toBeFocused()

    await overview.press("Escape")
    await expect(platform).toBeFocused()
    await expect(platform).toHaveAttribute("aria-expanded", "false")
  })

  test("closes on outside interaction and when focus leaves the group", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "Primary" })
    const platform = nav.getByRole("button", { name: "Platform", exact: true })
    const proof = nav.getByRole("link", { name: "Proof & Trust", exact: true })

    await platform.click()
    await page.locator("main").click({ position: { x: 4, y: 4 } })
    await expect(platform).toHaveAttribute("aria-expanded", "false")

    await platform.click()
    await proof.focus()
    await expect(platform).toHaveAttribute("aria-expanded", "false")
  })

  test("closes after route navigation and exposes accurate active states", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "Primary" })
    const platform = nav.getByRole("button", { name: "Platform", exact: true })

    await platform.click()
    await nav
      .getByRole("link", { name: "Dispatch Envelope", exact: true })
      .click()

    await expect(page).toHaveURL(/\/platform\/dispatch-envelope$/)
    await expect(platform).toHaveAttribute("aria-expanded", "false")

    await platform.click()
    await expect(
      nav.getByRole("link", { name: "Dispatch Envelope", exact: true })
    ).toHaveAttribute("aria-current", "page")
  })
})

test.describe("responsive navigation boundaries", () => {
  const widths = [375, 390, 768, 1023, 1024, 1279, 1280, 1440] as const

  test("hands off from the drawer to desktop navigation at 1280px", async ({
    page,
    clientHealth,
  }) => {
    await page.goto("/")

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })

      const primary = page.getByRole("navigation", { name: "Primary" })
      const drawerTrigger = page.getByRole("button", { name: "Open navigation" })

      if (width >= 1280) {
        await expect(primary, `desktop navigation at ${width}px`).toBeVisible()
        await expect(drawerTrigger, `drawer hidden at ${width}px`).toBeHidden()
      } else {
        await expect(primary, `desktop navigation hidden at ${width}px`).toBeHidden()
        await expect(drawerTrigger, `drawer available at ${width}px`).toBeVisible()
      }

      await clientHealth.expectNoHorizontalOverflow()
    }
  })

  test("keeps the mobile drawer scrollable on a short viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 420 })
    await page.goto("/platform/dispatch-envelope")
    await page.getByRole("button", { name: "Open navigation" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()

    const drawerNavigation = dialog.getByRole("navigation", { name: "Primary" })
    const scrollState = await drawerNavigation.evaluate((element) => {
      const style = getComputedStyle(element)

      return {
        canScroll: element.scrollHeight > element.clientHeight,
        overflowY: style.overflowY,
      }
    })

    expect(scrollState.canScroll).toBe(true)
    expect(["auto", "scroll"]).toContain(scrollState.overflowY)

    const active = dialog.getByRole("link", {
      name: "Dispatch Envelope",
      exact: true,
    })
    await active.scrollIntoViewIfNeeded()
    await expect(active).toHaveAttribute("aria-current", "page")
  })
})

test.describe("touch-capable desktop navigation", () => {
  test.use({ hasTouch: true, viewport: { width: 1440, height: 900 } })

  test("opens disclosures by tap without depending on hover", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "one representative touch-capable desktop context"
    )

    await page.goto("/")
    const nav = page.getByRole("navigation", { name: "Primary" })
    const platform = nav.getByRole("button", { name: "Platform", exact: true })

    await platform.tap()
    await expect(platform).toHaveAttribute("aria-expanded", "true")
    await expect(
      nav.getByRole("link", { name: "Platform Overview", exact: true })
    ).toBeVisible()
  })
})

test.describe("reduced-motion navigation", () => {
  test("remains usable with motion reduction enabled", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "one representative reduced-motion context"
    )

    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    const nav = page.getByRole("navigation", { name: "Primary" })
    const platform = nav.getByRole("button", { name: "Platform", exact: true })

    await platform.click()
    await expect(
      nav.getByRole("link", { name: "Platform Overview", exact: true })
    ).toBeVisible()
  })
})
