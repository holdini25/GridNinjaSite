/** Capture the actual civic figure, with optional offline paired art substituted for review. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import { dirname, resolve, extname } from "node:path"
import { parseArgs } from "node:util"
import { chromium } from "@playwright/test"
import { acquireComputeLock } from "../facility/compute-lock.mjs"

const { values } = parseArgs({ options: {
  "base-url": { type: "string", default: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000" },
  out: { type: "string", default: "build/civic/review" },
  widths: { type: "string", default: "320,390,768,819,820,1024,1440,1920" },
  dpr: { type: "string", default: "1,2" },
  landscape: { type: "string" },
  portrait: { type: "string" },
} })

assert(Boolean(values.landscape) === Boolean(values.portrait), "A candidate requires both --landscape and --portrait paths")
const widths = values.widths.split(",").map(Number)
const densities = values.dpr.split(",").map(Number)
assert(widths.length && widths.every(width => Number.isInteger(width) && width >= 320 && width <= 3840), "Widths must be integers between 320 and 3840")
assert(densities.length && densities.every(dpr => dpr === 1 || dpr === 2), "DPR must be 1, 2, or 1,2")
assert(new Set(widths).size === widths.length && new Set(densities).size === densities.length, "Duplicate capture sizes are not allowed")
const outputDirectory = resolve(values.out)
assert(outputDirectory.startsWith(`${resolve("build/civic")}/`), "Review output must remain in a fresh private build/civic directory")
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex")
const mime = { ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" }
const candidates = values.landscape ? Object.fromEntries(await Promise.all(["landscape", "portrait"].map(async composition => {
  const path = resolve(values[composition])
  assert(mime[extname(path).toLowerCase()], `Unsupported candidate format: ${path}`)
  const body = await readFile(path)
  return [composition, { path, body, sha256: sha256(body), bytes: body.length, contentType: mime[extname(path).toLowerCase()] }]
}))) : null

const executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH
const releaseCompute = await acquireComputeLock("civic-visual-review", { task: "browser-visual-review" })
let browser
let outputReady = false
const report = { schemaVersion: "civic-review.v1", startedAt: new Date().toISOString(), baseURL: values["base-url"], widths, densities,
  candidateSubstitution: candidates ? Object.fromEntries(Object.entries(candidates).map(([composition, { path, sha256, bytes, contentType }]) => [composition, { path, sha256, bytes, contentType }])) : null,
  views: [], result: "incomplete", failure: null }
try {
  await mkdir(dirname(outputDirectory), { recursive: true })
  assert(await realpath(dirname(outputDirectory)) === dirname(outputDirectory), "Private review parent cannot be symlinked")
  await mkdir(outputDirectory) // An earlier review is immutable, including partial captures.
  outputReady = true
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  // Serial captures avoid competing with each other. Run only after offline GPU jobs end.
  for (const deviceScaleFactor of densities) for (const width of widths) {
    const view = { width, deviceScaleFactor, result: "incomplete" }
    report.views.push(view)
    const context = await browser.newContext({ viewport: { width, height: 1100 }, deviceScaleFactor, reducedMotion: "reduce" })
    try {
      const page = await context.newPage()
      const requests = new Set()
      page.on("request", request => { const path = new URL(request.url()).pathname; if (path.startsWith("/assets/civic/")) requests.add(path) })
      if (candidates) await page.route("**/assets/civic/*/*", route => {
        const match = /\/(portrait|landscape)-\d+\.(?:webp|avif)$/.exec(new URL(route.request().url()).pathname)
        return match ? route.fulfill({ status: 200, body: candidates[match[1]].body, contentType: candidates[match[1]].contentType }) : route.continue()
      })
      await page.goto(values["base-url"], { waitUntil: "domcontentloaded" })
      const figure = page.locator("#shared-infrastructure .gn-civic-figure")
      await figure.locator(".gn-civic-artwork").scrollIntoViewIfNeeded()
      await figure.locator("picture img").evaluate(async element => { await element.decode() })
      await page.evaluate(() => document.fonts.ready)
      // Fit the whole figure below the real fixed navigation, without changing
      // page styles or allowing screenshot auto-scroll to cover its heading.
      const captureGeometry = await figure.evaluate(element => ({ height: element.getBoundingClientRect().height, headerHeight: document.getElementById("site-header")?.getBoundingClientRect().height ?? 0 }))
      const clearance = Math.ceil(captureGeometry.headerHeight + 24)
      const captureHeight = Math.max(1100, Math.ceil(captureGeometry.height + clearance * 2))
      await page.setViewportSize({ width, height: captureHeight })
      await figure.evaluate(async (element, clearance) => {
        window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - clearance, behavior: "instant" })
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      }, clearance)
      Object.assign(view, { captureViewport: { width, height: captureHeight }, headerClearance: clearance })
      const file = `civic-${width}-dpr${deviceScaleFactor}.png`
      const capture = await figure.screenshot({ animations: "disabled" })
      await writeFile(resolve(outputDirectory, file), capture, { flag: "wx" })
      Object.assign(view, { screenshot: file, screenshotSha256: sha256(capture), screenshotBytes: capture.length })
      const metrics = await figure.evaluate(element => {
        const artwork = element.querySelector(".gn-civic-artwork").getBoundingClientRect()
        const image = element.querySelector("picture img")
        return { release: element.dataset.civicRelease, source: image.currentSrc, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, artworkWidth: artwork.width, artworkHeight: artwork.height, horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 }
      })
      Object.assign(view, { ...metrics, requests: [...requests], result: "complete" })
      process.stdout.write(`${file}: ${metrics.release}, ${metrics.artworkWidth}×${metrics.artworkHeight} CSS pixels\n`)
    } catch (error) {
      Object.assign(view, { result: "fail", failure: error instanceof Error ? error.message : String(error) })
      throw error
    } finally {
      await context.close()
    }
  }
  report.result = "complete"
} catch (error) {
  report.result = "fail"
  report.failure = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${report.failure}\n`)
  process.exitCode = 1
} finally {
  try {
    try { await browser?.close() } catch (error) {
      report.result = "fail"
      report.failure ??= error instanceof Error ? error.message : String(error)
      process.exitCode = 1
    }
    report.finishedAt = new Date().toISOString()
    if (outputReady) await writeFile(resolve(outputDirectory, "review.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" })
  } finally { await releaseCompute() }
}
