/** Homepage-only regression evidence for the civic still, using existing release budgets. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { chromium } from "@playwright/test"
import lighthouse, { desktopConfig } from "lighthouse"
import { launch } from "chrome-launcher"
import { acquireComputeLock } from "../facility/compute-lock.mjs"
import { captureValidLighthouseReport } from "../facility/lighthouse-capture.mjs"
import { evaluateLighthouseGroup } from "../facility/lighthouse-group-budget.mjs"
import { assertLocalMeasurementOrigin, measurementEnvironment, provenance, verifiedBuildIdentity } from "../facility/performance-contract.mjs"
import { measureScrolledRoutes, SCROLLED_TRANSFER_PROTOCOL } from "../facility/scrolled-transfer.mjs"

const { values } = parseArgs({ options: {
  "base-url": { type: "string", default: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000" },
  out: { type: "string", default: "build/civic/performance" },
  phase: { type: "string", default: "all" },
  release: { type: "string", default: "civic-v2" },
} })
assert(["all", "lighthouse", "transfer"].includes(values.phase), "Phase must be all, lighthouse, or transfer")
assert(/^civic-v[1-9][0-9]*$/.test(values.release), "Expected civic release must be explicit")
const directory = resolve(values.out)
assert(directory.startsWith(`${resolve("build")}/`), "Civic performance evidence must remain under build/")
const baseURL = new URL(values["base-url"])
assert(baseURL.pathname === "/" && !baseURL.search && !baseURL.hash && !baseURL.username && !baseURL.password, "Base URL must identify the homepage origin without credentials")
assertLocalMeasurementOrigin(baseURL.origin)
assert(process.env.FACILITY_BASE_URL === undefined || process.env.FACILITY_BASE_URL === baseURL.origin, "Civic base URL differs from FACILITY_BASE_URL")
process.env.FACILITY_BASE_URL = baseURL.origin
const qualificationEnvironment = await measurementEnvironment()
assert.equal(qualificationEnvironment.name, "local", "Civic regression collection supports local qualification only")
const identity = await verifiedBuildIdentity()
// Experimental compatibility branch: legacy collectors cannot emit the new provenance.
assert.fail("Outside the fixed compatibility evaluation; use the frozen e49 worktree for this diagnostic until its toolchain is independently migrated")
const releaseCompute = await acquireComputeLock("civic-homepage-performance")
const matrix = { routes: ["/"], profiles: ["desktop", "mobile"], runs: 5 }
const report = {
  schemaVersion: "civic-homepage-performance.v1", scope: "homepage civic still regression; not whole-site or graphics qualification",
  startedAt: new Date().toISOString(), phase: values.phase, baseURL: baseURL.origin, qualificationEnvironment, identity,
  collectorSha256: createHash("sha256").update(await readFile(new URL(import.meta.url))).digest("hex"),
  expectedCivicRelease: values.release, servedIdentity: [], matrix, lighthouse: [], scrolledTransfer: [], failures: [], result: "incomplete",
}

async function verifyServedHomepage(stage) {
  const response = await fetch(baseURL.href, { cache: "no-store", signal: AbortSignal.timeout(30_000) })
  assert(response.ok && new URL(response.url).origin === baseURL.origin, "Homepage failed or left the expected origin")
  const html = await response.text()
  const servedBuildIds = [...html.matchAll(/\\"b\\":\\"([^\\"]+)\\"/g)].map(match => match[1])
  const civicReleases = [...html.matchAll(/<figure\b[^>]*\bdata-civic-release="([^"]+)"/g)].map(match => match[1])
  const file = `served-${stage}.html`
  await writeFile(join(directory, file), html, { flag: "wx" })
  report.servedIdentity.push({ stage, checkedAt: new Date().toISOString(), finalUrl: response.url, html: file, htmlSha256: createHash("sha256").update(html).digest("hex"), servedBuildIds, civicReleases })
  // Fail closed if Next's initial RSC contract changes or a different server is running.
  assert(servedBuildIds.includes(identity.buildId), "Served HTML does not match the verified local production build")
  assert.deepEqual(civicReleases, [values.release], "Served homepage does not select the expected civic release")
}

let outputReady = false
try {
  await mkdir(dirname(directory), { recursive: true })
  await mkdir(directory) // Preserve previous reports; a new collection needs a fresh directory.
  outputReady = true
  await verifyServedHomepage("before")
  if (values.phase !== "transfer") {
    for (const profile of matrix.profiles) {
      const group = []
      const groupRecord = { profile, captures: [], budget: null }
      report.lighthouse.push(groupRecord)
      for (let run = 1; run <= matrix.runs; run++) {
        let browserVersion
        const attempts = []
        const chromeFlags = ["--headless"]
        const result = await captureValidLighthouseReport(async number => {
          const userDataDir = await mkdtemp(join(tmpdir(), "gridninja-civic-lighthouse-"))
          const attempt = { number, freshBrowserProfile: true, startedAt: new Date().toISOString() }
          attempts.push(attempt)
          let chrome
          try {
            chrome = await launch({ chromeFlags, userDataDir, ...(process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH ? { chromePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH } : {}) })
            browserVersion = (await (await fetch(`http://127.0.0.1:${chrome.port}/json/version`)).json()).Browser
            const settings = { maxWaitForLoad: 45_000, ...(profile === "desktop" ? desktopConfig.settings : { formFactor: "mobile" }) }
            const capture = await lighthouse(baseURL.href, { port: chrome.port, output: "json", logLevel: "error" }, { extends: "lighthouse:default", settings })
            attempt.runtimeError = capture?.lhr?.runtimeError ?? null
            return capture
          } finally {
            attempt.finishedAt = new Date().toISOString()
            try { await chrome?.kill() } finally { await rm(userDataDir, { recursive: true, force: true }) }
          }
        }, async (invalid, attempt) => {
          await writeFile(join(directory, `${profile}-${run}-invalid-${attempt}.json`), `${JSON.stringify(invalid?.lhr ?? { missingReport: true }, null, 2)}\n`)
        })
        const evidence = { route: "/", run, complete: true, measurementComplete: true, qualificationEnvironment, provenance: await provenance(browserVersion, { profile, qualificationEnvironment, settings: result.lhr.configSettings, freshBrowserProfile: true, chromeFlags }) }
        const capture = { ...result.lhr, facilityEvidence: evidence }
        const file = `${profile}-${run}.json`
        await writeFile(join(directory, file), `${JSON.stringify(capture, null, 2)}\n`)
        await writeFile(join(directory, `${profile}-${run}-trace.json`), JSON.stringify(result.artifacts.Trace))
        await writeFile(join(directory, `${profile}-${run}-network.json`), JSON.stringify(result.artifacts.DevtoolsLog))
        group.push(capture)
        groupRecord.captures.push({ run, file, attempts })
        process.stdout.write(`${profile} ${run}/5: LCP ${Math.round(capture.audits["largest-contentful-paint"].numericValue)}ms\n`)
      }
      try {
        groupRecord.budget = evaluateLighthouseGroup(group, { route: "/", profile, buildSettings: identity.buildSettings, environment: qualificationEnvironment })
        report.failures.push(...groupRecord.budget.failures)
      } catch (error) { report.failures.push(`${profile}: ${error instanceof Error ? error.message : String(error)}`) }
    }
  }
  if (values.phase !== "lighthouse") {
    const launchSettings = process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH } : { channel: "chrome" }
    const browser = await chromium.launch({ headless: true, ...launchSettings })
    try {
      report.transferProvenance = await provenance(browser.version(), { scope: "homepage", qualificationEnvironment, matrix, desktopViewport: { width: 1440, height: 1100 }, mobileDevice: "Pixel 5", freshContextEveryRun: true, cacheDisabled: true, cumulativeNotAdditive: true, ...SCROLLED_TRANSFER_PROTOCOL })
      report.scrolledTransfer = await measureScrolledRoutes(browser, { matrix, baseURL: baseURL.origin, buildSettings: identity.buildSettings, desktopViewport: { width: 1440, height: 1100 }, qualificationEnvironment })
      for (const run of report.scrolledTransfer) if (!run.complete) report.failures.push(`${run.profile} full-scroll run ${run.run}: ${run.failure}`)
      assert.equal(report.scrolledTransfer.length, 10, "Missing homepage transfer measurements")
    } finally { await browser.close() }
  }
  await verifyServedHomepage("after")
  assert.deepEqual(await verifiedBuildIdentity(), identity, "Source or build changed during civic measurement")
  report.result = report.failures.length ? "fail" : "pass"
  if (report.failures.length) process.exitCode = 1
} catch (error) {
  report.failures.push(error instanceof Error ? error.message : String(error))
  report.result = "fail"
  process.exitCode = 1
} finally {
  report.finishedAt = new Date().toISOString()
  try { if (outputReady) await writeFile(join(directory, "index.json"), `${JSON.stringify(report, null, 2)}\n`) }
  finally { await releaseCompute() }
}
