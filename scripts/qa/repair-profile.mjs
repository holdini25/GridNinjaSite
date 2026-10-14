import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { COMMAND_LIMITS, CORRECTION_LIMITS } from "./command-budget.mjs"
import { assertCorrectionEnvironment, assertSupportedCommand } from "./command-contract.mjs"

// A separately admitted repair, never a reset or extension of the v1/v2 ledgers.
export const REPAIR_START = Date.parse("2026-10-11T02:06:13Z")
export const REPAIR_DEADLINE = Date.parse("2026-10-11T04:06:13Z")
export const REPAIR_COORDINATOR = "01a128b5-bd1a-708d-80fb-60a39bbba025"
export const REPAIR_BASELINE = "bbeb94bd98ee76b1aab149ad3b4ce92622e47f01"
export const REPAIR_LIMITS = Object.freeze({ commands: 12, candidates: 1, attemptsPerPhase: 1, windowMs: 7_200_000, maxCommandMs: 3_600_000, logBytesPerStream: 1_048_576 })
export const REPAIR_PHASES = Object.freeze(["unit", "quality", "browser-webkit-mobile", "browser-webkit", "browser-chrome", "browser-chromium", "browser-firefox", "browser-chromium-mobile", "page-performance", "lighthouse", "performance-summary", "headed-visibility"])
export const HEADED_TITLES = Object.freeze([
  "real background tabs defer cinematic acquisition and pause native playback without losing user intent",
  "real background-tab explicit deep link waits past its deadline then activates on foreground",
  "real background-tab visibility defers activation and freezes equipment",
])
export const HEADED_ARGS = Object.freeze(["run", "test:e2e", "--", "tests/e2e/cinematic-visibility.spec.ts", "tests/e2e/facility-visibility.spec.ts", "--project=chrome-stable", "--headed", "--workers=1", "--retries=0", "--reporter=list,json"])
const digest = bytes => createHash("sha256").update(bytes).digest("hex")
const sha = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const nonempty = value => typeof value === "string" && /\S/.test(value)
const identity = value => ({ head: value.head, sourceRevision: value.sourceRevision, qaHarnessRevision: value.qaHarnessRevision })
const validIdentity = value => /^[a-f0-9]{40}$/.test(value?.head ?? "") && sha(value?.sourceRevision) && sha(value?.qaHarnessRevision)

export function validateRepairAuthorization(record) {
  assert.equal(record?.schemaVersion, "gridninja-repair-authorization.v1", "Unknown repair authorization")
  assert.equal(record.id, "premium-civic-repair-01", "Wrong repair scope id")
  assert.equal(record.authorizedBy, "/root", "Repair requires root scope authorization")
  assert.equal(record.coordinatorThreadId, REPAIR_COORDINATOR, "Wrong independent coordinator")
  assert.equal(record.baselineHead, REPAIR_BASELINE, "Wrong repair baseline")
  assert.equal(record.startUtc, "2026-10-11T02:06:13Z", "Repair start is fixed")
  assert.equal(record.deadlineUtc, "2026-10-11T04:06:13Z", "Repair deadline is fixed")
  assert(nonempty(record.userRequest?.text) && nonempty(record.userRequest?.reference), "Repair request and source reference are required")
  assert.deepEqual(record.limits, REPAIR_LIMITS, "Repair limits changed")
  assert.deepEqual(record.phases, REPAIR_PHASES, "Repair phase order changed")
  assert.equal(record.priorBudgets?.length, 2, "Both historical ledgers must be preserved")
  for (const [index, prior] of record.priorBudgets.entries()) {
    assert(nonempty(prior.path) && sha(prior.sha256), "Historical ledger path/hash required")
    assert.equal(prior.attemptCount, index === 0 ? 26 : 6, "Historical command count changed")
    assert(Number.isSafeInteger(prior.deadlineAt), "Historical deadline required")
  }
  return record
}

/** @param {{authorizationPath: string, authorizationSha256: string, admissionPath: string, admissionSha256: string, priorBudgetPath: string}} options */
export async function readRepairAdmission(options) {
  async function pinned(path, expected) {
    assert(sha(expected), "Explicit authorization and admission SHA256 pins are required")
    const bytes = await readFile(path)
    assert(bytes.length <= 64 * 1024, "Oversized repair record")
    assert.equal(digest(bytes), expected, "Repair record hash mismatch")
    return JSON.parse(bytes.toString("utf8"))
  }
  const record = validateRepairAuthorization(await pinned(options.authorizationPath, options.authorizationSha256))
  const historicalPaths = [resolve(options.priorBudgetPath), resolve(dirname(options.priorBudgetPath), "corrections/premium-civic-performance-correction-01/budget.json")]
  for (const [index, prior] of record.priorBudgets.entries()) {
    assert.equal(resolve(prior.path), historicalPaths[index], "Repair must preserve the actual historical ledgers")
    const bytes = await readFile(prior.path), budget = JSON.parse(bytes.toString("utf8"))
    assert.equal(digest(bytes), prior.sha256, "Historical ledger hash changed")
    assert.equal(budget.schemaVersion, `gridninja-command-budget.v${index + 1}`, "Wrong historical ledger version")
    assert.equal(budget.scope, index === 0 ? "premium-civic-upgrade" : "premium-civic-correction", "Wrong historical ledger scope")
    assert.deepEqual(budget.limits, index === 0 ? COMMAND_LIMITS : CORRECTION_LIMITS, "Historical limits changed")
    assert.equal(budget.attempts.length, prior.attemptCount, "Historical attempt count changed")
    assert.equal(budget.deadlineAt, prior.deadlineAt, "Historical deadline changed")
    assert(!budget.attempts.some(attempt => attempt.status === "running"), "Historical command still running")
  }
  const admission = await pinned(options.admissionPath, options.admissionSha256)
  assert.equal(admission?.schemaVersion, "gridninja-repair-admission.v1", "Unknown repair admission")
  assert.equal(admission.decision, "admit", "Independent execution admission is required")
  assert.equal(admission.coordinatorThreadId, REPAIR_COORDINATOR, "Admission must name the independent coordinator")
  assert.equal(admission.authorizationSha256, options.authorizationSha256, "Admission scope hash mismatch")
  assert(nonempty(admission.reviewMessage?.id) && nonempty(admission.reviewMessage?.text), "Actual coordinator admission message id/text required")
  assert.equal(digest(admission.reviewMessage.text), admission.reviewMessage.sha256, "Admission message hash mismatch")
  const admittedAt = Date.parse(admission.admittedAt)
  assert(Number.isFinite(admittedAt) && admittedAt >= REPAIR_START && admittedAt < REPAIR_DEADLINE, "Admission must occur within the fixed repair window")
  assert(validIdentity(admission.candidate) && admission.candidate.head !== REPAIR_BASELINE, "Admission must bind one complete new candidate identity")
  const binding = { authorizationPath: resolve(options.authorizationPath), authorizationSha256: options.authorizationSha256, admissionPath: resolve(options.admissionPath), admissionSha256: options.admissionSha256, coordinatorThreadId: REPAIR_COORDINATOR, reviewMessageId: admission.reviewMessage.id, reviewMessageSha256: admission.reviewMessage.sha256, admittedAt, candidate: identity(admission.candidate), historical: record.priorBudgets }
  return { record, admission, binding }
}

/** @typedef {{sequence:number, phase:string, phaseAttempt:number, startedAt:number, timeoutMs:number, status:string, directory?:string, finishedAt?:number, receiptSha256?:string}} RepairAttempt */
export function newRepairBudget(authorization) {
  return { schemaVersion: "gridninja-command-budget.v3", scope: "premium-civic-repair", authorization: JSON.parse(JSON.stringify(authorization)), startAt: REPAIR_START, deadlineAt: REPAIR_DEADLINE, limits: { ...REPAIR_LIMITS }, attempts: /** @type {RepairAttempt[]} */ ([]) }
}
export function reserveRepairCommand(budget, phase, now, timeoutMs, { authorization, candidate }) {
  assert.equal(budget.schemaVersion, "gridninja-command-budget.v3", "Unknown repair budget")
  assert.equal(budget.scope, "premium-civic-repair", "Wrong repair scope")
  assert.deepEqual(budget.authorization, authorization, "Repair admission binding changed")
  assert.deepEqual(budget.limits, REPAIR_LIMITS, "Repair limits changed")
  assert.equal(budget.startAt, REPAIR_START, "Repair start changed")
  assert.equal(budget.deadlineAt, REPAIR_DEADLINE, "Repair deadline changed")
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= REPAIR_LIMITS.maxCommandMs, "Repair command needs a finite timeout of at most one hour")
  assert(now >= REPAIR_START && now >= authorization.admittedAt && now < REPAIR_DEADLINE, "Outside the fixed admitted repair window")
  assert(budget.attempts.every(attempt => attempt.status === "pass"), "Repair stops after any failed or unfinished command")
  assert(budget.attempts.every(attempt => now >= attempt.startedAt && now >= (attempt.finishedAt ?? attempt.startedAt)), "Repair clock moved backwards")
  assert(budget.attempts.length < REPAIR_LIMITS.commands, "Twelve-command repair allowance exhausted")
  budget.attempts.forEach((attempt, index) => {
    assert.equal(attempt.sequence, index + 1, "Repair sequence changed")
    assert.equal(attempt.phase, REPAIR_PHASES[index], "Repair history order changed")
    assert.equal(attempt.phaseAttempt, 1, "Repair phase was repeated")
  })
  assert.equal(phase, REPAIR_PHASES[budget.attempts.length], "Repair requires the exact next phase; no retries or extra build")
  assert(candidate?.dirty === false && candidate.dirtyPaths?.length === 0 && validIdentity(candidate), "Repair requires a clean frozen candidate")
  assert.deepEqual(identity(candidate), authorization.candidate, "Repair source, harness or commit differs from independent admission")
  const attempt = { sequence: budget.attempts.length + 1, phase, phaseAttempt: 1, startedAt: now, timeoutMs: Math.min(timeoutMs, REPAIR_DEADLINE - now), status: "running" }
  budget.attempts.push(attempt)
  return attempt
}

export function assertRepairCommand(phase, command, args) {
  assert(REPAIR_PHASES.includes(phase), "Phase is outside the repair scope")
  if (phase === "headed-visibility") {
    assert.equal(command, "npm", "Headed repair requires npm")
    assert.deepEqual(args, HEADED_ARGS, "Headed scope is exactly the three native visibility cases")
    return { id: "finite-npm:headed-visibility", cleanupScope: "owned-process-group-and-live-verified-descendants", detachedAfterSuccess: "unsupported; visibility tests close their owned Chrome instances" }
  }
  const contract = assertSupportedCommand(phase, command, args)
  if (phase.startsWith("browser-")) assert(args.includes("--retries=0") && args.includes("--reporter=list,json"), "Repair browser commands require zero retries and a JSON report")
  return contract
}

/** @param {string} phase @param {Record<string,string|undefined>} env */
export function assertRepairEnvironment(phase, env = process.env) {
  if (phase.startsWith("browser-") || phase === "headed-visibility") {
    const external = assertCorrectionEnvironment(phase === "headed-visibility" ? "browser-chrome" : phase, env)
    assert(nonempty(env.PLAYWRIGHT_JSON_OUTPUT_NAME), "Repair browser checks require an explicit fresh JSON report path")
    return { ...external, PLAYWRIGHT_JSON_OUTPUT_NAME: env.PLAYWRIGHT_JSON_OUTPUT_NAME }
  }
  if (["page-performance", "lighthouse", "performance-summary"].includes(phase)) {
    const url = new URL(env.FACILITY_BASE_URL ?? "")
    assert(["http:", "https:"].includes(url.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash, "Repair performance requires a loopback server origin")
    assert.equal(env.FACILITY_PERFORMANCE_MATRIX, "premium-civic", "Repair requires the complete 130-capture matrix")
    assert.equal(env.FACILITY_MEASUREMENT_SCOPE, "qualification", "Repair must retain hardware qualification requirements")
    assert.equal(env.FACILITY_RUNS, "5", "Repair requires five runs")
    assert.equal(env.FACILITY_LIGHTHOUSE_STOP_ON_FAILURE, "1", "Repair must stop at a decisive completed Lighthouse group")
    assert(!env.FACILITY_LIGHTHOUSE_DIAGNOSTIC || env.FACILITY_LIGHTHOUSE_DIAGNOSTIC === "0", "Diagnostic Lighthouse cannot qualify")
    assert(nonempty(env.FACILITY_PERFORMANCE_DIR), "Repair requires a fresh performance directory")
    assert(resolve(env.FACILITY_PERFORMANCE_DIR).startsWith(`${resolve("build/facility")}/`), "Repair performance output must be a dedicated directory under build/facility")
    assert(!env.FACILITY_REPORT_DIR || resolve(env.FACILITY_REPORT_DIR) === resolve(env.FACILITY_PERFORMANCE_DIR), "Summary output must remain with the repair captures")
    return Object.fromEntries(["FACILITY_BASE_URL", "FACILITY_PERFORMANCE_MATRIX", "FACILITY_MEASUREMENT_SCOPE", "FACILITY_RUNS", "FACILITY_LIGHTHOUSE_STOP_ON_FAILURE", "FACILITY_PERFORMANCE_DIR", "FACILITY_REPORT_DIR", "FACILITY_ANGLE", "FACILITY_CHROME_CHANNEL", "FACILITY_HEADED"].filter(key => env[key] !== undefined).map(key => [key, env[key]]))
  }
  return {}
}

export function validateRepairBrowserReport(report, headed = false) {
  const cases = /** @type {Array<{title:string, project:string, status:string, results:Array<{status:string, retry:number}>}>} */ ([])
  const visit = suites => { for (const suite of suites ?? []) { for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) cases.push({ title: spec.title, project: test.projectName, status: test.status, results: test.results ?? [] }); visit(suite.suites) } }
  visit(report.suites)
  assert(cases.length > 0 && !report.errors?.length, "Repair browser report is empty or contains runner errors")
  assert(cases.every(test => test.results.length === 1 && ["passed", "skipped"].includes(test.results[0].status) && test.results[0].retry === 0), "Repair browser report contains a retry, failure or missing result")
  if (headed) {
    assert.deepEqual(cases.map(test => test.title).sort(), [...HEADED_TITLES].sort(), "Headed invocation must contain exactly the three approved cases")
    assert(cases.every(test => test.project === "chrome-stable" && test.results[0].status === "passed"), "All three headed visibility cases must execute and pass")
  }
  return { cases: cases.length, passed: cases.filter(test => test.results[0].status === "passed").length, skipped: cases.filter(test => test.results[0].status === "skipped").length, retries: 0 }
}
