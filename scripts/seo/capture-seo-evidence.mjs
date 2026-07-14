import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { JSDOM } from "jsdom"

import {
  analyzeLinkGraph,
  buildLinkGraph,
  classifyInternalHref,
  reconstructDestinationPath,
  reconstructPredecessorPath,
} from "../../src/seo/internal-link-graph.mjs"

const baseURL = process.env.SEO_EVIDENCE_BASE_URL
if (!baseURL) {
  throw new Error("SEO_EVIDENCE_BASE_URL is required")
}

const outputDirectory = resolve(
  process.env.SEO_EVIDENCE_DIR ?? "test-results/seo-evidence"
)
const deploymentOrigin = new URL(baseURL).origin
const productionOrigin = "https://gridninja.ai"

function matches(html, pattern) {
  return [...html.matchAll(pattern)].map((match) => match[1])
}

function decode(value) {
  return value
    ?.replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
}

function first(html, pattern) {
  return decode(html.match(pattern)?.[1]) ?? null
}

function sortedEntries(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

await mkdir(outputDirectory, { recursive: true })

const sitemapResponse = await fetch(new URL("/sitemap.xml", deploymentOrigin))
if (!sitemapResponse.ok) {
  throw new Error(`Sitemap returned ${sitemapResponse.status}`)
}
const sitemapXml = await sitemapResponse.text()
const sitemapUrls = matches(sitemapXml, /<loc>([^<]+)<\/loc>/g)
const indexablePaths = new Set(
  sitemapUrls.map((canonicalUrl) => new URL(canonicalUrl).pathname)
)
const pages = []
const internalLinks = new Set()
const contextualEdgeKeys = new Set()
const contextualEdges = []
const routes = []
const malformedLinks = []
const missingRelatedSections = []
const missingDeclaredEdges = []
const nonGraphTargets = new Set()
const pageStatusFailures = []

for (const canonicalUrl of sitemapUrls) {
  const deploymentUrl = new URL(new URL(canonicalUrl).pathname, deploymentOrigin)
  const sourcePath = deploymentUrl.pathname
  const response = await fetch(deploymentUrl, {
    headers: { "user-agent": "GridNinja-SEO-Evidence/1.0" },
  })
  const html = await response.text()
  if (response.status !== 200) {
    pageStatusFailures.push({ path: sourcePath, status: response.status })
  }
  const document = new JSDOM(html).window.document
  const main = document.querySelector("main")
  const relatedSections = main?.querySelectorAll("[data-seo-related-source]") ?? []
  const relatedSection = [...relatedSections].find(
    (section) => section.getAttribute("data-seo-related-source") === sourcePath
  )
  const tier = Number(relatedSection?.getAttribute("data-seo-route-tier"))

  if (relatedSections.length !== 1 || !relatedSection || ![0, 1, 2].includes(tier)) {
    missingRelatedSections.push({
      path: sourcePath,
      count: relatedSections.length,
      tier: Number.isFinite(tier) ? tier : null,
    })
  }
  routes.push({ path: sourcePath, tier: [0, 1, 2].includes(tier) ? tier : 2 })

  if (relatedSection) {
    let declaredTargets = []
    try {
      const parsed = JSON.parse(
        relatedSection.getAttribute("data-seo-related-paths") ?? "[]"
      )
      if (!Array.isArray(parsed) || parsed.some((target) => typeof target !== "string")) {
        throw new TypeError("declared target payload is not a string array")
      }
      declaredTargets = parsed
    } catch (error) {
      malformedLinks.push({
        source: sourcePath,
        href: relatedSection.getAttribute("data-seo-related-paths"),
        reason: `Invalid declared related-path payload: ${String(error)}`,
      })
    }

    const renderedTargets = new Set(
      [...relatedSection.querySelectorAll("a[data-seo-related-target]")]
        .map((anchor) => anchor.getAttribute("data-seo-related-target"))
        .filter(Boolean)
    )
    for (const target of declaredTargets) {
      if (!renderedTargets.has(target)) {
        missingDeclaredEdges.push({ source: sourcePath, target })
      }
    }
  }

  const rawSchemas = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((script) => script.textContent ?? "")
  const schemas = rawSchemas.map((schema) => {
    try {
      return JSON.parse(schema.replaceAll("&quot;", '"'))
    } catch (error) {
      return { parseError: String(error), raw: schema }
    }
  })

  for (const anchor of document.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href")
    const classified = classifyInternalHref(href, {
      sourcePath,
      deploymentOrigin,
      productionOrigin,
    })
    if (classified.kind === "malformed") {
      malformedLinks.push({ source: sourcePath, href, reason: classified.reason })
    } else if (
      classified.kind === "internal" ||
      classified.kind === "excluded"
    ) {
      internalLinks.add(`${classified.path}${classified.search}`)
    }
  }

  for (const anchor of main?.querySelectorAll("a[href]") ?? []) {
    const href = anchor.getAttribute("href")
    const classified = classifyInternalHref(href, {
      sourcePath,
      deploymentOrigin,
      productionOrigin,
    })
    if (classified.kind !== "internal") continue
    if (!indexablePaths.has(classified.path)) {
      nonGraphTargets.add(classified.path)
      continue
    }

    const key = `${sourcePath}\0${classified.path}`
    if (contextualEdgeKeys.has(key)) continue
    contextualEdgeKeys.add(key)
    contextualEdges.push({ source: sourcePath, target: classified.path })
  }

  pages.push({
    requestedUrl: deploymentUrl.toString(),
    status: response.status,
    canonical: first(
      html,
      /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
    ),
    title: document.title || null,
    description:
      document.querySelector('meta[name="description"]')?.getAttribute("content") ??
      null,
    robots:
      document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
    h1: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    schemas,
    headers: {
      contentType: response.headers.get("content-type"),
      xRobotsTag: response.headers.get("x-robots-tag"),
    },
  })
}

const linkStatuses = new Map()
const brokenLinks = []
for (const path of [...internalLinks].sort()) {
  const response = await fetch(new URL(path, deploymentOrigin), {
    redirect: "manual",
    headers: { "user-agent": "GridNinja-SEO-Evidence/1.0" },
  })
  linkStatuses.set(path, response.status)
  if (response.status >= 300) brokenLinks.push({ path, status: response.status })
}

const unknownTargets = [...nonGraphTargets]
  .filter((path) => (linkStatuses.get(path) ?? 500) >= 300)
  .sort()
const graph = buildLinkGraph([...indexablePaths], contextualEdges)
const analysis = analyzeLinkGraph({ graph, routes, missingDeclaredEdges })
const graphViolations = [
  ...analysis.violations,
  ...pageStatusFailures.map((entry) => ({
    code: "sitemap-page-status",
    path: entry.path,
    target: null,
    message: `${entry.path} is in the sitemap but returned ${entry.status}; expected 200.`,
    pathTrace: [],
  })),
  ...missingRelatedSections.map((entry) => ({
    code: "missing-related-section",
    path: entry.path,
    target: null,
    message: `${entry.path} rendered ${entry.count} related-resource sections with tier ${String(entry.tier)}.`,
    pathTrace: [],
  })),
  ...unknownTargets.map((target) => ({
    code: "unknown-target",
    path: target,
    target,
    message: `${target} is linked from main content but is neither indexable nor a successful noindex resource.`,
    pathTrace: [],
  })),
  ...malformedLinks.map((link) => ({
    code: "malformed-href",
    path: link.source,
    target: null,
    message: `${link.source} contains malformed href ${String(link.href)}: ${link.reason}`,
    pathTrace: [],
  })),
].sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code))

const graphNodes = graph.nodes.map((path) => ({
  path,
  tier: routes.find((route) => route.path === path)?.tier ?? null,
  inboundDegree: analysis.inboundDegree.get(path) ?? 0,
  outboundDegree: analysis.outboundDegree.get(path) ?? 0,
  forwardDistance: analysis.forwardDistance.get(path) ?? null,
  forwardPredecessor: analysis.forwardPredecessor.get(path) ?? null,
  forwardPath:
    analysis.forwardDistance.get(path) === null
      ? []
      : reconstructPredecessorPath(analysis.forwardPredecessor, path),
  destinationDistance: analysis.destinationDistance.get(path) ?? null,
  nextHopToDestination: analysis.nextHopToDestination.get(path) ?? null,
  destinationPath:
    analysis.destinationDistance.get(path) === null
      ? []
      : reconstructDestinationPath(analysis.nextHopToDestination, path),
}))

const graphReport = {
  capturedAt: new Date().toISOString(),
  deploymentUrl: deploymentOrigin,
  commit: process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  nodes: graphNodes,
  edges: contextualEdges.sort(
    (left, right) =>
      left.source.localeCompare(right.source) || left.target.localeCompare(right.target)
  ),
  forwardDistance: sortedEntries(analysis.forwardDistance),
  destinationDistance: sortedEntries(analysis.destinationDistance),
  missingDeclaredEdges,
  unknownTargets,
  deadEnds: analysis.violations.filter((violation) => violation.code === "dead-end"),
  orphans: analysis.violations.filter((violation) => violation.code === "orphan"),
  brokenResponseStatuses: brokenLinks,
  violations: graphViolations,
}

const report = {
  capturedAt: new Date().toISOString(),
  deploymentUrl: deploymentOrigin,
  commit: process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  sitemapUrls,
  pages,
}

await Promise.all([
  writeFile(
    resolve(outputDirectory, "route-canonical-metadata-schema.json"),
    `${JSON.stringify(report, null, 2)}\n`
  ),
  writeFile(
    resolve(outputDirectory, "broken-links.json"),
    `${JSON.stringify({ brokenLinks }, null, 2)}\n`
  ),
  writeFile(
    resolve(outputDirectory, "internal-link-graph.json"),
    `${JSON.stringify(graphReport, null, 2)}\n`
  ),
  writeFile(resolve(outputDirectory, "sitemap.xml"), sitemapXml),
])

console.log(
  `Captured ${pages.length} pages, ${contextualEdges.length} contextual edges, and checked ${internalLinks.size} internal links in ${outputDirectory}`
)
if (brokenLinks.length > 0 || graphViolations.length > 0) {
  console.error(
    `${brokenLinks.length} internal links and ${graphViolations.length} graph invariants failed`
  )
  process.exitCode = 1
}
