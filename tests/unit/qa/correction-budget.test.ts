// @vitest-environment node
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { COMMAND_PHASES, CORRECTION_BASELINE_HEAD, CORRECTION_LIMITS, newCommandBudget, newCorrectionBudget, reserveCommand, reserveCorrectionCommand, validateCorrectionAuthorization } from "../../../scripts/qa/command-budget.mjs"
import { parseCommandArguments, readCorrectionDisposition, runBoundedCommand } from "../../../scripts/qa/bounded-command.mjs"
import { assertCorrectionEnvironment, assertSupportedCommand } from "../../../scripts/qa/command-contract.mjs"

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const candidate = { head: "a".repeat(40), sourceRevision: "b".repeat(64), qaHarnessRevision: "c".repeat(64), dirty: false, dirtyPaths: [] }
const binding = { dispositionSha256: "d".repeat(64), priorBudgetSha256: "e".repeat(64), userRequestSha256: "f".repeat(64), baselineHead: CORRECTION_BASELINE_HEAD }
const options = { authorization: binding, candidate }

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "gridninja-correction-")); directories.push(directory)
  const prior = newCommandBudget(100)
  for (let index = 0; index < 26; index++) reserveCommand(prior, COMMAND_PHASES[index % COMMAND_PHASES.length], 101, 1000).status = index === 0 ? "fail" : "pass"
  const priorBudgetPath = join(directory, "budget.json"), priorBytes = JSON.stringify(prior)
  await writeFile(priorBudgetPath, priorBytes)
  const record = { schemaVersion: "gridninja-correction-authorization.v1", id: "approved-correction-01", authorizedBy: "/root", authorizedAt: new Date().toISOString(), userRequest: { text: "Explicit corrective fixture request without weakening gates.", reference: "test fixture" }, baselineHead: CORRECTION_BASELINE_HEAD, priorBudget: { path: priorBudgetPath, sha256: hash(priorBytes), attemptCount: 26, deadlineAt: prior.deadlineAt }, limits: { ...CORRECTION_LIMITS } }
  const dispositionPath = join(directory, "authorization.json"), bytes = JSON.stringify(record)
  await writeFile(dispositionPath, bytes)
  return { directory, priorBytes, record, correction: { dispositionPath, dispositionSha256: hash(bytes), priorBudgetPath }, stateDirectory: join(directory, "corrections", record.id) }
}

describe("explicit additive correction allowance", () => {
  it("requires exact authorization, prior ledger hash/count/deadline and unaltered reviewed limits", async () => {
    const f = await fixture()
    const loaded = await readCorrectionDisposition(f.correction)
    expect(loaded.binding.priorAttemptCount).toBe(26)
    expect(loaded.binding.userRequestSha256).toBe(hash(f.record.userRequest.text))
    await expect(readCorrectionDisposition({ ...f.correction, dispositionSha256: "0".repeat(64) })).rejects.toThrow("disposition hash")
    await expect(readCorrectionDisposition({ ...f.correction, priorBudgetPath: join(f.directory, "other.json") })).rejects.toThrow("original task ledger")
    expect(() => validateCorrectionAuthorization({ ...f.record, userRequest: { text: "", reference: "fixture" } })).toThrow("Exact user request")
    expect(() => validateCorrectionAuthorization({ ...f.record, limits: { ...CORRECTION_LIMITS, commands: 21 } })).toThrow("limits differ")
    expect(() => validateCorrectionAuthorization({ ...f.record, baselineHead: "0".repeat(40) })).toThrow("baseline commit")
    expect(() => validateCorrectionAuthorization({ ...f.record, id: undefined })).toThrow("Invalid correction id")
    for (const priorBudget of [{ ...f.record.priorBudget, attemptCount: 25 }, { ...f.record.priorBudget, deadlineAt: f.record.priorBudget.deadlineAt + 1 }]) {
      const bytes = JSON.stringify({ ...f.record, priorBudget })
      await writeFile(f.correction.dispositionPath, bytes)
      await expect(readCorrectionDisposition({ ...f.correction, dispositionSha256: hash(bytes) })).rejects.toThrow(/Authorized prior (attempt count|deadline) differs/)
    }
    await writeFile(f.correction.dispositionPath, JSON.stringify(f.record))
    await writeFile(f.correction.priorBudgetPath, f.priorBytes + "\n")
    await expect(readCorrectionDisposition(f.correction)).rejects.toThrow("Prior budget hash")
  })

  it("counts failed attempts, shares quality/build ceilings, and refuses stale or exhausted reservations", () => {
    const budget = newCorrectionBudget(100, binding)
    reserveCorrectionCommand(budget, "quality", 101, 1000, options).status = "fail"
    reserveCorrectionCommand(budget, "build", 102, 1000, options).status = "fail"
    expect(() => reserveCorrectionCommand(budget, "quality", 103, 1000, options)).toThrow("Two candidate build")
    reserveCorrectionCommand(budget, "unit", 103, 1000, options)
    expect(() => reserveCorrectionCommand(budget, "audit", 104, 1000, options)).toThrow("unfinished")
    budget.attempts.at(-1)!.status = "fail"
    reserveCorrectionCommand(budget, "unit", 104, 1000, options).status = "pass"
    expect(() => reserveCorrectionCommand(budget, "unit", 105, 1000, options)).toThrow("Two-attempt")
    expect(budget.attempts.map(attempt => attempt.sequence)).toEqual([1, 2, 3, 4])
    const full = newCorrectionBudget(100, binding)
    const phases = COMMAND_PHASES.filter(phase => phase !== "quality" && phase !== "build")
    for (let index = 0; index < 20; index++) reserveCorrectionCommand(full, phases[index % phases.length], 101, 1000, options).status = "pass"
    expect(() => reserveCorrectionCommand(full, "build", 102, 1000, options)).toThrow("Twenty-command")
    const timed = newCorrectionBudget(100, binding)
    expect(reserveCorrectionCommand(timed, "unit", timed.deadlineAt - 10, 1000, options).timeoutMs).toBe(10)
    timed.attempts[0].status = "fail"
    expect(() => reserveCorrectionCommand(timed, "unit", timed.deadlineAt, 1000, options)).toThrow("Two-hour")
    expect(() => reserveCorrectionCommand(newCorrectionBudget(100, binding), "unit", 99, 1000, options)).toThrow("backwards")
    expect(() => reserveCorrectionCommand(newCorrectionBudget(100, binding), "unit", 101, Infinity, options)).toThrow("finite")
    const altered = newCorrectionBudget(100, binding); altered.deadlineAt++
    expect(() => reserveCorrectionCommand(altered, "unit", 101, 1000, options)).toThrow("window changed")
    expect(() => reserveCorrectionCommand(newCorrectionBudget(100, binding), "unit", 101, 1000, { ...options, authorization: { ...binding, dispositionSha256: "0".repeat(64) } })).toThrow("binding changed")
  })

  it("binds the first clean commit and requires a hash-bound explicit entry for at most one replacement", () => {
    const budget = newCorrectionBudget(100, binding)
    expect(() => reserveCorrectionCommand(budget, "unit", 101, 1000, { ...options, candidate: { ...candidate, dirty: true } })).toThrow("clean frozen")
    expect(() => reserveCorrectionCommand(budget, "unit", 101, 1000, { ...options, candidate: { ...candidate, head: CORRECTION_BASELINE_HEAD } })).toThrow("failed baseline")
    expect(budget.attempts).toHaveLength(0)
    reserveCorrectionCommand(budget, "unit", 101, 1000, options).status = "pass"
    const replacement = { ...candidate, head: "2".repeat(40), sourceRevision: "3".repeat(64) }
    const changed = { authorization: binding, candidate: replacement }
    expect(() => reserveCorrectionCommand(budget, "unit", 102, 1000, changed)).toThrow("explicit candidate entry")
    expect(budget.attempts).toHaveLength(1)
    const entry = { schemaVersion: "gridninja-correction-candidate.v1", authorizedBy: "/root", recordedAt: new Date().toISOString(), reason: "One explicit correction after retained failure", dispositionSha256: binding.dispositionSha256, priorCandidateHead: candidate.head, candidate: { head: replacement.head, sourceRevision: replacement.sourceRevision, qaHarnessRevision: replacement.qaHarnessRevision }, recordSha256: "4".repeat(64) }
    expect(() => reserveCorrectionCommand(budget, "unit", 102, 1000, { ...changed, candidateEntry: { ...entry, dispositionSha256: "5".repeat(64) } })).toThrow("hash mismatch")
    expect(() => reserveCorrectionCommand(budget, "unit", 102, 1000, { ...changed, candidate: { ...replacement, head: candidate.head }, candidateEntry: { ...entry, candidate: { ...entry.candidate, head: candidate.head } } })).toThrow("new committed candidate")
    reserveCorrectionCommand(budget, "unit", 102, 1000, { ...changed, candidateEntry: entry }).status = "pass"
    expect(budget.candidates).toHaveLength(2)
    expect(budget.attempts[1].candidateHead).toBe(replacement.head)
    expect(() => reserveCorrectionCommand(budget, "unit", 103, 1000, changed)).toThrow("Two-attempt")
    expect(() => reserveCorrectionCommand(budget, "audit", 103, 1000, { authorization: binding, candidate: { ...replacement, head: "6".repeat(40) } })).toThrow("Two correction candidate")
  })

  it("writes a separate receipt without modifying the original 26-command ledger", async () => {
    const f = await fixture()
    await writeFile(join(f.directory, "package.json"), JSON.stringify({ scripts: { "test:unit": "node -e \"process.stdout.write('corrective check')\"" } }))
    const result = await runBoundedCommand({ phase: "unit", command: "npm", args: ["run", "test:unit"], timeoutMs: 2000, cwd: f.directory, stateDirectory: f.stateDirectory, correction: f.correction, snapshot: async () => candidate })
    expect(result.status).toBe("pass")
    expect(result).toHaveProperty("priorBudgetUnchanged", true)
    expect(result).toHaveProperty("dispositionUnchanged", true)
    expect(await readFile(f.correction.priorBudgetPath, "utf8")).toBe(f.priorBytes)
    const corrected = JSON.parse(await readFile(join(f.stateDirectory, "budget.json"), "utf8"))
    expect(corrected.schemaVersion).toBe("gridninja-command-budget.v2")
    expect(corrected.attempts).toHaveLength(1)
    expect(corrected.candidates[0].head).toBe(candidate.head)
    expect(corrected.authorization.dispositionSha256).toBe(f.correction.dispositionSha256)
  })

  it("fails correction qualification when a tracked doc or untracked file changes despite equal source hashes", async () => {
    const f = await fixture()
    await writeFile(join(f.directory, "package.json"), JSON.stringify({ scripts: { "test:unit": "node -e \"process.stdout.write('finished')\"" } }))
    let snapshots = 0
    const result = await runBoundedCommand({ phase: "unit", command: "npm", args: ["run", "test:unit"], timeoutMs: 2000, cwd: f.directory, stateDirectory: f.stateDirectory, correction: f.correction, snapshot: async () => ++snapshots === 1 ? candidate : { ...candidate, dirty: true, dirtyPaths: ["?? unexpected.txt"] } })
    expect(result.identityUnchanged).toBe(true)
    expect(result.status).toBe("fail")
    expect(result.qualification).toBe("provisional-or-failed")
    expect(await readFile(f.correction.priorBudgetPath, "utf8")).toBe(f.priorBytes)
  })

  it("requires external prebuilt loopback servers so browser and SEO commands cannot hide build attempts", () => {
    const ready = { PLAYWRIGHT_PREBUILT: "1", PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3101", SEO_TEST_BASE_URL: "http://localhost:3101" }
    expect(assertCorrectionEnvironment("browser-chrome", ready)).toEqual({ PLAYWRIGHT_PREBUILT: "1", PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3101" })
    expect(assertCorrectionEnvironment("seo", ready)).toEqual({ PLAYWRIGHT_PREBUILT: "1", SEO_TEST_BASE_URL: "http://localhost:3101" })
    expect(assertCorrectionEnvironment("unit", {})).toEqual({})
    expect(() => assertCorrectionEnvironment("browser-webkit", {})).toThrow("PLAYWRIGHT_PREBUILT=1")
    expect(() => assertCorrectionEnvironment("browser-chrome", { PLAYWRIGHT_PREBUILT: "1" })).toThrow("PLAYWRIGHT_BASE_URL")
    expect(() => assertCorrectionEnvironment("seo", { PLAYWRIGHT_PREBUILT: "1", PLAYWRIGHT_BASE_URL: ready.PLAYWRIGHT_BASE_URL })).toThrow("SEO_TEST_BASE_URL")
    for (const url of ["https://gridninja.ai", "http://127.0.0.1:3101/private", "http://user:secret@localhost:3101", "http://127.0.0.1:3101/?build=1"]) expect(() => assertCorrectionEnvironment("browser-chrome", { ...ready, PLAYWRIGHT_BASE_URL: url })).toThrow("loopback external server origin")
  })

  it("parses explicit correction options without accepting arbitrary paths, commands or headed filters", () => {
    const parsed = parseCommandArguments(["unit", "--timeout-ms", "1000", "--correction-disposition", "authorization.json", "--disposition-sha256", "a".repeat(64), "--", "npm", "run", "test:unit"])
    expect(parsed.dispositionPath).toBe("authorization.json")
    expect(parsed.args).toEqual(["run", "test:unit"])
    expect(() => parseCommandArguments(["unit", "--timeout-ms", "1000", "--correction-disposition", "authorization.json", "--", "npm", "run", "test:unit"])).toThrow("supplied together")
    expect(() => parseCommandArguments(["unit", "--timeout-ms", "1000", "--state-directory", "/tmp/reset", "--", "npm", "run", "test:unit"])).toThrow("Unknown")
    expect(() => assertSupportedCommand("browser-chrome", "npm", ["run", "test:e2e", "--", "--project=chrome-stable", "--workers=1", "--headed"])).toThrow("Unsupported browser flags")
  })
})
