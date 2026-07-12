import { expect, test } from "@playwright/test"

test.describe("Why GridNinja competitor profiles", () => {
  test("swaps a complete profile panel, supports keyboard navigation, and reveals sources inline", async ({
    page,
  }) => {
    await page.goto("/why-gridninja#competitors")

    await expect(
      page.getByRole("heading", {
        name: "Respect the strengths. Define the responsibility.",
      })
    ).toBeVisible()
    await expect(page.getByTestId("competitor-rail").getByRole("tab")).toHaveCount(
      6
    )

    const emerald = page.getByRole("tab", { name: /Emerald AI/i })
    await emerald.focus()
    await emerald.press("ArrowRight")

    const phaidra = page.getByRole("tab", { name: /Phaidra/i })
    await expect(phaidra).toHaveAttribute("aria-selected", "true")
    await expect(page.getByTestId("competitor-panel")).toContainText("Phaidra")
    await expect(page.getByTestId("competitor-panel")).toContainText(
      "Proof GridNinja must produce"
    )

    const sourceButton = page.getByRole("button", { name: /3 sources/i })
    await sourceButton.click()
    await expect(sourceButton).toHaveAttribute("aria-expanded", "true")
    await expect(page.getByTestId("competitor-sources")).toBeVisible()
    await expect(
      page.getByLabel("Phaidra source notes").getByRole("link")
    ).toHaveCount(3)
    await expect(page.getByRole("dialog")).toHaveCount(0)
  })

  test("uses a sticky rail on desktop", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "desktop-only behavior")

    await page.goto("/why-gridninja#competitors")

    await expect(page.getByTestId("competitor-rail")).toHaveCSS(
      "position",
      "sticky"
    )
  })

  test("uses a horizontal snap rail and stacked claim cards on mobile", async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "mobile-only behavior")

    await page.goto("/why-gridninja#competitors")

    const rail = page.getByTestId("competitor-rail")
    await expect(rail).toHaveCSS("overflow-x", "auto")
    await expect(rail).toHaveCSS("scroll-snap-type", "x mandatory")
    const panelFitsViewport = await page
      .getByTestId("competitor-panel")
      .evaluate(
        (panel) => panel.getBoundingClientRect().right <= window.innerWidth
      )
    expect(panelFitsViewport).toBe(true)

    const publicClaim = page.getByText("What public materials show")
    const sharedClaim = page.getByText("Shared terrain")
    const publicBox = await publicClaim.boundingBox()
    const sharedBox = await sharedClaim.boundingBox()

    expect(publicBox?.y).not.toBe(sharedBox?.y)
  })
})
