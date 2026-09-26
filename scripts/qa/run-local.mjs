import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { sourceRevision } from "../facility/performance-contract.mjs"
import { hashEvidence, qaHarnessRevision } from "./candidate-contract.mjs"

// Explicit build flag: root can serialize builds and GPU measurements separately.
const root = process.env.QA_OUTPUT_DIR ?? `build/qa/local-${new Date().toISOString().replace(/[:.]/g, "-")}`
await mkdir(root, { recursive: true })
const checks = [
  ["brand", "npm", ["run", "brand:check"]],
  ["lint", "npm", ["run", "lint"]],
  ["types", "npm", ["run", "typecheck"]],
  ["unit", "npm", ["run", "test:unit"]],
  ["database", process.execPath, ["scripts/qa/run-isolated-database.mjs"]],
  ["production-dependencies", "npm", ["audit", "--omit=dev", "--audit-level=high", "--json"]],
  ...(process.argv.includes("--include-build") ? [["build", "npm", ["run", "build"]]] : []),
]
const report = { schemaVersion: "gridninja-local-qa.v1", sourceRevision: await sourceRevision(), qaHarnessRevision: await qaHarnessRevision(), startedAt: new Date().toISOString(), result: "incomplete", externalQualification: "not-run", checks: [] }
for (const [name, command, args] of checks) {
  const path = `${root}/${name}.log`, log = createWriteStream(path)
  const code = await new Promise(resolve => {
    const child = spawn(command, args, { env: { ...process.env, QA_DATABASE_REPORT: `${root}/database.json` }, stdio: ["ignore", "pipe", "pipe"] })
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false })
    child.once("error", error => { log.end(String(error), () => resolve(1)) })
    child.once("exit", code => { log.end(() => resolve(code ?? 1)) })
  })
  report.checks.push({ name, status: code === 0 ? "pass" : name === "database" && code === 2 ? "blocked" : "fail", exitCode: code, evidence: await hashEvidence(path) })
  console.log(`${name}: ${report.checks.at(-1).status}`)
}
const unchanged = report.sourceRevision === await sourceRevision() && report.qaHarnessRevision === await qaHarnessRevision()
report.result = unchanged && report.checks.every(check => check.status === "pass") ? "pass" : "fail"
report.sourceAndHarnessUnchanged = unchanged
await writeFile(`${root}/summary.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(`${report.result}: ${root}/summary.json; browser, visual, performance and external gates require separate evidence.`)
if (report.result !== "pass") process.exitCode = 1
