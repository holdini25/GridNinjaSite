import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { platform, arch, release as osRelease } from "node:os"

const execFileAsync = promisify(execFile)

/** Read actual local toolchain and frozen publication bytes, without invoking a
 * provider or mistaking an aggregate source hash for inspectable provenance. */
export async function candidateMetadata(root = ".") {
  const packageBytes = await readFile(join(root, "package.json"))
  const lockBytes = await readFile(join(root, "package-lock.json"))
  const npm = (await execFileAsync("npm", ["--version"], { cwd: root, timeout: 5_000, encoding: "utf8" })).stdout.trim()
  assert(/^\d+\.\d+\.\d+/.test(npm), "Cannot establish actual npm version")
  const base = "src/content/assessment-publications"
  const publications = []
  async function visit(path) {
    for (const entry of (await readdir(join(root, path), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(path, entry.name)
      assert(!entry.isSymbolicLink(), `Publication attestation cannot follow a symbolic link: ${file}`)
      if (entry.isDirectory()) await visit(file)
      else {
        assert(entry.isFile(), `Unsupported publication entry: ${file}`)
        const bytes = await readFile(join(root, file))
        publications.push({ path: file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") })
      }
    }
  }
  await visit(base)
  const registry = publications.find(file => file.path === `${base}/registry.json`)
  assert(registry, "Frozen publication registry is missing")
  return {
    toolchain: { node: process.version, npm, declaredPackageManager: JSON.parse(packageBytes).packageManager ?? null, platform: platform(), arch: arch(), osRelease: osRelease(), packageLockSha256: createHash("sha256").update(lockBytes).digest("hex") },
    publications: { schemaVersion: "gridninja-publication-attestation.v1", registrySha256: registry.sha256, filesSha256: createHash("sha256").update(JSON.stringify(publications)).digest("hex"), files: publications },
  }
}

export const EVIDENCE_STATUSES = ["pass", "fail", "not-run", "blocked", "superseded"]
export const CANDIDATE_GATES = [
  ["source-quality", "engineering", "local"],
  ["unit-invariants", "engineering", "local"],
  ["isolated-database", "engineering", "local"],
  ["production-build", "integration", "local"],
  ["browser-journeys", "experience", "local"],
  ["native-browser", "qa", "local"],
  ["simulator", "qa", "local"],
  ["required-skip-audit", "qa", "local"],
  ["assessment-publication-integrity", "integration", "local"],
  ["assets-mechanics-lifecycle", "runtime", "local"],
  ["visual-review", "design-reviewer", "local"],
  ["performance", "integration", "local"],
  ["security-privacy", "engineering", "local"],
  ["physical-devices", "device-reviewer", "external"],
  ["manual-accessibility", "accessibility-reviewer", "external"],
  ["representative-visitors", "research-owner", "external"],
  ["staging-delivery", "contact-operations", "external"],
  ["deployment-rollback", "deployment-owner", "external"],
  ["production-configured-performance", "integration", "external"],
  ["operational-recovery", "contact-operations", "external"],
  ["editorial-privacy-ownership", "release-owner", "external"],
]
export function createCandidateLedger(identity, settings, createdAt = new Date().toISOString()) {
  assert(identity?.sourceRevision && identity?.buildId, "An attested source revision and production build are required")
  return { schemaVersion: "gridninja-candidate.v1", createdAt, identity, settings,
    gates: CANDIDATE_GATES.map(([id, owner, scope]) => ({ id, owner, scope, status: "not-run", evidence: [], attempts: /** @type {Array<{status: string, evidence: Array<{path: string, sha256: string}>}>} */ ([]), note: scope === "external" ? "Local preparation only; external qualification remains outstanding." : "" })) }
}
export function recordCandidateEvidence(ledger, id, evidence) {
  const gate = ledger.gates.find(entry => entry.id === id)
  assert(gate, `Unknown candidate gate: ${id}`)
  assert(EVIDENCE_STATUSES.includes(evidence.status), "Invalid evidence status")
  assert.deepEqual(evidence.identity, ledger.identity, "Evidence belongs to a different source/build/settings identity")
  assert(evidence.owner?.trim(), "Evidence must name its accountable owner")
  assert(Array.isArray(evidence.evidence), "Evidence references are required")
  if (evidence.status === "pass") assert(evidence.evidence.length > 0 && evidence.evidence.every(item => item.path && /^[a-f0-9]{64}$/.test(item.sha256)), "Passing evidence needs hashed artifacts")
  if (gate.scope === "external" && evidence.status === "pass") assert(ledger.settings.externalActionsAuthorized === true, "External qualification cannot be passed by a local-only candidate")
  if (["fail", "blocked"].includes(gate.status) && evidence.status === "pass") assert(evidence.resolution?.trim(), "A failing/blocked gate needs an explicit resolution before a passing attempt")
  const attempt = JSON.parse(JSON.stringify({ ...evidence, recordedAt: evidence.recordedAt ?? new Date().toISOString(), attempt: gate.attempts.length + 1 }))
  gate.attempts.push(attempt)
  Object.assign(gate, evidence, { id: gate.id, scope: gate.scope, attempts: gate.attempts })
  return ledger
}
/** Test/harness changes invalidate qualification independently of application bytes. */
export async function qaHarnessRevision(root = ".") {
  async function files(path) {
    const entry = await stat(join(root, path)).catch(() => null)
    if (!entry) return []
    if (entry.isFile()) return [path]
    return (await Promise.all((await readdir(join(root, path))).sort().map(name => files(join(path, name))))).flat()
  }
  const config = (await readdir(root)).filter(name => /^(playwright|vitest|lighthouserc|eslint)\./.test(name))
  const paths = (await Promise.all(["scripts", "tests", ".github/workflows", ...config].map(files))).flat().sort()
  const hash = createHash("sha256")
  for (const path of paths) hash.update(path).update("\0").update(await readFile(join(root, path))).update("\0")
  return hash.digest("hex")
}
export async function hashEvidence(path) {
  return { path, sha256: createHash("sha256").update(await readFile(path)).digest("hex") }
}
export function evaluateCandidate(ledger) {
  assert.equal(new Set(ledger.gates.map(gate => gate.id)).size, CANDIDATE_GATES.length, "Missing or duplicated candidate gates")
  for (const [id] of CANDIDATE_GATES) assert(ledger.gates.some(gate => gate.id === id), `Missing gate: ${id}`)
  const unresolved = ledger.gates.filter(gate => gate.status !== "pass")
  return { localReady: !unresolved.some(gate => gate.scope === "local"), publicReady: unresolved.length === 0,
    unresolved: unresolved.map(({ id, owner, scope, status, note }) => ({ id, owner, scope, status, note })) }
}

/** Count final outcomes separately from retries; a flaky first attempt is not a clean pass.
 * @param {any} report
 * @param {{ allowedSkips?: Array<{title: string, project: string, reason: string}>, requiredTitles?: Array<{title: string, project: string}> }} policy
 */
export function auditPlaywrightReport(report, policy = {}) {
  const { allowedSkips = [], requiredTitles = [] } = policy
  const cases = []
  function visit(suites) {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
        const attempts = test.results ?? []
        const final = attempts.at(-1)?.status ?? "missing"
        const reasons = (test.annotations ?? []).filter(item => item.type === "skip").map(item => item.description ?? "")
        cases.push({ title: spec.title, project: test.projectName, final, attempts: attempts.map(item => item.status), reasons })
      }
      visit(suite.suites)
    }
  }
  visit(report.suites)
  const failures = []
  if (!cases.length) failures.push("Browser report contains no executed or skipped cases")
  for (const item of cases) {
    if (item.final === "skipped") {
      if (!allowedSkips.some(rule => rule.title === item.title && rule.project === item.project && item.reasons.includes(rule.reason))) failures.push(`Unapproved skip: ${item.project}: ${item.title}`)
    } else if (item.final !== "passed") failures.push(`Nonpassing case: ${item.project}: ${item.title}: ${item.final}`)
    if (item.attempts.some(status => status !== "passed" && status !== "skipped")) failures.push(`Failed attempt retained: ${item.project}: ${item.title}`)
  }
  for (const requirement of requiredTitles) {
    if (!cases.some(item => item.title === requirement.title && item.project === requirement.project && item.final === "passed")) failures.push(`Missing required execution: ${requirement.project}: ${requirement.title}`)
  }
  if (report.errors?.length) failures.push("Browser report includes runner errors")
  return { result: failures.length ? "fail" : "pass", cases, failures }
}
