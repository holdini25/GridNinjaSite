import assert from "node:assert/strict"
import { spawn, execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { resolve, join, dirname } from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { sourceRevision } from "../facility/performance-contract.mjs"
import { acquireComputeLock } from "../facility/compute-lock.mjs"
import { qaHarnessRevision } from "./candidate-contract.mjs"
import { COMMAND_LIMITS, COMMAND_PHASES, newCommandBudget, reserveCommand, newCorrectionBudget, reserveCorrectionCommand, validateCorrectionAuthorization } from "./command-budget.mjs"
import { assertSupportedCommand, assertCorrectionEnvironment } from "./command-contract.mjs"
import { REPAIR_PHASES, readRepairAdmission, newRepairBudget, reserveRepairCommand, assertRepairCommand, assertRepairEnvironment, validateRepairBrowserReport } from "./repair-profile.mjs"

const execFileAsync = promisify(execFile)
const hash = value => createHash("sha256").update(value).digest("hex")
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function processTable() {
  const { stdout } = await execFileAsync("ps", ["-axo", "pid=,ppid=,lstart="], { timeout: 1_000, maxBuffer: 2 * 1024 * 1024 })
  return stdout.split("\n").flatMap(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)
    return match ? [{ pid: Number(match[1]), parent: Number(match[2]), started: match[3].trim() }] : []
  })
}
function descendants(table, parent) {
  const owned = new Set([parent]), found = []
  for (let previous = -1; previous !== owned.size;) {
    previous = owned.size
    for (const row of table) if (owned.has(row.parent) && !owned.has(row.pid)) { owned.add(row.pid); found.push(row) }
  }
  return found
}
async function atomicJson(path, value) {
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 })
  await rename(temporary, path)
}
export async function commandCandidate(cwd = process.cwd()) {
  assert.equal(resolve(cwd), process.cwd(), "Candidate hashing must run from the repository root")
  const git = async args => (await execFileAsync("git", args, { cwd, timeout: 5_000, maxBuffer: 2 * 1024 * 1024 })).stdout.trim()
  const status = await git(["status", "--porcelain=v1", "--untracked-files=all"])
  return { head: await git(["rev-parse", "HEAD"]), dirty: Boolean(status), dirtyPaths: status.split("\n").filter(Boolean), sourceRevision: await sourceRevision(), qaHarnessRevision: await qaHarnessRevision(cwd) }
}

/** Load an explicitly hash-pinned root disposition; never alter the original ledger.
 * @param {{dispositionPath: string, dispositionSha256: string, priorBudgetPath: string, candidateEntryPath?: string}} options
 */
export async function readCorrectionDisposition({ dispositionPath, dispositionSha256, priorBudgetPath, candidateEntryPath }) {
  assert(/^[a-f0-9]{64}$/.test(dispositionSha256), "An explicit disposition SHA256 is required")
  const bytes = await readFile(dispositionPath)
  assert(bytes.length <= 64 * 1024, "Oversized correction authorization")
  assert.equal(hash(bytes), dispositionSha256, "Correction disposition hash mismatch")
  const record = validateCorrectionAuthorization(JSON.parse(bytes.toString("utf8")))
  assert.equal(resolve(record.priorBudget.path), resolve(priorBudgetPath), "Correction must bind the original task ledger")
  const priorBytes = await readFile(priorBudgetPath)
  assert.equal(hash(priorBytes), record.priorBudget.sha256, "Prior budget hash mismatch; original ledger must remain unchanged")
  const prior = JSON.parse(priorBytes.toString("utf8"))
  assert.equal(prior.schemaVersion, "gridninja-command-budget.v1", "Correction must preserve a v1 task ledger")
  assert.equal(prior.scope, "premium-civic-upgrade", "Wrong prior task scope")
  assert.deepEqual(prior.limits, COMMAND_LIMITS, "Prior task limits differ")
  assert.equal(prior.deadlineAt, prior.firstInvocationAt + COMMAND_LIMITS.windowMs, "Prior task deadline differs")
  assert.equal(prior.deadlineAt, record.priorBudget.deadlineAt, "Authorized prior deadline differs")
  assert.equal(prior.attempts.length, record.priorBudget.attemptCount, "Authorized prior attempt count differs")
  assert(!prior.attempts.some(attempt => attempt.status === "running"), "Prior task has an unfinished command")
  let candidateEntry = null
  if (candidateEntryPath) {
    const entryBytes = await readFile(candidateEntryPath)
    assert(entryBytes.length <= 16 * 1024, "Oversized candidate entry")
    const entry = JSON.parse(entryBytes.toString("utf8"))
    assert(!Object.hasOwn(entry, "recordSha256"), "Candidate entry hash is computed from its file")
    candidateEntry = { ...entry, recordSha256: hash(entryBytes), recordPath: resolve(candidateEntryPath) }
  }
  return {
    record,
    binding: { id: record.id, dispositionPath: resolve(dispositionPath), dispositionSha256, authorizedBy: record.authorizedBy, userRequestSha256: hash(record.userRequest.text), userRequestReference: record.userRequest.reference, baselineHead: record.baselineHead, priorBudgetPath: resolve(priorBudgetPath), priorBudgetSha256: record.priorBudget.sha256, priorAttemptCount: prior.attempts.length, priorDeadlineAt: prior.deadlineAt },
    candidateEntry,
  }
}

/** POSIX process-group ownership targets only this invocation's child tree.
 * No process-name matching, global kill, shell evaluation, or timeout retries.
 * @param {string} command
 * @param {string[]} args
 * @param {{cwd?: string, timeoutMs: number, signal?: AbortSignal, logLimit?: number, terminateGraceMs?: number, killGraceMs?: number, inspectProcesses?: typeof processTable}} options
 */
export async function executeOwned(command, args, { cwd, timeoutMs, signal, logLimit = COMMAND_LIMITS.logBytesPerStream, terminateGraceMs = 1_000, killGraceMs = 1_000, inspectProcesses = processTable }) {
  assert(process.platform !== "win32", "This owned process-group runner requires POSIX; Windows must use an independently verified tree-cleanup implementation")
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0, "Missing child deadline")
  const logs = { stdout: { chunks: [], saved: 0, total: 0 }, stderr: { chunks: [], saved: 0, total: 0 } }
  const started = Date.now()
  const child = spawn(command, args, { cwd, detached: true, shell: false, stdio: ["ignore", "pipe", "pipe"] })
  const append = stream => chunk => { const log = logs[stream]; log.total += chunk.length; const bytes = chunk.subarray(0, Math.max(0, logLimit - log.saved)); if (bytes.length) { log.chunks.push(bytes); log.saved += bytes.length } }
  child.stdout.on("data", append("stdout")); child.stderr.on("data", append("stderr"))
  const closed = new Promise(resolve => child.once("close", resolve))
  let timer, reason = "exit", stop
  const result = await new Promise(resolve => {
    let resolved = false
    const finish = result => { if (!resolved) { resolved = true; resolve(result) } }
    stop = () => { reason = "interrupted"; finish({ code: null, signal: null }) }
    signal?.addEventListener("abort", stop, { once: true })
    child.once("error", error => { reason = "spawn-error"; finish({ code: null, signal: null, error: error.message }) })
    child.once("exit", (code, signal) => finish({ code, signal }))
    timer = setTimeout(() => { reason = "timeout"; finish({ code: null, signal: null }) }, timeoutMs)
    if (signal?.aborted) stop()
  })
  clearTimeout(timer); signal?.removeEventListener("abort", stop)
  let cleanup = "not-started"
  const groupExists = () => { if (!child.pid) return false; try { process.kill(-child.pid, 0); return true } catch (error) { if (error.code === "ESRCH") return false; throw error } }
  const send = signal => { try { process.kill(-child.pid, signal) } catch (error) { if (error.code !== "ESRCH") throw error } }
  let owned = []
  const cleanupErrors = []
  // Failure to inspect must never bypass termination of the known owned group.
  try { if (child.pid && child.exitCode === null && child.signalCode === null) owned = descendants(await inspectProcesses(), child.pid) }
  catch (error) { cleanupErrors.push(`Descendant inspection unavailable: ${error.message}`) }
  result.cleanupTargets = owned.map(({ pid, started }) => ({ pid, started }))
  const signalDescendants = async signal => {
    try {
      const current = await inspectProcesses()
      for (const row of owned.toReversed()) if (current.some(item => item.pid === row.pid && item.started === row.started)) {
        try { process.kill(row.pid, signal) } catch (error) { if (error.code !== "ESRCH") throw error }
      }
    } catch (error) { cleanupErrors.push(`Descendant cleanup unavailable: ${error.message}`) }
  }
  try {
    // Inspect descendants before terminating the live parent. Chrome-launcher
    // creates its own process group; signal only descendants whose PID and
    // start time still match this owned tree, never similarly named processes.
    if (owned.length) await signalDescendants("SIGTERM")
    if (groupExists()) {
      send("SIGTERM")
      const deadline = Date.now() + terminateGraceMs
      while (groupExists() && Date.now() < deadline) await sleep(20)
      if (owned.length) await signalDescendants("SIGKILL")
      if (groupExists()) send("SIGKILL")
      const killDeadline = Date.now() + killGraceMs
      while (groupExists() && Date.now() < killDeadline) await sleep(20)
      cleanup = groupExists() ? "failed" : "owned-group-stopped"
    } else {
      if (owned.length) await signalDescendants("SIGKILL")
      cleanup = "owned-group-exited"
    }
  } catch (error) { cleanupErrors.push(`Owned group cleanup failed: ${error.message}`) }
  if (cleanupErrors.length) { cleanup = "failed"; result.cleanupError = cleanupErrors.join("; ") }
  // Drain pipe bytes after process exit, but do not let inherited streams
  // extend the deadline forever. Any incomplete drain fails qualification.
  let drainTimer
  const drained = await Promise.race([closed.then(() => true), new Promise(resolve => { drainTimer = setTimeout(() => resolve(false), 1_000) })])
  clearTimeout(drainTimer)
  if (!drained) cleanup = "failed"
  child.stdout.destroy(); child.stderr.destroy()
  return { ...result, reason, cleanup, cleanupScope: "owned-process-group-and-live-verified-descendants", detachedAfterSuccess: "unverified; unsupported by qualification contract", pid: child.pid ?? null, elapsedMs: Date.now() - started, stdout: Buffer.concat(logs.stdout.chunks), stderr: Buffer.concat(logs.stderr.chunks), logBytes: { stdout: logs.stdout.total, stderr: logs.stderr.total }, truncated: { stdout: logs.stdout.total > logLimit, stderr: logs.stderr.total > logLimit } }
}

/** @param {{phase: string, command: string, args?: string[], timeoutMs: number, cwd?: string, stateDirectory: string, snapshot?: typeof commandCandidate, signal?: AbortSignal, correction?: {dispositionPath: string, dispositionSha256: string, priorBudgetPath: string, candidateEntryPath?: string}, repair?: {authorizationPath: string, authorizationSha256: string, admissionPath: string, admissionSha256: string, priorBudgetPath: string}}} options */
export async function runBoundedCommand({ phase, command, args = [], timeoutMs, cwd = process.cwd(), stateDirectory, snapshot = commandCandidate, signal, correction, repair }) {
  assert(!correction || !repair, "Qualification profiles cannot be combined")
  assert((repair ? REPAIR_PHASES : COMMAND_PHASES).includes(phase), "Unknown qualification phase")
  assert(typeof command === "string" && command.length > 0 && args.every(arg => typeof arg === "string") && JSON.stringify([command, ...args]).length <= 8192, "Invalid or oversized command arguments")
  const commandContract = repair ? assertRepairCommand(phase, command, args) : assertSupportedCommand(phase, command, args)
  const correctionEnvironment = correction ? assertCorrectionEnvironment(phase) : null
  const repairEnvironment = repair ? assertRepairEnvironment(phase) : null
  if (repair) await readRepairAdmission(repair) // No state directory/reservation before independent admission.
  await mkdir(stateDirectory, { recursive: true })
  // Corrections share the original reservation lock, preventing concurrent old/new checks.
  const lockDirectory = repair ? dirname(repair.priorBudgetPath) : correction ? dirname(correction.priorBudgetPath) : stateDirectory
  const release = await acquireComputeLock("qa-command-runner", { path: join(lockDirectory, "budget.lock"), task: "bounded-application-check" })
  try {
    const disposition = correction ? await readCorrectionDisposition(correction) : null
    const admission = repair ? await readRepairAdmission(repair) : null
    if (disposition) assert.equal(resolve(stateDirectory), resolve(dirname(correction.priorBudgetPath), "corrections", disposition.record.id), "Correction state directory must derive from its authorization id")
    if (admission) assert.equal(resolve(stateDirectory), resolve(dirname(repair.priorBudgetPath), "repairs", admission.record.id), "Repair state directory must derive from its authorization id")
    const budgetPath = join(stateDirectory, "budget.json")
    let budget
    try { budget = JSON.parse(await readFile(budgetPath, "utf8")) } catch (error) { if (error.code !== "ENOENT") throw error; budget = admission ? newRepairBudget(admission.binding) : disposition ? newCorrectionBudget(Date.now(), disposition.binding) : newCommandBudget(Date.now()) }
    const frozenCandidate = disposition || admission ? await snapshot(cwd) : null
    let repairReportPath = null
    if (admission && repairEnvironment.PLAYWRIGHT_JSON_OUTPUT_NAME) {
      repairReportPath = resolve(cwd, repairEnvironment.PLAYWRIGHT_JSON_OUTPUT_NAME)
      assert(repairReportPath.startsWith(`${resolve(cwd, "build/qa", admission.record.id)}/`), "Repair browser report must be inside its dedicated ignored evidence directory")
      try { await readFile(repairReportPath); assert.fail("Repair browser report already exists; no overwrite or rerun") } catch (error) { if (error.code !== "ENOENT") throw error }
    }
    if (admission && ["page-performance", "lighthouse", "performance-summary"].includes(phase)) {
      if (budget.performanceEnvironment) assert.deepEqual(repairEnvironment, budget.performanceEnvironment, "Repair performance settings/output directory changed")
      else budget.performanceEnvironment = repairEnvironment
    }
    const attempt = admission
      ? reserveRepairCommand(budget, phase, Date.now(), timeoutMs, { authorization: admission.binding, candidate: frozenCandidate })
      : disposition
      ? reserveCorrectionCommand(budget, phase, Date.now(), timeoutMs, { authorization: disposition.binding, candidate: frozenCandidate, candidateEntry: disposition.candidateEntry })
      : reserveCommand(budget, phase, Date.now(), timeoutMs)
    const directory = join(stateDirectory, `${String(attempt.sequence).padStart(2, "0")}-${phase}-${attempt.phaseAttempt}`)
    // Reserve before metadata/launch: crashes and spawn failures still consume
    // the attempt, and a stale running record fails closed on the next invocation.
    attempt.directory = directory
    await atomicJson(budgetPath, budget)
    await mkdir(directory)
    let receipt = { ...attempt, directory, command: [command, ...args], commandContract, cwd, before: null, after: null, identityUnchanged: false, qualification: "not-qualified" }
    if (disposition) receipt.correction = { ...disposition.binding, candidateEntry: disposition.candidateEntry, environment: correctionEnvironment }
    if (admission) receipt.repair = { ...admission.binding, environment: repairEnvironment }
    try {
      receipt.before = frozenCandidate ?? await snapshot(cwd)
      const result = await executeOwned(command, args, { cwd, timeoutMs: Math.min(attempt.timeoutMs, budget.deadlineAt - Date.now()), signal })
      const { stdout, stderr, ...outcome } = result
      await writeFile(join(directory, "stdout.log"), stdout, { flag: "wx", mode: 0o600 })
      await writeFile(join(directory, "stderr.log"), stderr, { flag: "wx", mode: 0o600 })
      Object.assign(receipt, outcome, { logs: { stdout: { sha256: hash(stdout), bytes: stdout.length }, stderr: { sha256: hash(stderr), bytes: stderr.length } } })
      receipt.after = await snapshot(cwd)
      receipt.identityUnchanged = ["head", "sourceRevision", "qaHarnessRevision"].every(key => receipt.before[key] === receipt.after[key])
      if (disposition) {
        receipt.priorBudgetUnchanged = hash(await readFile(correction.priorBudgetPath)) === disposition.binding.priorBudgetSha256
        receipt.dispositionUnchanged = hash(await readFile(correction.dispositionPath)) === disposition.binding.dispositionSha256
      }
      if (admission) {
        const afterAdmission = await readRepairAdmission(repair)
        assert.deepEqual(afterAdmission.binding, admission.binding, "Repair authorization, admission or historical ledgers changed during command")
        receipt.repairBindingUnchanged = true
        if (repairReportPath) {
          const bytes = await readFile(repairReportPath)
          assert(bytes.length <= 32 * 1024 * 1024, "Oversized repair browser report")
          await writeFile(join(directory, "browser-report.json"), bytes, { flag: "wx", mode: 0o600 })
          receipt.browserReport = { path: repairReportPath, sha256: hash(bytes), ...validateRepairBrowserReport(JSON.parse(bytes.toString("utf8")), phase === "headed-visibility") }
        }
      }
      receipt.status = result.reason === "exit" && result.code === 0 && result.cleanup !== "failed" && receipt.identityUnchanged && (!disposition || (receipt.priorBudgetUnchanged && receipt.dispositionUnchanged && receipt.after.dirty === false && receipt.after.dirtyPaths?.length === 0)) && (!admission || (receipt.repairBindingUnchanged && receipt.after.dirty === false && receipt.after.dirtyPaths?.length === 0 && Date.now() < budget.deadlineAt)) ? "pass" : "fail"
      receipt.qualification = receipt.status === "pass" && !receipt.before.dirty && !receipt.after.dirty ? "clean-candidate-command" : "provisional-or-failed"
    } catch (error) { receipt.status = "fail"; receipt.error = error.message }
    receipt.finishedAt = Date.now()
    await writeFile(join(directory, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o600 })
    Object.assign(attempt, { status: receipt.status, finishedAt: receipt.finishedAt, receiptSha256: hash(await readFile(join(directory, "receipt.json"))) })
    await atomicJson(budgetPath, budget)
    return receipt
  } finally { await release() }
}

export function parseCommandArguments(argv) {
  const [phase, ...arguments_] = argv
  const divider = arguments_.indexOf("--")
  assert(divider >= 2 && divider % 2 === 0, "Usage: PHASE --timeout-ms INTEGER [--correction-disposition PATH --disposition-sha256 HASH [--candidate-entry PATH]] -- COMMAND [ARG...]")
  const options = new Map()
  for (let index = 0; index < divider; index += 2) {
    const name = arguments_[index], value = arguments_[index + 1]
    assert(["--timeout-ms", "--correction-disposition", "--disposition-sha256", "--candidate-entry", "--repair-authorization", "--authorization-sha256", "--repair-admission", "--admission-sha256"].includes(name) && !options.has(name) && value, "Unknown, duplicate or empty qualification option")
    options.set(name, value)
  }
  assert(options.has("--timeout-ms"), "Explicit command timeout is required")
  assert(options.has("--correction-disposition") === options.has("--disposition-sha256"), "Correction disposition and hash must be supplied together")
  assert(!options.has("--candidate-entry") || options.has("--correction-disposition"), "Candidate entries require a correction disposition")
  const repairKeys = ["--repair-authorization", "--authorization-sha256", "--repair-admission", "--admission-sha256"]
  assert(!repairKeys.some(key => options.has(key)) || repairKeys.every(key => options.has(key)), "Repair authorization/admission paths and hashes must all be supplied")
  assert(!options.has("--repair-authorization") || !options.has("--correction-disposition"), "Qualification profiles cannot be combined")
  return { phase, command: arguments_[divider + 1], args: arguments_.slice(divider + 2), timeoutMs: Number(options.get("--timeout-ms")), dispositionPath: options.get("--correction-disposition"), dispositionSha256: options.get("--disposition-sha256"), candidateEntryPath: options.get("--candidate-entry"), authorizationPath: options.get("--repair-authorization"), authorizationSha256: options.get("--authorization-sha256"), admissionPath: options.get("--repair-admission"), admissionSha256: options.get("--admission-sha256") }
}

async function main() {
  const parsed = parseCommandArguments(process.argv.slice(2))
  const { phase, command, args, timeoutMs } = parsed
  const common = (await execFileAsync("git", ["rev-parse", "--git-common-dir"], { timeout: 5_000 })).stdout.trim()
  const originalStateDirectory = resolve(common, "gridninja-qa/premium-civic-upgrade")
  const correction = parsed.dispositionPath ? { dispositionPath: parsed.dispositionPath, dispositionSha256: parsed.dispositionSha256, candidateEntryPath: parsed.candidateEntryPath, priorBudgetPath: join(originalStateDirectory, "budget.json") } : undefined
  const disposition = correction ? await readCorrectionDisposition(correction) : null
  const repair = parsed.authorizationPath ? { authorizationPath: parsed.authorizationPath, authorizationSha256: parsed.authorizationSha256, admissionPath: parsed.admissionPath, admissionSha256: parsed.admissionSha256, priorBudgetPath: join(originalStateDirectory, "budget.json") } : undefined
  const admission = repair ? await readRepairAdmission(repair) : null
  const stateDirectory = admission ? join(originalStateDirectory, "repairs", admission.record.id) : disposition ? join(originalStateDirectory, "corrections", disposition.record.id) : originalStateDirectory
  const controller = new AbortController()
  const interrupt = () => controller.abort()
  process.once("SIGTERM", interrupt); process.once("SIGINT", interrupt)
  try {
    const receipt = await runBoundedCommand({ phase, command, args, timeoutMs, stateDirectory, correction, repair, signal: controller.signal })
    console.log(JSON.stringify({ status: receipt.status, qualification: receipt.qualification, phase, attempt: receipt.phaseAttempt, reason: receipt.reason, receipt: join(receipt.directory, "receipt.json") }))
    if (receipt.status !== "pass") process.exitCode = 1
  } finally { process.removeListener("SIGTERM", interrupt); process.removeListener("SIGINT", interrupt) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1 })
