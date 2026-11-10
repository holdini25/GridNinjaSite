import { type Page } from "@playwright/test"
import { JSDOM } from "jsdom"

import { absoluteUrl } from "../../src/seo/policy"
import { getSeoRoute } from "../../src/seo/route-manifest"
import { buildSeoGraph } from "../../src/seo/schema"
import { expect, test } from "./support/client-health"
import { centerLocatorInViewport } from "./support/viewport"

const assessmentContactHref = "/contact?intent=other&source=assessment-page"
const contactRoute = getSeoRoute("/contact")
const submissionId = "63ff18aa-dc9c-4b6d-b336-a5f11c9fa711"

type ApiRequest = { method: string; path: string; body: string | null }

async function mockIntakeAndVerification(page: Page) {
  const requests: ApiRequest[] = []
  // Fulfill every browser API request locally, including unexpected ones. The
  // assertions below reject extra traffic without allowing it to reach a service.
  await page.route("**/api/**", async route => {
    const request = route.request()
    requests.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postData() })
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, requestId: "router-parity", submissionId, status: "queued" }),
    })
  })
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js**", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: `(() => {
      let sequence = 0;
      const widgets = new Map();
      window.turnstile = {
        render(container, options) {
          const id = "router-parity-" + (++sequence);
          widgets.set(id, options);
          queueMicrotask(() => options.callback("router-parity-token-" + sequence));
          return id;
        },
        reset(id) {
          const options = widgets.get(id);
          if (options) queueMicrotask(() => options.callback("router-parity-token-" + (++sequence)));
        },
        remove(id) { widgets.delete(id); }
      };
    })();`,
  }))
  return requests
}

async function expectContactDestination(page: Page, hydrated: boolean) {
  await expect(page).toHaveURL(url => `${url.pathname}${url.search}` === assessmentContactHref)
  await expect(page.locator("main h1")).toHaveText(contactRoute.h1)
  await expect(page.locator("main")).toHaveCount(1)
  await expect(page.locator("#site-header")).toHaveCount(1)
  await expect(page.locator("footer")).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", absoluteUrl("/contact"))
  const name = page.getByLabel("Name", { exact: true })
  if (hydrated) {
    await expect(name).toBeEnabled()
    await expect(page.getByRole("radio", { name: "Other", exact: true })).toBeChecked()
  } else {
    await expect(name).toBeDisabled()
    await expect(page.locator('form button[type="submit"]')).toBeDisabled()
    await expect(page.locator("form noscript p")).toBeVisible()
    await expect(page.locator("form noscript p")).toContainText("No inquiry has been sent by opening this page.")
    await expect(page.locator("form")).toHaveAttribute("method", "post")
    await expect(page.locator("form")).toHaveAttribute("action", "/api/contact")
  }
}

async function followAssessmentContactLink(page: Page, javaScriptEnabled = true) {
  await page.goto("/assessment", { waitUntil: "domcontentloaded" })
  const contact = page.getByRole("link", { name: "Contact us about something else", exact: true })
  await expect(contact).toHaveAttribute("href", assessmentContactHref)
  // The extra centering helper waits on page requestAnimationFrame callbacks,
  // which do not run with JavaScript disabled. Native click still performs its
  // own scrolling, stability and hit-target checks in the no-JS context.
  if (javaScriptEnabled) {
    await expect(page.getByLabel("Name", { exact: true })).toBeEnabled()
    await centerLocatorInViewport(contact)
    // This link is inside the assessment form: focusing it engages verification.
    // Let the mocked script finish loading and its token callback reach the UI
    // before the native navigation, instead of cancelling our own pending mock.
    await contact.focus()
    await expect(contact).toBeFocused()
    const verification = page.getByText("Security verification complete.", { exact: true })
    await expect(verification).toHaveRole("status")
    await expect(verification).toBeVisible()
  }
  await contact.click()
}

async function followContactProofLink(page: Page, javaScriptEnabled = true) {
  const proof = page.getByRole("link", { name: "View proof before autonomy" })
  await expect(proof).toHaveAttribute("href", "/proof")
  if (javaScriptEnabled) await centerLocatorInViewport(proof)
  await proof.click()
  await expect(page).toHaveURL(url => url.pathname === "/proof")
  await expect(page.locator("main h1")).toHaveText(getSeoRoute("/proof").h1)
  await expect(page).toHaveTitle(getSeoRoute("/proof").title)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", absoluteUrl("/proof"))
}

const inheritedMetaNames = [
  "viewport", "application-name", "robots", "googlebot", "color-scheme", "theme-color",
  "mobile-web-app-capable", "apple-mobile-web-app-capable", "apple-mobile-web-app-title", "apple-mobile-web-app-status-bar-style",
  "twitter:card", "twitter:image:type", "twitter:image:width", "twitter:image:height", "twitter:image:alt",
]
const inheritedMetaProperties = [
  "og:site_name", "og:type", "og:image:width", "og:image:height", "og:image:type", "og:image:alt",
]
const rootMetaSelector = [
  ...inheritedMetaNames.map(name => `meta[name="${name}"]`),
  ...inheritedMetaProperties.map(property => `meta[property="${property}"]`),
].join(",")
const identityMetaSelector = `${rootMetaSelector},meta[name="description"],meta[name="twitter:title"],meta[name="twitter:description"],meta[name="twitter:image"],meta[property="og:title"],meta[property="og:description"],meta[property="og:url"],meta[property="og:image"]`

function metaValues(document: Document, selector: string) {
  return [...document.querySelectorAll(selector)].map(element => [
    element.getAttribute("name") ?? element.getAttribute("property"), element.getAttribute("content"),
  ]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

function shellLinks(document: Document) {
  return [...document.querySelectorAll('link[rel="manifest"],link[rel="icon"],link[rel="apple-touch-icon"]')]
    .map(element => ["rel", "href", "sizes", "type", "crossorigin"].map(attribute => element.getAttribute(attribute)))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

function expectCredentialedManifest(document: Document) {
  const links = [...document.querySelectorAll('link[rel~="manifest"]')]
  expect(links).toHaveLength(1)
  expect(document.head.contains(links[0])).toBe(true)
  expect(links[0].getAttribute("href")).toBe("/manifest.webmanifest")
  expect(links[0].getAttribute("crossorigin")).toBe("use-credentials")
}

function schemaDocuments(document: Document) {
  return [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map(element => JSON.parse(element.textContent ?? ""))
}

test("preserves Contact attribution across both routers, history and refresh before a mocked inquiry", async ({ page }) => {
  const apiRequests = await mockIntakeAndVerification(page)
  await followAssessmentContactLink(page)
  await expectContactDestination(page, true)
  await followContactProofLink(page)
  await page.goBack({ waitUntil: "domcontentloaded" })
  await expectContactDestination(page, true)
  await page.goForward({ waitUntil: "domcontentloaded" })
  await expect(page).toHaveURL(url => url.pathname === "/proof")
  await expect(page.locator("main h1")).toHaveText(getSeoRoute("/proof").h1)
  await page.goBack({ waitUntil: "domcontentloaded" })
  await expectContactDestination(page, true)
  await page.reload({ waitUntil: "domcontentloaded" })
  await expectContactDestination(page, true)
  expect(apiRequests).toEqual([])

  await page.getByLabel("Name", { exact: true }).fill("Ada Operator")
  await page.getByLabel("Organization", { exact: true }).fill("Atlas Compute")
  await page.getByLabel("Work email", { exact: true }).fill("ada@example.com")
  await expect(page.getByText("Security verification complete.", { exact: true })).toBeVisible()
  const submit = page.getByRole("button", { name: "Send inquiry", exact: true })
  await centerLocatorInViewport(submit)
  await submit.click()
  await expect(page.getByRole("heading", { name: "Inquiry received", exact: true })).toBeVisible()
  expect(apiRequests).toHaveLength(1)
  expect(apiRequests[0]).toMatchObject({ method: "POST", path: "/api/contact" })
  expect(JSON.parse(apiRequests[0].body ?? "")).toMatchObject({
    schemaVersion: 2, formType: "contact", intent: "other", source: "assessment-page",
    name: "Ada Operator", company: "Atlas Compute", email: "ada@example.com",
    turnstileToken: expect.stringMatching(/^router-parity-token-/),
  })
  await expect(page.getByText(/^Reference:/)).toContainText(submissionId)
})

test("Contact emits the App shell metadata and manifest schema before hydration and retains them afterward", async ({ page, request }) => {
  const apiRequests = await mockIntakeAndVerification(page)
  const appResponse = await request.get("/assessment")
  expect(appResponse.status()).toBe(200)
  const appDocument = new JSDOM(await appResponse.text()).window.document
  expectCredentialedManifest(appDocument)
  const response = await page.goto(`${assessmentContactHref}&utm_source=router-parity#form`, { waitUntil: "domcontentloaded" })
  expect(response?.status()).toBe(200)
  const initial = new JSDOM(await response!.text()).window.document
  expectCredentialedManifest(initial)
  expect(initial.title).toBe(contactRoute.title)
  expect([...initial.querySelectorAll('link[rel="canonical"]')].map(link => link.getAttribute("href"))).toEqual([absoluteUrl("/contact")])
  expect(metaValues(initial, 'meta[name="description"]')).toEqual([["description", contactRoute.description]])
  expect(metaValues(initial, 'meta[property="og:title"],meta[property="og:description"],meta[property="og:url"],meta[property="og:image"]')).toEqual([
    ["og:description", contactRoute.description], ["og:image", absoluteUrl(`/og/${contactRoute.socialImageKey}`)],
    ["og:title", contactRoute.title], ["og:url", absoluteUrl("/contact")],
  ])
  expect(metaValues(initial, 'meta[name="twitter:title"],meta[name="twitter:description"],meta[name="twitter:image"]')).toEqual([
    ["twitter:description", contactRoute.description], ["twitter:image", absoluteUrl(`/og/${contactRoute.socialImageKey}`)],
    ["twitter:title", contactRoute.title],
  ])
  // This catches Pages _document/_app drift without duplicating the existing
  // whole-site SEO matrix. Both routes must inherit the same deployment policy.
  expect(metaValues(initial, rootMetaSelector)).toEqual(metaValues(appDocument, rootMetaSelector))
  expect(shellLinks(initial)).toEqual(shellLinks(appDocument))
  expect(schemaDocuments(initial)).toEqual([buildSeoGraph(contactRoute)])
  expect(initial.documentElement.lang).toBe("en")
  expect(initial.documentElement.classList.contains("dark")).toBe(true)

  await expect(page.getByLabel("Name", { exact: true })).toBeEnabled()
  await expect(page.getByRole("radio", { name: "Other", exact: true })).toBeChecked()
  const hydrated = new JSDOM(await page.content()).window.document
  expectCredentialedManifest(hydrated)
  expect(hydrated.title).toBe(initial.title)
  expect(metaValues(hydrated, identityMetaSelector)).toEqual(metaValues(initial, identityMetaSelector))
  expect(shellLinks(hydrated)).toEqual(shellLinks(initial))
  expect(schemaDocuments(hydrated)).toEqual(schemaDocuments(initial))
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", absoluteUrl("/contact"))
  expect(apiRequests).toEqual([])
})

test("Contact keeps its centered content widths and static mark geometry at narrow and wide viewports", async ({ page, clientHealth }, testInfo) => {
  const apiRequests = await mockIntakeAndVerification(page)
  await page.goto("/contact", { waitUntil: "load" })

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1100 })
    await clientHealth.expectNoHorizontalOverflow()
    const containers = []
    for (const target of [
      { selector: "main .gn-section-container", maxWidth: 1180 },
      { selector: "footer .gn-section-container", maxWidth: 1280 },
    ]) {
      const container = page.locator(target.selector)
      await expect(container).toHaveCount(1)
      const geometry = await container.evaluate(element => {
        const shell = element.parentElement!
        const bounds = element.getBoundingClientRect()
        const shellBounds = shell.getBoundingClientRect()
        const css = getComputedStyle(element), shellCss = getComputedStyle(shell)
        const contentLeft = shellBounds.left + parseFloat(shellCss.borderLeftWidth) + parseFloat(shellCss.paddingLeft)
        const contentRight = shellBounds.right - parseFloat(shellCss.borderRightWidth) - parseFloat(shellCss.paddingRight)
        return {
          width: bounds.width,
          maxWidth: parseFloat(css.maxWidth),
          availableWidth: contentRight - contentLeft,
          startSpace: bounds.left - contentLeft,
          endSpace: contentRight - bounds.right,
          viewportWidth: window.innerWidth,
        }
      })
      containers.push({ selector: target.selector, ...geometry })
      expect(geometry.viewportWidth).toBe(width)
      // Contact deliberately narrows the shared 1280px shell to 1180px. At a
      // narrow viewport both must fill the available width without losing their
      // desktop cap; at a wide viewport the spare space must split evenly.
      expect(geometry.maxWidth).toBe(target.maxWidth)
      expect(geometry.width).toBeCloseTo(Math.min(geometry.availableWidth, target.maxWidth), 0)
      expect(geometry.startSpace).toBeGreaterThanOrEqual(-0.5)
      expect(geometry.endSpace).toBeGreaterThanOrEqual(-0.5)
      expect(Math.abs(geometry.startSpace - geometry.endSpace)).toBeLessThan(1)
      if (width === 1440) expect(geometry.startSpace).toBeGreaterThan(0)
    }

    const marks = []
    for (const target of [
      { selector: 'main img[src="/brand/gridninja-favicon-proof-core.svg"]', size: 28 },
      { selector: 'footer img[src="/brand/gridninja-emblem-detailed-dark.svg"]', size: 72 },
    ]) {
      const mark = page.locator(target.selector)
      await expect(mark).toHaveCount(1)
      const geometry = await mark.evaluate(element => {
        const bounds = element.getBoundingClientRect(), css = getComputedStyle(element)
        return { width: bounds.width, height: bounds.height, objectFit: css.objectFit, flexShrink: css.flexShrink }
      })
      marks.push({ selector: target.selector, ...geometry })
      // These are the caller's intended rendered sizes, independent of each
      // SVG's larger intrinsic dimensions and the component's class ordering.
      expect(geometry.width).toBeCloseTo(target.size, 0)
      expect(geometry.height).toBeCloseTo(target.size, 0)
      expect(geometry.objectFit).toBe("contain")
      expect(geometry.flexShrink).toBe("0")
    }
    await testInfo.attach(`contact-primitive-geometry-${width}.json`, {
      contentType: "application/json",
      body: JSON.stringify({ width, containers, marks }),
    })
  }
  expect(apiRequests).toEqual([])
})

test.describe("Contact router boundary without JavaScript", () => {
  test.use({ javaScriptEnabled: false })

  test("keeps native links and history usable while intake remains safely disabled", async ({ page }) => {
    const apiRequests = await mockIntakeAndVerification(page)
    await followAssessmentContactLink(page, false)
    await expectContactDestination(page, false)
    await followContactProofLink(page, false)
    await page.goBack({ waitUntil: "domcontentloaded" })
    await expectContactDestination(page, false)
    await page.reload({ waitUntil: "domcontentloaded" })
    await expectContactDestination(page, false)
    await expect(page.locator("form [required]")).toHaveCount(3)
    await expect(page.getByRole("heading", { name: "Inquiry received", exact: true })).toHaveCount(0)
    expect(apiRequests).toEqual([])
  })
})
