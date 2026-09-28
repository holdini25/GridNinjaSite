// @vitest-environment node
import { describe, expect, it } from "vitest"
import { inspectReleaseEnvironment, productionQualificationIssues } from "../../../scripts/qa/release-preflight-contract.mjs"
import { createCandidateLedger, evaluateCandidate, recordCandidateEvidence } from "../../../scripts/qa/candidate-contract.mjs"

const productionSettings = { observability: true, httpsPolicy: true, verification: "live", csp: "enforce" }
const evidence = { path: "build/qa/hosted-performance.json", sha256: "a".repeat(64) }

describe("production qualification prerequisites", () => {
  it.each([
    ["observability", false, "production-observability-not-in-build"],
    ["httpsPolicy", false, "https-policy-not-in-build"],
    ["verification", "test", "live-verification-not-in-build"],
    ["verification", "unconfigured", "live-verification-not-in-build"],
    ["csp", "report-only", "enforced-csp-not-in-build"],
  ])("rejects omitted %s even with an externally authorized ledger", (key, value, issue) => {
    const identity = { sourceRevision: "source", buildId: "build", buildSettings: { ...productionSettings, [key as string]: value } }
    expect(productionQualificationIssues(identity.buildSettings)).toContain(issue)
    const ledger = createCandidateLedger(identity, { externalActionsAuthorized: true })
    expect(() => recordCandidateEvidence(ledger, "production-configured-performance", { identity, owner: "reviewer", status: "pass", evidence: [evidence] })).toThrow(/production build settings/)
    expect(ledger.gates.find(gate => gate.id === "production-configured-performance")?.attempts).toHaveLength(0)
  })

  it("permits a recorded hosted result only after explicit authorization and complete build settings", () => {
    const identity = { sourceRevision: "source", buildId: "build", buildSettings: productionSettings }
    const local = createCandidateLedger(identity, { externalActionsAuthorized: false })
    expect(() => recordCandidateEvidence(local, "production-configured-performance", { identity, owner: "reviewer", status: "pass", evidence: [evidence] })).toThrow(/local-only/)
    const hosted = createCandidateLedger(identity, { externalActionsAuthorized: true })
    recordCandidateEvidence(hosted, "production-configured-performance", { identity, owner: "reviewer", status: "pass", evidence: [evidence] })
    expect(evaluateCandidate(hosted).publicReady).toBe(false)
  })

  it("rejects a saved passing production gate against the local test build", () => {
    const ledger = createCandidateLedger({ sourceRevision: "source", buildId: "build", buildSettings: { observability: false, httpsPolicy: false, verification: "test", csp: "enforce" } }, {})
    const gate = ledger.gates.find(gate => gate.id === "production-configured-performance")!
    gate.status = "pass"
    expect(() => evaluateCandidate(ledger)).toThrow(/omitted production dependencies/)
    expect(productionQualificationIssues(undefined)).toHaveLength(4)
  })
})

describe("redacted release capability inventory", () => {
  it("reports names and presence without returning values, endpoints, recipients or secret material", () => {
    const sentinel = "SECRET_SENTINEL_DO_NOT_RECORD"
    const report = inspectReleaseEnvironment({ DATABASE_URL: sentinel, LEAD_EMAIL_TO: sentinel, LEAD_ALERT_WEBHOOK_URL: sentinel, STAGING_BASE_URL: sentinel, NEXT_PUBLIC_TURNSTILE_SITE_KEY: sentinel, VERCEL: "1", GRIDNINJA_CSP_MODE: "enforce" })
    expect(JSON.stringify(report)).not.toContain(sentinel)
    expect(report.groups.inquiryDelivery.variables).toContainEqual({ name: "DATABASE_URL", present: true })
    expect(report.groups.inquiryDelivery.variables).toContainEqual({ name: "RESEND_API_KEY", present: false })
    expect(report.effectiveBuildConfiguration).toEqual(productionSettings)
  })

  it("does not treat absent, blank or example-like test verification as production capability", () => {
    const empty = inspectReleaseEnvironment({ RESEND_API_KEY: "  " })
    expect(empty.groups.inquiryDelivery.variables.every(variable => !variable.present)).toBe(true)
    expect(empty.effectiveBuildConfiguration.verification).toBe("unconfigured")
    const local = inspectReleaseEnvironment({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA", GRIDNINJA_HTTPS: "1", GRIDNINJA_CSP_MODE: "report-only" })
    expect(local.effectiveBuildConfiguration).toEqual({ observability: false, httpsPolicy: true, verification: "test", csp: "report-only" })
    expect(productionQualificationIssues(local.effectiveBuildConfiguration)).toHaveLength(3)
    expect(inspectReleaseEnvironment({ GRIDNINJA_CSP_MODE: "SECRET_SENTINEL" }).effectiveBuildConfiguration.csp).toBe("invalid")
  })
})
