import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("keeps proof contrast stable while Load Passport selection changes", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "The focused regression covers Lighthouse's desktop Chromium path."
  )

  await page.goto("/proof")

  await expect
    .poll(() =>
      page.locator("html").evaluate((root) =>
        window.getComputedStyle(root).getPropertyValue("view-transition-name")
      )
    )
    .toBe("none")

  const passport = page
    .locator("section.gn-hd-panel")
    .filter({ hasText: "AI Data Center Load Passport" })
    .first()
  const telemetryTrust = passport.getByRole("button", {
    name: /Telemetry Trust Score/i,
  })

  await passport.scrollIntoViewIfNeeded()
  await telemetryTrust.focus()
  await expect(telemetryTrust).toHaveAttribute("aria-pressed", "true")

  for (const selector of [".gn-chain-stage", ".gn-v2-braid-node"]) {
    const backgrounds = await page.locator(selector).evaluateAll((nodes) =>
      nodes.map((node) => window.getComputedStyle(node).backgroundColor)
    )

    expect(backgrounds.length).toBeGreaterThan(0)
    expect(
      backgrounds.every(
        (color) => !color.startsWith("rgba(") && !color.includes("/")
      )
    ).toBe(true)
  }

  const results = await new AxeBuilder({ page })
    .include(".gn-proof-chain")
    .include(".gn-v2-braid-node")
    .withRules(["color-contrast"])
    .analyze()

  expect(results.violations).toEqual([])
})
