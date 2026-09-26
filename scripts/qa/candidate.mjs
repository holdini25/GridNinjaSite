import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { verifiedBuildIdentity } from "../facility/performance-contract.mjs"
import { auditPlaywrightReport, candidateMetadata, createCandidateLedger, evaluateCandidate, hashEvidence, qaHarnessRevision, recordCandidateEvidence } from "./candidate-contract.mjs"

const [command, ...args] = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const output = option("--ledger", "build/qa/candidate.json")
const identity = async () => ({ ...await verifiedBuildIdentity(), qaHarnessRevision: await qaHarnessRevision(), ...await candidateMetadata() })
try {
  if (command === "init") {
    const ledger = createCandidateLedger(await identity(), { target: "enterprise-production-release", externalActionsAuthorized: false })
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify(ledger, null, 2)}\n`, { flag: "wx" })
    console.log(`Created ${output}; no gate is implicitly passed.`)
  } else if (command === "record") {
    const ledger = JSON.parse(await readFile(output, "utf8")), path = option("--evidence")
    const current = await identity()
    recordCandidateEvidence(ledger, option("--gate"), { identity: current, owner: option("--owner"), status: option("--status"), note: option("--note", ""), resolution: option("--resolution", ""), recordedAt: new Date().toISOString(), evidence: path ? [await hashEvidence(path)] : [] })
    await writeFile(output, `${JSON.stringify(ledger, null, 2)}\n`)
  } else if (command === "check") {
    const ledger = JSON.parse(await readFile(output, "utf8"))
    const current = await identity()
    if (JSON.stringify(current) !== JSON.stringify(ledger.identity)) throw new Error("Candidate identity is stale; preserve it and initialize a new candidate")
    for (const gate of ledger.gates) for (const attempt of gate.attempts) for (const evidence of attempt.evidence) if ((await hashEvidence(evidence.path)).sha256 !== evidence.sha256) throw new Error(`Evidence changed: ${evidence.path}`)
    const result = evaluateCandidate(ledger); console.log(JSON.stringify(result, null, 2))
    if (!(option("--scope", "local") === "public" ? result.publicReady : result.localReady)) process.exitCode = 1
  } else if (command === "skips") {
    const report = JSON.parse(await readFile(option("--report"), "utf8"))
    const policy = option("--policy") ? JSON.parse(await readFile(option("--policy"), "utf8")) : {}
    const result = auditPlaywrightReport(report, policy), path = option("--out", "build/qa/skip-audit.json")
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(result, null, 2)}\n`)
    console.log(`${result.result}: ${result.cases.length} cases, ${result.failures.length} failures (${resolve(path)})`)
    if (result.result !== "pass") process.exitCode = 1
  } else throw new Error("Usage: candidate.mjs init|record|check|skips; see docs/website-upgrade/qa-candidate-runbook.md")
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 }
