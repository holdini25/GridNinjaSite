import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const baseURL = process.env.SEO_EVIDENCE_BASE_URL
if (!baseURL) {
  throw new Error("SEO_EVIDENCE_BASE_URL is required")
}

const outputDirectory = resolve(
  process.env.SEO_EVIDENCE_DIR ?? "test-results/seo-evidence"
)
const deploymentOrigin = new URL(baseURL).origin

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

await mkdir(outputDirectory, { recursive: true })

const sitemapResponse = await fetch(new URL("/sitemap.xml", deploymentOrigin))
if (!sitemapResponse.ok) {
  throw new Error(`Sitemap returned ${sitemapResponse.status}`)
}
const sitemapXml = await sitemapResponse.text()
const sitemapUrls = matches(sitemapXml, /<loc>([^<]+)<\/loc>/g)
const pages = []
const internalLinks = new Set()

for (const canonicalUrl of sitemapUrls) {
  const deploymentUrl = new URL(new URL(canonicalUrl).pathname, deploymentOrigin)
  const response = await fetch(deploymentUrl, {
    headers: { "user-agent": "GridNinja-SEO-Evidence/1.0" },
  })
  const html = await response.text()
  const rawSchemas = matches(
    html,
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )
  const schemas = rawSchemas.map((schema) => {
    try {
      return JSON.parse(schema.replaceAll("&quot;", '"'))
    } catch (error) {
      return { parseError: String(error), raw: schema }
    }
  })

  for (const href of matches(html, /<a\b[^>]*href=["']([^"']+)["']/gi)) {
    const resolved = new URL(decode(href), deploymentUrl)
    if (resolved.origin === deploymentOrigin) {
      internalLinks.add(`${resolved.pathname}${resolved.search}`)
    }
  }

  pages.push({
    requestedUrl: deploymentUrl.toString(),
    status: response.status,
    canonical: first(
      html,
      /<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
    ),
    title: first(html, /<title>([\s\S]*?)<\/title>/i),
    description: first(
      html,
      /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
    ),
    robots: first(
      html,
      /<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i
    ),
    h1: first(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, " ") ?? null,
    schemas,
    headers: {
      contentType: response.headers.get("content-type"),
      xRobotsTag: response.headers.get("x-robots-tag"),
    },
  })
}

const brokenLinks = []
for (const path of [...internalLinks].sort()) {
  const response = await fetch(new URL(path, deploymentOrigin), {
    redirect: "manual",
    headers: { "user-agent": "GridNinja-SEO-Evidence/1.0" },
  })
  if (response.status >= 300) brokenLinks.push({ path, status: response.status })
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
  writeFile(resolve(outputDirectory, "sitemap.xml"), sitemapXml),
])

console.log(
  `Captured ${pages.length} pages and checked ${internalLinks.size} internal links in ${outputDirectory}`
)
if (brokenLinks.length > 0) {
  console.error(`${brokenLinks.length} internal links returned an error response`)
  process.exitCode = 1
}
