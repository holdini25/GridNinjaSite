import assert from "node:assert/strict"
import { productionQualificationIssues } from "../qa/release-preflight-contract.mjs"

const SCHEMA = "facility-qualification-environment.v1"
const NAMES = ["local", "protected-staging", "public-production"]
// hosted-auth.mjs consumes VERCEL_AUTOMATION_BYPASS_SECRET. Reject the proposed
// facility alias too, so public evidence can never silently inherit either one.
const AUTH_ENV = ["FACILITY_HOSTED_BYPASS_SECRET", "VERCEL_AUTOMATION_BYPASS_SECRET"]

function validateEnvironment(environment) {
  assert(environment && typeof environment === "object", "Missing qualification environment")
  assert.deepEqual(Object.keys(environment).sort(), ["measurementOrigin", "name", "schemaVersion"], "Invalid qualification environment fields")
  assert.equal(environment.schemaVersion, SCHEMA, "Unknown qualification environment schema")
  assert(NAMES.includes(environment.name), "Unknown qualification environment")
  assert.equal(typeof environment.measurementOrigin, "string", "Missing measurement origin")
  const url = new URL(environment.measurementOrigin)
  assert.equal(url.origin, environment.measurementOrigin, "Measurement URL must be a canonical bare origin")
  assert(!url.username && !url.password && !url.search && !url.hash && url.pathname === "/", "Measurement URL must be a bare origin")
  if (environment.name === "local") {
    assert(["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local qualification requires a loopback origin")
  } else if (environment.name === "protected-staging") {
    assert(url.protocol === "https:" && !url.port && /^[a-z0-9][a-z0-9-]*\.vercel\.app$/.test(url.hostname), "Protected staging requires an immutable Vercel HTTPS origin")
  } else {
    assert.equal(environment.measurementOrigin, "https://gridninja.ai", "Public qualification requires https://gridninja.ai")
  }
  return environment
}

/** The attestation/pin files are validated by the serving adapters. Presence
 * here is a prerequisite only, never proof of a deployment or public serving.
 * @param {Record<string, string | undefined>} env
 */
export function qualificationEnvironment(env = process.env) {
  const name = env.FACILITY_QUALIFICATION_ENVIRONMENT ?? "local"
  assert(NAMES.includes(name), "Unknown qualification environment")
  const environment = validateEnvironment({ schemaVersion: SCHEMA, name, measurementOrigin: env.FACILITY_BASE_URL ?? (name === "local" ? "http://localhost:3000" : "") })
  if (name === "local") assert(!env.FACILITY_HOSTED_ATTESTATION_FILE, "Hosted attestation requires an explicit hosted qualification environment")
  if (name !== "local") assert(typeof env.FACILITY_HOSTED_ATTESTATION_FILE === "string" && env.FACILITY_HOSTED_ATTESTATION_FILE.trim(), "Hosted qualification requires FACILITY_HOSTED_ATTESTATION_FILE")
  if (name === "public-production") {
    assert(typeof env.FACILITY_PUBLIC_PRODUCTION_PINS_FILE === "string" && env.FACILITY_PUBLIC_PRODUCTION_PINS_FILE.trim(), "Public qualification requires FACILITY_PUBLIC_PRODUCTION_PINS_FILE")
    for (const key of AUTH_ENV) assert(!env[key], `Public qualification forbids ${key}`)
  }
  return environment
}

export function assertQualificationBuild(environment, identity) {
  validateEnvironment(environment)
  if (environment.name === "local") return
  const issues = productionQualificationIssues(identity?.buildSettings)
  assert.equal(issues.length, 0, `Hosted build is not production-equivalent: ${issues.join(", ")}`)
}

export function assertQualificationEnvironment(actual, expected) {
  validateEnvironment(actual)
  validateEnvironment(expected)
  assert.deepEqual(actual, expected, "Missing or mixed qualification environment")
}

// Pinned to tools/qualification's Lighthouse default-config.js (13.5.0).
// Scoring forces legitimately notApplicable audits to weight 0 while retaining
// their reference. No absent/extra/duplicated reference or arbitrary NA passes.
const SEO_REFS = [
  ["is-crawlable", 93 / 23, "seo-crawl"],
  ["document-title", 1, "seo-content"],
  ["meta-description", 1, "seo-content"],
  ["http-status-code", 1, "seo-crawl"],
  ["link-text", 1, "seo-content"],
  ["crawlable-anchors", 1, "seo-crawl"],
  ["robots-txt", 1, "seo-crawl"],
  ["image-alt", 1, "seo-content"],
  ["hreflang", 1, "seo-content"],
  ["canonical", 1, "seo-content"],
  ["structured-data", 0, undefined],
]
const ALLOWED_NA = new Set(["robots-txt", "image-alt", "canonical"])
// The site's header is generic. A bot-scoped directive is not evidence that the
// protected document is noindex for everyone, even if its later token says so.
const noindex = value => typeof value === "string" && !value.includes(":") && value.split(",").some(part => part.trim().toLowerCase() === "noindex")

/** Numeric SEO floors remain group-median gates for local/public collection.
 * Protected staging instead proves the expected crawl prohibition plus every
 * other applicable weighted SEO audit. The unmodified public score failure is
 * recorded separately; this is never a public SEO pass or a BP exemption. */
export function evaluateEnvironmentSeo(report, { environment, route, seoFloor }) {
  validateEnvironment(environment)
  const failures = [], publicAcceptanceFailures = []
  if (environment.name !== "protected-staging" || seoFloor === null) return { failures, publicAcceptanceFailures }
  assert(Number.isFinite(seoFloor) && seoFloor >= 0 && seoFloor <= 100, "Missing SEO floor")
  const fail = message => failures.push(`${route}: ${message}`)
  const score = report?.categories?.seo?.score
  if (!Number.isFinite(score) || score < 0 || score > 1) fail("Missing valid raw SEO score")
  else if (score * 100 < seoFloor) publicAcceptanceFailures.push(`${route}: raw SEO ${score * 100} below public floor ${seoFloor}`)
  if (report?.lighthouseVersion !== "13.5.0") fail("Protected SEO contract requires Lighthouse 13.5.0")
  const document = report?.facilityEvidence?.documentResponse
  const expectedUrl = `${environment.measurementOrigin}${route}`
  if (report?.finalUrl !== expectedUrl || document?.url !== expectedUrl || document?.status !== 200
    || !/^text\/html(?:\s*;|$)/i.test(document?.headers?.["content-type"] ?? "")) fail("Missing successful exact main-document response")
  if (!noindex(document?.headers?.["x-robots-tag"])) fail("Main-document response must positively prove noindex")
  const refs = report?.categories?.seo?.auditRefs
  if (!Array.isArray(refs) || refs.length !== SEO_REFS.length
    || new Set(refs.map(ref => ref?.id)).size !== SEO_REFS.length
    || refs.some(ref => !SEO_REFS.some(([id]) => id === ref?.id))) fail("Missing or changed complete Lighthouse SEO audit references")
  for (const [id, weight, group] of SEO_REFS) {
    const ref = Array.isArray(refs) ? refs.find(item => item?.id === id) : undefined
    const audit = report?.audits?.[id]
    const validNa = ALLOWED_NA.has(id) && audit?.scoreDisplayMode === "notApplicable" && audit.score === null
    if (!ref || ref.weight !== (validNa ? 0 : weight) || ref.group !== group) fail(`Changed or missing SEO reference ${id}`)
    if (!audit || audit.id !== id || audit.errorMessage) {
      fail(`Missing or invalid SEO audit ${id}`)
    } else if (id === "structured-data") {
      if (audit.score !== null || audit.scoreDisplayMode !== "manual") fail("Changed manual structured-data audit")
    } else if (!validNa && (audit.score !== (id === "is-crawlable" ? 0 : 1) || audit.scoreDisplayMode !== "binary")) {
      fail(`Required ${id} audit did not ${id === "is-crawlable" ? "confirm crawl blocking" : "pass"}`)
    }
  }
  return { failures, publicAcceptanceFailures }
}

/** Additional environment policy only. The caller must also validate serving
 * identity, resource digests and chronology with its hosted/public adapter. */
export function assertEnvironmentServing(pair, environment, attestation) {
  validateEnvironment(environment)
  if (environment.name !== "protected-staging") return
  assert.equal(attestation?.origin, environment.measurementOrigin, "Serving environment differs from attested origin")
  assert(Array.isArray(attestation.resources) && attestation.resources.some(resource => resource.kind === "html"), "Missing attested HTML resources")
  for (const phase of ["before", "after"]) {
    const receipt = pair?.[phase]
    assert.equal(receipt?.result, "pass", `Missing protected ${phase} serving verification`)
    assert.equal(receipt.origin, environment.measurementOrigin, "Serving receipt differs from qualification origin")
    assert(Array.isArray(receipt.resources), "Missing protected serving resources")
    assert.deepEqual(receipt.resources.map(resource => resource.path), attestation.resources.map(resource => resource.path), "Protected serving resource coverage changed")
    for (const [index, resource] of attestation.resources.entries()) {
      if (resource.kind !== "html") continue
      const observed = receipt.resources[index]
      assert(/^text\/html(?:\s*;|$)/i.test(observed.contentType ?? ""), `Protected ${phase} HTML content type missing: ${resource.path}`)
      assert(noindex(observed.robots), `Protected ${phase} HTML must remain noindex: ${resource.path}`)
    }
  }
}

export function qualificationOutcome(environment, failures) {
  validateEnvironment(environment)
  assert(Array.isArray(failures), "Missing qualification failures")
  const passed = failures.length === 0, isPublic = environment.name === "public-production"
  return {
    result: passed ? ({ local: "local-pass", "protected-staging": "protected-pass", "public-production": "public-pass" })[environment.name] : "fail",
    publicReady: isPublic && passed,
    publicAcceptance: isPublic ? passed ? "pass" : "fail" : "pending",
  }
}
