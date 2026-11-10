import { expect, test, type Locator, type Page } from "@playwright/test"
import registry from "../../src/content/civic-releases/registry.json"

test.skip(!registry.some(entry => entry.release === "civic-v2" && entry.status === "available"), "Pending civic-v2 registration: approved artwork packaging and release validation must be complete; these skipped checks are not browser qualification evidence")

const civicSelector = "#shared-infrastructure .gn-civic-figure"
const civicAssetPattern = "**/assets/civic/civic-v2/*"
const viewports = [320, 390, 768, 819, 820, 1024, 1440, 1920]

function civicRequests(page: Page) {
  const paths = new Set<string>()
  page.on("request", request => {
    const path = new URL(request.url()).pathname
    if (path.startsWith("/assets/civic/")) paths.add(path)
  })
  return paths
}

async function openCivic(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  const figure = page.locator(civicSelector)
  await expect(figure).toHaveAttribute("data-civic-release", "civic-v2")
  await figure.locator(".gn-civic-artwork").scrollIntoViewIfNeeded()
  return figure
}

async function decodedImage(figure: Locator, { javaScriptEnabled = true } = {}) {
  const image = figure.locator("picture img")
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
  if (javaScriptEnabled) {
    await image.evaluate((element: HTMLImageElement) => element.decode())
  } else {
    // Firefox suppresses Promise reactions when scripting is disabled (Mozilla
    // bug 1942990). Poll synchronous readback: native decoding can finish after
    // the resource reports complete, and no page Promise is needed here.
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      const context = canvas.getContext("2d")!
      context.drawImage(element, 0, 0, 1, 1)
      return context.getImageData(0, 0, 1, 1).data[3]
    })).toBeGreaterThan(0)
  }
  return image.evaluate((element: HTMLImageElement) => {
    return { src: element.currentSrc, width: element.naturalWidth, height: element.naturalHeight }
  })
}

async function assertMeaning(figure: Locator) {
  await expect(figure.locator("figcaption")).toContainText("Grid constraints")
  await expect(figure.locator("figcaption")).toContainText("Facility perimeter")
  await expect(figure.locator("figcaption")).toContainText("Local community")
  await expect(figure.locator("figcaption")).toContainText("Synthetic concept. Grid services, resource impacts and community benefits require separate evidence and review.")
  await expect(figure.locator("figcaption")).toContainText("The scene does not define an assessment boundary or operating authority.")
}

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }) })

for (const deviceScaleFactor of [1, 2]) {
  test.describe(`civic v2 at DPR ${deviceScaleFactor}`, () => {
    test.skip(({ isMobile }) => isMobile, "The viewport/DPR matrix uses desktop browser contexts; mobile project devices retain their own settings below")
    test.use({ deviceScaleFactor })
    for (const width of viewports) {
      test(`the ${width}px homepage selects one responsive composition and preserves its geometry`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 1100 })
        const requests = civicRequests(page)
        const figure = await openCivic(page)
        const image = await decodedImage(figure)
        const composition = width <= 819 ? "portrait" : "landscape"
        expect(new URL(image.src).pathname).toMatch(new RegExp(`/assets/civic/civic-v2/${composition}-\\d+\\.avif$`))
        expect([...requests]).toEqual([new URL(image.src).pathname])
        expect(image.width / image.height).toBeCloseTo(composition === "portrait" ? 5 / 6 : 16 / 9, 2)
        const geometry = await figure.locator(".gn-civic-artwork").evaluate(element => {
          const box = element.getBoundingClientRect()
          return { left: box.left, width: box.width, height: box.height, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }
        })
        expect(geometry.width).toBeCloseTo(Math.min(width, composition === "portrait" ? 680 : 1600), 0)
        expect(geometry.left).toBeCloseTo((width - geometry.width) / 2, 0)
        expect(geometry.width / geometry.height).toBeCloseTo(composition === "portrait" ? 5 / 6 : 16 / 9, 2)
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1)
        await assertMeaning(figure)
        await testInfo.attach("civic-delivery", { body: Buffer.from(JSON.stringify({ viewport: width, deviceScaleFactor, image, geometry, requests: [...requests] }, null, 2)), contentType: "application/json" })
      })
    }
  })
}

test("the configured mobile device retains its viewport, DPR and portrait delivery", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, "Runs on the actual configured mobile emulation projects")
  const viewport = page.viewportSize()!
  const requests = civicRequests(page)
  const figure = await openCivic(page)
  const image = await decodedImage(figure)
  const device = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, touchPoints: navigator.maxTouchPoints, pageWidth: document.documentElement.scrollWidth }))
  expect(device.width).toBe(viewport.width)
  expect(device.dpr).toBe(testInfo.project.use.deviceScaleFactor)
  expect(device.pageWidth).toBeLessThanOrEqual(device.width + 1)
  expect(new URL(image.src).pathname).toMatch(/\/assets\/civic\/civic-v2\/portrait-\d+\.avif$/)
  expect([...requests]).toEqual([new URL(image.src).pathname])
  await assertMeaning(figure)
  await testInfo.attach("civic-mobile-device", { body: Buffer.from(JSON.stringify({ device, viewport, image, requests: [...requests] }, null, 2)), contentType: "application/json" })
})

for (const width of [390, 1440]) {
  test(`the ${width}px civic artwork reserves space before its image is available`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 })
    let release = () => {}
    const gate = new Promise<void>(resolve => { release = resolve })
    let requested = false
    await page.route(civicAssetPattern, async route => {
      requested = true
      await gate
      await route.continue()
    })
    try {
      const figure = await openCivic(page)
      await expect.poll(() => requested).toBe(true)
      const artwork = figure.locator(".gn-civic-artwork")
      const before = await artwork.boundingBox()
      expect(before).not.toBeNull()
      expect(before!.height).toBeGreaterThan(0)
      const captionBefore = await figure.locator("figcaption").boundingBox()
      release()
      await decodedImage(figure)
      const after = await artwork.boundingBox()
      const captionAfter = await figure.locator("figcaption").boundingBox()
      expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1)
      // Caption position relative to its artwork is unaffected by scroll anchoring.
      expect(Math.abs((captionAfter!.y - after!.y) - (captionBefore!.y - before!.y))).toBeLessThanOrEqual(1)
    } finally {
      release()
      await page.unroute(civicAssetPattern)
    }
  })

  test(`a ${width}px civic image HTTP failure preserves the SVG and qualified explanation`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 })
    await page.route(civicAssetPattern, route => route.fulfill({ status: 503, contentType: "text/plain", body: "Injected unavailable civic image", headers: { "cache-control": "no-store" } }))
    const figure = await openCivic(page)
    const image = figure.locator("picture img")
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth === 0)).toBe(true)
    await expect(figure.locator(width <= 819 ? ".gn-civic-portrait" : ".gn-civic-landscape")).toBeVisible()
    await assertMeaning(figure)
    await expect(page.locator("#shared-infrastructure-heading")).toContainText("accountable neighbors")
  })
}

test.describe("civic server-rendered delivery", () => {
  test.use({ javaScriptEnabled: false })

  for (const width of [390, 1440]) {
    test(`the ${width}px image and explanation work without JavaScript`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1100 })
      const requests = civicRequests(page)
      const figure = await openCivic(page)
      const image = await decodedImage(figure, { javaScriptEnabled: false })
      expect([...requests]).toEqual([new URL(image.src).pathname])
      await assertMeaning(figure)
    })

    test(`the native ${width}px picture selects WebP when its AVIF MIME is unsupported`, async ({ page }, testInfo) => {
      testInfo.annotations.push({ type: "capability-fixture", description: "Only civic AVIF source MIME declarations are replaced with an unsupported type in the document response. This tests native picture fallback, not an AVIF download-error retry." })
      await page.setViewportSize({ width, height: 1100 })
      await page.route(url => url.pathname === "/", async route => {
        const response = await route.fetch()
        const body = (await response.text()).replace(/<source\b[^>]*>/g, source => source.includes("/assets/civic/civic-v2/") ? source.replace('type="image/avif"', 'type="image/x-civic-unsupported"') : source)
        await route.fulfill({ response, body })
      })
      const requests = civicRequests(page)
      const figure = await openCivic(page)
      const image = await decodedImage(figure, { javaScriptEnabled: false })
      expect(new URL(image.src).pathname).toMatch(new RegExp(`/assets/civic/civic-v2/${width <= 819 ? "portrait" : "landscape"}-\\d+\\.webp$`))
      expect([...requests]).toEqual([new URL(image.src).pathname])
      await assertMeaning(figure)
    })
  }
})

for (const path of ["/about", "/platform"]) {
  test(`${path} retains civic v1`, async ({ page }) => {
    const requests = civicRequests(page)
    await page.goto(path, { waitUntil: "domcontentloaded" })
    const figure = page.locator(".gn-civic-figure")
    await expect(figure).toHaveAttribute("data-civic-release", "civic-v1")
    await figure.scrollIntoViewIfNeeded()
    const image = await decodedImage(figure)
    expect(new URL(image.src).pathname).toMatch(/^\/assets\/civic\/civic-v1\/.*\.webp$/)
    expect([...requests].every(path => path.startsWith("/assets/civic/civic-v1/"))).toBe(true)
  })
}
