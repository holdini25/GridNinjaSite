import { getSeoRoute, seoRoutes } from "../../src/seo/route-manifest"
import { expect, test } from "./support/client-health"

// Source inventory includes gated status pages, the receipt, and four immutable
// publication documents. Keep those distinct from indexable marketing pages.
const publicRoutes = seoRoutes.map(route => getSeoRoute(route.path))

test.describe("public route browser health", () => {
  for (const route of publicRoutes) {
    test(`${route.path} renders primary content without client failures or overflow`, async ({ page, clientHealth }, testInfo) => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" })
      expect(response?.status(), `${route.path} should return its document`).toBe(200)
      const publication = route.presentation === "publication"
      const content = publication ? page.locator("body") : page.locator("main#main-content")
      await expect(content).toBeVisible()
      await expect(content.locator("h1")).toHaveCount(1)
      await expect(content.locator("h1")).toContainText(route.h1)
      const robots = await page.locator('meta[name="robots"]').getAttribute("content")
      if (route.indexable) expect(robots ?? "").not.toMatch(/(?:^|,)\s*noindex\b/i)
      else expect(robots).toMatch(/\bnoindex\b/i)
      if (publication) await expect(page.locator("#site-header")).toHaveCount(0)

      // Visit lazy sections before evaluating image/overflow health. A blank
      // offscreen screenshot alone is not evidence that an asset failed.
      const scroll = await page.evaluate(async () => {
        for (let step = 0; step < 100; step++) {
          const bottom = Math.max(0, document.documentElement.scrollHeight - innerHeight)
          scrollTo({ top: Math.min(bottom, scrollY + innerHeight * .8), behavior: "instant" })
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
          if (scrollY >= Math.max(0, document.documentElement.scrollHeight - innerHeight) - 1) return true
        }
        return false
      })
      expect(scroll, "The bounded scroll should reach the final section").toBe(true)
      await expect.poll(async () => content.locator("img").evaluateAll(nodes => nodes
        .filter((node): node is HTMLImageElement => node instanceof HTMLImageElement)
        .filter(image => image.getClientRects().length > 0)
        .filter(image => !image.complete || image.naturalWidth === 0)
        .map(image => image.currentSrc || image.src)), { message: "Visible images should decode after the reader visits every section" }).toEqual([])
      await clientHealth.expectNoHorizontalOverflow()
      await testInfo.attach("route-acceptance.json", { contentType: "application/json", body: JSON.stringify({ path: route.path, status: response?.status(), indexable: route.indexable, presentation: route.presentation ?? "page", viewport: page.viewportSize(), browser: testInfo.project.name, coverage: "document semantics, initial client health and full-scroll image/overflow checks; not accessibility conformance or physical-device evidence" }, null, 2) })
    })
  }

  test("the legacy ROI address preserves its permanent assessment redirect", async ({ page, request, clientHealth }) => {
    const response = await request.get("/roi", { maxRedirects: 0 })
    expect(response.status()).toBe(308)
    expect(new URL(response.headers().location, "https://gridninja.ai").pathname).toBe("/assessment")
    await page.goto("/roi")
    await expect(page).toHaveURL(/\/assessment$/)
    await expect(page.locator("main#main-content h1")).toContainText(getSeoRoute("/assessment").h1)
    await clientHealth.expectNoHorizontalOverflow()
  })
})
