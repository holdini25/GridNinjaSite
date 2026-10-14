import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

/** Offline count reconciliation only; never applies a migration or authorizes release. */
export function reconcileCutover(before, after) {
  const checks = []
  const check = (name, pass) => checks.push({ name, result: pass ? "pass" : "fail" })
  const count = (report, group, field) => {
    const observation = report?.database?.counts?.[group]
    const value = observation?.counts?.[field]
    if (observation?.status !== "observed" || typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("Required aggregate unavailable")
    return BigInt(value)
  }
  try {
    check("same-explicit-target", /^[a-f0-9]{64}$/.test(before?.targetSha256) && before.targetSha256 === after?.targetSha256)
    check("both-read-only-observations", [before, after].every(report => report?.schemaVersion === "gridninja-cutover-inventory.v1" && report.status === "observed-not-qualified" && report.database?.status === "observed-read-only"))
    check("expected-0001-before", before.database?.journal?.status === "matching-repository-prefix" && before.database.journal.matchedPrefix === "0001_contact_intake_v2" && before.database.schema?.matchingColumnSnapshot === "0001")
    check("expected-0002-after", after.database?.journal?.status === "matching-repository-prefix" && after.database.journal.matchedPrefix === "0002_delivery_safeguards" && after.database.schema?.matchingColumnSnapshot === "0002")
    check("ordered-captures", Number.isFinite(Date.parse(before.collectedAt)) && Date.parse(before.collectedAt) < Date.parse(after.collectedAt))
    check("no-live-leases-before-or-after", count(before, "outbox", "live_leases") === 0n && count(after, "outbox", "live_leases") === 0n)
    for (const field of ["total", "redacted"]) check(`submission-${field}-preserved`, count(before, "submissions", field) === count(after, "submissions", field))
    for (const field of ["total", "provider_accepted", "unattempted_pending"]) check(`outbox-${field}-preserved`, count(before, "outbox", field) === count(after, "outbox", field))
    const quarantined = count(before, "outbox", "legacy_quarantine_candidates")
    check("quarantine-candidate-accounting", quarantined === count(before, "outbox", "legacy_pending") + count(before, "outbox", "legacy_retry_scheduled") + count(before, "outbox", "processing"))
    check("exact-quarantine-count", count(after, "safeguards", "legacy_quarantined") === quarantined)
    check("dead-letter-increment", count(after, "outbox", "dead_letter") === count(before, "outbox", "dead_letter") + quarantined)
    for (const [field, legacy] of [["pending", "legacy_pending"], ["retry_scheduled", "legacy_retry_scheduled"]]) check(`${field}-remaining`, count(after, "outbox", field) === count(before, "outbox", field) - count(before, "outbox", legacy))
    check("no-unresolved-legacy-claims", count(after, "outbox", "processing") === 0n && count(after, "outbox", "legacy_quarantine_candidates") === 0n)
    check("no-fabricated-frozen-bodies", count(after, "safeguards", "retained_request_bodies") === 0n)
    for (const group of ["attempts", "events", "acknowledgements"]) check(`no-fabricated-${group}`, count(after, group, "total") === 0n)
  } catch { checks.push({ name: "required-input-observations", result: "unavailable" }) }
  return { schemaVersion: "gridninja-cutover-reconciliation.v1", status: checks.every(check => check.result === "pass") ? "counts-match-not-qualified" : "blocked", checks,
    limitations: "Untrusted offline receipts are not signed evidence. Counts do not prove identity/key/counter preservation, restored bytes, all-path hold, drained provider requests, schema semantics or safe delivery. Independently review those before any cutover." }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let report
  try {
    if (process.argv.length !== 4) throw new Error("Two receipts required")
    report = reconcileCutover(JSON.parse(await readFile(process.argv[2], "utf8")), JSON.parse(await readFile(process.argv[3], "utf8")))
  } catch { report = { schemaVersion: "gridninja-cutover-reconciliation.v1", status: "blocked", reason: "Two valid private inventory receipts are required; no source file contents or paths are printed" } }
  console.log(JSON.stringify(report, null, 2))
  if (report.status === "blocked") process.exitCode = 2
}
