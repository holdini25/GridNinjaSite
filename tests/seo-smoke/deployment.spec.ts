import { request as playwrightRequest, expect, test } from "@playwright/test"

const apexOrigin = "https://gridninja.ai"

function locations(xml: string) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
}

test("deployment exposes one canonical identity and crawl policy", async ({
  baseURL,
  page,
  request,
}) => {
  expect(baseURL).toBeTruthy()
  const target = new URL(baseURL ?? apexOrigin)

  const response = await page.goto("/", { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)

  if (target.origin === apexOrigin) {
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${apexOrigin}/`
    )
    const robots = await request.get("/robots.txt")
    expect(robots.status()).toBe(200)
    expect(await robots.text()).toContain(
      `Sitemap: ${apexOrigin}/sitemap.xml`
    )

    const sitemap = await request.get("/sitemap.xml")
    expect(sitemap.status()).toBe(200)
    expect(
      locations(await sitemap.text()).every((url) => url.startsWith(`${apexOrigin}/`))
    ).toBe(true)
  } else {
    const robotsHeader = response?.headers()["x-robots-tag"] ?? ""
    const robotsLocator = page.locator('meta[name="robots"]')
    const robotsMeta =
      (await robotsLocator.count()) > 0
        ? (await robotsLocator.getAttribute("content")) ?? ""
        : ""
    expect(`${robotsHeader},${robotsMeta}`).toMatch(/noindex/i)
    expect(`${robotsHeader},${robotsMeta}`).toMatch(/nofollow/i)
    expect(`${robotsHeader},${robotsMeta}`).toMatch(/noarchive/i)
  }
})

test("production host variants redirect to apex in one permanent hop", async ({
  baseURL,
}) => {
  test.skip(new URL(baseURL ?? apexOrigin).origin !== apexOrigin)

  for (const source of [
    "http://gridninja.ai/seo-smoke?proof=1",
    "http://www.gridninja.ai/seo-smoke?proof=1",
    "https://www.gridninja.ai/seo-smoke?proof=1",
  ]) {
    const context = await playwrightRequest.newContext()
    try {
      const response = await context.get(source, { maxRedirects: 0 })
      expect([301, 308], source).toContain(response.status())
      expect(response.headers().location, source).toBe(
        `${apexOrigin}/seo-smoke?proof=1`
      )
    } finally {
      await context.dispose()
    }
  }
})
