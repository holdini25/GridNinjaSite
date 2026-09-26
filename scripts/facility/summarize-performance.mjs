import assert from "node:assert/strict"
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import { validateLighthouseReport } from "../seo/validate-lighthouse-budgets.mjs"
import { assertCompleteTransfer, assertCadenceBudget, assertFrameBudget, assertRendererBudget, assertSettlementEvidence, assertLighthouseProfile, assertSameBuild, canonicalJson, provenance } from "./performance-contract.mjs"

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const summary = { measuredAt: new Date().toISOString(), result: "incomplete", profiles: [], failures: [], mobileEvidence: "Browser device emulation; physical mobile validation remains separate" }
try {
  const pages = JSON.parse(await readFile("build/facility/page-measurements.json", "utf8"))
  const expected = await provenance(pages.provenance?.browser, pages.provenance?.settings)
  assertSameBuild(pages.provenance, expected)
  if(pages.result!=="pass")summary.failures.push(`Page measurements failed: ${pages.failure ?? "incomplete measurement"}`)
  assert.equal(pages.provenance.settings.runCount, 5, "Release validation requires five fresh profiles")
  summary.provenance = expected
  const build = JSON.parse(await readFile(".next/facility-build.json", "utf8"))
  const fresh = timestamp => {
    assert(Number.isFinite(Date.parse(timestamp)) && Date.parse(timestamp) >= Date.parse(build.recordedAt) && Date.parse(timestamp) <= Date.now() + 60_000, "Report predates this build or has an invalid measurement time")
  }
  fresh(pages.measuredAt)
  const index = JSON.parse(await readFile("build/facility/lighthouse-index.json", "utf8"))
  assert.equal(index.result, "pass", "Lighthouse collection did not complete")
  assert.equal(index.runs.length, 30, "Missing Lighthouse fresh-profile runs for home, demo, and assessment")
  for (const profile of ["desktop", "mobile"]) {
    const directory = `build/facility/lighthouse-${profile}`
    const reports = []
    for (const file of await readdir(directory)) if (file.endsWith(".json")) reports.push(JSON.parse(await readFile(`${directory}/${file}`, "utf8")))
    assert.equal(reports.length, 15, `${profile}: expected exactly fifteen Lighthouse reports`)
    for (const route of ["/", "/demo", "/assessment"]) {
      const group = reports.filter(report => new URL(report.finalUrl).pathname === route)
      assert.equal(group.length, 5, `${profile} ${route}: expected five runs`)
      assert.deepEqual(group.map(report => report.facilityEvidence?.run).sort(), [1, 2, 3, 4, 5], "Duplicated or missing Lighthouse run IDs")
      const profileSettings = canonicalJson(group[0].facilityEvidence?.provenance.settings)
      const samples = group.map(report => {
        const evidence = report.facilityEvidence
        assertLighthouseProfile(report, profile)
        assert(evidence?.complete && evidence.route === route, "Missing complete Lighthouse evidence")
        assertSameBuild(evidence.provenance, expected)
        assert.equal(evidence.provenance.browser, pages.provenance.browser, "Mixed Chrome versions between transfer and Lighthouse evidence")
        assert.equal(canonicalJson(evidence.provenance.settings), profileSettings, "Mixed Lighthouse settings within a profile")
        assert(evidence.provenance.settings.freshBrowserProfile, "Lighthouse profile was reused")
        fresh(evidence.measuredAt)
        const sample = {
          performance: report.categories.performance.score * 100,
          accessibility: report.categories.accessibility.score * 100,
          bestPractices: report.categories["best-practices"].score * 100,
          lcp: report.audits["largest-contentful-paint"].numericValue,
          fcp: report.audits["first-contentful-paint"].numericValue,
          tbt: report.audits["total-blocking-time"].numericValue,
          cls: report.audits["cumulative-layout-shift"].numericValue,
          transferBytes: report.audits["total-byte-weight"].numericValue,
        }
        assert(Object.values(sample).every(Number.isFinite), "Missing Lighthouse metric")
        summary.failures.push(...validateLighthouseReport(report))
        return sample
      })
      const medians = Object.fromEntries(Object.keys(samples[0]).map(key => [key, median(samples.map(sample => sample[key]))]))
      for (const [key, ceiling] of [["lcp", 2500], ["fcp", 1800], ["tbt", 200], ["cls", 0.1], ["transferBytes", 1_572_864]]) if (medians[key] > ceiling) summary.failures.push(`${profile} ${route}: ${key} ${medians[key]} exceeds ${ceiling}`)
      for (const [key, floor] of [["performance", 90], ["accessibility", 95], ["bestPractices", 95]]) if (medians[key] < floor) summary.failures.push(`${profile} ${route}: ${key} ${medians[key]} below ${floor}`)
      const pageProfile = profile === "mobile" ? "mobile-emulation" : "desktop"
      const transfers = pages.results.filter(result => result.route === route && result.profile === pageProfile)
      if (route !== "/assessment") {
        assert.equal(transfers.length, 5, "Missing five complete through-readiness transfer measurements")
        assert.deepEqual(transfers.map(result => result.run).sort(), [1, 2, 3, 4, 5], "Duplicate page-measurement run IDs")
      }
      for (const result of transfers) {
        try {
        assert(result.complete && result.freshContext, "Incomplete or reused page measurement")
        assert((profile !== "desktop" && pages.provenance.buildSettings.mode !== "auto-adaptive") || result.throughReady, "Automatic transfer stopped before 3D readiness")
        assertCompleteTransfer(result.transfer)
        assertRendererBudget(result.renderer)
        if (result.settlement) {
          assertSettlementEvidence(result.settlement, pages.provenance.settings)
          if (result.settlement.mode === "adaptive-still") assert.equal(pages.provenance.buildSettings.mode, "auto-adaptive")
        } else assertRendererBudget(result.pausedRenderer, false) // Historical explicit-pause reports.
        assert(Number.isFinite(result.capability?.frameP95 ?? result.renderer?.frameP95) && (result.capability?.sampleCount ?? result.renderer?.sampleCount) >= 120, "Missing fixed-cadence capability evidence")
        if (result.renderingClass === "hardware") {
          if(pages.provenance.buildSettings.mode === "auto-adaptive") {
            for (const sample of result.ambientDiagnostics ?? []) if (sample.quality !== "still" && sample.sampleCount >= 120) assertCadenceBudget(sample)
            if (result.renderer.quality === "still") {
              assert.equal(result.ambientCadence?.status, "not-applicable", "Still must explicitly classify absent ambient cadence")
              assert.equal(result.settlement?.mode, "adaptive-still", "Still requires actual static-settlement evidence")
            } else assertCadenceBudget(result.renderer)
          }
          assertFrameBudget(result.capability ?? result.renderer, profile === "desktop" ? 20 : 34)
        }
        }catch(error){summary.failures.push(`${profile} ${route} run ${result.run}: ${error instanceof Error?error.message:String(error)}`)}
      }
      summary.profiles.push({ profile, route, lighthouseVersion: group[0].lighthouseVersion, settings: group[0].configSettings, medians, samples, throughReadyTransfers: transfers.map(result => ({ bytes: result.transfer?.bytes, renderingClass: result.renderingClass, frameP95: result.renderer?.frameP95, capabilityP95:result.capability?.frameP95, complete:result.complete, ambientCadence:result.ambientCadence, settlementMode:result.settlement?.mode ?? "legacy-explicit-pause", budgetFailures:result.budgetFailures })) })
    }
  }
  summary.result = summary.failures.length ? "fail" : "pass"
} catch (error) {
  summary.result = "fail"
  summary.failures.push(error instanceof Error ? error.message : String(error))
}
await mkdir("build/facility", { recursive: true })
await writeFile("build/facility/performance-summary.json", `${JSON.stringify(summary, null, 2)}\n`)
const activeRelease = summary.provenance?.buildSettings?.selectedRelease ?? "facility-v3"
const evidenceDirectory = process.env.FACILITY_REPORT_DIR ?? `docs/website-upgrade/facility-validation-${activeRelease.replace(/^facility-/, "")}`
await mkdir(evidenceDirectory, { recursive: true })
await writeFile(`${evidenceDirectory}/lighthouse.json`, `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify({ result: summary.result, profiles: summary.profiles.map(({ profile, route, medians }) => ({ profile, route, medians })), failures: summary.failures }, null, 2))
if (summary.result !== "pass") process.exitCode = 1
