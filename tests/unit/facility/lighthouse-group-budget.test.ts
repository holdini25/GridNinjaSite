// @vitest-environment node
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { assertReadinessRunCount, evaluateLighthouseGroup } from "../../../scripts/facility/lighthouse-group-budget.mjs"
import { qualificationRequire, QUALIFICATION_VERSIONS } from "../../../scripts/facility/qualification-toolchain.mjs"

const lighthouseConfig: { categories: { seo: { auditRefs: Array<{ id: string; weight: number; group?: string }> } } } = (await import(pathToFileURL(qualificationRequire.resolve("lighthouse/core/config/default-config.js")).href)).default

const environment = { schemaVersion: "facility-qualification-environment.v1", name: "local", measurementOrigin: "http://localhost:3101" }
const options = (route = "/", profile = "mobile", buildSettings = {}) => ({ route, profile, buildSettings, environment })
function reports(route = "/", profile = "mobile", buildSettings = {}) {
  return Array.from({ length: 5 }, (_, index) => ({
    finalUrl: `http://localhost:3101${route}`,
    configSettings: { formFactor: profile },
    facilityEvidence: { route, run: index + 1, complete: true, provenance: { qualificationEnvironment: environment, buildSettings, settings: { profile, settings: { formFactor: profile } } } },
    categories: { performance: { score: .9 }, accessibility: { score: .95 }, "best-practices": { score: .95 }, seo: { score: 1 } },
    audits: {
      "largest-contentful-paint": { numericValue: route === "/contact" ? 2000 : 2500 },
      "first-contentful-paint": { numericValue: 1800 },
      "total-blocking-time": { numericValue: 200 },
      "cumulative-layout-shift": { numericValue: route === "/contact" ? .05 : .1 },
      "total-byte-weight": { numericValue: 1_572_864 },
      "heading-order": { score: 1, scoreDisplayMode: "numeric" },
      "color-contrast": { score: 1, scoreDisplayMode: "numeric" },
      "resource-summary": { details: { items: [{ resourceType: "total", transferSize: 1_572_864 }, { resourceType: "font", transferSize: 163_840 }, { resourceType: "script", transferSize: 204_800 }] } },
      "network-requests": { details: { items: [{ resourceType: "Image", transferSize: 256_000 }] } },
    },
  }))
}

describe("environment-specific group qualification", () => {
  it("uses the separately pinned Facility Lighthouse configuration", () => {
    expect(QUALIFICATION_VERSIONS.lighthouse).toBe("13.5.0")
    expect(JSON.parse(readFileSync(qualificationRequire.resolve("lighthouse/package.json"), "utf8")).version).toBe("13.5.0")
  })
  const staging = { ...environment, name: "protected-staging", measurementOrigin: "https://candidate-123.vercel.app" }
  const protectedReports = () => reports("/contact").map(report => ({
    ...report, lighthouseVersion: "13.5.0", finalUrl: `${staging.measurementOrigin}/contact`,
    categories: { ...report.categories, seo: { score: .69, auditRefs: structuredClone(lighthouseConfig.categories!.seo.auditRefs) } },
    audits: { ...report.audits, ...Object.fromEntries(lighthouseConfig.categories!.seo.auditRefs.map(({ id }) => [id, { id, score: id === "structured-data" ? null : id === "is-crawlable" ? 0 : 1, scoreDisplayMode: id === "structured-data" ? "manual" : "binary" }])) },
    facilityEvidence: { ...report.facilityEvidence, provenance: { ...report.facilityEvidence.provenance, qualificationEnvironment: staging }, documentResponse: { url: `${staging.measurementOrigin}/contact`, status: 200, headers: { "content-type": "text/html", "x-robots-tag": "noindex, nofollow" } } },
  }))
  const opts = { ...options("/contact"), environment: staging }
  it("retains raw SEO/public failures and every unchanged performance/BP/transfer gate", () => {
    const group = protectedReports(), original = structuredClone(group)
    const result = evaluateLighthouseGroup(group, opts)
    expect(result.failures).toEqual([])
    expect(result.medians.seo).toBe(69)
    expect(result.publicAcceptanceFailures).toHaveLength(5)
    expect(group).toEqual(original)
    for (const report of group) report.categories["best-practices"].score = .93
    expect(evaluateLighthouseGroup(group, opts).failures).toContainEqual(expect.stringContaining("bestPractices 93 below 95"))
    for (const report of group) report.audits["largest-contentful-paint"].numericValue = 2001
    expect(evaluateLighthouseGroup(group, opts).failures).toContainEqual(expect.stringContaining("lcp 2001 exceeds 2000"))
    for (const report of group) report.audits["total-byte-weight"].numericValue = 1_572_865
    expect(evaluateLighthouseGroup(group, opts).failures).toContainEqual(expect.stringContaining("transferBytes"))
  })
  it("rejects mixed environments and cannot relabel protected samples as public/local", () => {
    const group = protectedReports()
    expect(() => evaluateLighthouseGroup(group, options("/contact"))).toThrow("environment")
    expect(() => evaluateLighthouseGroup(group, { ...opts, environment: { ...staging, name: "public-production", measurementOrigin: "https://gridninja.ai" } })).toThrow("environment")
    group[0].facilityEvidence.provenance.qualificationEnvironment = { ...staging, name: "local", measurementOrigin: "http://localhost:3101" }
    expect(() => evaluateLighthouseGroup(group, opts)).toThrow("environment")
  })
  it("rejects one old-version or failed SEO audit even when the five-run score median is unchanged", () => {
    const oldVersion = protectedReports(); oldVersion[0].lighthouseVersion = "12.6.1"
    expect(evaluateLighthouseGroup(oldVersion, opts).failures).toContainEqual(expect.stringContaining("requires Lighthouse 13.5.0"))
    const auditFailure = protectedReports(); auditFailure[0].audits["document-title"].score = 0
    const result = evaluateLighthouseGroup(auditFailure, opts)
    expect(result.medians.seo).toBe(69)
    expect(result.failures).toContainEqual(expect.stringContaining("Required document-title audit did not pass"))
  })
})

describe("completed Lighthouse group release gates", () => {
  it("accepts exact unchanged ceilings/floors without turning the design aim into a gate", () => {
    const result = evaluateLighthouseGroup(reports(), options())
    expect(result.failures).toEqual([])
    expect(result.samples).toHaveLength(5)
    expect(result.medians.lcp).toBe(2500)
    expect(result.policy.lcpAim).toBe(2200)
    expect(evaluateLighthouseGroup(reports("/contact"), options("/contact")).failures).toEqual([])
  })

  it.each([
    ["largest-contentful-paint", "lcp"], ["first-contentful-paint", "fcp"],
    ["total-blocking-time", "tbt"], ["cumulative-layout-shift", "cls"],
    ["total-byte-weight", "transferBytes"],
  ] as const)("enforces the five-run median for %s", (audit, metric) => {
    const group = reports()
    for (const report of group.slice(0, 2)) report.audits[audit].numericValue += 1
    expect(evaluateLighthouseGroup(group, options()).failures).toEqual([])
    group[2].audits[audit].numericValue += 1
    expect(evaluateLighthouseGroup(group, options()).failures).toContainEqual(expect.stringContaining(`${metric} `))
  })

  it.each(["performance", "accessibility", "best-practices", "seo"] as const)("enforces the %s score floor", category => {
    const group = reports()
    for (const report of group.slice(0, 3)) report.categories[category].score -= .01
    expect(evaluateLighthouseGroup(group, options()).failures).toHaveLength(1)
  })

  it("retains stricter contact gates and the frozen-brief SEO exception", () => {
    const contact = reports("/contact")
    for (const report of contact) {
      report.audits["largest-contentful-paint"].numericValue = 2001
      report.audits["cumulative-layout-shift"].numericValue = .051
    }
    expect(evaluateLighthouseGroup(contact, options("/contact")).failures).toHaveLength(2)
    const route = "/evidence/assessments/demo-01-b/v1.0.0"
    const brief = reports(route)
    for (const report of brief) report.categories.seo.score = .5
    expect(evaluateLighthouseGroup(brief, options(route)).failures).toEqual([])
  })

  it.each(["heading-order", "color-contrast"] as const)("rejects one failed, missing or not-applicable %s score", audit => {
    const group = reports()
    group[0].audits[audit].score = 0
    expect(() => evaluateLighthouseGroup(group, options())).toThrow(`Required ${audit}`)
    group[0].audits[audit].score = Number.NaN
    group[0].audits[audit].scoreDisplayMode = "notApplicable"
    expect(() => evaluateLighthouseGroup(group, options())).toThrow(`Required ${audit}`)
  })

  it("keeps per-sample resource budgets decisive even when every median passes", () => {
    const group = reports("/insights/example")
    for (const item of group[0].audits["resource-summary"].details.items) item.transferSize += 1
    group[0].audits["network-requests"].details.items[0].transferSize += 1
    expect(evaluateLighthouseGroup(group, options("/insights/example")).failures).toHaveLength(4)
    group[0].audits["network-requests"].details.items[0].transferSize = Number.NaN
    expect(evaluateLighthouseGroup(group, options("/insights/example")).failures).toContainEqual(expect.stringContaining("missing transferSize"))
  })

  it("applies selected-cinematic transfer limits only to home and the actual profile", () => {
    const buildSettings = { cinematic: { selectedRelease: "cinematic-v1" } }
    const group = reports("/", "mobile", buildSettings)
    for (const report of group) {
      report.audits["total-byte-weight"].numericValue = 2_097_152
      report.audits["resource-summary"].details.items[0].transferSize = 2_097_152
    }
    expect(evaluateLighthouseGroup(group, options("/", "mobile", buildSettings)).failures).toEqual([])
    expect(evaluateLighthouseGroup(group, options()).failures).toContainEqual(expect.stringContaining("transferBytes"))
  })

  it("refuses partial, extra, duplicate, incomplete or nonfinite captures", () => {
    expect(() => evaluateLighthouseGroup(reports().slice(0, 4), options())).toThrow("expected five")
    expect(() => evaluateLighthouseGroup([...reports(), reports()[0]], options())).toThrow("expected five")
    const duplicate = reports(); duplicate[4].facilityEvidence.run = 1
    expect(() => evaluateLighthouseGroup(duplicate, options())).toThrow("Duplicated or missing")
    const incomplete = reports(); incomplete[4].facilityEvidence.complete = false
    expect(() => evaluateLighthouseGroup(incomplete, options())).toThrow("complete Lighthouse evidence")
    const nonfinite = reports(); nonfinite[0].audits["largest-contentful-paint"].numericValue = Number.NaN
    expect(() => evaluateLighthouseGroup(nonfinite, options())).toThrow("Missing Lighthouse metric")
  })

  it("retains the separate five-run readiness requirement", () => {
    const readiness = [1, 2, 3, 4, 5].map(run => ({ run }))
    expect(() => assertReadinessRunCount(readiness)).not.toThrow()
    expect(() => assertReadinessRunCount(readiness.slice(0, 4))).toThrow("five complete through-readiness")
    expect(() => assertReadinessRunCount([...readiness, { run: 6 }])).toThrow("five complete through-readiness")
    expect(() => assertReadinessRunCount([...readiness.slice(0, 4), { run: 1 }])).toThrow("Duplicate page-measurement")
  })
})
