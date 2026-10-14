import { readFileSync } from "node:fs"
import { join } from "node:path"
import { type Response } from "@playwright/test"

import { expect, test } from "./support/client-health"

const expectedManifestBody = readFileSync(join(__dirname, "../fixtures/web-app-manifest.json"), "utf8")
const cookieName = "gn_manifest_credentials_fixture"
const cookieValue = "local-browser-regression"

for (const route of ["/about", "/contact"] as const) {
  test(`native manifest loading sends the local HttpOnly fixture on ${route}`, async ({ page, context, browserName, baseURL }) => {
    test.skip(browserName !== "chromium", "Native Page.getAppManifest verification requires Chromium CDP; this skip provides no manifest credential qualification for this engine.")
    const origin = baseURL ? new URL(baseURL) : null
    test.skip(!origin || !["http:", "https:"].includes(origin.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname), "The synthetic HttpOnly cookie fixture is restricted to local loopback; remote qualification must use its separate authorized procedure.")
    expect(origin?.username).toBe("")
    expect(origin?.password).toBe("")
    const localOrigin = origin!.origin
    const manifestURL = `${localOrigin}/manifest.webmanifest`
    const unexpectedRequests: string[] = []
    // No form interaction or provider operation is needed for native manifest
    // loading. Fulfill any unexpected attempt locally and fail on the record.
    await context.route("**/api/**", async intercepted => {
      unexpectedRequests.push(`API ${new URL(intercepted.request().url()).pathname}`)
      await intercepted.fulfill({ status: 204, body: "" })
    })
    await context.route("https://challenges.cloudflare.com/**", async intercepted => {
      unexpectedRequests.push(`verification ${new URL(intercepted.request().url()).pathname}`)
      await intercepted.fulfill({ status: 200, contentType: "application/javascript", body: "/* Verification is not part of this manifest test. */" })
    })
    // URL-only cookie input creates a host-only cookie for this fresh context;
    // no application credential, global header, or remote origin is involved.
    await context.addCookies([{ name: cookieName, value: cookieValue, url: `${localOrigin}/`, httpOnly: true, sameSite: "Lax" }])
    const fixture = (await context.cookies(localOrigin)).find(cookie => cookie.name === cookieName)
    expect(fixture && { domain: fixture.domain, path: fixture.path, httpOnly: fixture.httpOnly }).toEqual({ domain: origin!.hostname, path: "/", httpOnly: true })

    const manifestResponses: Response[] = []
    page.on("response", response => { if (response.url() === manifestURL) manifestResponses.push(response) })
    const cdp = await context.newCDPSession(page)
    try {
      const documentResponse = await page.goto(`${localOrigin}${route}`, { waitUntil: "load" })
      expect(documentResponse?.status()).toBe(200)
      await expect(page.locator('link[rel="manifest"]')).toHaveCount(1)
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest")
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("crossorigin", "use-credentials")
      expect(await page.evaluate(name => document.cookie.split(";").some(cookie => cookie.trim().startsWith(`${name}=`)), cookieName)).toBe(false)

      // This asks Chromium's native manifest loader to process the document's
      // manifest link. A page/API fetch would not exercise that credential mode.
      const manifest = await cdp.send("Page.getAppManifest")
      expect(manifest.url).toBe(manifestURL)
      expect(manifest.errors.filter(error => error.critical !== 0)).toEqual([])
      expect(manifest.data).toBe(expectedManifestBody)
      expect(JSON.parse(manifest.data ?? "{}")).toMatchObject({ name: "GridNinja", start_url: "/", scope: "/", display: "standalone" })
      await expect.poll(() => manifestResponses.length, { message: "Observe Chromium's actual manifest response" }).toBeGreaterThan(0)

      for (const response of manifestResponses) {
        expect(response.status()).toBe(200)
        expect(response.headers()["content-type"]).toBe("application/manifest+json")
        expect(await response.text()).toBe(expectedManifestBody)
        const cookieHeader = await response.request().headerValue("cookie")
        const cookies = (cookieHeader ?? "").split(";").map(cookie => cookie.trim()).filter(Boolean)
        // Only names and the synthetic fixture's match result reach assertions;
        // never print or attach a complete Cookie header.
        expect(cookies.map(cookie => cookie.slice(0, cookie.indexOf("=")))).toEqual([cookieName])
        expect(cookies.includes(`${cookieName}=${cookieValue}`)).toBe(true)
      }
      expect(unexpectedRequests).toEqual([])
    } finally {
      await cdp.detach()
    }
  })
}
