import assert from "node:assert/strict"
import { spawn, execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { resolve, join } from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { sourceRevision } from "../facility/performance-contract.mjs"
import { acquireComputeLock } from "../facility/compute-lock.mjs"
import { qaHarnessRevision } from "./candidate-contract.mjs"
import { COMMAND_LIMITS, COMMAND_PHASES, newCommandBudget, reserveCommand } from "./command-budget.mjs"
import { assertSupportedCommand } from "./command-contract.mjs"

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

/** @param {{phase: string, command: string, args?: string[], timeoutMs: number, cwd?: string, stateDirectory: string, snapshot?: typeof commandCandidate, signal?: AbortSignal}} options */
export async function runBoundedCommand({ phase, command, args = [], timeoutMs, cwd = process.cwd(), stateDirectory, snapshot = commandCandidate, signal }) {
  assert(COMMAND_PHASES.includes(phase), "Unknown qualification phase")
  assert(typeof command === "string" && command.length > 0 && args.every(arg => typeof arg === "string") && JSON.stringify([command, ...args]).length <= 8192, "Invalid or oversized command arguments")
  const commandContract = assertSupportedCommand(phase, command, args)
  await mkdir(stateDirectory, { recursive: true })
  const release = await acquireComputeLock("qa-command-runner", { path: join(stateDirectory, "budget.lock"), task: "bounded-application-check" })
  try {
    const budgetPath = join(stateDirectory, "budget.json")
    let budget
    try { budget = JSON.parse(await readFile(budgetPath, "utf8")) } catch (error) { if (error.code !== "ENOENT") throw error; budget = newCommandBudget(Date.now()) }
    const attempt = reserveCommand(budget, phase, Date.now(), timeoutMs)
    const directory = join(stateDirectory, `${String(attempt.sequence).padStart(2, "0")}-${phase}-${attempt.phaseAttempt}`)
    // Reserve before metadata/launch: crashes and spawn failures still consume
    // the attempt, and a stale running record fails closed on the next invocation.
    attempt.directory = directory
    await atomicJson(budgetPath, budget)
    await mkdir(directory)
    let receipt = { ...attempt, directory, command: [command, ...args], commandContract, cwd, before: null, after: null, identityUnchanged: false, qualification: "not-qualified" }
    try {
      receipt.before = await snapshot(cwd)
      const result = await executeOwned(command, args, { cwd, timeoutMs: Math.min(attempt.timeoutMs, budget.deadlineAt - Date.now()), signal })
      const { stdout, stderr, ...outcome } = result
      await writeFile(join(directory, "stdout.log"), stdout, { flag: "wx", mode: 0o600 })
      await writeFile(join(directory, "stderr.log"), stderr, { flag: "wx", mode: 0o600 })
      Object.assign(receipt, outcome, { logs: { stdout: { sha256: hash(stdout), bytes: stdout.length }, stderr: { sha256: hash(stderr), bytes: stderr.length } } })
      receipt.after = await snapshot(cwd)
      receipt.identityUnchanged = ["head", "sourceRevision", "qaHarnessRevision"].every(key => receipt.before[key] === receipt.after[key])
      receipt.status = result.reason === "exit" && result.code === 0 && result.cleanup !== "failed" && receipt.identityUnchanged ? "pass" : "fail"
      receipt.qualification = receipt.status === "pass" && !receipt.before.dirty && !receipt.after.dirty ? "clean-candidate-command" : "provisional-or-failed"
    } catch (error) { receipt.status = "fail"; receipt.error = error.message }
    receipt.finishedAt = Date.now()
    await writeFile(join(directory, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o600 })
    Object.assign(attempt, { status: receipt.status, finishedAt: receipt.finishedAt, receiptSha256: hash(await readFile(join(directory, "receipt.json"))) })
    await atomicJson(budgetPath, budget)
    return receipt
  } finally { await release() }
}

async function main() {
  const [phase, ...arguments_] = process.argv.slice(2)
  const divider = arguments_.indexOf("--")
  assert(divider === 2 && arguments_[0] === "--timeout-ms", "Usage: bounded-command.mjs PHASE --timeout-ms INTEGER -- COMMAND [ARG...]")
  const command = arguments_[divider + 1], args = arguments_.slice(divider + 2)
  const common = (await execFileAsync("git", ["rev-parse", "--git-common-dir"], { timeout: 5_000 })).stdout.trim()
  const stateDirectory = resolve(common, "gridninja-qa/premium-civic-upgrade")
  const controller = new AbortController()
  const interrupt = () => controller.abort()
  process.once("SIGTERM", interrupt); process.once("SIGINT", interrupt)
  try {
    const receipt = await runBoundedCommand({ phase, command, args, timeoutMs: Number(arguments_[1]), stateDirectory, signal: controller.signal })
    console.log(JSON.stringify({ status: receipt.status, qualification: receipt.qualification, phase, attempt: receipt.phaseAttempt, reason: receipt.reason, receipt: join(receipt.directory, "receipt.json") }))
    if (receipt.status !== "pass") process.exitCode = 1
  } finally { process.removeListener("SIGTERM", interrupt); process.removeListener("SIGINT", interrupt) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1 })
