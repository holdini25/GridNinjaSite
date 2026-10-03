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
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href")
    // URL identity treats an origin's empty path and `/` identically.
    // Parsing without a base still rejects relative or malformed canonicals.
    expect(new URL(canonical ?? "").href).toBe(`${apexOrigin}/`)
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

test("production host variants follow the approved permanent redirect chains", async ({
  baseURL,
}, testInfo) => {
  test.skip(new URL(baseURL ?? apexOrigin).origin !== apexOrigin)

  const pathAndQuery = "/assessment?proof=1&source=seo-smoke"
  // Vercel upgrades HTTP to HTTPS before the host redirect. Only HTTP www
  // has this approved two-hop chain; neither temporary nor extra hops qualify.
  // https://vercel.com/docs/cdn-security/encryption
  const chains = [
    ["http://gridninja.ai", apexOrigin],
    ["http://www.gridninja.ai", "https://www.gridninja.ai", apexOrigin],
    ["https://www.gridninja.ai", apexOrigin],
  ]
  const observations: { url: string; status: number; location: string | null }[] = []
  const context = await playwrightRequest.newContext()
  try {
    for (const chain of chains) {
      for (let hop = 0; hop < chain.length; hop++) {
        const url = `${chain[hop]}${pathAndQuery}`
        const response = await context.get(url, { maxRedirects: 0 })
        const location = response.headers().location ?? null
        observations.push({ url, status: response.status(), location })
        if (hop === chain.length - 1) {
          expect(response.status(), `terminal ${url}`).toBe(200)
          expect(location, `no further redirect from ${url}`).toBeNull()
        } else {
          expect([301, 308], url).toContain(response.status())
          expect(location, `hop ${hop + 1} from ${url}`).toBe(
            `${chain[hop + 1]}${pathAndQuery}`
          )
        }
      }
    }
  } finally {
    await testInfo.attach("production-redirect-chains", {
      body: Buffer.from(JSON.stringify(observations, null, 2)),
      contentType: "application/json",
    })
    await context.dispose()
  }
})
