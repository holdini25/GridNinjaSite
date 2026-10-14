// @vitest-environment node
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { COMMAND_LIMITS, CORRECTION_LIMITS } from "../../../scripts/qa/command-budget.mjs"
import { parseCommandArguments, runBoundedCommand } from "../../../scripts/qa/bounded-command.mjs"
import { HEADED_ARGS, HEADED_TITLES, REPAIR_BASELINE, REPAIR_COORDINATOR, REPAIR_DEADLINE, REPAIR_LIMITS, REPAIR_PHASES, REPAIR_START, assertRepairCommand, assertRepairEnvironment, newRepairBudget, readRepairAdmission, reserveRepairCommand, validateRepairAuthorization, validateRepairBrowserReport } from "../../../scripts/qa/repair-profile.mjs"

const dirs: string[] = []
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const candidate = { head: "a".repeat(40), sourceRevision: "b".repeat(64), qaHarnessRevision: "c".repeat(64), dirty: false, dirtyPaths: [] }
const identity = { head: candidate.head, sourceRevision: candidate.sourceRevision, qaHarnessRevision: candidate.qaHarnessRevision }
const binding = { admittedAt: REPAIR_START, candidate: identity, authorizationSha256: "d".repeat(64), admissionSha256: "e".repeat(64) }
const options = { authorization: binding, candidate }

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "gridninja-repair-")); dirs.push(directory)
  const priorBudgetPath = join(directory, "budget.json")
  const priorBudgets = []
  for (const [index, path] of [priorBudgetPath, join(directory, "corrections/premium-civic-performance-correction-01/budget.json")].entries()) {
    const bytes = JSON.stringify({ schemaVersion: `gridninja-command-budget.v${index + 1}`, scope: index ? "premium-civic-correction" : "premium-civic-upgrade", limits: index ? CORRECTION_LIMITS : COMMAND_LIMITS, deadlineAt: 123 + index, attempts: Array.from({ length: index ? 6 : 26 }, () => ({ status: "fail" })) })
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes)
    priorBudgets.push({ path, sha256: hash(bytes), deadlineAt: 123 + index, attemptCount: index ? 6 : 26 })
  }
  const record = { schemaVersion: "gridninja-repair-authorization.v1", id: "premium-civic-repair-01", authorizedBy: "/root", coordinatorThreadId: REPAIR_COORDINATOR, baselineHead: REPAIR_BASELINE, startUtc: "2026-10-11T02:06:13Z", deadlineUtc: "2026-10-11T04:06:13Z", userRequest: { text: "Explicit bounded repair fixture", reference: "test fixture" }, limits: { ...REPAIR_LIMITS }, phases: [...REPAIR_PHASES], priorBudgets }
  const authorizationPath = join(directory, "authorization.json"), authorizationBytes = JSON.stringify(record), authorizationSha256 = hash(authorizationBytes)
  await writeFile(authorizationPath, authorizationBytes)
  const text = "Fixture coordinator reviewed and admits this exact candidate within the fixed scope."
  const admission = { schemaVersion: "gridninja-repair-admission.v1", decision: "admit", coordinatorThreadId: REPAIR_COORDINATOR, authorizationSha256, admittedAt: new Date(REPAIR_START).toISOString(), reviewMessage: { id: "fixture-message", text, sha256: hash(text) }, candidate: identity }
  const admissionPath = join(directory, "admission.json"), admissionBytes = JSON.stringify(admission)
  await writeFile(admissionPath, admissionBytes)
  return { directory, record, admission, repair: { authorizationPath, authorizationSha256, admissionPath, admissionSha256: hash(admissionBytes), priorBudgetPath }, stateDirectory: join(directory, "repairs/premium-civic-repair-01") }
}

describe("fixed independently admitted repair", () => {
  it("requires hash-pinned actual admission and both unchanged historical ledgers", async () => {
    const f = await fixture(), loaded = await readRepairAdmission(f.repair)
    expect(loaded.binding.candidate).toEqual(identity)
    expect(loaded.binding.historical.map((p: { attemptCount: number }) => p.attemptCount)).toEqual([26, 6])
    await expect(readRepairAdmission({ ...f.repair, admissionSha256: "0".repeat(64) })).rejects.toThrow("record hash")
    await expect(readRepairAdmission({ ...f.repair, authorizationSha256: "0".repeat(64) })).rejects.toThrow("record hash")
    for (const change of [{ decision: "pending" }, { coordinatorThreadId: "other" }, { authorizationSha256: "0".repeat(64) }, { admittedAt: new Date(REPAIR_DEADLINE).toISOString() }, { reviewMessage: { ...f.admission.reviewMessage, text: "changed" } }]) {
      const bytes = JSON.stringify({ ...f.admission, ...change }); await writeFile(f.repair.admissionPath, bytes)
      await expect(readRepairAdmission({ ...f.repair, admissionSha256: hash(bytes) })).rejects.toThrow()
    }
    await writeFile(f.repair.admissionPath, JSON.stringify(f.admission))
    for (const p of f.record.priorBudgets) {
      const bytes = await readFile(p.path); await writeFile(p.path, Buffer.concat([bytes, Buffer.from("\n")]))
      await expect(readRepairAdmission(f.repair)).rejects.toThrow("Historical ledger hash")
      await writeFile(p.path, bytes)
    }
    expect(() => validateRepairAuthorization({ ...f.record, limits: { ...REPAIR_LIMITS, commands: 13 } })).toThrow("limits changed")
    expect(() => validateRepairAuthorization({ ...f.record, deadlineUtc: "2026-10-11T05:06:13Z" })).toThrow("deadline is fixed")
  })

  it("allows exactly the ordered twelve phases once, with no extra build or candidate", () => {
    const budget = newRepairBudget(binding)
    expect(() => reserveRepairCommand(budget, "quality", REPAIR_START, 1000, options)).toThrow("exact next phase")
    for (const [index, phase] of REPAIR_PHASES.entries()) {
      const attempt = reserveRepairCommand(budget, phase, REPAIR_START + index, 1000, options)
      expect(attempt.phaseAttempt).toBe(1); attempt.status = "pass"
    }
    expect(budget.attempts).toHaveLength(12)
    expect(() => reserveRepairCommand(budget, "quality", REPAIR_START + 20, 1000, options)).toThrow("Twelve-command")
    for (const changed of [{ ...candidate, head: "f".repeat(40) }, { ...candidate, sourceRevision: "f".repeat(64) }, { ...candidate, qaHarnessRevision: "f".repeat(64) }, { ...candidate, dirty: true }, { ...candidate, dirtyPaths: ["?? changed"] }]) {
      expect(() => reserveRepairCommand(newRepairBudget(binding), "unit", REPAIR_START, 1000, { ...options, candidate: changed })).toThrow(/candidate|admission/)
    }
    expect(() => reserveRepairCommand(newRepairBudget(binding), "unit", REPAIR_START, 1000, { ...options, authorization: { ...binding, admissionSha256: "0".repeat(64) } })).toThrow("binding changed")
  })

  it("stops after every non-pass and clips to the original deadline even when starting late", () => {
    for (const status of ["running", "fail", "interrupted", "timeout"]) {
      const budget = newRepairBudget(binding)
      reserveRepairCommand(budget, "unit", REPAIR_START, 1000, options).status = status
      expect(() => reserveRepairCommand(budget, "quality", REPAIR_START + 1, 1000, options)).toThrow("stops after")
    }
    expect(reserveRepairCommand(newRepairBudget(binding), "unit", REPAIR_DEADLINE - 10, 1000, options).timeoutMs).toBe(10)
    for (const now of [REPAIR_START - 1, REPAIR_DEADLINE]) expect(() => reserveRepairCommand(newRepairBudget(binding), "unit", now, 1000, options)).toThrow("fixed admitted")
    for (const timeout of [Infinity, 0, 3_600_001]) expect(() => reserveRepairCommand(newRepairBudget(binding), "unit", REPAIR_START, timeout, options)).toThrow("finite timeout")
    const changed = newRepairBudget(binding); changed.deadlineAt++
    expect(() => reserveRepairCommand(changed, "unit", REPAIR_START, 1000, options)).toThrow("deadline changed")
  })

  it("requires serial zero-retry full projects and limits headed execution to the exact three cases", () => {
    const args = ["run", "test:e2e", "--", "--project=webkit-mobile", "--workers=1", "--retries=0", "--reporter=list,json"]
    expect(assertRepairCommand("browser-webkit-mobile", "npm", args).id).toBe("finite-npm:browser-webkit-mobile")
    expect(() => assertRepairCommand("browser-webkit-mobile", "npm", args.filter(v => v !== "--retries=0"))).toThrow("zero retries")
    expect(() => assertRepairCommand("browser-webkit-mobile", "npm", [...args, "--grep=fast"])).toThrow()
    expect(assertRepairCommand("headed-visibility", "npm", [...HEADED_ARGS]).id).toBe("finite-npm:headed-visibility")
    expect(() => assertRepairCommand("headed-visibility", "npm", HEADED_ARGS.filter(v => v !== "tests/e2e/facility-visibility.spec.ts"))).toThrow("exactly")
    expect(() => assertRepairCommand("build", "npm", ["run", "build"])).toThrow("outside")
    expect(() => assertRepairEnvironment("headed-visibility", {})).toThrow("PREBUILT")
    const env = { PLAYWRIGHT_PREBUILT: "1", PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3101", PLAYWRIGHT_JSON_OUTPUT_NAME: "build/qa/premium-civic-repair-01/headed.json" }
    expect(assertRepairEnvironment("headed-visibility", env)).toEqual(env)
    const perf = { FACILITY_BASE_URL: "http://127.0.0.1:3101", FACILITY_PERFORMANCE_MATRIX: "premium-civic", FACILITY_MEASUREMENT_SCOPE: "qualification", FACILITY_RUNS: "5", FACILITY_LIGHTHOUSE_STOP_ON_FAILURE: "1", FACILITY_PERFORMANCE_DIR: "build/facility/repair-01" }
    expect(assertRepairEnvironment("lighthouse", perf)).toEqual(perf)
    expect(() => assertRepairEnvironment("lighthouse", { ...perf, FACILITY_LIGHTHOUSE_STOP_ON_FAILURE: "0" })).toThrow("decisive")
    expect(() => assertRepairEnvironment("lighthouse", { ...perf, FACILITY_LIGHTHOUSE_DIAGNOSTIC: "1" })).toThrow("Diagnostic")
  })

  it("does not treat missing, skipped, retried or failed headed cases as qualification", () => {
    const report = { suites: [{ specs: HEADED_TITLES.map(title => ({ title, tests: [{ projectName: "chrome-stable", status: "expected", results: [{ status: "passed", retry: 0 }] }] })) }] }
    expect(validateRepairBrowserReport(report, true)).toEqual({ cases: 3, passed: 3, skipped: 0, retries: 0 })
    const skipped = structuredClone(report); skipped.suites[0].specs[0].tests[0].results[0].status = "skipped"
    expect(() => validateRepairBrowserReport(skipped, true)).toThrow("execute and pass")
    const retry = structuredClone(report); retry.suites[0].specs[0].tests[0].results.push({ status: "passed", retry: 1 })
    expect(() => validateRepairBrowserReport(retry, true)).toThrow("retry")
    const missing = structuredClone(report); missing.suites[0].specs.pop()
    expect(() => validateRepairBrowserReport(missing, true)).toThrow("exactly")
  })

  it("requires all four CLI pins and rejects mixed profiles or arbitrary state paths", () => {
    const args = ["unit", "--timeout-ms", "1000", "--repair-authorization", "scope.json", "--authorization-sha256", "a".repeat(64), "--repair-admission", "admission.json", "--admission-sha256", "b".repeat(64)]
    expect(parseCommandArguments([...args, "--", "npm", "run", "test:unit"]).admissionPath).toBe("admission.json")
    expect(() => parseCommandArguments([...args.slice(0, -2), "--", "npm", "run", "test:unit"])).toThrow("must all")
    expect(() => parseCommandArguments([...args, "--correction-disposition", "old.json", "--disposition-sha256", "c".repeat(64), "--", "npm", "run", "test:unit"])).toThrow("cannot be combined")
  })

  it("keeps historical bytes unchanged, records a failed child, and cannot launch the next phase", async () => {
    const f = await fixture(), original = await Promise.all(f.record.priorBudgets.map(p => readFile(p.path)))
    const realNow = Date.now.bind(Date), start = realNow()
    vi.spyOn(Date, "now").mockImplementation(() => REPAIR_START + 1000 + realNow() - start)
    await writeFile(join(f.directory, "package.json"), JSON.stringify({ scripts: { "test:unit": "node -e \"process.exitCode=1\"" } }))
    const result = await runBoundedCommand({ phase: "unit", command: "npm", args: ["run", "test:unit"], timeoutMs: 2000, cwd: f.directory, stateDirectory: f.stateDirectory, repair: f.repair, snapshot: async () => candidate })
    expect(result.status).toBe("fail")
    await expect(runBoundedCommand({ phase: "quality", command: "npm", args: ["run", "validate"], timeoutMs: 2000, cwd: f.directory, stateDirectory: f.stateDirectory, repair: f.repair, snapshot: async () => candidate })).rejects.toThrow("stops after")
    expect(JSON.parse(await readFile(join(f.stateDirectory, "budget.json"), "utf8")).attempts).toHaveLength(1)
    for (const [i, p] of f.record.priorBudgets.entries()) expect(await readFile(p.path)).toEqual(original[i])
  })
})
