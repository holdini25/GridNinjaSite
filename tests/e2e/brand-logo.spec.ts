import { expect, test } from "./support/client-health"

test.describe("GridNinja brand placements", () => {
  const widths = [320, 360, 375, 768, 1024, 1280, 1440] as const

  test("keeps the canonical 34px micro identity stable in the header", async ({
    page,
    clientHealth,
  }) => {
    await page.goto("/")
    await expect(page.locator("header").getByRole("link", { name: "GridNinja home", exact: true })
      .filter({ visible: true }).getByText("GridNinja", { exact: true })).toBeVisible()

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })

      const header = page.locator("header")
      const home = header.getByRole("link", { name: "GridNinja home", exact: true }).filter({ visible: true })
      const mark = home.locator('[data-logo-motion="micro-response"] svg')
      const wordmark = home.getByText("GridNinja", { exact: true })

      expect((await header.boundingBox())?.height).toBeCloseTo(70, 2)
      expect((await home.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      await expect(mark).toBeVisible()
      expect((await mark.boundingBox())?.height).toBeCloseTo(34, 2)
      const homeBox = (await home.boundingBox())!
      const ctaBox = (await header.getByRole("link", { name: "Contact Us", exact: true })
        .filter({ visible: true }).boundingBox())!
      expect(homeBox.x + homeBox.width, `brand avoids CTA at ${width}px`).toBeLessThanOrEqual(ctaBox.x + 1)
      // The optional wordmark follows available container space, including
      // enlarged text. Validate its actual fit instead of a device breakpoint.
      if (await wordmark.isVisible()) {
        const wordmarkBox = (await wordmark.boundingBox())!
        const markBox = (await mark.boundingBox())!
        expect(wordmarkBox.x, `wordmark clears emblem at ${width}px`).toBeGreaterThanOrEqual(markBox.x + markBox.width)
        expect(wordmarkBox.x + wordmarkBox.width, `wordmark fits brand at ${width}px`).toBeLessThanOrEqual(homeBox.x + homeBox.width + 1)
      }
      await clientHealth.expectNoHorizontalOverflow()
    }
  })

  test("uses the documented logo variants and minimum sizes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    await page.goto("/")

    const footerMark = page
      .locator("footer")
      .locator('img[src*="gridninja-emblem-detailed-dark.svg"]')

    await expect(footerMark).toBeVisible()
    await expect(page.locator("footer")).toContainText(
      "Infrastructure · Intelligence · Control"
    )
    expect((await footerMark.boundingBox())?.height).toBeGreaterThanOrEqual(72)
    await expect(page.locator("footer [data-logo-motion]")).toHaveCount(0)

    await page.goto("/about")
    await expect(page.locator('[data-logo-motion="guardian-wake"]')).toHaveCount(0)
    await expect(page.locator("main")).toContainText("development")
  })

  test("links the 36px micro identity in the mobile drawer", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 720 })
    await page.goto("/")
    await page.locator("[data-mobile-menu] > summary").click()

    const drawer = page.getByRole("dialog")
    const home = drawer.getByRole("link", { name: "GridNinja home" })
    const mark = home.locator('[data-logo-motion="micro-response"] svg')

    await expect(home).toBeVisible()
    expect((await mark.boundingBox())?.height).toBeCloseTo(36, 2)
    await expect(drawer).toContainText(
      "Capacity decisions supported by explicit evidence."
    )
  })

  test("does not imply verified evidence on the synthetic sample page", async ({ page }) => {
    await page.goto("/proof/proof-pack")
    await expect(page.locator('[data-evidence-chain-status="complete"]')).toHaveCount(0)
    await expect(page.locator("main")).toContainText("synthetic")
  })

  test("keeps the footer brand signature readable without overflow", async ({
    page,
    clientHealth,
  }) => {
    await page.goto("/about")

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })

      const signature = page
        .locator("footer")
        .getByText("Infrastructure · Intelligence · Control", { exact: true })

      await signature.scrollIntoViewIfNeeded()
      await expect(signature).toBeVisible()
      // Compact footer columns may use two lines. Check the rendered text
      // bounds so responsive wrapping cannot conceal clipped characters.
      const metrics = await signature.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
        const range = document.createRange()
        range.selectNodeContents(element)
        const textFits = [...range.getClientRects()].every(rect =>
          rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 &&
          rect.top >= bounds.top - 2 && rect.bottom <= bounds.bottom + 2)

        return { height: bounds.height, lineHeight, textFits, clipped: element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1 }
      })
      expect(metrics.height, `signature length at ${width}px`).toBeLessThanOrEqual(metrics.lineHeight * 2 + 1)
      expect(metrics.textFits, `signature glyph bounds at ${width}px`).toBe(true)
      expect(metrics.clipped, `signature clipping at ${width}px`).toBe(false)
      await clientHealth.expectNoHorizontalOverflow()
    }
  })

  test("navigates functionally from the header logo", async ({ page }) => {
    await page.goto("/about")

    const home = page.locator("header").getByRole("link", { name: "GridNinja home", exact: true }).filter({ visible: true })
    await home.click()

    await expect(page).toHaveURL(/\/$/)
  })

  test("runs the micro response from keyboard focus before any hover", async ({
    page,
    browserName,
  }) => {
    await page.goto("/")

    const trigger = page.locator("header").getByRole("link", { name: "GridNinja home", exact: true }).filter({ visible: true })
    const core = trigger.locator('[data-part="proof-core"]')
    const glow = trigger.locator('[data-part="proof-glow"]')
    const sweep = trigger.locator('[data-part="proof-sweep"]')
    const guardians = trigger.locator(
      '[data-part="guardian-left"], [data-part="guardian-right"]'
    )

    // macOS WebKit uses Option-Tab to include links with default keyboard settings.
    const nextFocusable = browserName === "webkit" && process.platform === "darwin"
      ? "Alt+Tab"
      : "Tab"
    await page.keyboard.press(nextFocusable)
    await page.keyboard.press(nextFocusable)
    await expect(trigger).toBeFocused()
    await expect.poll(() => core.evaluate(readMotionStyle)).toMatchObject({
      hasFilter: true,
      hasTransform: true,
    })
    await expect.poll(() => glow.evaluate(readOpacity)).toBeGreaterThan(0)
    await expect.poll(() => sweep.evaluate(readAnimationName)).toContain(
      "perimeter-sweep"
    )
    expect(await guardians.evaluateAll(readComputedTransforms)).toEqual([
      "none",
      "none",
    ])
  })

  test("keeps micro interaction motion geometry and copper colors semantic-neutral", async ({
    page,
  }) => {
    await page.goto("/")

    const trigger = page.locator("header").getByRole("link", { name: "GridNinja home", exact: true }).filter({ visible: true })
    const logo = trigger.locator('[data-logo-motion="micro-response"]')
    const parts = logo.locator("[data-part]")
    const guardians = logo.locator(
      '[data-part="guardian-left"], [data-part="guardian-right"]'
    )

    await expect(logo).toBeVisible()
    expect(await parts.count()).toBeGreaterThan(2)

    const colorsBefore = await parts.evaluateAll(readPartColors)
    const guardianGeometryBefore = await guardians.evaluateAll(
      readTransformAttributes
    )
    await trigger.hover()
    const core = logo.locator('[data-part="proof-core"]')
    const sweep = logo.locator('[data-part="proof-sweep"]')
    await expect.poll(() => core.evaluate(readMotionStyle)).toMatchObject({
      hasFilter: true,
      hasTransform: true,
    })
    await expect.poll(() => sweep.evaluate(readAnimationName)).toContain(
      "perimeter-sweep"
    )
    expect(await parts.evaluateAll(readPartColors)).toEqual(colorsBefore)
    expect(await guardians.evaluateAll(readTransformAttributes)).toEqual(
      guardianGeometryBefore
    )

    await trigger.focus()
    await expect(trigger).toBeFocused()
    expect(await parts.evaluateAll(readPartColors)).toEqual(colorsBefore)
    expect(await guardians.evaluateAll(readTransformAttributes)).toEqual(
      guardianGeometryBefore
    )
  })

  test("settles both motion modes immediately when reduced motion is requested", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")

    const trigger = page.locator("header").getByRole("link", { name: "GridNinja home", exact: true }).filter({ visible: true })
    const microParts = trigger.locator("[data-part]")
    await trigger.hover()
    await trigger.focus()
    expect(await microParts.evaluateAll(hasReducedMotionContract)).toBe(true)

  })
})

function readPartColors(elements: Element[]) {
  return elements.map((element) => {
    const style = getComputedStyle(element)
    return { fill: style.fill, stroke: style.stroke }
  })
}

function readTransformAttributes(elements: Element[]) {
  return elements.map((element) => element.getAttribute("transform"))
}

function readMotionStyle(element: Element) {
  const style = getComputedStyle(element)
  return {
    hasFilter: style.filter !== "none",
    hasTransform: style.transform !== "none",
  }
}

function readAnimationName(element: Element) {
  return getComputedStyle(element).animationName
}

function readOpacity(element: Element) {
  return Number.parseFloat(getComputedStyle(element).opacity)
}

function readComputedTransforms(elements: Element[]) {
  return elements.map((element) => getComputedStyle(element).transform)
}

function hasReducedMotionContract(elements: Element[]) {
  const durationInMilliseconds = (value: string) => {
    const duration = value.trim()
    return duration.endsWith("ms")
      ? Number.parseFloat(duration)
      : Number.parseFloat(duration) * 1000
  }

  return elements.every((element) => {
    const style = getComputedStyle(element)
    const properties = style.transitionProperty
      .split(",")
      .map((property) => property.trim())
    const durations = style.transitionDuration
      .split(",")
      .map(durationInMilliseconds)
    return style.transform === "none" &&
      style.animationName === "none" &&
      properties.every((property, index) =>
        durations[index % durations.length]! <= 1 ||
        property === "none" ||
        property === "opacity" ||
        property === "color" ||
        property === "fill" ||
        property === "stroke"
      ) &&
      durations.every((duration) => duration <= 180)
  })
}
