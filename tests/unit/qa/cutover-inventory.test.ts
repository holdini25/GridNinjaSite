// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { compareJournal, cutoverInventory, cutoverTarget, inspectCutoverDatabase, repositoryMigrations } from "../../../scripts/qa/cutover-inventory.mjs"
import { reconcileCutover } from "../../../scripts/qa/cutover-reconcile.mjs"

const local = { CUTOVER_DATABASE_URL: "postgresql://reviewer:private-password@127.0.0.1:5544/gridninja_fixture", CUTOVER_AUTHORIZATION: "local-read-only" }
const remote = { CUTOVER_DATABASE_URL: "postgresql://reviewer:private-password@database.example.test/review?sslmode=require", CUTOVER_AUTHORIZATION: "authorized-target-read-only" }

describe("cutover inventory target boundary", () => {
  it("never inherits DATABASE_URL and requires explicit authorization even locally", () => {
    expect(() => cutoverTarget({ DATABASE_URL: local.CUTOVER_DATABASE_URL })).toThrow(/explicitly/)
    expect(() => cutoverTarget({ ...local, CUTOVER_AUTHORIZATION: "" })).toThrow(/authorization/)
    const config = cutoverTarget(local)
    expect(config.targetClass).toBe("literal-loopback")
    expect(config.connection.options).toContain("default_transaction_read_only=on")
    expect(config.connection.password()).toBe("private-password")
    expect(JSON.stringify(config)).not.toContain("private-password")
  })

  it("binds remote authorization to a separately approved target and verified TLS", () => {
    const targetSha256 = cutoverTarget(remote, false).targetSha256
    const approved = { ...remote, CUTOVER_EXPECTED_TARGET_SHA256: targetSha256 }
    expect(cutoverTarget(approved).connection.ssl).toEqual({ rejectUnauthorized: true })
    expect(() => cutoverTarget(remote)).toThrow(/digest/)
    expect(() => cutoverTarget({ ...approved, CUTOVER_DATABASE_URL: remote.CUTOVER_DATABASE_URL.replace("/review?", "/other?") })).toThrow(/digest/)
    expect(() => cutoverTarget({ ...remote, CUTOVER_DATABASE_URL: remote.CUTOVER_DATABASE_URL.split("?")[0] }, false)).toThrow(/TLS/)
    expect(cutoverTarget({ ...remote, CUTOVER_DATABASE_URL: remote.CUTOVER_DATABASE_URL.replace("private-password", "rotated-password") }, false).targetSha256).toBe(targetSha256)
  })

  it("rejects connection rerouting, socket aliases, weak TLS and duplicate options", () => {
    for (const suffix of ["?host=other", "?options=-csearch_path=evil", "?sslmode=disable", "?sslmode=no-verify", "?sslmode=require&sslmode=require", "?sslrootcert=/private/file"]) {
      expect(() => cutoverTarget({ ...local, CUTOVER_DATABASE_URL: local.CUTOVER_DATABASE_URL + suffix })).toThrow()
    }
    for (const value of ["postgresql://user@localhost/db", "postgresql://user@127.0.0.1./db", "postgresql://user@127.0.0.1/db/path", "postgresql://user@127.0.0.1/db%2Fpath", "postgresql://user@127.0.0.1/db#fragment", "postgresql://user@127.0.0.1/db%00", "https://user@127.0.0.1/db"]) {
      expect(() => cutoverTarget({ ...local, CUTOVER_DATABASE_URL: value })).toThrow()
    }
  })

  it("reports offline readiness and a digest without constructing a database client", async () => {
    const factory = vi.fn()
    const offline = await cutoverInventory({}, "offline", factory)
    expect(offline.status).toBe("ready-local-package")
    expect(offline.database.counts).toBeNull()
    const digestOnly = await cutoverInventory(remote, "target-digest", factory)
    expect(digestOnly.status).toBe("target-digest-only")
    expect(digestOnly.targetSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(factory).not.toHaveBeenCalled()
    expect(JSON.stringify(digestOnly)).not.toMatch(/private-password|database\.example|postgresql:\/\//)
  })
})

describe("offline additive-migration reconciliation", () => {
  function receipts() {
    const observed = (counts: Record<string, string>) => ({ status: "observed", counts })
    const before = {
      schemaVersion: "gridninja-cutover-inventory.v1", status: "observed-not-qualified", targetSha256: "a".repeat(64), collectedAt: "2026-10-13T10:00:00Z",
      database: { status: "observed-read-only", journal: { status: "matching-repository-prefix", matchedPrefix: "0001_contact_intake_v2" }, schema: { matchingColumnSnapshot: "0001" }, counts: {
        submissions: observed({ total: "9", redacted: "1" }),
        outbox: observed({ total: "9", provider_accepted: "2", unattempted_pending: "2", live_leases: "0", legacy_quarantine_candidates: "4", legacy_pending: "1", legacy_retry_scheduled: "2", processing: "1", dead_letter: "1", pending: "3", retry_scheduled: "2" }),
      } },
    }
    const after = structuredClone(before)
    after.collectedAt = "2026-10-13T10:01:00Z"
    after.database.journal.matchedPrefix = "0002_delivery_safeguards"
    after.database.schema.matchingColumnSnapshot = "0002"
    Object.assign(after.database.counts.outbox.counts, { legacy_quarantine_candidates: "0", processing: "0", dead_letter: "5", pending: "2", retry_scheduled: "0" })
    Object.assign(after.database.counts, { safeguards: observed({ legacy_quarantined: "4", retained_request_bodies: "0" }), attempts: observed({ total: "0" }), events: observed({ total: "0" }), acknowledgements: observed({ total: "0" }) })
    return { before, after }
  }

  it("checks every migration count without calling it release qualification", () => {
    const { before, after } = receipts()
    const result = reconcileCutover(before, after)
    expect(result.status).toBe("counts-match-not-qualified")
    expect(result.checks.every(check => check.result === "pass")).toBe(true)
    expect(result.limitations).toContain("drained provider requests")
  })

  it("blocks wrong targets, missing observations, active leases and unexpected changes", () => {
    for (const mutate of [
      (after: ReturnType<typeof receipts>["after"]) => { after.targetSha256 = "b".repeat(64) },
      (after: ReturnType<typeof receipts>["after"]) => { after.database.counts.outbox.status = "unavailable" },
      (after: ReturnType<typeof receipts>["after"]) => { after.database.counts.outbox.counts.live_leases = "1" },
      (after: ReturnType<typeof receipts>["after"]) => { after.database.counts.outbox.counts.dead_letter = "4" },
      (after: ReturnType<typeof receipts>["after"]) => { after.database.counts.submissions.counts.total = "8" },
      (after: ReturnType<typeof receipts>["after"]) => { after.database.journal.status = "mismatch" },
    ]) {
      const { before, after } = receipts()
      mutate(after)
      expect(reconcileCutover(before, after).status).toBe("blocked")
    }
    expect(reconcileCutover({}, {}).status).toBe("blocked")
  })
})

describe("cutover migration reconciliation", () => {
  it("compares the complete ordered journal using both file checksum and timestamp", async () => {
    const repository = await repositoryMigrations()
    const rows = repository.migrations.map(migration => ({ hash: migration.sha256, created_at: migration.createdAt }))
    expect(compareJournal(rows.slice(0, 2), repository.migrations)).toMatchObject({ status: "matching-repository-prefix", matchedPrefix: "0001_contact_intake_v2" })
    expect(compareJournal(rows, repository.migrations)).toMatchObject({ status: "matching-repository-prefix", matchedPrefix: "0002_delivery_safeguards" })
    for (const changed of [[...rows, rows[0]], rows.slice(1), rows.toReversed(), [{ ...rows[0], created_at: "0" }], [{ ...rows[0], hash: "untrusted-private-data" }]]) {
      const result = compareJournal(changed, repository.migrations)
      expect(result.status).toBe("mismatch")
      expect(JSON.stringify(result)).not.toContain("untrusted-private-data")
    }
    expect(compareJournal([], repository.migrations)).toMatchObject({ status: "empty", matchedPrefix: null })
  })
})

type Row = Record<string, unknown>
function fakeClient({ columns = [] as Row[], relations = [] as Row[], readOnly = "on", failCounts = false } = {}) {
  const queries: string[] = []
  return {
    queries, connect: vi.fn(async () => {}), end: vi.fn(async () => {}), on: vi.fn(),
    query: vi.fn(async (sql: string) => {
      queries.push(sql)
      if (sql.includes("current_database()")) return { rows: [{ database: "private-db", role: "private-role", server_address: "private-address", server_port: 5432, version: "170005", read_only: readOnly }] }
      if (sql.includes("c.relkind AS kind")) return { rows: relations }
      if (sql.includes("a.attname AS column")) return { rows: columns }
      if (sql.includes("count(*)")) {
        if (failCounts) throw new Error("private-password and private-name from driver")
        return { rows: [{ total: "9007199254740993", redacted: "0", redaction_due: "2", deletion_due: "1" }] }
      }
      return { rows: [] }
    }),
  }
}

describe("cutover read-only snapshot and privacy", () => {
  it("keeps absent tables unavailable, hashes catalog identity, and always rolls back", async () => {
    const client = fakeClient()
    const report = await inspectCutoverDatabase(client, await repositoryMigrations())
    expect(client.queries[0]).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    expect(client.queries.at(-1)).toBe("ROLLBACK")
    expect(client.queries.every(sql => /^(BEGIN|SET LOCAL|SELECT|ROLLBACK)\b/.test(sql))).toBe(true)
    expect(report.counts.outbox).toMatchObject({ status: "unavailable", counts: null })
    expect(report.journal.status).toBe("unavailable")
    expect(JSON.stringify(report)).not.toMatch(/private-db|private-role|private-address/)
    expect(report.observedIdentitySha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it("reads only fixed aggregates and refuses misleading RLS/view counts", async () => {
    const columns = ["redacted_at", "redact_after", "delete_after"].map(column => ({ table: "lead_submissions", column }))
    for (const relation of [{ table: "lead_submissions", kind: "v", rls: false }, { table: "lead_submissions", kind: "r", rls: true }]) {
      const client = fakeClient({ columns, relations: [relation] })
      const result = await inspectCutoverDatabase(client, await repositoryMigrations())
      expect(result.counts.submissions.counts).toBeNull()
      expect(client.queries.some(sql => sql.includes("count(*)"))).toBe(false)
    }
    const client = fakeClient({ columns, relations: [{ table: "lead_submissions", kind: "r", rls: false }] })
    const result = await inspectCutoverDatabase(client, await repositoryMigrations())
    expect(result.counts.submissions).toEqual({ status: "observed", counts: { total: "9007199254740993", redacted: "0", redaction_due: "2", deletion_due: "1" } })
    expect(client.queries.filter(sql => sql.includes("count(*)"))).toHaveLength(1)
    expect(client.queries.join("\n")).not.toMatch(/SELECT\s+(name|email|message|provider_request_body)\b/i)
  })

  it("fails closed when read-only mode is not established", async () => {
    const client = fakeClient({ readOnly: "off" })
    await expect(inspectCutoverDatabase(client, await repositoryMigrations())).rejects.toThrow(/Read-only/)
    expect(client.queries.at(-1)).toBe("ROLLBACK")
    expect(client.queries.some(sql => sql.includes("count(*)"))).toBe(false)
  })

  it("redacts driver failures, closes its client, and never turns failure into zero counts", async () => {
    const client = fakeClient({ columns: ["redacted_at", "redact_after", "delete_after"].map(column => ({ table: "lead_submissions", column })), relations: [{ table: "lead_submissions", kind: "r", rls: false }], failCounts: true })
    const result = await cutoverInventory(local, "database", () => client)
    expect(result.status).toBe("blocked")
    expect(result.database.counts).toBeNull()
    expect(client.queries.at(-1)).toBe("ROLLBACK")
    expect(client.end).toHaveBeenCalledOnce()
    expect(JSON.stringify(result)).not.toMatch(/private-password|private-name|private-db|private-role/)
  })
})
