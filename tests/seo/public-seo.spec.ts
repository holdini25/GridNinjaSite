import { request as playwrightRequest, expect, test } from "@playwright/test"
import { JSDOM } from "jsdom"

import {
  analyzeLinkGraph,
  buildLinkGraph,
  classifyInternalHref,
} from "../../src/seo/internal-link-graph.mjs"
import {
  indexableSeoRoutes,
  seoRoutes,
} from "../../src/seo/route-manifest"
import { PRODUCTION_ORIGIN } from "../../src/seo/policy"
import { whyGridNinjaSourceRecords } from "../../src/content/copy/why-gridninja"
import { publicAuthors } from "../../src/content/authors"

const productionHost = new URL(PRODUCTION_ORIGIN).host
const criticalRoutes = indexableSeoRoutes.filter((route) => route.tier <= 1)

function xmlLocations(xml: string) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
}

function absolute(path: string) {
  return new URL(path, `${PRODUCTION_ORIGIN}/`).toString()
}

function extractFirst(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1]
}

function normalizeText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function collectStructuredStrings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(collectStructuredStrings)
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStructuredStrings)
  }
  return []
}

test.describe("manifest-derived search eligibility", () => {
  for (const route of criticalRoutes) {
    test(`${route.path} has one apex identity and crawlable semantic content`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "seo-chromium",
        "The complete route matrix runs once; specialized projects have focused parity tests."
      )

      const response = await page.goto(route.path, {
        waitUntil: "domcontentloaded",
      })

      expect(response?.status(), route.path).toBe(200)
      await expect(page).toHaveTitle(route.title)
      await expect(page.locator("main")).toHaveCount(1)
      await expect(page.locator("main h1")).toHaveCount(1)
      await expect(page.locator("main h1")).toContainText(route.h1)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        route.description
      )
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href")
      expect(new URL(canonical ?? "").toString()).toBe(absolute(route.path))

      const robots = await page
        .locator('meta[name="robots"]')
        .getAttribute("content")
      expect(robots ?? "").not.toMatch(/(?:^|,)\s*noindex\b/i)

      const identityMarkup = await page.locator("head").innerHTML()
      expect(identityMarkup).not.toContain("vercel.app")
      expect(identityMarkup).not.toContain("https://www.gridninja.ai")

      const schemas = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents()
      expect(schemas.length, `${route.path} must emit JSON-LD`).toBeGreaterThan(0)
      const parsed = schemas.map((schema) => JSON.parse(schema))
      const serialized = JSON.stringify(parsed)
      expect(serialized).toContain(`${absolute(route.path)}#webpage`)
      expect(serialized).not.toMatch(
        /"@type":"(?:FAQPage|Product|AggregateRating|Review|Dataset)"/
      )

      if (route.breadcrumbs.length > 0) {
        expect(serialized).toContain('"BreadcrumbList"')
        await expect(page.locator('nav[aria-label*="breadcrumb" i]')).toHaveCount(1)
      }
    })
  }

  test("homepage owns the site and organization identity graphs once", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-chromium")
    await page.goto("/")

    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    const documents = schemas.map((schema) => JSON.parse(schema))
    const nodes = documents.flatMap((document) =>
      Array.isArray(document["@graph"]) ? document["@graph"] : [document]
    )
    const serialized = JSON.stringify(documents)

    expect(
      nodes.filter((node) => node["@id"] === `${PRODUCTION_ORIGIN}/#website`)
    ).toHaveLength(1)
    expect(
      nodes.filter((node) => node["@id"] === `${PRODUCTION_ORIGIN}/#organization`)
    ).toHaveLength(1)
    expect(serialized).toContain('"name":"GridNinja"')
    expect(serialized).toContain('"gridninja.ai"')
    expect(serialized).not.toContain('"sameAs"')

    const robots = [
      (await page.locator('meta[name="robots"]').getAttribute("content")) ?? "",
      (await page.locator('meta[name="googlebot"]').getAttribute("content")) ?? "",
    ].join(",")
    expect(robots).toContain("max-image-preview:large")
    expect(robots).toContain("max-snippet:-1")
    expect(robots).toContain("max-video-preview:-1")
    expect(robots).not.toMatch(/(?:^|,)\s*nosnippet\b/i)
  })

  test("sitemap is exactly the indexable manifest projection", async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-chromium")
    const response = await request.get("/sitemap.xml")
    expect(response.status()).toBe(200)

    const locations = xmlLocations(await response.text())
    expect(locations).toEqual(indexableSeoRoutes.map((route) => absolute(route.path)))
    expect(locations.every((location) => new URL(location).host === productionHost)).toBe(
      true
    )
  })

  test("publication-gated technical resources stay available but noindex", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-chromium")

    for (const route of seoRoutes.filter((candidate) => !candidate.indexable)) {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" })
      expect(response?.status(), route.path).toBe(200)
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/i
      )
      await expect(page.locator("main h1")).toHaveCount(1)
      await expect(page.locator("main h1")).toContainText(route.h1)

      const jsonLd = (
        await page.locator('script[type="application/ld+json"]').allTextContents()
      ).join("\n")
      if ((route.schemaTypes as readonly string[]).includes("TechArticle")) {
        if (publicAuthors.length === 0) {
          expect(jsonLd, route.path).not.toContain('"TechArticle"')
        } else {
          expect(jsonLd, route.path).toContain('"TechArticle"')
          expect(jsonLd, route.path).toContain('"Person"')
        }
      }
      expect(jsonLd, route.path).not.toMatch(/placeholder|example person|jane doe/i)
    }
  })

  test("robots allows public content and protects non-public namespaces", async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-chromium")
    const response = await request.get("/robots.txt")
    const body = await response.text()

    expect(response.status()).toBe(200)
    expect(body).toMatch(/Allow:\s*\//i)
    expect(body).toMatch(/Disallow:\s*\/api\//i)
    expect(body).toMatch(/Disallow:\s*\/internal\//i)
    expect(body).toContain(`Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`)
  })

  test("raw proof-pack artifact defers indexing to its evidence page", async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-chromium")
    const response = await request.get("/downloads/sample-proof-pack")

    expect(response.status()).toBe(200)
    expect(response.headers()["x-robots-tag"]).toMatch(/noindex/i)
    expect(response.headers().link).toContain(
      `<${PRODUCTION_ORIGIN}/proof/proof-pack>; rel="canonical"`
    )

    const releaseArtifact = await request.get(
      "/evidence/releases/v1.0.0/virtual-capacity-proof-test.json"
    )
    expect(releaseArtifact.status()).toBe(200)
    expect(releaseArtifact.headers()["content-type"]).toContain("application/json")
    expect(releaseArtifact.headers()["x-robots-tag"]).toMatch(/noindex/i)
    expect(releaseArtifact.headers().link).toContain(
      `<${PRODUCTION_ORIGIN}/evidence>; rel="canonical"`
    )
  })

  test("unknown paths are true 404 responses", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-chromium")
    const response = await request.get(
      `/seo-contract-missing-${Date.now()}`,
      { maxRedirects: 0 }
    )
    expect(response.status()).toBe(404)
  })

  test("query-string intent states canonicalize to their base route", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-chromium")
    await page.goto("/contact?intent=partnership&utm_source=private#form")
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${PRODUCTION_ORIGIN}/contact`
    )
    expect(await page.locator("head").innerHTML()).not.toContain("utm_source")
  })

  test("Tier 0 and Tier 1 internal links resolve", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-chromium")
    const links = new Set<string>()

    for (const route of criticalRoutes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" })
      for (const href of await page.locator('main a[href^="/"]').evaluateAll((anchors) =>
        anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute("href"))
      )) {
        if (href && !href.startsWith("//")) {
          links.add(new URL(href, `${PRODUCTION_ORIGIN}/`).pathname)
        }
      }
    }

    for (const path of [...links].sort()) {
      const response = await request.get(path)
      expect(response.status(), path).toBeLessThan(400)
    }
  })

  test("contextual internal-link graph is complete and within discovery depth", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      !["seo-chromium", "seo-googlebot-smartphone"].includes(
        testInfo.project.name
      ),
      "The contextual graph is verified for a browser and Googlebot smartphone."
    )

    const allManifestPaths = new Set(seoRoutes.map((route) => route.path))
    const indexablePaths = new Set<string>(
      indexableSeoRoutes.map((route) => route.path)
    )
    const edgeKeys = new Set<string>()
    const edges: { source: string; target: string }[] = []
    const malformedLinks: string[] = []
    const unknownLinks: string[] = []
    const requestPaths = new Set<string>()
    const missingDeclaredEdges: { source: string; target: string }[] = []

    for (const route of indexableSeoRoutes) {
      const response = await page.goto(route.path, {
        waitUntil: "domcontentloaded",
      })
      expect(response?.status(), route.path).toBe(200)
      const html = (await response?.text()) ?? ""
      const document = new JSDOM(html).window.document
      const main = document.querySelector("main")
      expect(main, `${route.path} must have a server-rendered main`).not.toBeNull()

      const relatedSection = main?.querySelector(
        `[data-seo-related-source="${route.path}"]`
      )
      expect(
        relatedSection,
        `${route.path} must render one contextual related-resources section`
      ).not.toBeNull()
      expect(
        main?.querySelectorAll("[data-seo-related-source]").length,
        `${route.path} must render the related-resources section exactly once`
      ).toBe(1)

      const renderedDeclaredTargets = new Set(
        [...(relatedSection?.querySelectorAll("a[data-seo-related-target]") ?? [])]
          .map((anchor) => anchor.getAttribute("data-seo-related-target"))
          .filter((target): target is string => Boolean(target))
      )
      for (const target of route.relatedPaths) {
        if (!renderedDeclaredTargets.has(target)) {
          missingDeclaredEdges.push({ source: route.path, target })
        }
      }

      for (const anchor of main?.querySelectorAll("a[href]") ?? []) {
        const href = anchor.getAttribute("href")
        const classified = classifyInternalHref(href, {
          sourcePath: route.path,
          deploymentOrigin: testInfo.project.use.baseURL ?? PRODUCTION_ORIGIN,
          productionOrigin: PRODUCTION_ORIGIN,
          knownPaths: allManifestPaths,
        })

        if (classified.kind === "malformed") {
          malformedLinks.push(`${route.path}: ${String(href)}`)
          continue
        }
        if (classified.kind === "unknown") {
          unknownLinks.push(`${route.path} -> ${classified.path}`)
          continue
        }
        if (classified.kind !== "internal") continue

        requestPaths.add(`${classified.path}${classified.search}`)
        if (!indexablePaths.has(classified.path)) continue

        const edgeKey = `${route.path}\0${classified.path}`
        if (edgeKeys.has(edgeKey)) continue
        edgeKeys.add(edgeKey)
        edges.push({ source: route.path, target: classified.path })
      }
    }

    expect(malformedLinks, "malformed internal hrefs").toEqual([])
    expect(unknownLinks, "navigational paths absent from the route manifest").toEqual(
      []
    )

    for (const path of [...requestPaths].sort()) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(200)
    }

    const graph = buildLinkGraph(
      indexableSeoRoutes.map((route) => route.path),
      edges
    )
    const analysis = analyzeLinkGraph({
      graph,
      routes: indexableSeoRoutes,
      missingDeclaredEdges,
    })

    expect(
      analysis.violations.map((violation) => violation.message),
      `${testInfo.project.name} contextual graph violations`
    ).toEqual([])
  })

  test("comparison sources have crawlable, stable fragment targets", async ({
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-chromium")
    const response = await request.get("/why-gridninja")
    const html = await response.text()

    expect(response.status()).toBe(200)
    for (const source of whyGridNinjaSourceRecords) {
      expect(html, source.id).toContain(`id="source-${source.id}"`)
      expect(html, source.id).toContain(`href="${source.url}`)
    }
  })
})

test.describe("snippet and raw-content controls", () => {
  test("excluded claim values remain out of structured data while caveats stay visible", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-chromium")

    for (const route of seoRoutes.filter((candidate) => candidate.indexable)) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" })
      const structuredStrings = (
        await page.locator('script[type="application/ld+json"]').allTextContents()
      ).flatMap((document) => collectStructuredStrings(JSON.parse(document)))
      const excluded = page.locator("[data-nosnippet]")

      for (let index = 0; index < (await excluded.count()); index += 1) {
        const element = excluded.nth(index)
        const tagName = await element.evaluate((node) => node.tagName.toLowerCase())
        const value = (await element.textContent())?.trim() ?? ""
        const surroundingText =
          (await element.locator("xpath=..").textContent())?.trim() ?? ""

        expect(["span", "div", "section"], route.path).toContain(tagName)
        expect(value.length, route.path).toBeGreaterThan(0)
        expect(surroundingText.length, route.path).toBeGreaterThan(value.length)
        expect(structuredStrings, `${route.path}: ${value}`).not.toContain(value)
      }
    }
  })

  test("search-critical homepage content is visible without JavaScript", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-raw-html")
    const response = await page.goto("/", { waitUntil: "domcontentloaded" })

    expect(response?.status()).toBe(200)
    await expect(page.locator("main h1")).toHaveCount(1)
    await expect(page.locator("main h1")).toBeVisible()
    await expect(
      page.getByText("AI Data Center Virtual Capacity Control Plane", {
        exact: false,
      }).first()
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Request Capacity Audit", exact: true }).first()
    ).toBeVisible()
    expect((await page.locator("main section").count())).toBeGreaterThan(0)
    expect((await page.locator("main").innerText()).toLowerCase()).toContain(
      "proof"
    )

    await page.screenshot({
      path: testInfo.outputPath("homepage-js-disabled.png"),
      fullPage: true,
    })
    await testInfo.attach("homepage-js-disabled", {
      path: testInfo.outputPath("homepage-js-disabled.png"),
      contentType: "image/png",
    })
  })

  test("Googlebot smartphone receives materially equivalent semantic HTML", async ({
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-googlebot-smartphone")
    expect(baseURL).toBeTruthy()

    const browserContext = await playwrightRequest.newContext({ baseURL })
    const googlebotContext = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile " +
          "Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
    })

    try {
      const [browserResponse, googlebotResponse] = await Promise.all([
        browserContext.get("/"),
        googlebotContext.get("/"),
      ])
      const [browserHtml, googlebotHtml] = await Promise.all([
        browserResponse.text(),
        googlebotResponse.text(),
      ])

      expect(browserResponse.status()).toBe(200)
      expect(googlebotResponse.status()).toBe(200)
      expect(extractFirst(browserHtml, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)).toBe(
        extractFirst(googlebotHtml, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
      )
      expect(
        extractFirst(browserHtml, /<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)
      ).toBe(
        extractFirst(
          googlebotHtml,
          /<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i
        )
      )

      const browserTextLength = normalizeText(browserHtml).length
      const googlebotTextLength = normalizeText(googlebotHtml).length
      expect(googlebotTextLength / browserTextLength).toBeGreaterThanOrEqual(0.95)
      expect(googlebotTextLength / browserTextLength).toBeLessThanOrEqual(1.05)

      await testInfo.attach("browser-homepage.html", {
        body: browserHtml,
        contentType: "text/html",
      })
      await testInfo.attach("googlebot-homepage.html", {
        body: googlebotHtml,
        contentType: "text/html",
      })
    } finally {
      await browserContext.dispose()
      await googlebotContext.dispose()
    }
  })

  test("reduced-motion visitors retain visible critical content", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "seo-reduced-motion")
    await page.goto("/")

    expect(
      await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)
    ).toBe(true)
    await expect(page.locator("main h1")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Request Capacity Audit", exact: true }).first()
    ).toBeVisible()
    expect(await page.locator("main h1").evaluate((node) => getComputedStyle(node).opacity)).toBe(
      "1"
    )
  })
})
