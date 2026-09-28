import { describe, expect, it } from "vitest"
import { enterpriseFunctionalPolicy } from "../../../scripts/qa/enterprise-functional-policy.mjs"
import { auditPlaywrightReport } from "../../../scripts/qa/candidate-contract.mjs"

describe("reviewed enterprise browser capabilities", () => {
  it("requires each common journey everywhere and scopes only explicit navigation exceptions", () => {
    for (const project of ["chromium-desktop", "chromium-mobile", "firefox-desktop", "webkit-desktop", "webkit-mobile"]) {
      const policy = enterpriseFunctionalPolicy(project)
      expect(policy.requiredTitles.some(item => item.title.includes("hypothetical minimum"))).toBe(true)
      expect(policy.requiredTitles.some(item => item.title.includes("frozen publications retain"))).toBe(true)
      expect(policy.allowedSkips.every(item => item.project === project && item.reason.length > 0)).toBe(true)
      expect(policy.allowedSkips.some(item => item.title.includes("hypothetical") || item.title.includes("CSP"))).toBe(false)
      expect(policy.allowedSkips).toHaveLength(project.endsWith("-mobile") ? 8 : project === "chromium-desktop" ? 0 : 2)
    }
    expect(() => enterpriseFunctionalPolicy("new-unreviewed-browser")).toThrow()
  })
  it("cannot turn a green subset, absent project, or newly skipped feature into qualification", () => {
    const policy = enterpriseFunctionalPolicy("firefox-desktop")
    const report = { suites: [{ specs: policy.requiredTitles.map(item => ({ title: item.title, tests: [{ projectName: item.project, results: [{ status: "passed" }] }] })) }] }
    expect(auditPlaywrightReport(report, policy).result).toBe("pass")
    report.suites[0].specs.pop()
    expect(auditPlaywrightReport(report, policy).result).toBe("fail")
    report.suites[0].specs[0].tests[0].results[0].status = "skipped"
    expect(auditPlaywrightReport(report, policy).failures).toContain("Unapproved skip: firefox-desktop: all ordered transitions keep the explanation, quantities, and exact exports synchronized")
  })
})
