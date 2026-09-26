import "server-only"

import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { ContactRuntimeConfig } from "@/lib/contact/config"
import { stagingDatabaseTargetSha256 } from "@/lib/contact/staging-database-target.mjs"

const SHA256 = /^[a-f0-9]{64}$/
const MODES = new Set(["poster", "manual", "auto-desktop", "auto-adaptive"])
type Environment = Readonly<Record<string, string | undefined>>

export class StagingPreflightError extends Error {
  constructor(readonly code: "staging_disabled" | "origin_not_authorized" | "unsafe_recipient" | "crm_not_authorized" | "database_target_unavailable" | "attestation_unavailable") {
    super(code)
    this.name = "StagingPreflightError"
  }
}

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)

export function assertStagingPreflightBoundary(requestUrl: string, env: Environment) {
  if (env.LEAD_STAGING_PREFLIGHT_ENABLED !== "staging-only") throw new StagingPreflightError("staging_disabled")
  try {
    const expected = env.LEAD_STAGING_PREFLIGHT_ORIGIN?.trim()
    if (!expected) throw new Error()
    const origin = new URL(expected), request = new URL(requestUrl)
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
    if (expected !== origin.origin || origin.username || origin.password ||
        origin.hostname.endsWith(".") ||
        !(origin.protocol === "https:" || (loopback && origin.protocol === "http:")) ||
        origin.hostname === "gridninja.ai" ||
        (origin.hostname.endsWith(".gridninja.ai") && origin.hostname !== "staging.gridninja.ai") ||
        request.origin !== expected || request.search || request.hash) throw new Error()
    // A dedicated staging Vercel project needs its production deployment for
    // native cron. VERCEL_ENV therefore cannot establish the staging boundary.
    return expected
  } catch {
    throw new StagingPreflightError("origin_not_authorized")
  }
}

export function inspectStagingPreflight(input: {
  origin: string
  config: ContactRuntimeConfig
  attestation: Buffer
  packagedBuildId: string
}) {
  const { origin, config, attestation } = input
  const recipient = config.emailTo.trim()
  // This rehearsal authorizes one exact internal recipient. Display-name,
  // comma-separated and header-shaped values do not satisfy that contract.
  if (recipient.length > 254 || !/^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(recipient)) {
    throw new StagingPreflightError("unsafe_recipient")
  }
  if (config.crmWebhookUrl || config.crmWebhookSigningSecret) throw new StagingPreflightError("crm_not_authorized")
  // The worker URL is derived from publicBaseUrl. Merely allowing a staging
  // browser origin could still enqueue work against the public deployment.
  if (config.publicBaseUrl !== origin || !config.allowedOrigins.has(origin)) throw new StagingPreflightError("origin_not_authorized")
  let databaseTargetSha256: string
  try { databaseTargetSha256 = stagingDatabaseTargetSha256(config.databaseUrl) }
  catch { throw new StagingPreflightError("database_target_unavailable") }
  try {
    if (!attestation.length || attestation.length > 65_536) throw new Error()
    const record: unknown = JSON.parse(attestation.toString("utf8"))
    if (!object(record) || typeof record.recordedAt !== "string" || !Number.isFinite(Date.parse(record.recordedAt)) || !object(record.identity)) throw new Error()
    const identity = record.identity
    if (typeof identity.buildId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(identity.buildId) ||
        identity.buildId !== input.packagedBuildId.trim() ||
        typeof identity.sourceRevision !== "string" || !SHA256.test(identity.sourceRevision) ||
        !object(identity.buildSettings) || !Array.isArray(identity.releases)) throw new Error()
    const { selectedRelease, mode } = identity.buildSettings
    if (typeof selectedRelease !== "string" || !/^facility-v[1-9][0-9]*$/.test(selectedRelease) ||
        typeof mode !== "string" || !MODES.has(mode) ||
        !identity.releases.some(release => object(release) && release.release === selectedRelease &&
          typeof release.manifestSha256 === "string" && SHA256.test(release.manifestSha256))) throw new Error()
    const recipientSha256 = digest(recipient)
    // Deliberately excludes credentials, storage locations, inquiry content and
    // provider request bodies. The manifest describes which public settings it binds.
    const configurationSha256 = digest(JSON.stringify({
      schemaVersion: "lead-staging-public-config.v1", origin,
      publicBaseUrl: config.publicBaseUrl,
      allowedOrigins: [...config.allowedOrigins].sort(),
      allowedTurnstileHostnames: [...config.allowedTurnstileHostnames].sort(),
      sender: config.emailFrom.trim(), recipientSha256, crmEnabled: false,
    }))
    return {
      ok: true as const, schemaVersion: "lead-staging-preflight.v1" as const,
      recipientSha256, configurationSha256, databaseTargetSha256, attestationSha256: digest(attestation),
      artifact: { buildId: identity.buildId, sourceRevision: identity.sourceRevision, selectedRelease, mode },
      crmEnabled: false as const,
    }
  } catch {
    throw new StagingPreflightError("attestation_unavailable")
  }
}

export async function readPackagedStagingAttestation() {
  // Both paths are constant and explicitly included in this endpoint's output
  // trace after the final postbuild attestation exists. Never accept a URL path.
  const [attestation, packagedBuildId] = await Promise.all([
    readFile(join(process.cwd(), ".next", "facility-build.json")),
    readFile(join(process.cwd(), ".next", "BUILD_ID"), "utf8"),
  ])
  return { attestation, packagedBuildId }
}
