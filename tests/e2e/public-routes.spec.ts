import { expect, test } from "./support/client-health"

const publicRoutes = [
  "/",
  "/platform",
  "/platform/dispatch-envelope",
  "/solutions/ai-cloud",
  "/solutions/colocation",
  "/solutions/bridge-power",
  "/proof",
  "/why-gridninja",
  "/proof/proof-pack",
  "/demo",
  "/dcii",
  "/roi",
  "/about",
  "/contact",
] as const

test.describe("public route browser health", () => {
  for (const route of publicRoutes) {
    test(`${route} renders primary content without client failures or overflow`, async ({
      page,
      clientHealth,
    }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" })

      expect(response?.status(), `${route} should return a successful response`).toBeLessThan(
        400
      )
      await expect(page.locator("main#main-content")).toBeVisible()
      await expect(page.locator("main#main-content h1").first()).toBeVisible()
      await clientHealth.expectNoHorizontalOverflow()
    })
  }
})
