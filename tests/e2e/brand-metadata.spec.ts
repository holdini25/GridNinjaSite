import { expect, test } from "@playwright/test"

const socialImageAlt =
  "GridNinja — proof-backed virtual capacity for AI data centers"

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
          src: "/brand/icons/pwa-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/brand/icons/pwa-512.png",
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
    ["/icon1.png", 16, 16],
    ["/icon2.png", 32, 32],
    ["/apple-icon.png", 180, 180],
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

  test("serves the favicon and SVG icon fallbacks", async ({ request }) => {
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

    const svgResponse = await request.get("/icon.svg")
    expect(svgResponse.status()).toBe(200)
    expect(svgResponse.headers()["content-type"]).toContain("image/svg+xml")
    expect(await svgResponse.text()).toContain(
      "GridNinja proof-core favicon"
    )
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
      links.map((link) => ({
        path: new URL((link as HTMLLinkElement).href).pathname,
        type: (link as HTMLLinkElement).type,
      }))
    )
    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/favicon.ico" }),
        { path: "/icon.svg", type: "image/svg+xml" },
        { path: "/icon1.png", type: "image/png" },
        { path: "/icon2.png", type: "image/png" },
      ])
    )

    const appleIconPaths = await page
      .locator('link[rel="apple-touch-icon"]')
      .evaluateAll((links) =>
        links.map((link) => new URL((link as HTMLLinkElement).href).pathname)
      )
    expect(appleIconPaths).toContain("/apple-icon.png")
  })
})
