import { createHash } from "node:crypto"

/** Compare a named PostgreSQL target without returning or hashing credentials.
 * Shared by the server preflight and the Node-only staging runner.
 * This identifies an endpoint/database, not an independently isolated account.
 */
export function stagingDatabaseTargetSha256(connectionString) {
  try {
    if (typeof connectionString !== "string" || connectionString.length > 8192) throw new Error()
    const url = new URL(connectionString)
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.hash) throw new Error()
    const database = decodeURIComponent(url.pathname.slice(1))
    if (!/^[A-Za-z0-9_.-]{1,63}$/.test(database)) throw new Error()
    const hostname = url.hostname.toLowerCase(), port = Number(url.port || 5432)
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error()
    const allowed = { sslmode: new Set(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]),
      channel_binding: new Set(["disable", "prefer", "require"]) }
    const seen = new Set()
    for (const [key, value] of url.searchParams) {
      if (!Object.hasOwn(allowed, key) || seen.has(key) || !allowed[key].has(value)) throw new Error()
      seen.add(key)
    }
    // Only transport/authentication settings are accepted. In particular,
    // options/search_path/branch/host query parameters cannot alter routing
    // behind a matching digest. Pooler aliases remain distinct hosts.
    return createHash("sha256").update(JSON.stringify({
      schemaVersion: "staging-database-target.v1", protocol: "postgresql", hostname, port, database,
    })).digest("hex")
  } catch { throw new Error("Invalid staging database target") }
}
