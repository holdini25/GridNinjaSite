// @vitest-environment node
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import { COMMAND_LIMITS, COMMAND_PHASES, newCommandBudget, reserveCommand } from "../../../scripts/qa/command-budget.mjs"
import { executeOwned, runBoundedCommand } from "../../../scripts/qa/bounded-command.mjs"
import { assertSupportedCommand } from "../../../scripts/qa/command-contract.mjs"

const directories: string[] = []
async function temporary() { const path = await mkdtemp(join(tmpdir(), "gridninja-qa-command-")); directories.push(path); return path }
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const identity = { head: "a".repeat(40), dirty: false, dirtyPaths: [], sourceRevision: "b".repeat(64), qaHarnessRevision: "c".repeat(64) }

describe("durable qualification command budget", () => {
  it("counts failures and passes alike, caps phases at three, and refuses abandoned attempts", () => {
    const budget = newCommandBudget(100)
    const first = reserveCommand(budget, "build", 100, 1000)
    expect(() => reserveCommand(budget, "build", 101, 1000)).toThrow("unfinished")
    first.status = "fail"
    reserveCommand(budget, "build", 101, 1000).status = "pass"
    reserveCommand(budget, "build", 102, 1000).status = "fail"
    expect(() => reserveCommand(budget, "build", 103, 1000)).toThrow("Three-attempt")
    expect(budget.attempts.map(attempt => attempt.sequence)).toEqual([1, 2, 3])
    expect(budget.firstInvocationAt).toBe(100)
  })
  it("enforces the shared forty-command and four-hour limits without a phase or source reset", () => {
    const budget = newCommandBudget(100)
    for (let index = 0; index < 40; index++) reserveCommand(budget, COMMAND_PHASES[Math.floor(index / 3)], 101, 5000).status = "pass"
    expect(() => reserveCommand(budget, "audit", 102, 5000)).toThrow("Forty-command")
    const timed = newCommandBudget(100)
    expect(reserveCommand(timed, "unit", timed.deadlineAt - 10, 1000).timeoutMs).toBe(10)
    timed.attempts[0].status = "fail"
    expect(() => reserveCommand(timed, "build", timed.deadlineAt, 1000)).toThrow("Four-hour")
    expect(() => reserveCommand(newCommandBudget(100), "build", 99, 1000)).toThrow("backwards")
    expect(() => reserveCommand(newCommandBudget(100), "invented-phase", 100, 1000)).toThrow("Unknown")
    expect(() => reserveCommand(newCommandBudget(100), "build", 100, Infinity)).toThrow("finite")
    const changed = newCommandBudget(100); changed.limits.commands = 41
    expect(() => reserveCommand(changed, "build", 100, 1000)).toThrow("limits changed")
  })
  it("preserves bounded logs and receipts; a command changing source cannot produce a passing qualification", async () => {
    const directory = await temporary()
    await writeFile(join(directory, "package.json"), JSON.stringify({ scripts: { "test:unit": "node -e \"process.stdout.write('check complete')\"" } }))
    let snapshots = 0
    const result = await runBoundedCommand({ phase: "unit", command: "npm", args: ["run", "test:unit"], cwd: directory, timeoutMs: 2000, stateDirectory: directory, snapshot: async () => ({ ...identity, sourceRevision: ++snapshots === 1 ? identity.sourceRevision : "d".repeat(64) }) })
    expect(result.status).toBe("fail")
    expect(result.identityUnchanged).toBe(false)
    expect(await readFile(join(result.directory, "stdout.log"), "utf8")).toContain("check complete")
    const budget = JSON.parse(await readFile(join(directory, "budget.json"), "utf8"))
    expect(budget.attempts).toHaveLength(1)
    expect(budget.attempts[0].receiptSha256).toMatch(/^[a-f0-9]{64}$/)
    const next = await runBoundedCommand({ phase: "unit", command: "npm", args: ["run", "test:unit"], cwd: directory, timeoutMs: 2000, stateDirectory: directory, snapshot: async () => ({ ...identity, dirty: true }) })
    expect(next.phaseAttempt).toBe(2)
    expect(next.status).toBe("pass")
    expect(next.qualification).toBe("provisional-or-failed")
    expect((JSON.parse(await readFile(join(directory, "budget.json"), "utf8"))).firstInvocationAt).toBe(budget.firstInvocationAt)
  })
  it("rejects unsupported normal-exit detached-child launchers before they can run", async () => {
    const directory = await temporary(), marker = join(directory, "launched")
    const stub = `require('node:fs').writeFileSync(${JSON.stringify(marker)},'launched');const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});c.unref();process.exit(0)`
    await expect(runBoundedCommand({ phase: "unit", command: process.execPath, args: ["-e", stub], timeoutMs: 1000, stateDirectory: directory, snapshot: async () => identity })).rejects.toThrow("Unsupported cleanup contract")
    await expect(access(marker)).rejects.toThrow()
    await expect(access(join(directory, "budget.json"))).rejects.toThrow()
    expect(() => assertSupportedCommand("build", "npm", ["run", "start"])).toThrow("Unsupported command")
    expect(() => assertSupportedCommand("visual-acceptance", "npm", ["run", "build"])).toThrow("no reviewed finite command")
    expect(assertSupportedCommand("browser-webkit", "npm", ["run", "test:e2e", "--", "--project=webkit-desktop", "--workers=1", "--retries=0", "--reporter=list,json"]).cleanupScope).toBe("owned-process-group-and-live-verified-descendants")
    expect(() => assertSupportedCommand("browser-webkit", "npm", ["run", "test:e2e", "--", "--project=chromium-desktop", "--workers=1"])).toThrow("mismatched")
  })
})

describe("owned finite child lifetime", () => {
  it("terminates an unresponsive child without waiting indefinitely and retains truncated output evidence", async () => {
    const result = await executeOwned(process.execPath, ["-e", "process.on('SIGTERM',()=>{});process.stdout.write('x'.repeat(10000));setInterval(()=>{},1000)"], { timeoutMs: 150, terminateGraceMs: 50, killGraceMs: 1000, logLimit: 100 })
    expect(result.reason).toBe("timeout")
    expect(result.cleanup).not.toBe("failed")
    expect(result.elapsedMs).toBeLessThan(2000)
    expect(result.stdout.length).toBe(100)
    expect(result.logBytes.stdout).toBe(10000)
    expect(result.truncated.stdout).toBe(true)
    expect(() => process.kill(result.pid!, 0)).toThrow()
  })
  it("cleans owned descendants including detached groups and treats spawn errors as failures", async () => {
    const result = await executeOwned(process.execPath, ["-e", "const{spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',detached:true});console.log(c.pid);setInterval(()=>{},1000)"], { timeoutMs: 150, terminateGraceMs: 100, killGraceMs: 1000 })
    expect(result.reason).toBe("timeout")
    expect(result.cleanup).not.toBe("failed")
    const descendant = Number(result.stdout.toString().trim())
    expect(descendant).toBeGreaterThan(0)
    expect(() => process.kill(descendant, 0)).toThrow()
    const missing = await executeOwned("/no/such/gridninja-command", [], { timeoutMs: 1000 })
    expect(missing.reason).toBe("spawn-error")
    expect(missing.error).toMatch(/ENOENT/)
  })
  it("records explicit interruption and never waits beyond the finite deadline", async () => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 100)
    const result = await executeOwned(process.execPath, ["-e", "setInterval(()=>{},1000)"], { timeoutMs: 2000, signal: controller.signal })
    expect(result.reason).toBe("interrupted")
    expect(result.cleanup).not.toBe("failed")
    expect(COMMAND_LIMITS.windowMs).toBe(14_400_000)
  })
  it("always terminates its known process group when descendant inspection fails and fails cleanup qualification", async () => {
    const result = await executeOwned(process.execPath, ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { timeoutMs: 150, terminateGraceMs: 50, killGraceMs: 1000, inspectProcesses: async () => { throw new Error("inspection fixture unavailable") } })
    expect(result.reason).toBe("timeout")
    expect(result.cleanup).toBe("failed")
    expect(result.cleanupError).toContain("inspection fixture unavailable")
    expect(() => process.kill(result.pid!, 0)).toThrow()
    expect(result.elapsedMs).toBeLessThan(2000)
  })
})
