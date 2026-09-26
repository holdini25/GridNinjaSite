import assert from "node:assert/strict"
import { validateLighthouseReport } from "../seo/validate-lighthouse-budgets.mjs"
import { assertSameBuild, canonicalJson, TRANSFER_BUDGET } from "./performance-contract.mjs"

export const STARTUP_PROFILES = ["desktop", "mobile"]
export const STARTUP_ROUTES = ["/", "/demo"]
export const STARTUP_RUN_COUNT = 5

export function startupRunName(profile, route, run) {
  return `${profile}-${route === "/" ? "home" : "demo"}-${run}`
}

export function startupCollectorSettings(config, desktopSettings) {
  return Object.fromEntries(STARTUP_PROFILES.map(profile => {
    const settings = { ...config.ci.collect.settings, ...(profile === "desktop" ? desktopSettings : { formFactor: "mobile" }) }
    delete settings.chromeFlags
    delete settings.preset
    return [profile, settings]
  }))
}

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const expectedNames = () => STARTUP_PROFILES.flatMap(profile => STARTUP_ROUTES.flatMap(route =>
  Array.from({ length: STARTUP_RUN_COUNT }, (_, index) => startupRunName(profile, route, index + 1))))

function assertFresh(timestamp, earliest, latest) {
  const value = Date.parse(timestamp)
  assert(Number.isFinite(value) && value >= earliest && value <= latest,
    "Startup report predates this collection/build or has an invalid measurement time")
}

function assertCollectorSettings(actual, expected, profile) {
  assert.equal(actual?.formFactor, profile, "Lighthouse actual form factor differs from its profile")
  assert.equal(actual?.throttlingMethod, "simulate", "Startup gate requires the release collector's simulated throttling")
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(canonicalJson(actual?.[key]), canonicalJson(value), `Lighthouse ${key} differs from release collector settings`)
  }
}

function metricSample(report) {
  const sample = {
    performance: report.categories?.performance?.score * 100,
    accessibility: report.categories?.accessibility?.score * 100,
    bestPractices: report.categories?.["best-practices"]?.score * 100,
    lcp: report.audits?.["largest-contentful-paint"]?.numericValue,
    fcp: report.audits?.["first-contentful-paint"]?.numericValue,
    tbt: report.audits?.["total-blocking-time"]?.numericValue,
    cls: report.audits?.["cumulative-layout-shift"]?.numericValue,
    transferBytes: report.audits?.["total-byte-weight"]?.numericValue,
  }
  assert(Object.values(sample).every(Number.isFinite), "Missing Lighthouse metric")
  return sample
}

/** Validate the saved twenty-run experiment without changing the full release collector. */
export function summarizeStartupEvidence({ label, measuredAt, identity, indexedRuns, reports, expectedProvenance, buildRecordedAt, baseURL, collectorSettings, now = Date.now() }) {
  const summary = {
    label, measuredAt, identity, runs: [], medians: {},
    collection: { result: "incomplete", failures: [] },
    threshold: { result: "not-evaluated", failures: [] },
    result: "fail",
  }
  try {
    const names = expectedNames()
    assert.equal(indexedRuns.length, names.length, "Expected exactly twenty indexed fresh-profile runs")
    assert.equal(reports.length, names.length, "Expected exactly twenty saved Lighthouse reports")
    assert.deepEqual(indexedRuns.map(run => startupRunName(run.profile, run.route, run.run)).sort(), [...names].sort(),
      "Missing or duplicate indexed startup run IDs")
    assert.deepEqual(reports.map(({ name }) => name).sort(), [...names].sort(),
      "Missing or duplicate saved startup reports")
    assert.deepEqual({ sourceRevision: expectedProvenance.sourceRevision, buildId: expectedProvenance.buildId,
      releases: expectedProvenance.releases, buildSettings: expectedProvenance.buildSettings }, identity,
      "Startup reports do not match the recorded build identity")
    const earliest = Math.max(Date.parse(measuredAt), Date.parse(buildRecordedAt))
    assert(Number.isFinite(earliest), "Missing build or collection start time")
    const expectedURL = new URL(baseURL)
    let lighthouseVersion
    const settingsByProfile = new Map()
    const samplesByGroup = new Map()
    for (const { name, report } of reports) {
      const evidence = report.facilityEvidence
      assert(evidence?.complete, `${name}: missing complete Lighthouse evidence`)
      const { profile, route, run } = indexedRuns.find(item => startupRunName(item.profile, item.route, item.run) === name)
      assert.equal(evidence.route, route, `${name}: report route differs from its run ID`)
      assert.equal(evidence.run, run, `${name}: report run differs from its run ID`)
      const reportURL = new URL(report.finalUrl)
      const requestedURL = new URL(report.requestedUrl)
      for (const url of [reportURL, requestedURL]) {
        assert.equal(url.origin, expectedURL.origin, `${name}: report uses another origin`)
        assert.equal(url.pathname, route, `${name}: report uses another route`)
      }
      assertSameBuild(evidence.provenance, expectedProvenance)
      assert.equal(evidence.provenance.browser, expectedProvenance.browser, `${name}: mixed Chrome versions`)
      assert.equal(evidence.provenance.settings?.profile, profile, `${name}: wrong device profile`)
      assert.equal(evidence.provenance.settings?.freshBrowserProfile, true, `${name}: reused browser profile`)
      assert.equal(canonicalJson(evidence.provenance.settings.settings), canonicalJson(report.configSettings),
        `${name}: actual Lighthouse settings differ from recorded settings`)
      assertCollectorSettings(report.configSettings, collectorSettings[profile], profile)
      const serializedSettings = canonicalJson(report.configSettings)
      if (settingsByProfile.has(profile)) assert.equal(serializedSettings, settingsByProfile.get(profile), `${name}: mixed ${profile} Lighthouse settings`)
      else settingsByProfile.set(profile, serializedSettings)
      assertFresh(evidence.measuredAt, earliest, now + 60_000)
      assert.equal(typeof report.lighthouseVersion, "string", `${name}: missing Lighthouse version`)
      if (lighthouseVersion) assert.equal(report.lighthouseVersion, lighthouseVersion, `${name}: mixed Lighthouse versions`)
      else lighthouseVersion = report.lighthouseVersion
      const sample = metricSample(report)
      summary.runs.push({ profile, route, run, ...sample })
      const group = `${profile} ${route}`
      if (!samplesByGroup.has(group)) samplesByGroup.set(group, [])
      samplesByGroup.get(group).push({ report, sample })
    }
    for (const profile of STARTUP_PROFILES) {
      summary.medians[profile] = {}
      for (const route of STARTUP_ROUTES) {
        const samples = samplesByGroup.get(`${profile} ${route}`)
        assert.equal(samples?.length, STARTUP_RUN_COUNT, `${profile} ${route}: expected five fresh profiles`)
        summary.medians[profile][route] = Object.fromEntries(Object.keys(samples[0].sample)
          .map(key => [key, median(samples.map(({ sample }) => sample[key]))]))
      }
    }
    summary.collection.result = "complete"
    for (const profile of STARTUP_PROFILES) for (const route of STARTUP_ROUTES) {
      const group = `${profile} ${route}`
      const medians = summary.medians[profile][route]
      for (const [key, ceiling] of [["lcp", 2500], ["fcp", 1800], ["tbt", 200], ["cls", 0.1], ["transferBytes", TRANSFER_BUDGET]]) {
        if (medians[key] > ceiling) summary.threshold.failures.push(`${group}: ${key} ${medians[key]} exceeds ${ceiling}`)
      }
      for (const [key, floor] of [["performance", 90], ["accessibility", 95], ["bestPractices", 95]]) {
        if (medians[key] < floor) summary.threshold.failures.push(`${group}: ${key} ${medians[key]} below ${floor}`)
      }
      for (const { report } of samplesByGroup.get(group)) {
        for (const audit of ["heading-order", "color-contrast"]) {
          if (report.audits?.[audit]?.score !== 1) summary.threshold.failures.push(`${group}: required ${audit} audit did not pass`)
        }
        summary.threshold.failures.push(...validateLighthouseReport(report))
      }
    }
    summary.threshold.result = summary.threshold.failures.length ? "fail" : "pass"
    summary.result = summary.threshold.result
  } catch (error) {
    summary.collection.failures.push(error instanceof Error ? error.message : String(error))
  }
  return summary
}
