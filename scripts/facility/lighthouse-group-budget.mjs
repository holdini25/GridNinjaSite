import assert from "node:assert/strict"
import { validateLighthouseReport } from "../seo/validate-lighthouse-budgets.mjs"
import { assertLighthouseProfile, routeTransferBudget } from "./performance-contract.mjs"
import { lighthouseRoutePolicy } from "./lighthouse-matrix.mjs"

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

/** A Lighthouse group never substitutes for the separately captured readiness runs. */
export function assertReadinessRunCount(transfers) {
  assert.equal(transfers.length, 5, "Missing five complete through-readiness transfer measurements")
  assert.deepEqual(transfers.map(result => result.run).sort(), [1, 2, 3, 4, 5], "Duplicate page-measurement run IDs")
}

/** Evaluate only an entire five-capture Lighthouse group. Page readiness,
 * through-readiness transfer, source identity and full-matrix coverage remain
 * separate mandatory qualification checks in summarize-performance.mjs. */
export function evaluateLighthouseGroup(group, { route, profile, buildSettings }) {
  assert.equal(group.length, 5, `${profile} ${route}: expected five runs`)
  assert.deepEqual(group.map(report => report.facilityEvidence?.run).sort(), [1, 2, 3, 4, 5], "Duplicated or missing Lighthouse run IDs")
  const failures = []
  const samples = group.map(report => {
    const evidence = report.facilityEvidence
    assert(new URL(report.finalUrl).pathname === route && evidence?.complete && evidence.route === route, "Missing complete Lighthouse evidence")
    // Includes the existing strict per-run heading-order and color-contrast
    // requirement; notApplicable is not a passing result for these audits.
    assertLighthouseProfile(report, profile)
    const sample = {
      performance: report.categories.performance.score * 100,
      accessibility: report.categories.accessibility.score * 100,
      bestPractices: report.categories["best-practices"].score * 100,
      seo: report.categories.seo.score * 100,
      lcp: report.audits["largest-contentful-paint"].numericValue,
      fcp: report.audits["first-contentful-paint"].numericValue,
      tbt: report.audits["total-blocking-time"].numericValue,
      cls: report.audits["cumulative-layout-shift"].numericValue,
      transferBytes: report.audits["total-byte-weight"].numericValue,
    }
    assert(Object.values(sample).every(Number.isFinite), "Missing Lighthouse metric")
    failures.push(...validateLighthouseReport(report))
    return sample
  })
  const medians = Object.fromEntries(Object.keys(samples[0]).map(key => [key, median(samples.map(sample => sample[key]))]))
  const policy = lighthouseRoutePolicy(route)
  for (const [key, ceiling] of [["lcp", policy.lcp], ["fcp", policy.fcp], ["tbt", policy.tbt], ["cls", policy.cls], ["transferBytes", routeTransferBudget(route, profile, buildSettings)]]) if (medians[key] > ceiling) failures.push(`${profile} ${route}: ${key} ${medians[key]} exceeds ${ceiling}`)
  for (const [key, floor] of [["performance", policy.performance], ["accessibility", policy.accessibility], ["bestPractices", policy.bestPractices], ...(policy.seo === null ? [] : [["seo", policy.seo]])]) if (medians[key] < floor) failures.push(`${profile} ${route}: ${key} ${medians[key]} below ${floor}`)
  return { samples, medians, policy, failures }
}
