import assert from "node:assert/strict"
import { readFile, readdir, stat, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { desktopConfig } from "lighthouse"
import { startupCollectorSettings, summarizeStartupEvidence } from "./startup-gate.mjs"

const require = createRequire(import.meta.url)
const config = require("./lighthouse.cjs")
const directory = process.argv[2]
assert(directory, "Supply a saved startup-experiment directory")
const original = JSON.parse(await readFile(join(directory, "summary.json"), "utf8"))
const files = (await readdir(directory)).filter(file => /^(desktop|mobile)-(home|demo)-\d+\.json$/.test(file))
const reports = await Promise.all(files.map(async file => {
  const name = file.slice(0, -5)
  for (const suffix of ["trace", "network"]) {
    const artifact = await stat(join(directory, `${name}-${suffix}.json`))
    assert(artifact.size > 0, `${name}: empty ${suffix} artifact`)
  }
  return { name, report: JSON.parse(await readFile(join(directory, file), "utf8")) }
}))
const first = reports[0]?.report
assert(first?.facilityEvidence?.provenance, "No saved Lighthouse provenance")
const summary = summarizeStartupEvidence({
  label: original.label,
  measuredAt: original.measuredAt,
  identity: original.identity,
  indexedRuns: original.runs,
  reports,
  expectedProvenance: first.facilityEvidence.provenance,
  buildRecordedAt: original.buildRecordedAt ?? original.measuredAt,
  baseURL: new URL(first.requestedUrl).origin,
  collectorSettings: startupCollectorSettings(config, desktopConfig.settings),
})
summary.validationMode = "retrospective-saved-evidence"
await writeFile(join(directory, "gate-summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify({ label: summary.label, collection: summary.collection, threshold: summary.threshold, medians: summary.medians }, null, 2))
if (summary.result !== "pass") process.exitCode = 1
