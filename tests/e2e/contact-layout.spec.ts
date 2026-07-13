import { expect, test } from "./support/client-health"

test.describe("contact information layout", () => {
  test("keeps the autonomy ladder readable and event states separated", async ({
    page,
    clientHealth,
  }) => {
    await page.goto("/contact", { waitUntil: "domcontentloaded" })

    const ladder = page.locator(
      '.gn-deployment-ladder[data-layout="contact-split"]'
    )
    const cards = ladder.locator(":scope > *")

    await expect(ladder).toBeVisible()
    await expect(cards).toHaveCount(4)

    const cardBoxes = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width }
      })
    )

    const isDesktop = page.viewportSize()!.width >= 768

    if (isDesktop) {
      expect(Math.abs(cardBoxes[0].y - cardBoxes[1].y)).toBeLessThan(2)
      expect(cardBoxes[1].x).toBeGreaterThan(cardBoxes[0].x)
      expect(cardBoxes[2].y).toBeGreaterThan(cardBoxes[0].y)
      expect(Math.abs(cardBoxes[2].y - cardBoxes[3].y)).toBeLessThan(2)
    } else {
      expect(cardBoxes[1].y).toBeGreaterThan(cardBoxes[0].y)
      expect(Math.abs(cardBoxes[0].x - cardBoxes[1].x)).toBeLessThan(2)
      expect(Math.abs(cardBoxes[0].width - cardBoxes[1].width)).toBeLessThan(2)
    }

    const firstEvent = page.locator(".gn-instrument-event").first()
    const stateLabel = firstEvent.locator("p").nth(1)
    const statusDot = firstEvent.locator(".gn-instrument-event-status")

    await expect(stateLabel).toBeVisible()
    await expect(statusDot).toBeVisible()

    const stateBox = await stateLabel.boundingBox()
    const dotBox = await statusDot.boundingBox()

    expect(stateBox).not.toBeNull()
    expect(dotBox).not.toBeNull()
    expect(stateBox!.x + stateBox!.width).toBeLessThanOrEqual(dotBox!.x)

    await clientHealth.expectNoHorizontalOverflow()
  })
})
