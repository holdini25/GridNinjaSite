// @vitest-environment node
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { qualificationRequire, QUALIFICATION_VERSIONS } from "../../../scripts/facility/qualification-toolchain.mjs"
import {
  assertEnvironmentServing, assertQualificationBuild, assertQualificationEnvironment,
  evaluateEnvironmentSeo, qualificationEnvironment, qualificationOutcome,
} from "../../../scripts/facility/qualification-environment.mjs"

const lighthouseConfig = (await import(pathToFileURL(qualificationRequire.resolve("lighthouse/core/config/default-config.js")).href)).default
const origin = "https://gridninja-release-6ii00t6s2-holdini25s-projects.vercel.app"
const stagingEnv = { FACILITY_QUALIFICATION_ENVIRONMENT: "protected-staging", FACILITY_BASE_URL: origin, FACILITY_HOSTED_ATTESTATION_FILE: "/private/attestation.json" }
const publicEnv = { ...stagingEnv, FACILITY_QUALIFICATION_ENVIRONMENT: "public-production", FACILITY_BASE_URL: "https://gridninja.ai", FACILITY_PUBLIC_PRODUCTION_PINS_FILE: "/private/pins.json" }
const local = qualificationEnvironment({}), staging = qualificationEnvironment(stagingEnv), production = qualificationEnvironment(publicEnv)
const live = { buildSettings: { privateCandidate: null, observability: true, httpsPolicy: true, verification: "live", csp: "enforce" } }
const refs = [
  { id: "is-crawlable", weight: 93 / 23, group: "seo-crawl" },
  { id: "document-title", weight: 1, group: "seo-content" },
  { id: "meta-description", weight: 1, group: "seo-content" },
  { id: "http-status-code", weight: 1, group: "seo-crawl" },
  { id: "link-text", weight: 1, group: "seo-content" },
  { id: "crawlable-anchors", weight: 1, group: "seo-crawl" },
  { id: "robots-txt", weight: 1, group: "seo-crawl" },
  { id: "image-alt", weight: 1, group: "seo-content" },
  { id: "hreflang", weight: 1, group: "seo-content" },
  { id: "canonical", weight: 1, group: "seo-content" },
  { id: "structured-data", weight: 0 },
]
type Audit = { id: string; score: number | null; scoreDisplayMode: string; errorMessage?: string }
function report() {
  const audits: Record<string, Audit> = Object.fromEntries(refs.map(ref => [ref.id, {
    id: ref.id, score: ref.id === "structured-data" ? null : ref.id === "is-crawlable" ? 0 : 1,
    scoreDisplayMode: ref.id === "structured-data" ? "manual" : "binary",
  }]))
  return {
    lighthouseVersion: "13.5.0", finalUrl: `${origin}/contact`,
    categories: { seo: { score: .69, auditRefs: structuredClone(refs) } }, audits,
    facilityEvidence: { documentResponse: { url: `${origin}/contact`, status: 200, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow, noarchive" as string | null } } },
  }
}
const evaluate = (value = report(), environment = staging, seoFloor: number | null = 100) => evaluateEnvironmentSeo(value, { environment, route: "/contact", seoFloor })

describe("qualification environment identity and prerequisites", () => {
  it("defaults only to canonical loopback local collection", () => {
    expect(local).toEqual({ schemaVersion: "facility-qualification-environment.v1", name: "local", measurementOrigin: "http://localhost:3000" })
    for (const url of ["http://localhost:3101", "https://127.0.0.1:3001", "http://[::1]:3101"]) expect(qualificationEnvironment({ FACILITY_BASE_URL: url }).measurementOrigin).toBe(url)
    for (const url of [origin, "https://gridninja.ai", "http://localhost:3000/contact", "http://localhost:3000/", "http://localhost:3000?x=1", "http://user@localhost:3000", "http://localhost:3000#hash", "http://127.1:3000"]) expect(() => qualificationEnvironment({ FACILITY_BASE_URL: url })).toThrow()
    expect(() => qualificationEnvironment({ FACILITY_QUALIFICATION_ENVIRONMENT: "" })).toThrow()
    expect(() => qualificationEnvironment({ FACILITY_QUALIFICATION_ENVIRONMENT: "staging" })).toThrow()
    expect(() => qualificationEnvironment({ FACILITY_HOSTED_ATTESTATION_FILE: "attestation.json" })).toThrow("explicit hosted")
  })

  it("requires explicit protected deployment origin and attestation", () => {
    expect(staging.name).toBe("protected-staging")
    for (const url of ["https://gridninja.ai", "https://vercel.app", "https://nested.candidate.vercel.app", "https://candidate.vercel.app.evil.test", "http://candidate.vercel.app", `${origin}:444`, `${origin}/`, `${origin}/contact`, `${origin}?x=1`, `https://user@${new URL(origin).hostname}`]) expect(() => qualificationEnvironment({ ...stagingEnv, FACILITY_BASE_URL: url })).toThrow()
    expect(() => qualificationEnvironment({ ...stagingEnv, FACILITY_HOSTED_ATTESTATION_FILE: " " })).toThrow("ATTESTATION_FILE")
    expect(() => qualificationEnvironment({ FACILITY_QUALIFICATION_ENVIRONMENT: "protected-staging" })).toThrow()
  })

  it("requires exact public apex, pins, attestation and no automation authentication", () => {
    expect(production.name).toBe("public-production")
    for (const url of [origin, "https://www.gridninja.ai", "http://gridninja.ai", "https://gridninja.ai/", "https://gridninja.ai:444", "https://gridninja.ai?token=test"]) expect(() => qualificationEnvironment({ ...publicEnv, FACILITY_BASE_URL: url })).toThrow()
    expect(() => qualificationEnvironment({ ...publicEnv, FACILITY_PUBLIC_PRODUCTION_PINS_FILE: "" })).toThrow("PINS_FILE")
    expect(() => qualificationEnvironment({ ...publicEnv, FACILITY_HOSTED_ATTESTATION_FILE: "" })).toThrow("ATTESTATION_FILE")
    for (const key of ["VERCEL_AUTOMATION_BYPASS_SECRET", "FACILITY_HOSTED_BYPASS_SECRET"]) {
      expect(() => qualificationEnvironment({ ...publicEnv, [key]: "synthetic" })).toThrow(key)
      expect(() => qualificationEnvironment({ ...publicEnv, [key]: " " })).toThrow(key)
      expect(() => qualificationEnvironment({ ...publicEnv, [key]: "" })).not.toThrow()
    }
  })

  it("requires production build prerequisites in both hosted environments", () => {
    expect(() => assertQualificationBuild(local, {})).not.toThrow()
    for (const environment of [staging, production]) {
      expect(() => assertQualificationBuild(environment, live)).not.toThrow()
      expect(() => assertQualificationBuild(environment, {})).toThrow("production-equivalent")
      for (const replacement of [{ privateCandidate: {} }, { observability: false }, { httpsPolicy: false }, { verification: "test" }, { verification: "unconfigured" }, { csp: "report-only" }]) expect(() => assertQualificationBuild(environment, { buildSettings: { ...live.buildSettings, ...replacement } })).toThrow("production-equivalent")
    }
  })

  it("rejects absent, malformed, mixed-origin or mixed-kind environment evidence", () => {
    expect(() => assertQualificationEnvironment(structuredClone(staging), staging)).not.toThrow()
    for (const actual of [undefined, null, {}, { ...staging, schemaVersion: undefined }, { ...staging, extra: true }, local, production, { ...staging, measurementOrigin: "https://other-build.vercel.app" }]) expect(() => assertQualificationEnvironment(actual, staging)).toThrow()
    expect(() => assertQualificationEnvironment(undefined, undefined)).toThrow()
    expect(() => assertQualificationEnvironment(staging, undefined)).toThrow()
  })
})

describe("protected staging SEO policy", () => {
  it("pins the installed Lighthouse version and complete default SEO reference contract", () => {
    expect(QUALIFICATION_VERSIONS.lighthouse).toBe("13.5.0")
    expect(JSON.parse(readFileSync(qualificationRequire.resolve("lighthouse/package.json"), "utf8")).version).toBe("13.5.0")
    expect(lighthouseConfig.categories?.seo.auditRefs).toEqual(refs)
  })

  it("keeps raw score/public failure while accepting only expected noindex", () => {
    const value = report(), original = structuredClone(value)
    expect(evaluate(value)).toEqual({ failures: [], publicAcceptanceFailures: ["/contact: raw SEO 69 below public floor 100"] })
    expect(value).toEqual(original)
    value.facilityEvidence.documentResponse.headers["x-robots-tag"] = "NOFOLLOW, NOINDEX"
    expect(evaluate(value).failures).toEqual([])
  })

  it("leaves local/public numeric floors to the five-run group and retains publication exemption", () => {
    for (const environment of [local, production]) expect(evaluate(report(), environment)).toEqual({ failures: [], publicAcceptanceFailures: [] })
    const value = report(); value.audits = {}; value.facilityEvidence.documentResponse.headers["x-robots-tag"] = null
    expect(evaluate(value, staging, null)).toEqual({ failures: [], publicAcceptanceFailures: [] })
  })

  it("requires safe evidence of the exact successful main document's noindex header", () => {
    for (const header of [null, "", "index", "none", "not-noindex", "googlebot: noindex", "googlebot: nofollow, noindex"]) {
      const value = report(); value.facilityEvidence.documentResponse.headers["x-robots-tag"] = header
      expect(evaluate(value).failures).toContainEqual(expect.stringContaining("positively prove noindex"))
    }
    for (const replacement of [{ url: `${origin}/wrong` }, { url: "https://gridninja.ai/contact" }, { status: 302 }, { status: 401 }, { status: 500 }, { headers: { "content-type": "application/json", "x-robots-tag": "noindex" } }]) {
      const value = report(); Object.assign(value.facilityEvidence.documentResponse, replacement)
      expect(evaluate(value).failures).toContainEqual(expect.stringContaining("main-document response"))
    }
    const value = report(); value.finalUrl = `${origin}/different`
    expect(evaluate(value).failures).not.toEqual([])
    expect(evaluate({ ...report(), facilityEvidence: {} } as ReturnType<typeof report>).failures).not.toEqual([])
  })

  it("rejects changed Lighthouse version and missing/nonfinite raw scores", () => {
    for (const lighthouseVersion of ["12.6.1", "13.4.0", "13.5.1", "", undefined]) {
      const value = report(); Object.assign(value, { lighthouseVersion })
      expect(evaluate(value).failures).toContainEqual(expect.stringContaining("requires Lighthouse 13.5.0"))
    }
    for (const score of [Number.NaN, Number.POSITIVE_INFINITY, -1, 2, null, undefined]) {
      const value = report(); Object.assign(value.categories.seo, { score })
      expect(evaluate(value).failures).toContainEqual(expect.stringContaining("raw SEO score"))
    }
  })

  it("rejects every dropped, duplicated, unknown, reweighted or regrouped audit reference", () => {
    for (const ref of refs) {
      const value = report(); value.categories.seo.auditRefs = value.categories.seo.auditRefs.filter(item => item.id !== ref.id)
      expect(evaluate(value).failures).not.toEqual([])
    }
    for (const replacement of [{ id: "unknown" }, { weight: 0 }, { weight: 2 }, { group: "other" }]) {
      const value = report(); Object.assign(value.categories.seo.auditRefs[1], replacement)
      expect(evaluate(value).failures).not.toEqual([])
    }
    const duplicate = report(); duplicate.categories.seo.auditRefs[1] = { ...duplicate.categories.seo.auditRefs[0] }
    expect(evaluate(duplicate).failures).not.toEqual([])
    for (const auditRefs of [null, undefined, []]) {
      const value = report(); Object.assign(value.categories.seo, { auditRefs })
      expect(evaluate(value).failures).not.toEqual([])
    }
  })

  it("requires all other weighted applicable audits to pass, never null or error", () => {
    for (const { id } of refs.filter(ref => ref.id !== "is-crawlable" && ref.weight > 0)) {
      for (const replacement of [{ id: "different-audit" }, { score: 0 }, { score: null }, { score: Number.NaN }, { scoreDisplayMode: "error" }, { scoreDisplayMode: "informative" }, { scoreDisplayMode: "numeric" }, { scoreDisplayMode: undefined }, { errorMessage: "failed" }]) {
        const value = report(); Object.assign(value.audits[id], replacement)
        expect(evaluate(value).failures).not.toEqual([])
      }
      const absent = report(); delete absent.audits[id]
      expect(evaluate(absent).failures).not.toEqual([])
    }
    const indexable = report(); indexable.audits["is-crawlable"].score = 1
    expect(evaluate(indexable).failures).not.toEqual([])
    const manual = report(); manual.audits["structured-data"].score = 1
    expect(evaluate(manual).failures).not.toEqual([])
  })

  it("requires the protected exception itself to remain a successful binary crawl-blocking audit", () => {
    for (const replacement of [{ score: null }, { scoreDisplayMode: "notApplicable" }, { scoreDisplayMode: "numeric" }, { scoreDisplayMode: "error" }, { errorMessage: "failed" }]) {
      const value = report(); Object.assign(value.audits["is-crawlable"], replacement)
      expect(evaluate(value).failures).not.toEqual([])
    }
    for (const replacement of [{ scoreDisplayMode: "notApplicable" }, { scoreDisplayMode: "informative" }, { scoreDisplayMode: "binary" }, { errorMessage: "failed" }]) {
      const value = report(); Object.assign(value.audits["structured-data"], replacement)
      expect(evaluate(value).failures).not.toEqual([])
    }
  })

  it("permits only Lighthouse's legitimate NA audits with retained zero-weight refs", () => {
    for (const id of ["canonical", "robots-txt", "image-alt"]) {
      const value = report(); Object.assign(value.audits[id], { score: null, scoreDisplayMode: "notApplicable" })
      expect(evaluate(value).failures).not.toEqual([])
      value.categories.seo.auditRefs.find(ref => ref.id === id)!.weight = 0
      expect(evaluate(value).failures).toEqual([])
      value.audits[id].errorMessage = "audit failed"
      expect(evaluate(value).failures).not.toEqual([])
      delete value.audits[id].errorMessage
      value.audits[id].score = 1
      expect(evaluate(value).failures).not.toEqual([])
    }
    for (const id of ["is-crawlable", "document-title", "meta-description", "http-status-code", "link-text", "crawlable-anchors", "hreflang"]) {
      const value = report(); Object.assign(value.audits[id], { score: null, scoreDisplayMode: "notApplicable" })
      value.categories.seo.auditRefs.find(ref => ref.id === id)!.weight = 0
      expect(evaluate(value).failures).not.toEqual([])
    }
  })

  it("retains the raw public failure when legitimate NA reweighting changes the protected score", () => {
    const value = report()
    for (const id of ["canonical", "robots-txt", "image-alt"]) {
      Object.assign(value.audits[id], { score: null, scoreDisplayMode: "notApplicable" })
      value.categories.seo.auditRefs.find(ref => ref.id === id)!.weight = 0
    }
    value.categories.seo.score = .60
    const original = structuredClone(value)
    expect(evaluate(value)).toEqual({ failures: [], publicAcceptanceFailures: ["/contact: raw SEO 60 below public floor 100"] })
    expect(value).toEqual(original)
  })
})

describe("environment serving and outcome", () => {
  const attestation = { origin, resources: [{ path: "/", kind: "html" }, { path: "/evidence/assessments/demo-01-b/v1.0.0", kind: "html" }, { path: "/_next/static/chunk.js", kind: "asset" }] }
  const pair = () => {
    const receipt = { result: "pass", origin, resources: attestation.resources.map(resource => ({ path: resource.path, contentType: resource.kind === "html" ? "text/html; charset=utf-8" : "application/javascript", robots: resource.kind === "html" ? "noindex, nofollow, noarchive" : null })) }
    return { before: structuredClone(receipt), after: structuredClone(receipt) }
  }
  it("checks every attested HTML route before and after, including the SEO-exempt brief", () => {
    expect(() => assertEnvironmentServing(pair(), staging, attestation)).not.toThrow()
    for (const phase of ["before", "after"] as const) {
      for (const index of [0, 1]) {
        const value = pair(); value[phase].resources[index].robots = null
        expect(() => assertEnvironmentServing(value, staging, attestation)).toThrow("noindex")
      }
      for (const replacement of [{ result: "fail" }, { origin: "https://other.vercel.app" }, { resources: [] }]) {
        const value = pair(); Object.assign(value[phase], replacement)
        expect(() => assertEnvironmentServing(value, staging, attestation)).toThrow()
      }
    }
    expect(() => assertEnvironmentServing({}, staging, attestation)).toThrow()
    expect(() => assertEnvironmentServing(pair(), staging, { ...attestation, origin: "https://other.vercel.app" })).toThrow()
    expect(() => assertEnvironmentServing(null, local, null)).not.toThrow()
    expect(() => assertEnvironmentServing(null, production, null)).not.toThrow()
  })
  it("never marks local/protected passes public-ready and reports every failure", () => {
    expect(qualificationOutcome(local, [])).toEqual({ result: "local-pass", publicReady: false, publicAcceptance: "pending" })
    expect(qualificationOutcome(staging, [])).toEqual({ result: "protected-pass", publicReady: false, publicAcceptance: "pending" })
    expect(qualificationOutcome(production, [])).toEqual({ result: "public-pass", publicReady: true, publicAcceptance: "pass" })
    for (const environment of [local, staging, production]) expect(qualificationOutcome(environment, ["failure"])).toEqual({ result: "fail", publicReady: false, publicAcceptance: environment.name === "public-production" ? "fail" : "pending" })
    expect(() => qualificationOutcome(staging, undefined)).toThrow()
  })
})
