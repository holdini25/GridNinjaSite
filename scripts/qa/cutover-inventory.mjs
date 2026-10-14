import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

const root = fileURLToPath(new URL("../../", import.meta.url))
const tables = ["lead_submissions", "lead_delivery_outbox", "lead_provider_attempts", "lead_provider_events", "lead_delivery_acknowledgements", "lead_operations_heartbeats"]
const sha = value => createHash("sha256").update(value).digest("hex")
const digest = value => sha(JSON.stringify(value))
const unavailable = reason => ({ status: "unavailable", reason, counts: null })

/** Never fall back to DATABASE_URL or print a connection string in an error. */
export function cutoverTarget(env, authorize = true) {
  let url
  try { url = new URL(env.CUTOVER_DATABASE_URL ?? "") } catch { throw new Error("CUTOVER_DATABASE_URL must explicitly name a PostgreSQL target") }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.hash || !url.username || !/^\/[^/]+$/.test(url.pathname)) throw new Error("Invalid PostgreSQL target shape")
  if (url.hostname.endsWith(".")) throw new Error("Target hostname aliases are not accepted")
  const parameters = [...url.searchParams.entries()]
  if (new Set(parameters.map(([key]) => key)).size !== parameters.length || parameters.some(([key, value]) => !(key === "sslmode" && ["require", "verify-full"].includes(value) || key === "channel_binding" && value === "require"))) throw new Error("Connection routing and unsupported URL options are forbidden")
  let database, user, password
  try { database = decodeURIComponent(url.pathname.slice(1)); user = decodeURIComponent(url.username); password = decodeURIComponent(url.password) } catch { throw new Error("Invalid target encoding") }
  if ([database, user, password].some(value => /[\u0000-\u001f]/.test(value)) || database.includes("/")) throw new Error("Invalid target fields")
  const host = url.hostname.replace(/^\[|\]$/g, "")
  const local = ["127.0.0.1", "::1"].includes(host)
  const port = Number(url.port || 5432)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid target port")
  const targetSha256 = digest({ host, port, database })
  if (authorize && env.CUTOVER_AUTHORIZATION !== (local ? "local-read-only" : "authorized-target-read-only")) throw new Error("Explicit target-class read-only authorization is required")
  if (authorize && !local && env.CUTOVER_EXPECTED_TARGET_SHA256 !== targetSha256) throw new Error("Remote target digest must match the separately approved inventory")
  if (!local && !parameters.some(([key]) => key === "sslmode")) throw new Error("Remote inventory requires verified TLS")
  return {
    targetSha256, targetClass: local ? "literal-loopback" : "authorized-remote",
    connection: {
      host, port, database, user, password: () => password,
      // Explicit parameters prevent connection-string/PGOPTIONS routing overrides.
      options: "-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=10000",
      ssl: local && !parameters.some(([key]) => key === "sslmode") ? false : { rejectUnauthorized: true },
      enableChannelBinding: parameters.some(([key]) => key === "channel_binding"),
      application_name: "gridninja-cutover-read-only",
      connectionTimeoutMillis: 5000, query_timeout: 7000,
    },
  }
}

export async function repositoryMigrations(directory = root) {
  const journal = JSON.parse(await readFile(resolve(directory, "drizzle/meta/_journal.json"), "utf8"))
  const migrations = []
  for (const entry of journal.entries) {
    if (!["0000_contact_intake", "0001_contact_intake_v2", "0002_delivery_safeguards"].includes(entry.tag)) throw new Error("Unrecognized repository migration; review inventory helper before use")
    const bytes = await readFile(resolve(directory, "drizzle", `${entry.tag}.sql`))
    migrations.push({ index: entry.idx, tag: entry.tag, createdAt: String(entry.when), sha256: sha(bytes) })
  }
  const shapes = []
  for (const version of ["0001", "0002"]) {
    const snapshot = JSON.parse(await readFile(resolve(directory, "drizzle/meta", `${version}_snapshot.json`), "utf8"))
    const columns = Object.values(snapshot.tables).filter(table => tables.includes(table.name)).flatMap(table => Object.values(table.columns).map(column => ({ table: table.name, column: column.name, type: column.type.replace(/^varchar\(/, "character varying("), notNull: column.notNull })))
    shapes.push({ version, columnsSha256: digest(sortColumns(columns)) })
  }
  return { migrations, shapes }
}

function sortColumns(columns) {
  return [...columns].sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`, "en"))
}

export function compareJournal(rows, migrations) {
  if (!rows.length) return { status: "empty", matchedPrefix: null, rows: 0 }
  const matches = rows.length <= migrations.length && rows.every((row, index) => row.hash === migrations[index].sha256 && String(row.created_at) === migrations[index].createdAt)
  return { status: matches ? "matching-repository-prefix" : "mismatch", matchedPrefix: matches ? migrations[rows.length - 1].tag : null, rows: rows.length,
    // Hash the whole observation; never emit untrusted journal field contents.
    observedSha256: digest(rows.map(row => ({ hash: row.hash, createdAt: String(row.created_at) }))) }
}

const countQueries = {
  submissions: {
    table: "lead_submissions", required: ["redacted_at", "redact_after", "delete_after"],
    sql: `SELECT count(*)::text AS total,
      count(*) FILTER (WHERE redacted_at IS NOT NULL)::text AS redacted,
      count(*) FILTER (WHERE redacted_at IS NULL AND redact_after <= now())::text AS redaction_due,
      count(*) FILTER (WHERE delete_after <= now())::text AS deletion_due
      FROM public.lead_submissions`,
  },
  outbox: {
    table: "lead_delivery_outbox", required: ["status", "attempt_count", "lease_token", "lease_expires_at"],
    sql: `SELECT count(*)::text AS total,
      count(*) FILTER (WHERE status = 'pending')::text AS pending,
      count(*) FILTER (WHERE status = 'retry_scheduled')::text AS retry_scheduled,
      count(*) FILTER (WHERE status = 'processing')::text AS processing,
      count(*) FILTER (WHERE status = 'delivered')::text AS provider_accepted,
      count(*) FILTER (WHERE status = 'dead_letter')::text AS dead_letter,
      count(*) FILTER (WHERE lease_token IS NOT NULL AND lease_expires_at > now())::text AS live_leases,
      count(*) FILTER (WHERE (attempt_count > 0 OR status = 'processing') AND status IN ('pending', 'retry_scheduled', 'processing'))::text AS legacy_quarantine_candidates,
      count(*) FILTER (WHERE attempt_count > 0 AND status = 'pending')::text AS legacy_pending,
      count(*) FILTER (WHERE attempt_count > 0 AND status = 'retry_scheduled')::text AS legacy_retry_scheduled,
      count(*) FILTER (WHERE attempt_count = 0 AND status IN ('pending', 'retry_scheduled'))::text AS unattempted_pending
      FROM public.lead_delivery_outbox`,
  },
  safeguards: {
    table: "lead_delivery_outbox", required: ["review_reason", "provider_request_body"],
    sql: `SELECT count(*) FILTER (WHERE review_reason = 'legacy_attempt_unknown')::text AS legacy_quarantined,
      count(*) FILTER (WHERE provider_request_body IS NOT NULL)::text AS retained_request_bodies
      FROM public.lead_delivery_outbox`,
  },
  attempts: {
    table: "lead_provider_attempts", required: ["completed_at"],
    sql: "SELECT count(*)::text AS total, count(*) FILTER (WHERE completed_at IS NULL)::text AS unresolved FROM public.lead_provider_attempts",
  },
  events: {
    table: "lead_provider_events", required: ["outbox_id", "conflicted_at", "received_at"],
    sql: `SELECT count(*)::text AS total, count(*) FILTER (WHERE outbox_id IS NULL)::text AS unmatched,
      count(*) FILTER (WHERE conflicted_at IS NOT NULL)::text AS conflicted,
      count(*) FILTER (WHERE outbox_id IS NULL AND received_at < now() - interval '7 days')::text AS unmatched_expired
      FROM public.lead_provider_events`,
  },
  acknowledgements: { table: "lead_delivery_acknowledgements", required: [], sql: "SELECT count(*)::text AS total FROM public.lead_delivery_acknowledgements" },
}

/** Only catalog metadata and fixed aggregates are read, inside one read-only snapshot. */
export async function inspectCutoverDatabase(client, repository) {
  let begun = false
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    begun = true
    await client.query("SET LOCAL search_path = pg_catalog, public")
    await client.query("SET LOCAL statement_timeout = '5s'")
    await client.query("SET LOCAL lock_timeout = '1s'")
    const identity = (await client.query(`SELECT current_database() AS database, current_user AS role,
      inet_server_addr()::text AS server_address, inet_server_port() AS server_port,
      current_setting('server_version_num') AS version,
      current_setting('transaction_read_only') AS read_only`)).rows[0]
    if (identity?.read_only !== "on") throw new Error("Read-only transaction was not established")
    const relations = (await client.query(`SELECT c.relname AS table, c.relkind AS kind, c.relrowsecurity AS rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) ORDER BY c.relname`, [tables])).rows
    const columns = (await client.query(`SELECT c.relname AS table, a.attname AS column,
      format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS "notNull"
      FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) AND a.attnum > 0 AND NOT a.attisdropped`, [tables])).rows
    const constraints = (await client.query(`SELECT c.relname AS table, p.contype AS type, pg_get_constraintdef(p.oid) AS definition
      FROM pg_constraint p JOIN pg_class c ON c.oid = p.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) ORDER BY c.relname, p.conname`, [tables])).rows
    const indexes = (await client.query(`SELECT tablename AS table, indexdef AS definition FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ANY($1::text[]) ORDER BY tablename, indexname`, [tables])).rows
    const journals = (await client.query(`SELECT n.nspname AS schema FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = '__drizzle_migrations' AND n.nspname IN ('drizzle', 'public') AND c.relkind = 'r' AND NOT c.relrowsecurity ORDER BY n.nspname`)).rows
    let journal = { status: journals.length ? "ambiguous" : "unavailable", matchedPrefix: null, rows: null }
    if (journals.length === 1 && ["drizzle", "public"].includes(journals[0].schema)) {
      const rows = (await client.query(`SELECT hash, created_at FROM ${journals[0].schema}.__drizzle_migrations ORDER BY created_at, id LIMIT 101`)).rows
      journal = compareJournal(rows, repository.migrations)
    }
    /** @type {Record<string, {status: string, reason?: string, counts: Record<string, string> | null}>} */
    const counts = {}
    for (const [name, check] of Object.entries(countQueries)) {
      const relation = relations.find(row => row.table === check.table)
      if (!relation || !["r", "p"].includes(relation.kind) || relation.rls || !check.required.every(column => columns.some(row => row.table === check.table && row.column === column))) {
        counts[name] = unavailable("Required ordinary table/columns absent or row-level security enabled")
        continue
      }
      const row = (await client.query(check.sql)).rows[0]
      if (!row || Object.values(row).some(value => typeof value !== "string" || !/^\d+$/.test(value))) throw new Error("Invalid aggregate result")
      counts[name] = { status: "observed", counts: row }
    }
    const columnsSha256 = digest(sortColumns(columns))
    return {
      status: "observed-read-only", observedIdentitySha256: digest(identity),
      serverVersion: /^\d+$/.test(identity.version) ? identity.version : null,
      transaction: "repeatable-read/read-only", journal,
      schema: { columnsSha256, constraintsSha256: digest(constraints), indexesSha256: digest(indexes),
        matchingColumnSnapshot: repository.shapes.find(shape => shape.columnsSha256 === columnsSha256)?.version ?? null,
        fullStructuralReview: "required; column match and fingerprints do not verify defaults, enums, constraints, triggers, ownership or migration execution" },
      counts,
      cutoverAuthorization: "not-established; snapshot counts cannot prove all-path hold or drained provider calls",
    }
  } finally { if (begun) await client.query("ROLLBACK") }
}

/** @param {Record<string, string | undefined>} env */
export async function cutoverInventory(env = process.env, mode = "offline", clientFactory) {
  const report = { schemaVersion: "gridninja-cutover-inventory.v1", collectedAt: new Date().toISOString(),
    mode, status: "blocked", repository: null, targetSha256: null, targetClass: null, database: unavailable("Not requested; no database connection attempted"),
    deployment: "unperformed; verify hosting deployment SHA/build and aliases privately",
    broker: "unperformed; inventory schedules, pending retries, old destination URLs and manual paths privately",
    externalActions: "no migrations, sends, queue changes or deployment changes" }
  let client
  try {
    report.repository = await repositoryMigrations()
    if (mode === "offline") { report.status = "ready-local-package"; return report }
    const target = cutoverTarget(env, mode !== "target-digest")
    if (mode === "target-digest") { report.status = "target-digest-only"; report.targetSha256 = target.targetSha256; return report }
    if (mode !== "database") throw new Error("Unknown inventory mode")
    report.targetSha256 = target.targetSha256
    report.targetClass = target.targetClass
    client = clientFactory ? clientFactory(target.connection) : new (await import("pg")).Client(target.connection)
    // Prevent an idle socket error from surfacing driver text with target details.
    client.on?.("error", () => {})
    await client.connect()
    report.database = await inspectCutoverDatabase(client, report.repository)
    report.status = "observed-not-qualified"
  } catch {
    report.status = "blocked"
    report.database = unavailable("Configuration, connection or read-only inspection failed; review privately. No zero-count assumption is permitted.")
  } finally {
    if (client) { try { await client.end() } catch { report.status = "blocked"; report.database = unavailable("Connection cleanup failed; review privately") } }
  }
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const modes = { "--offline": "offline", "--target-digest": "target-digest", "--database": "database" }
  const mode = process.argv.length === 2 ? "offline" : process.argv.length === 3 ? modes[process.argv[2]] : undefined
  if (!mode) { console.error("Use --offline (default), --target-digest, or --database. Secrets are environment-only."); process.exitCode = 2 }
  else { const report = await cutoverInventory(process.env, mode); console.log(JSON.stringify(report, null, 2)); if (report.status === "blocked") process.exitCode = 2 }
}
