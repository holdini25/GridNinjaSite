import { expect, test } from "./support/client-health"

const headerCtaHref = "/contact?intent=capacity-audit&source=header"

function isMobileProject(projectName: string) {
  return projectName.includes("mobile")
}

test.describe("desktop primary navigation", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo.project.name), "desktop navigation only")
    await page.goto("/")
  })

  test("uses deterministic disclosure buttons with concise destination context", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "Primary" })
    const platform = nav.getByRole("button", { name: "Platform", exact: true })
    const solutions = nav.getByRole("button", { name: "Solutions", exact: true })
    const proof = nav.getByRole("button", { name: "Proof", exact: true })

    await expect(platform).toHaveAttribute("aria-expanded", "false")

    await platform.click()
    await expect(platform).toHaveAttribute("aria-expanded", "true")
    await expect(
      nav.getByRole("link", { name: "Platform Overview", exact: true })
    ).toBeVisible()
    await expect(
      nav.getByText(
        "Define the safe operating boundary before execution.",
        { exact: true }
      )
    ).toBeVisible()

    await solutions.click()
    await expect(platform).toHaveAttribute("aria-expanded", "false")
    await expect(solutions).toHaveAttribute("aria-expanded", "true")
    await expect(
      nav.getByRole("link", { name: "Platform Overview", exact: true })
    ).toHaveCount(0)
    await expect(
      nav.getByRole("link", { name: "AI Cloud Providers", exact: true })
    ).toBeVisible()

    await proof.click()
    await expect(solutions).toHaveAttribute("aria-expanded", "false")
    await expect(proof).toHaveAttribute("aria-expanded", "true")
    await expect(
      nav.getByRole("link", { name: "Interactive Proof Demo", exact: true })
    ).toBeVisible()

    await proof.click()
    await expect(proof).toHaveAttribute("aria-expanded", "false")
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
    const whyGridNinja = nav.getByRole("link", {
      name: "Why GridNinja",
      exact: true,
    })

    await platform.click()
    await page.locator("main").click({ position: { x: 4, y: 4 } })
    await expect(platform).toHaveAttribute("aria-expanded", "false")

    await platform.click()
    await whyGridNinja.focus()
    await expect(platform).toHaveAttribute("aria-expanded", "false")
  })

  test("marks one most-specific child and shows the active orange dot", async ({
    page,
  }) => {
    await page.goto("/platform/dispatch-envelope")

    const nav = page.getByRole("navigation", { name: "Primary" })
    const platform = nav.getByRole("button", { name: "Platform", exact: true })

    await expect(platform).toHaveAttribute("data-nav-active", "true")
    await expect(platform.locator("[data-nav-active-indicator]")).toHaveCount(1)

    await platform.click()
    await expect(
      nav.getByRole("link", { name: "Dispatch Envelope", exact: true })
    ).toHaveAttribute("aria-current", "page")
    await expect(
      nav.getByRole("link", { name: "Platform Overview", exact: true })
    ).not.toHaveAttribute("aria-current", "page")
  })
})

test.describe("responsive navigation boundaries", () => {
  const widths = [375, 390, 768, 1023, 1119, 1120, 1280, 1440] as const

  test("hands off from the drawer to a non-wrapping desktop header at 1120px", async ({
    page,
    clientHealth,
  }) => {
    await page.goto("/")

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })

      const header = page.getByRole("banner")
      const primary = page.getByRole("navigation", { name: "Primary" })
      const drawerTrigger = page.getByRole("button", { name: "Open navigation" })
      const compactCta = header
        .locator('a[data-gn-event="header-capacity-audit"]')
        .filter({ hasText: /^Request Audit$/ })
      const desktopCta = header
        .locator('a[data-gn-event="header-capacity-audit"]')
        .filter({ hasText: /^Request Capacity Audit$/ })

      if (width >= 1120) {
        await expect(primary, `desktop navigation at ${width}px`).toBeVisible()
        await expect(drawerTrigger, `drawer hidden at ${width}px`).toBeHidden()
        await expect(compactCta, `compact CTA hidden at ${width}px`).toBeHidden()
        await expect(desktopCta, `desktop CTA at ${width}px`).toBeVisible()

        const controls = primary.locator(":scope > a, :scope > div > button")
        const wrapping = await controls.evaluateAll((elements) =>
          elements.map((element) => ({
            label: element.textContent?.trim(),
            whiteSpace: getComputedStyle(element).whiteSpace,
            fits: element.scrollWidth <= element.clientWidth,
          }))
        )

        expect(wrapping).toHaveLength(5)
        for (const item of wrapping) {
          expect(item.whiteSpace, `${item.label} whitespace at ${width}px`).toBe(
            "nowrap"
          )
          expect(item.fits, `${item.label} fit at ${width}px`).toBe(true)
        }

        const navBox = await primary.boundingBox()
        const ctaBox = await desktopCta.boundingBox()
        expect(navBox).not.toBeNull()
        expect(ctaBox).not.toBeNull()
        expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(ctaBox!.x)
      } else {
        await expect(primary, `desktop navigation hidden at ${width}px`).toBeHidden()
        await expect(drawerTrigger, `drawer available at ${width}px`).toBeVisible()
        await expect(compactCta, `compact CTA at ${width}px`).toBeVisible()
        await expect(desktopCta, `desktop CTA hidden at ${width}px`).toBeHidden()
      }

      await expect(compactCta).toHaveAttribute("href", headerCtaHref)
      await expect(desktopCta).toHaveAttribute("href", headerCtaHref)
      await clientHealth.expectNoHorizontalOverflow()
    }
  })

  test("uses one mobile accordion at a time without duplicate parent links", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 720 })
    await page.goto("/")
    await page.getByRole("button", { name: "Open navigation" }).click()

    const dialog = page.getByRole("dialog")
    const platform = dialog.getByRole("button", { name: "Platform", exact: true })
    const solutions = dialog.getByRole("button", { name: "Solutions", exact: true })

    await expect(platform).toHaveAttribute("aria-expanded", "false")
    await expect(dialog.getByRole("link", { name: "Platform", exact: true })).toHaveCount(0)

    await platform.click()
    await expect(platform).toHaveAttribute("aria-expanded", "true")
    await expect(
      dialog.getByRole("link", { name: "Platform Overview", exact: true })
    ).toBeVisible()
    await expect(
      dialog.getByText(
        "See how GridNinja converts constrained infrastructure into proof-adjusted virtual capacity.",
        { exact: true }
      )
    ).toHaveCount(0)

    await solutions.click()
    await expect(platform).toHaveAttribute("aria-expanded", "false")
    await expect(solutions).toHaveAttribute("aria-expanded", "true")
    await expect(
      dialog.getByRole("link", { name: "AI Cloud Providers", exact: true })
    ).toBeVisible()
  })

  test("keeps active navigation scrollable above a fixed mobile CTA", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 420 })
    await page.goto("/platform/dispatch-envelope")

    const compactCta = page.getByRole("banner").getByRole("link", {
      name: "Request Audit",
      exact: true,
    })
    await expect(compactCta).toHaveAttribute("href", headerCtaHref)
    await page.getByRole("button", { name: "Open navigation" }).click()

    const dialog = page.getByRole("dialog")
    const drawerNavigation = dialog.getByRole("navigation", { name: "Primary" })
    const platform = dialog.getByRole("button", { name: "Platform", exact: true })
    const footer = dialog.locator("[data-mobile-nav-footer]")
    const drawerCta = footer.getByRole("link", {
      name: "Request Capacity Audit",
      exact: true,
    })

    await expect(platform).toHaveAttribute("aria-expanded", "true")
    await expect(
      dialog.getByRole("link", { name: "Dispatch Envelope", exact: true })
    ).toHaveAttribute("aria-current", "page")
    await expect(drawerCta).toHaveAttribute("href", headerCtaHref)

    const scrollState = await drawerNavigation.evaluate((element) => {
      const style = getComputedStyle(element)

      return {
        canScroll: element.scrollHeight > element.clientHeight,
        overflowY: style.overflowY,
      }
    })
    expect(scrollState.canScroll).toBe(true)
    expect(["auto", "scroll"]).toContain(scrollState.overflowY)

    const footerBeforeScroll = await footer.boundingBox()
    await drawerNavigation.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    const footerAfterScroll = await footer.boundingBox()
    expect(footerBeforeScroll?.y).toBeCloseTo(footerAfterScroll?.y ?? 0, 1)

    const targetHeights = await dialog.locator("button, a[href]").evaluateAll(
      (elements) =>
        elements.map((element) => ({
          name: element.getAttribute("aria-label") ?? element.textContent?.trim(),
          height: element.getBoundingClientRect().height,
        }))
    )
    for (const target of targetHeights) {
      expect(target.height, `${target.name} touch target`).toBeGreaterThanOrEqual(44)
    }
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
