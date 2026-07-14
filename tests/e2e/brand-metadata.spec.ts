import { expect, test } from "@playwright/test"

const socialImageAlt =
  "GridNinja — proof-backed virtual capacity for AI data centers"
const canonicalSiteUrl = "https://gridninja.ai/"
const homepageTitle =
  "AI Data Center Virtual Capacity Control Plane | GridNinja"
const homepageDescription =
  "GridNinja is the virtual capacity control plane for AI data centers, proving safe, usable capacity to accelerate time-to-power while protecting infrastructure."

function pngSize(buffer: Buffer) {
  expect(buffer.subarray(1, 4).toString("ascii")).toBe("PNG")
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

test.describe("production brand metadata routes", () => {
  test("serves the manifest with local standard and maskable icons", async ({
    request,
  }) => {
    const response = await request.get("/manifest.webmanifest")

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain(
      "application/manifest+json"
    )
    const manifest = await response.json()
    expect(manifest).toMatchObject({
      name: "GridNinja",
      short_name: "GridNinja",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#070a0d",
      theme_color: "#070a0d",
      icons: [
        {
          src: "/gridninja-icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/gridninja-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/brand/icons/pwa-maskable-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "/brand/icons/pwa-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    })
    expect(manifest).not.toHaveProperty("serviceworker")
  })

  const pngRoutes = [
    ["/opengraph-image", 1200, 630],
    ["/twitter-image", 1200, 630],
    ["/og/home", 1200, 630],
    ["/gridninja-apple-touch-icon-180.png", 180, 180],
    ["/gridninja-icon-192.png", 192, 192],
    ["/gridninja-icon-512.png", 512, 512],
    ["/brand/icons/pwa-192.png", 192, 192],
    ["/brand/icons/pwa-512.png", 512, 512],
    ["/brand/icons/pwa-maskable-192.png", 192, 192],
    ["/brand/icons/pwa-maskable-512.png", 512, 512],
    ["/brand/social/gridninja-og-emblem.png", 400, 400],
  ] as const

  for (const [route, width, height] of pngRoutes) {
    test(`serves ${route} as a correctly sized PNG`, async ({ request }) => {
      const response = await request.get(route)

      expect(response.status()).toBe(200)
      expect(response.headers()["content-type"]).toContain("image/png")
      expect(pngSize(await response.body())).toEqual({ width, height })
    })
  }

  test("serves the stable multi-size favicon", async ({ request }) => {
    const faviconResponse = await request.get("/favicon.ico")
    expect(faviconResponse.status()).toBe(200)
    expect(faviconResponse.headers()["content-type"]).toMatch(
      /^image\/(?:x-icon|vnd\.microsoft\.icon)/
    )
    const favicon = await faviconResponse.body()
    expect(favicon.readUInt16LE(4)).toBe(3)
    expect(
      Array.from({ length: 3 }, (_, index) => favicon[6 + index * 16] || 256)
    ).toEqual([16, 32, 48])

  })

  test("publishes complete social, icon, manifest, and theme metadata in the root head", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest"
    )
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#070a0d"
    )
    await expect(page).toHaveTitle(homepageTitle)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      homepageDescription
    )
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      canonicalSiteUrl
    )
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      canonicalSiteUrl
    )
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "GridNinja"
    )
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      "content",
      "1200"
    )
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute(
      "content",
      "630"
    )
    await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute(
      "content",
      "image/png"
    )
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      "content",
      socialImageAlt
    )
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image"
    )
    await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
      "content",
      socialImageAlt
    )

    const icons = await page.locator('link[rel="icon"]').evaluateAll((links) =>
      links.map((link) => {
        const element = link as HTMLLinkElement
        const url = new URL(element.href)
        return {
          path: url.pathname,
          search: url.search,
          sizes: element.sizes.value,
          type: element.type,
        }
      })
    )
    expect(icons).toEqual([
      {
        path: "/favicon.ico",
        search: "",
        sizes: "any",
        type: "",
      },
      {
        path: "/gridninja-icon-192.png",
        search: "",
        sizes: "192x192",
        type: "image/png",
      },
    ])

    const appleIcons = await page
      .locator('link[rel="apple-touch-icon"]')
      .evaluateAll((links) =>
        links.map((link) => {
          const element = link as HTMLLinkElement
          const url = new URL(element.href)
          return {
            path: url.pathname,
            search: url.search,
            sizes: element.sizes.value,
            type: element.type,
          }
        })
      )
    expect(appleIcons).toEqual([
      {
        path: "/gridninja-apple-touch-icon-180.png",
        search: "",
        sizes: "",
        type: "",
      },
    ])

    const schema = page.locator(
      'script#gridninja-schema-home[type="application/ld+json"]'
    )
    await expect(schema).toHaveCount(1)
    const graph = JSON.parse((await schema.textContent()) ?? "")
    expect(graph).toMatchObject({ "@context": "https://schema.org" })
    expect(graph["@graph"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "@type": "WebSite",
          "@id": "https://gridninja.ai/#website",
          url: canonicalSiteUrl,
          name: "GridNinja",
          alternateName: "gridninja.ai",
        }),
        expect.objectContaining({
          "@type": "Organization",
          "@id": "https://gridninja.ai/#organization",
        }),
      ])
    )
    await expect(
      page.getByText("GridNinja is the runtime-assured virtual capacity engine", {
        exact: false,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Read more", exact: true })
    ).toHaveCount(0)
  })

  test("publishes crawlable apex robots and sitemap signals", async ({
    request,
  }) => {
    const robotsResponse = await request.get("/robots.txt")
    expect(robotsResponse.status()).toBe(200)
    const robotsText = await robotsResponse.text()
    expect(robotsText).toContain("User-Agent: *\nAllow: /")
    expect(robotsText).toContain("Disallow: /api/")
    expect(robotsText).toContain("Disallow: /internal/")
    expect(robotsText).toContain("Sitemap: https://gridninja.ai/sitemap.xml")

    const sitemapResponse = await request.get("/sitemap.xml")
    expect(sitemapResponse.status()).toBe(200)
    const sitemap = await sitemapResponse.text()
    expect(sitemap).toContain(`<loc>${canonicalSiteUrl}</loc>`)
    expect(sitemap).not.toContain("https://www.gridninja.ai")
    expect(sitemap.match(/<loc>https:\/\/gridninja\.ai\//g)).not.toBeNull()
  })
})
