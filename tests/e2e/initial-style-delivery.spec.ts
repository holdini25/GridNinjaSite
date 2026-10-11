import { expect, test } from "./support/client-health"

const routes = [
  { path: "/", body: "main .gn-home-lead", text: "paid, bounded assessment" },
  { path: "/contact", body: "main h1 + p", text: "historical inputs" },
  { path: "/evidence", body: "main header p.text-lg", text: "synthetic examples" },
] as const

for (const javaScriptEnabled of [true, false]) {
  test.describe(`initial inline styles with JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, () => {
    test.use({ javaScriptEnabled })

    for (const route of routes) {
      test(`${route.path} delivers readable initial content without an external stylesheet`, async ({ page }, testInfo) => {
        const stylesheetRequests: string[] = []
        const enhancementRequests: string[] = []
        page.on("request", request => {
          if (request.resourceType() === "stylesheet") stylesheetRequests.push(request.url())
          if (new URL(request.url()).pathname === "/header-controls.mjs") enhancementRequests.push(request.url())
        })

        // No routing, injected styles, response substitution or init scripts:
        // these assertions inspect the candidate's actual production document.
        const response = await page.goto(route.path, { waitUntil: "load" })
        expect(response?.status()).toBe(200)
        const html = await response!.text()
        const inlineStyles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1])
        expect(inlineStyles.some(css => css.includes("--gn-canvas:"))).toBe(true)
        expect(html.match(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/g) ?? []).toEqual([])
        expect(stylesheetRequests).toEqual([])

        const heading = page.locator("main h1")
        const body = page.locator(route.body)
        await expect(heading).toBeVisible()
        await expect(body).toBeVisible()
        await expect(body).toContainText(route.text)
        await expect(page.locator("#site-header")).not.toHaveAttribute("data-enhanced", "true")
        expect(enhancementRequests).toEqual([])

        const styles = await page.evaluate(bodySelector => {
          const heading = document.querySelector("main h1")!
          const body = document.querySelector(bodySelector)!
          return {
            canvas: getComputedStyle(document.body).backgroundColor,
            headingSize: parseFloat(getComputedStyle(heading).fontSize),
            bodySize: parseFloat(getComputedStyle(body).fontSize),
            bodyColor: getComputedStyle(body).color,
          }
        }, route.body)
        expect(styles.canvas).toBe("rgb(8, 8, 8)")
        expect(styles.headingSize).toBeGreaterThanOrEqual(32)
        expect(styles.bodySize).toBeGreaterThanOrEqual(16)
        expect(styles.bodyColor).not.toBe(styles.canvas)

        await testInfo.attach("initial-style-delivery.json", {
          contentType: "application/json",
          body: Buffer.from(JSON.stringify({ evidence: "untampered production response and initial browser document; no performance claim", route: route.path, javaScriptEnabled, inlineStyleBlocks: inlineStyles.length, stylesheetRequests, enhancementRequests, styles }, null, 2)),
        })
      })
    }
  })
}
