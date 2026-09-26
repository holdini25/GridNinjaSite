import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { verifiedBuildIdentity } from "../facility/performance-contract.mjs"
import { auditPlaywrightReport, candidateMetadata, qaHarnessRevision } from "./candidate-contract.mjs"
import { enterpriseFunctionalPolicy } from "./enterprise-functional-policy.mjs"

const project = "webkit-mobile"
const expectedCases = 161
const expectedPasses = 149
const deepLinkTitle = "deep links restore authored focus without graphics and preserve exact records across history"
const additionalSkips = [
  ["real background-tab visibility defers activation and freezes equipment", "Requires an isolated headed Chrome default context without focus emulation"],
  ["keeps proof inspectors positioned over the wide chart", "Desktop-only layout assertion"],
  ["proof page keeps boundaries readable with no-preference motion", "Focused automated contrast and motion verification."],
  ["proof page keeps boundaries readable with reduce motion", "Focused automated contrast and motion verification."],
]
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const readJson = async path => JSON.parse(await readFile(path, "utf8"))
const identity = async () => ({ ...await verifiedBuildIdentity(), qaHarnessRevision: await qaHarnessRevision(), ...await candidateMetadata() })

function casesIn(report) {
  const cases = []
  function visit(suites) {
    for (const suite of suites ?? []) {
      for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) cases.push({ title: spec.title, project: test.projectName, attempts: test.results ?? [] })
      visit(suite.suites)
    }
  }
  visit(report.suites)
  return cases
}

function assertInventory(inventory) {
  assert.equal(inventory.errors?.length, 0, "Playwright declaration inventory has errors")
  const cases = casesIn(inventory)
  assert.equal(cases.length, expectedCases, "Full WebKit mobile declaration count changed")
  assert(cases.every(item => item.project === project), "Inventory contains another project")
  assert.equal(new Set(cases.map(item => item.title)).size, expectedCases, "Duplicate test title prevents exact auditing")
  assert(cases.some(item => item.title === deepLinkTitle), "The original deep-link case is missing")
  return cases
}

async function prepare(directory) {
  const candidate = await readJson(join(directory, "candidate.json"))
  assert.deepEqual(await identity(), candidate.identity, "Candidate changed before policy preparation")
  const inventoryPath = join(directory, "inventory.json")
  const inventoryBytes = await readFile(inventoryPath)
  const declarations = assertInventory(JSON.parse(inventoryBytes))
  const base = enterpriseFunctionalPolicy(project)
  const allowedSkips = [...base.allowedSkips, ...additionalSkips.map(([title, reason]) => ({ title, project, reason }))]
  assert.equal(allowedSkips.length, 12, "Reviewed skip set changed")
  assert.equal(new Set(allowedSkips.map(item => item.title)).size, 12, "Duplicate reviewed skip")
  const declared = new Set(declarations.map(item => item.title))
  assert(allowedSkips.every(item => declared.has(item.title)), "A reviewed skip is no longer declared")
  const excluded = new Set(allowedSkips.map(item => item.title))
  const requiredTitles = declarations.filter(item => !excluded.has(item.title)).map(({ title }) => ({ title, project }))
  assert.equal(requiredTitles.length, expectedPasses)
  assert(requiredTitles.some(item => item.title === deepLinkTitle), "Deep-link case cannot be excluded")
  for (const item of base.requiredTitles) assert(requiredTitles.some(required => required.title === item.title), `Critical case missing: ${item.title}`)
  const policy = { schemaVersion: "gridninja-webkit-mobile-v11-profile.v1", qualificationIdentity: candidate.identity, inventorySha256: hash(inventoryBytes), declaredCaseCount: expectedCases, requiredCaseCount: expectedPasses, requiredTitles, allowedSkips }
  await writeFile(join(directory, "policy.json"), `${JSON.stringify(policy, null, 2)}\n`, { flag: "wx" })
  assert.deepEqual(await identity(), candidate.identity, "Candidate changed during policy preparation")
  console.log(`Prepared ${expectedPasses} required cases and ${allowedSkips.length} reviewed exclusions`)
}

async function audit(directory) {
  const failures = []
  let candidate, policy, inventory, browser, current, browserExitCode
  try { candidate = await readJson(join(directory, "candidate.json")) } catch (error) { failures.push(`Candidate unavailable: ${error}`) }
  try { policy = await readJson(join(directory, "policy.json")) } catch (error) { failures.push(`Policy unavailable: ${error}`) }
  try { inventory = await readFile(join(directory, "inventory.json")) } catch (error) { failures.push(`Inventory unavailable: ${error}`) }
  try { browser = await readJson(join(directory, "browser.json")) } catch (error) { failures.push(`Browser report unavailable: ${error}`) }
  try { browserExitCode = (await readFile(join(directory, "browser-exit-code.txt"), "utf8")).trim() } catch (error) { failures.push(`Browser exit code unavailable: ${error}`) }
  try { current = await identity() } catch (error) { failures.push(`Build identity unavailable: ${error}`) }
  let cases = []
  if (candidate && policy && inventory && browser && current) {
    try {
      assert.deepEqual(current, candidate.identity, "Candidate changed during execution")
      assert.deepEqual(policy.qualificationIdentity, candidate.identity, "Policy has another candidate identity")
      assert.equal(policy.inventorySha256, hash(inventory), "Declaration inventory changed")
      const declarations = assertInventory(JSON.parse(inventory))
      assert.equal(policy.declaredCaseCount, expectedCases)
      assert.equal(policy.requiredCaseCount, expectedPasses)
      const expectedSkips = [...enterpriseFunctionalPolicy(project).allowedSkips, ...additionalSkips.map(([title, reason]) => ({ title, project, reason }))]
      assert.deepEqual(policy.allowedSkips, expectedSkips, "Reviewed skip policy changed after preparation")
      assert.deepEqual(policy.requiredTitles, declarations.filter(item => !expectedSkips.some(skip => skip.title === item.title)).map(({ title }) => ({ title, project })), "Required declaration set changed after preparation")
      if (browserExitCode !== "0") failures.push(`Browser process did not exit successfully: ${browserExitCode ?? "missing"}`)
      const declaredKeys = declarations.map(item => item.title).sort()
      cases = casesIn(browser)
      assert.deepEqual(cases.map(item => item.title).sort(), declaredKeys, "Executed cases differ from the predeclared full profile")
      assert(cases.every(item => item.project === project), "Report contains another project")
      assert(cases.every(item => item.attempts.length === 1 && item.attempts[0].retry === 0), "Missing or retried test attempt")
      const result = auditPlaywrightReport(browser, policy)
      failures.push(...result.failures)
      if (browser.stats?.expected !== expectedPasses) failures.push(`Required pass count differs: ${browser.stats?.expected ?? "missing"}`)
      if (browser.stats?.skipped !== 12) failures.push(`Reviewed skip count differs: ${browser.stats?.skipped ?? "missing"}`)
      if (browser.stats?.flaky !== 0) failures.push(`Flaky result is disallowed: ${browser.stats?.flaky ?? "missing"}`)
      if (browser.stats?.unexpected !== 0) failures.push(`Unexpected result is disallowed: ${browser.stats?.unexpected ?? "missing"}`)
      if (!cases.some(item => item.title === deepLinkTitle && item.attempts[0].status === "passed")) failures.push("Deep-link case did not pass")
    } catch (error) { failures.push(String(error)) }
  }
  const result = { status: failures.length ? "fail" : "pass", project, candidateIdentity: candidate?.identity ?? null, inventorySha256: inventory ? hash(inventory) : null, reportSha256: browser ? hash(await readFile(join(directory, "browser.json"))) : null, expected: { declared: expectedCases, passed: expectedPasses, reviewedSkips: 12, retries: 0 }, observed: { cases: cases.length, stats: browser?.stats ?? null, browserExitCode: browserExitCode ?? null }, failures }
  await writeFile(join(directory, "skip-audit.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" })
  console.log(JSON.stringify({ status: result.status, observed: result.observed, failures }))
  if (result.status !== "pass") process.exitCode = 1
}

const [command, directory] = process.argv.slice(2)
if (!directory || !["prepare", "audit"].includes(command)) throw new Error("Usage: webkit-mobile-v11-profile.mjs prepare|audit <new-attempt-directory>")
if (command === "prepare") await prepare(directory)
else await audit(directory)
