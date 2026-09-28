// @vitest-environment node
import { describe, expect, it } from "vitest"
import { settingsDigest } from "../../../scripts/facility/performance-contract.mjs"
import { STARTUP_PROFILES, STARTUP_ROUTES, STARTUP_RUN_COUNT, startupRunName, summarizeStartupEvidence } from "../../../scripts/facility/startup-gate.mjs"

const measuredAt = "2026-09-24T12:00:00.000Z"
const buildRecordedAt = "2026-09-24T11:55:00.000Z"
const now = Date.parse("2026-09-24T12:10:00.000Z")
const baseURL = "http://localhost:3000"
const identity = {
  sourceRevision: "source", buildId: "build",
  releases: [{ release: "facility-v7", manifestSha256: "manifest" }],
  buildSettings: { selectedRelease: "facility-v7", mode: "auto-adaptive" },
}
const collectorSettings = {
  desktop: { maxWaitForLoad: 45_000, formFactor: "desktop" },
  mobile: { maxWaitForLoad: 45_000, formFactor: "mobile" },
}

function makeReport(profile: string, route: string, run: number) {
  const settings = { ...collectorSettings[profile as keyof typeof collectorSettings], throttlingMethod: "simulate" }
  const provenance = {
    schemaVersion: "facility-performance.v2", ...identity, harnessRevision: "harness", browser: "154.0",
    settings: { profile, settings, freshBrowserProfile: true },
    settingsSha256: settingsDigest({ profile, settings, freshBrowserProfile: true }),
  }
  return {
    lighthouseVersion: "12.6.1",
    requestedUrl: `${baseURL}${route}`, finalUrl: `${baseURL}${route}`, configSettings: settings,
    facilityEvidence: { provenance, route, run, measuredAt: "2026-09-24T12:01:00.000Z", complete: true },
    categories: { performance: { score: 0.98 }, accessibility: { score: 1 }, "best-practices": { score: 1 } },
    audits: {
      "largest-contentful-paint": { numericValue: 2_300 },
      "first-contentful-paint": { numericValue: 1_500 },
      "total-blocking-time": { numericValue: 20 },
      "cumulative-layout-shift": { numericValue: 0 },
      "total-byte-weight": { numericValue: 500_000 },
      "heading-order": { score: 1 }, "color-contrast": { score: 1 },
      "resource-summary": { details: { items: [{ resourceType: "total", transferSize: 500_000 }, { resourceType: "font", transferSize: 20_000 }] } },
      "network-requests": { details: { items: [] } },
    },
  }
}

function fixture() {
  const indexedRuns: Array<{ profile: string; route: string; run: number }> = []
  const reports: Array<{ name: string; report: ReturnType<typeof makeReport> }> = []
  for (const profile of STARTUP_PROFILES) for (const route of STARTUP_ROUTES) for (let run = 1; run <= STARTUP_RUN_COUNT; run++) {
    indexedRuns.push({ profile, route, run })
    reports.push({ name: startupRunName(profile, route, run), report: makeReport(profile, route, run) })
  }
  const expectedProvenance = reports[0].report.facilityEvidence.provenance
  return { label: "v7-current", measuredAt, identity, indexedRuns, reports, expectedProvenance, buildRecordedAt, baseURL, collectorSettings, now }
}

describe("focused startup gate", () => {
  it("accepts exactly five complete fresh profiles for each home and demo device group", () => {
    const summary = summarizeStartupEvidence(fixture())
    expect(summary.collection.result).toBe("complete")
    expect(summary.threshold.result).toBe("pass")
    expect(summary.result).toBe("pass")
    expect(summary.runs).toHaveLength(20)
    expect((summary.medians as Record<string, Record<string, { lcp: number }>>).mobile["/demo"].lcp).toBe(2_300)
  })

  it("keeps a complete collection distinct from failed 2,500 ms mobile LCP thresholds", () => {
    const input = fixture()
    for (const { report } of input.reports) if (report.facilityEvidence.provenance.settings.profile === "mobile") {
      report.audits["largest-contentful-paint"].numericValue = report.facilityEvidence.route === "/" ? 2_606 : 2_746
    }
    const summary = summarizeStartupEvidence(input)
    expect(summary.collection.result).toBe("complete")
    expect(summary.threshold.result).toBe("fail")
    expect(summary.result).toBe("fail")
    expect(summary.threshold.failures).toEqual(expect.arrayContaining([
      expect.stringContaining("mobile /: lcp 2606 exceeds 2500"),
      expect.stringContaining("mobile /demo: lcp 2746 exceeds 2500"),
    ]))
  })

  it("rejects missing and duplicate run IDs before evaluating thresholds", () => {
    const missing = fixture()
    missing.reports.pop()
    expect(summarizeStartupEvidence(missing).collection.result).toBe("incomplete")
    expect(summarizeStartupEvidence(missing).threshold.result).toBe("not-evaluated")
    const duplicate = fixture()
    duplicate.indexedRuns[19] = { ...duplicate.indexedRuns[18] }
    const summary = summarizeStartupEvidence(duplicate)
    expect(summary.collection.result).toBe("incomplete")
    expect(summary.collection.failures.join(" ")).toMatch(/duplicate|missing/i)
  })

  it("rejects mixed source, build, harness, browser, and Lighthouse settings", () => {
    for (const field of ["sourceRevision", "buildId", "harnessRevision", "browser"]) {
      const input = fixture()
      Object.assign(input.reports[19].report.facilityEvidence.provenance, { [field]: "mixed" })
      const summary = summarizeStartupEvidence(input)
      expect(summary.collection.result, field).toBe("incomplete")
    }
    const settings = fixture()
    const report = settings.reports[19].report
    report.configSettings.maxWaitForLoad = 30_000
    report.facilityEvidence.provenance.settings.settings.maxWaitForLoad = 30_000
    report.facilityEvidence.provenance.settingsSha256 = settingsDigest(report.facilityEvidence.provenance.settings)
    expect(summarizeStartupEvidence(settings).collection.result).toBe("incomplete")
  })

  it("rejects stale reports and reused browser profiles", () => {
    const stale = fixture()
    stale.reports[0].report.facilityEvidence.measuredAt = "2026-09-24T11:59:00.000Z"
    expect(summarizeStartupEvidence(stale).collection.result).toBe("incomplete")
    const reused = fixture()
    reused.reports[0].report.facilityEvidence.provenance.settings.freshBrowserProfile = false
    reused.reports[0].report.facilityEvidence.provenance.settingsSha256 = settingsDigest(reused.reports[0].report.facilityEvidence.provenance.settings)
    expect(summarizeStartupEvidence(reused).collection.result).toBe("incomplete")
  })
})
