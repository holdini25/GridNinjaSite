import assert from "node:assert/strict"
import { mkdir, mkdtemp, readdir, rm, writeFile, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import lighthouse, { desktopConfig } from "lighthouse"
import { launch } from "chrome-launcher"
import { provenance, verifiedBuildIdentity } from "./performance-contract.mjs"
import { STARTUP_PROFILES, STARTUP_ROUTES, STARTUP_RUN_COUNT, startupCollectorSettings, startupRunName, summarizeStartupEvidence } from "./startup-gate.mjs"

const require = createRequire(import.meta.url)
const config = require("./lighthouse.cjs")
const label = process.argv[2]
assert(/^[a-z0-9-]{1,48}$/.test(label ?? ""), "Supply a unique experiment label")
const baseURL = process.env.FACILITY_BASE_URL ?? "http://127.0.0.1:3000"
const identity = await verifiedBuildIdentity()
const experimentRoot = `build/facility/${identity.buildSettings.selectedRelease}/startup-experiments`
await mkdir(experimentRoot, { recursive: true })
const directory = `${experimentRoot}/${label}`
await mkdir(directory, { recursive: false })
const measuredAt = new Date().toISOString()
const indexedRuns = []
const collectorSettings = startupCollectorSettings(config, desktopConfig.settings)
let report = { label, measuredAt, identity, runs: indexedRuns, collection: { result: "incomplete", failures: [] }, threshold: { result: "not-evaluated", failures: [] }, result: "fail" }
await writeFile(join(directory, "next.config.txt"), await readFile("next.config.ts"))
try {
  for (const profile of STARTUP_PROFILES) for (const route of STARTUP_ROUTES) for (let run = 1; run <= STARTUP_RUN_COUNT; run++) {
    const userDataDir = await mkdtemp(join(tmpdir(), "gridninja-startup-"))
    const chrome = await launch({ chromeFlags: ["--headless"], userDataDir })
    const name = startupRunName(profile, route, run)
    try {
      const version = await (await fetch(`http://localhost:${chrome.port}/json/version`)).json()
      const result = await lighthouse(new URL(route, baseURL).href, { port: chrome.port, output: "json", logLevel: "error" }, { extends: "lighthouse:default", settings: collectorSettings[profile] })
      assert(result?.lhr && !result.lhr.runtimeError, result?.lhr.runtimeError?.message ?? "No Lighthouse result")
      const evidence = await provenance(String(version.Browser).replace(/^Chrome\//, ""), { profile, settings: result.lhr.configSettings, freshBrowserProfile: true })
      const facilityEvidence = { provenance: evidence, route, run, measuredAt: new Date().toISOString(), complete: true }
      await writeFile(join(directory, `${name}.json`), JSON.stringify({ ...result.lhr, facilityEvidence }))
      await writeFile(join(directory, `${name}-trace.json`), JSON.stringify(result.artifacts.Trace))
      await writeFile(join(directory, `${name}-network.json`), JSON.stringify(result.artifacts.DevtoolsLog))
      const audits = result.lhr.audits
      const sample = { profile, route, run, lcp: audits["largest-contentful-paint"].numericValue, tbt: audits["total-blocking-time"].numericValue, cls: audits["cumulative-layout-shift"].numericValue, bytes: audits["total-byte-weight"].numericValue }
      indexedRuns.push(sample)
      console.log(JSON.stringify(sample))
    } finally { await chrome.kill(); await rm(userDataDir, { recursive: true, force: true }) }
  }
  assert.deepEqual(await verifiedBuildIdentity(), identity, "Source changed during experiment")
  const reportFiles = (await readdir(directory)).filter(file => /^(desktop|mobile)-(home|demo)-\d+\.json$/.test(file))
  const reports = await Promise.all(reportFiles.map(async file => ({ name: file.slice(0, -5), report: JSON.parse(await readFile(join(directory, file), "utf8")) })))
  for (const { name } of reports) for (const suffix of ["trace", "network"]) await readFile(join(directory, `${name}-${suffix}.json`))
  const first = reports[0]?.report.facilityEvidence?.provenance
  assert(first, "No saved Lighthouse reports")
  const expectedProvenance = await provenance(first.browser, first.settings)
  const { recordedAt: buildRecordedAt } = JSON.parse(await readFile(".next/facility-build.json", "utf8"))
  report = summarizeStartupEvidence({ label, measuredAt, identity, indexedRuns, reports, expectedProvenance, buildRecordedAt, baseURL, collectorSettings })
  if (report.result !== "pass") process.exitCode = 1
} catch (error) {
  report.collection.failures.push(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await writeFile(join(directory, "summary.json"), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ label, collection: report.collection, threshold: report.threshold, medians: report.medians }, null, 2))
}
