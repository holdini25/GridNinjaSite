// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assertReadinessRunCount, evaluateLighthouseGroup } from "../../../scripts/facility/lighthouse-group-budget.mjs"

const options = (route = "/", profile = "mobile", buildSettings = {}) => ({ route, profile, buildSettings })
function reports(route = "/", profile = "mobile", buildSettings = {}) {
  return Array.from({ length: 5 }, (_, index) => ({
    finalUrl: `http://localhost:3101${route}`,
    configSettings: { formFactor: profile },
    facilityEvidence: { route, run: index + 1, complete: true, provenance: { buildSettings, settings: { profile, settings: { formFactor: profile } } } },
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
