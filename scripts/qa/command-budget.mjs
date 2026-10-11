import assert from "node:assert/strict"
import { isCandidateBuildPhase } from "./command-contract.mjs"

export const COMMAND_LIMITS = Object.freeze({ commands: 40, attemptsPerPhase: 3, windowMs: 4 * 60 * 60 * 1000, maxCommandMs: 60 * 60 * 1000, logBytesPerStream: 1024 * 1024 })
export const COMMAND_PHASES = Object.freeze(["quality", "brand", "lint", "typecheck", "unit", "integration", "build", "browser-chrome", "browser-chromium", "browser-firefox", "browser-webkit", "browser-chromium-mobile", "browser-webkit-mobile", "seo", "seo-smoke", "lighthouse", "page-performance", "performance-summary", "facility-browser", "audit", "publication-integrity", "visual-acceptance", "skip-audit"])
export function newCommandBudget(now) {
  return { schemaVersion: "gridninja-command-budget.v1", scope: "premium-civic-upgrade", firstInvocationAt: now, deadlineAt: now + COMMAND_LIMITS.windowMs, limits: /** @type {Record<string, number>} */ ({ ...COMMAND_LIMITS }), attempts: /** @type {Array<{ sequence: number, phase: string, phaseAttempt: number, startedAt: number, timeoutMs: number, status: string, directory?: string, finishedAt?: number, receiptSha256?: string }>} */ ([]) }
}
export function reserveCommand(budget, phase, now, timeoutMs) {
  assert.equal(budget.schemaVersion, "gridninja-command-budget.v1", "Unknown command budget")
  assert.equal(budget.scope, "premium-civic-upgrade", "Wrong task scope")
  assert.deepEqual(budget.limits, COMMAND_LIMITS, "Budget limits changed; explicit root disposition is required")
  assert.equal(budget.deadlineAt, budget.firstInvocationAt + COMMAND_LIMITS.windowMs, "Budget window changed")
  assert(COMMAND_PHASES.includes(phase), "Unknown qualification phase")
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= COMMAND_LIMITS.maxCommandMs, "A finite command deadline of at most one hour is required")
  assert(now >= budget.firstInvocationAt, "Clock moved backwards; disposition required")
  assert(!budget.attempts.some(attempt => attempt.status === "running"), "An unfinished command requires owner inspection and documented disposition")
  assert(now < budget.deadlineAt, "Four-hour task window exhausted; explicit root disposition required")
  assert(budget.attempts.length < COMMAND_LIMITS.commands, "Forty-command task budget exhausted; explicit root disposition required")
  const phaseAttempt = budget.attempts.filter(attempt => attempt.phase === phase).length + 1
  assert(phaseAttempt <= COMMAND_LIMITS.attemptsPerPhase, "Three-attempt phase budget exhausted; explicit root disposition required")
  const attempt = { sequence: budget.attempts.length + 1, phase, phaseAttempt, startedAt: now, timeoutMs: Math.min(timeoutMs, budget.deadlineAt - now), status: "running" }
  budget.attempts.push(attempt)
  return attempt
}

// Additive authorization only. The original v1 profile and ledger remain immutable.
export const CORRECTION_LIMITS = Object.freeze({ commands: 20, attemptsPerPhase: 2, windowMs: 2 * 60 * 60 * 1000, maxCommandMs: 60 * 60 * 1000, logBytesPerStream: 1024 * 1024, candidateBuilds: 2 })
export const CORRECTION_BASELINE_HEAD = "6a43b307397083cfb8c0a49761d10bb6443fe336"
const sha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const commit = value => typeof value === "string" && /^[a-f0-9]{40}$/.test(value)
const nonempty = value => typeof value === "string" && /\S/.test(value)

/** @typedef {{head: string, sourceRevision: string, qaHarnessRevision: string}} CorrectionIdentity */
/** @typedef {{schemaVersion: string, authorizedBy: string, recordedAt: string, reason: string, dispositionSha256: string, priorCandidateHead: string, candidate: CorrectionIdentity, recordSha256: string, recordPath?: string}} CorrectionEntry */
/** @typedef {{sequence: number, phase: string, phaseAttempt: number, candidateSequence: number, candidateHead: string, startedAt: number, timeoutMs: number, status: string, directory?: string, finishedAt?: number, receiptSha256?: string}} CorrectionAttempt */

export function validateCorrectionAuthorization(record) {
  assert.equal(record?.schemaVersion, "gridninja-correction-authorization.v1", "Unknown correction authorization")
  assert(typeof record.id === "string" && /^[a-z][a-z0-9-]{0,79}$/.test(record.id), "Invalid correction id")
  assert.equal(record.authorizedBy, "/root", "Correction requires explicit root authorization")
  assert(Number.isFinite(Date.parse(record.authorizedAt)), "Correction authorization timestamp is required")
  assert(nonempty(record.userRequest?.text) && nonempty(record.userRequest?.reference), "Exact user request and source reference are required")
  assert.equal(record.baselineHead, CORRECTION_BASELINE_HEAD, "Correction baseline commit differs from the authorized failed candidate")
  assert(nonempty(record.priorBudget?.path) && sha256(record.priorBudget?.sha256), "Prior budget path and hash are required")
  assert(Number.isSafeInteger(record.priorBudget.attemptCount) && record.priorBudget.attemptCount >= 0, "Prior attempt count is required")
  assert(Number.isSafeInteger(record.priorBudget.deadlineAt), "Prior deadline is required")
  assert.deepEqual(record.limits, CORRECTION_LIMITS, "Correction limits differ from the reviewed allowance")
  return record
}

export function newCorrectionBudget(now, authorization) {
  assert(sha256(authorization?.dispositionSha256) && sha256(authorization?.priorBudgetSha256) && sha256(authorization?.userRequestSha256), "Correction binding hashes are required")
  assert(commit(authorization.baselineHead), "Correction baseline binding is required")
  return { schemaVersion: "gridninja-command-budget.v2", scope: "premium-civic-correction", authorization: JSON.parse(JSON.stringify(authorization)), firstInvocationAt: now, deadlineAt: now + CORRECTION_LIMITS.windowMs, limits: { ...CORRECTION_LIMITS }, candidates: /** @type {Array<CorrectionIdentity & {sequence: number, boundAt: number, entry: CorrectionEntry | null}>} */ ([]), attempts: /** @type {CorrectionAttempt[]} */ ([]) }
}

export function reserveCorrectionCommand(budget, phase, now, timeoutMs, { authorization, candidate, candidateEntry = /** @type {CorrectionEntry | null} */ (null) }) {
  assert.equal(budget.schemaVersion, "gridninja-command-budget.v2", "Unknown correction budget")
  assert.equal(budget.scope, "premium-civic-correction", "Wrong correction scope")
  assert.deepEqual(budget.authorization, authorization, "Correction authorization binding changed")
  assert.deepEqual(budget.limits, CORRECTION_LIMITS, "Correction limits changed")
  assert.equal(budget.deadlineAt, budget.firstInvocationAt + CORRECTION_LIMITS.windowMs, "Correction window changed")
  assert(COMMAND_PHASES.includes(phase), "Unknown qualification phase")
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= CORRECTION_LIMITS.maxCommandMs, "A finite correction command deadline of at most one hour is required")
  assert(now >= budget.firstInvocationAt, "Clock moved backwards; disposition required")
  assert(!budget.attempts.some(attempt => attempt.status === "running"), "An unfinished correction command requires documented disposition")
  assert(now < budget.deadlineAt, "Two-hour correction window exhausted")
  assert(budget.attempts.length < CORRECTION_LIMITS.commands, "Twenty-command correction allowance exhausted")
  const phaseAttempt = budget.attempts.filter(attempt => attempt.phase === phase).length + 1
  assert(phaseAttempt <= CORRECTION_LIMITS.attemptsPerPhase, "Two-attempt correction phase allowance exhausted")
  if (isCandidateBuildPhase(phase)) assert(budget.attempts.filter(attempt => isCandidateBuildPhase(attempt.phase)).length < CORRECTION_LIMITS.candidateBuilds, "Two candidate build attempts exhausted (quality and build combined)")
  assert(candidate?.dirty === false && candidate.dirtyPaths?.length === 0, "Correction commands require a clean frozen candidate")
  assert(commit(candidate.head) && sha256(candidate.sourceRevision) && sha256(candidate.qaHarnessRevision), "Complete correction candidate identity is required")
  assert.notEqual(candidate.head, authorization.baselineHead, "Correction candidate must differ from the failed baseline")
  const identity = { head: candidate.head, sourceRevision: candidate.sourceRevision, qaHarnessRevision: candidate.qaHarnessRevision }
  const previous = budget.candidates.at(-1)
  const sameCandidate = previous && ["head", "sourceRevision", "qaHarnessRevision"].every(key => previous[key] === identity[key])
  let registered = previous
  if (!sameCandidate) {
    assert(budget.candidates.length < CORRECTION_LIMITS.candidateBuilds, "Two correction candidate identities exhausted")
    if (previous) {
      assert.equal(candidateEntry?.schemaVersion, "gridninja-correction-candidate.v1", "Changed candidate requires an explicit candidate entry")
      assert.equal(candidateEntry.authorizedBy, "/root", "Candidate entry requires root authorization")
      assert(nonempty(candidateEntry.reason) && Number.isFinite(Date.parse(candidateEntry.recordedAt)), "Candidate entry reason and timestamp are required")
      assert.equal(candidateEntry.dispositionSha256, authorization.dispositionSha256, "Candidate entry disposition hash mismatch")
      assert.equal(candidateEntry.priorCandidateHead, previous.head, "Candidate entry prior commit mismatch")
      assert.notEqual(identity.head, previous.head, "Changed source requires a new committed candidate")
      assert.deepEqual(candidateEntry.candidate, identity, "Candidate entry does not match the frozen identity")
      assert(sha256(candidateEntry.recordSha256), "Candidate entry file hash is required")
    } else assert.equal(candidateEntry, null, "First candidate binds at first launch; no replacement entry is accepted")
    registered = { ...identity, sequence: budget.candidates.length + 1, boundAt: now, entry: previous ? JSON.parse(JSON.stringify(candidateEntry)) : null }
  } else assert.equal(candidateEntry, null, "Replacement entry cannot be reused for an unchanged candidate")
  const attempt = { sequence: budget.attempts.length + 1, phase, phaseAttempt, candidateSequence: registered.sequence, candidateHead: identity.head, startedAt: now, timeoutMs: Math.min(timeoutMs, budget.deadlineAt - now), status: "running" }
  if (!sameCandidate) budget.candidates.push(registered)
  budget.attempts.push(attempt)
  return attempt
}
