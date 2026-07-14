import { expect, test } from "./support/client-health"

test.describe("GridNinja brand placements", () => {
  const widths = [320, 360, 375, 768, 1024, 1280, 1440] as const

  test("keeps the canonical 34px micro identity stable in the header", async ({
    page,
    clientHealth,
  }) => {
    await page.goto("/")

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })

      const header = page.locator("header")
      const home = header.locator("[data-gn-logo-trigger]")
      const mark = header.locator('[data-logo-motion="micro-response"] svg')
      const wordmark = header.getByText("GridNinja", { exact: true })

      expect((await header.boundingBox())?.height).toBeCloseTo(70, 2)
      expect((await home.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      await expect(mark).toBeVisible()
      expect((await mark.boundingBox())?.height).toBeCloseTo(34, 2)
      if (width < 380) {
        await expect(wordmark).toBeHidden()
      } else {
        await expect(wordmark).toBeVisible()
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
    const watermark = page.locator('img[src*="gridninja-watermark.svg"]')

    await expect(footerMark).toBeVisible()
    await expect(page.locator("footer")).toContainText(
      "Infrastructure · Intelligence · Control"
    )
    expect((await footerMark.boundingBox())?.height).toBeGreaterThanOrEqual(72)
    await expect(watermark).toBeVisible()
    await expect(watermark).toHaveCSS("opacity", "0.04")
    await expect(page.locator("footer [data-logo-motion]")).toHaveCount(0)
    await expect(watermark).not.toHaveAttribute("data-logo-motion")

    await page.goto("/about")
    const ceremonial = page.locator(
      '[data-logo-motion="guardian-wake"] svg'
    )
    await expect(ceremonial).toBeVisible()
    expect((await ceremonial.boundingBox())?.height).toBeCloseTo(192, 2)
    await expect(
      page.getByRole("heading", { name: "Coordination protected by proof" })
    ).toBeVisible()
  })

  test("links the 36px micro identity in the mobile drawer", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 720 })
    await page.goto("/")
    await page.getByRole("button", { name: "Open navigation" }).click()

    const drawer = page.getByRole("dialog")
    const home = drawer.getByRole("link", { name: "GridNinja home" })
    const mark = home.locator('[data-logo-motion="micro-response"] svg')

    await expect(home).toBeVisible()
    expect((await mark.boundingBox())?.height).toBeCloseTo(36, 2)
    await expect(drawer).toContainText(
      "Runtime-assured virtual capacity for AI data centers."
    )
  })

  test("keeps proof seals static", async ({ page }) => {
    await page.goto("/proof/proof-pack")

    const seal = page
      .locator('[data-evidence-chain-status="complete"]')
      .first()
    await expect(seal).toBeVisible()
    await expect(seal.locator("[data-logo-motion]")).toHaveCount(0)
    await expect(seal).not.toHaveAttribute("data-logo-motion")
  })

  test("keeps the footer brand signature on one line without overflow", async ({
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
      await expect(signature).toHaveCSS("white-space", "nowrap")
      const metrics = await signature.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)

        return { height: bounds.height, lineHeight }
      })
      expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight + 1)
      await clientHealth.expectNoHorizontalOverflow()
    }
  })

  test("navigates functionally from the header logo", async ({ page }) => {
    await page.goto("/about")

    const home = page.locator("header [data-gn-logo-trigger]")
    await home.click()

    await expect(page).toHaveURL(/\/$/)
  })

  test("runs the micro response from keyboard focus before any hover", async ({
    page,
  }) => {
    await page.goto("/")

    const trigger = page.locator("header [data-gn-logo-trigger]")
    const core = trigger.locator('[data-part="proof-core"]')
    const glow = trigger.locator('[data-part="proof-glow"]')
    const sweep = trigger.locator('[data-part="proof-sweep"]')
    const guardians = trigger.locator(
      '[data-part="guardian-left"], [data-part="guardian-right"]'
    )

    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
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

    const trigger = page.locator("header [data-gn-logo-trigger]")
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

  test("reveals the ceremonial guardian once and stays settled after re-entry", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 500 })
    await page.goto("/about")

    const logo = page.locator('[data-logo-motion="guardian-wake"]')
    await expect(logo).toHaveAttribute("data-logo-reveal", "once")

    await logo.scrollIntoViewIfNeeded()
    await expect(logo).toHaveAttribute("data-logo-revealed", "true")

    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(logo).toHaveAttribute("data-logo-revealed", "true")
    await logo.scrollIntoViewIfNeeded()
    await expect(logo).toHaveAttribute("data-logo-revealed", "true")
  })

  test("keeps the ceremonial emblem visible when hydration is unavailable", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    try {
      await page.goto("/about")
      const logo = page.locator('[data-logo-motion="guardian-wake"]')

      await expect(logo).toHaveAttribute("data-logo-revealed", "true")
      await expect(logo).toHaveAttribute("data-logo-reveal-stage", "settled")
      await expect(logo.locator("svg")).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test("caps fine-pointer ceremonial tilt at two degrees and resets on leave", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 700 })
    await page.goto("/about")
    const finePointer = await page.evaluate(() =>
      matchMedia("(pointer: fine)").matches
    )
    test.skip(!finePointer, "Tilt is intentionally disabled on coarse pointers")

    const logo = page.locator('[data-logo-motion="guardian-wake"]')
    await logo.scrollIntoViewIfNeeded()
    const box = await logo.boundingBox()
    expect(box).not.toBeNull()

    await page.mouse.move(box!.x + box!.width - 1, box!.y + 1)
    const tilt = await logo.evaluate(readTiltProperties)
    expect(Math.abs(tilt.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(tilt.y)).toBeLessThanOrEqual(2)

    await page.mouse.move(0, 0)
    await expect.poll(() => logo.evaluate(readTiltProperties)).toEqual({
      x: 0,
      y: 0,
    })
  })

  test("keeps ceremonial tilt disabled on coarse pointers", async ({ page }) => {
    await page.goto("/about")
    const coarsePointer = await page.evaluate(() =>
      matchMedia("(pointer: coarse)").matches
    )
    test.skip(!coarsePointer, "This assertion applies to mobile/coarse projects")

    const logo = page.locator('[data-logo-motion="guardian-wake"]')
    await logo.scrollIntoViewIfNeeded()
    const box = await logo.boundingBox()
    expect(box).not.toBeNull()

    await page.touchscreen.tap(
      box!.x + box!.width - 1,
      box!.y + Math.min(20, box!.height - 1)
    )
    expect(await logo.evaluate(readTiltProperties)).toEqual({ x: 0, y: 0 })
    await expect(logo.locator("svg")).toHaveCSS("transform", "none")
  })

  test("settles both motion modes immediately when reduced motion is requested", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")

    const trigger = page.locator("header [data-gn-logo-trigger]")
    const microParts = trigger.locator("[data-part]")
    await trigger.hover()
    await trigger.focus()
    expect(await microParts.evaluateAll(hasReducedMotionContract)).toBe(true)

    await page.goto("/about")
    const guardian = page.locator('[data-logo-motion="guardian-wake"]')
    await guardian.scrollIntoViewIfNeeded()
    await expect(guardian).toHaveAttribute("data-logo-revealed", "true")
    expect(
      await guardian.locator("[data-part]").evaluateAll(hasReducedMotionContract)
    ).toBe(true)
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

function readTiltProperties(element: Element) {
  const style = (element as HTMLElement).style
  return {
    x: Number.parseFloat(
      style.getPropertyValue("--gridninja-tilt-x") || "0"
    ),
    y: Number.parseFloat(
      style.getPropertyValue("--gridninja-tilt-y") || "0"
    ),
  }
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
