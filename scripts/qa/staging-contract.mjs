import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

const sha256 = value => createHash("sha256").update(value).digest("hex")
const reference = /^[A-Za-z0-9_-]{1,64}$/
const digest = /^[a-f0-9]{64}$/
const emailPattern = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/
const timestamp = value => value instanceof Date ? value.getTime() : Date.parse(value)
const requireEvidence = (condition, code) => { if (!condition) throw new Error(code) }

function requiredValue(env, name) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required; the staging canary must not skip.`)
  return value
}

/** Smoke is deliberately distinct from the opt-in staffed observation chain.
 * Neither mode establishes production readiness or replaces failure rehearsals. */
export function stagingIntakeConfig(env) {
  const required = name => requiredValue(env, name)
  const baseURL = required("STAGING_BASE_URL")
  let url
  try { url = new URL(baseURL) } catch { throw new Error("STAGING_BASE_URL must be a clean HTTP(S) origin") }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("STAGING_BASE_URL must be a clean HTTP(S) origin")
  // DNS treats a final dot as an equivalent fully qualified hostname. Keep one
  // spelling of an explicitly authorized staging target; never bypass the
  // production guard through that alias.
  if (url.hostname.endsWith(".")) throw new Error("Staging hostnames must not use a trailing-dot alias")
  if (url.protocol !== "https:" && !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Remote staging must use HTTPS")
  if (url.hostname === "gridninja.ai" || url.hostname.endsWith(".gridninja.ai") && url.hostname !== "staging.gridninja.ai") throw new Error("Production host is not an authorized staging target")
  if (required("STAGING_CANARY_AUTHORIZED_ORIGIN") !== url.origin) throw new Error("The staging origin must match explicit canary authorization")
  if (required("STAGING_CANARY_AUTHORIZED") !== "staging-only") throw new Error("Explicit staging-only canary authorization is required")
  const databaseUrl = required("STAGING_DATABASE_URL")
  const databaseConnection = stagingDatabaseConnection(databaseUrl)
  const email = required("STAGING_CANARY_EMAIL")
  if (!emailPattern.test(email)) throw new Error("STAGING_CANARY_EMAIL must name one approved test email")
  const deliveryEmail = required("STAGING_CANARY_DELIVERY_EMAIL")
  if (!emailPattern.test(deliveryEmail)) throw new Error("STAGING_CANARY_DELIVERY_EMAIL must name one authorized internal recipient")
  const approvalFile = required("STAGING_CANARY_APPROVAL_FILE")
  const approvalSha256 = required("STAGING_CANARY_APPROVAL_SHA256")
  const expectedAttestationSha256 = required("STAGING_CANARY_EXPECTED_ATTESTATION_SHA256")
  if (!digest.test(approvalSha256) || !digest.test(expectedAttestationSha256)) throw new Error("Staging approval and qualified build hashes are required")
  const deploymentBypass = required("STAGING_CANARY_DEPLOYMENT_BYPASS")
  if (deploymentBypass.length < 32) throw new Error("Staging deployment authentication must be configured")
  return { baseURL: url.origin, databaseUrl, databaseConnection, email, deliveryEmail, approvalFile, approvalSha256, expectedAttestationSha256, deploymentBypass }
}

/** This runner has no acknowledgement credential and cannot fabricate handling. */
export function stagingCanaryConfig(env) {
  const intake = stagingIntakeConfig(env)
  const required = name => requiredValue(env, name)
  const operatorReference = required("STAGING_CANARY_OPERATOR_REFERENCE")
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(operatorReference)) throw new Error("STAGING_CANARY_OPERATOR_REFERENCE must name the assigned operator using a non-sensitive identifier")
  const monitorSecret = required("STAGING_CANARY_MONITOR_SECRET")
  if (monitorSecret.length < 32) throw new Error("Staging monitor authentication must be configured")
  const wait = required("STAGING_CANARY_ACK_TIMEOUT_SECONDS")
  if (!/^[1-9][0-9]*$/.test(wait) || Number(wait) > 900) throw new Error("Human acknowledgement timeout must be 1 to 900 seconds")
  return { ...intake, operatorReference, monitorSecret, acknowledgementTimeoutMs: Number(wait) * 1000 }
}

export function stagingRehearsalMode(env) {
  const mode = env.STAGING_CANARY_MODE ?? "intake-smoke"
  if (!["intake-smoke", "observation-chain"].includes(mode)) throw new Error("Unknown staging canary mode")
  return mode
}

/** Validate before hashing or connecting. pg connectionString parameters override
 * explicit options, so never pass the URL to the driver. Only literal loopback
 * targets may omit verified TLS. Credentials remain private to this runner. */
export function stagingDatabaseConnection(connectionString) {
  let url
  try { url = new URL(connectionString) } catch { throw new Error("STAGING_DATABASE_URL must explicitly name a PostgreSQL target") }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.hash || !url.username || !/^\/[^/]+$/.test(url.pathname)) throw new Error("Invalid staging PostgreSQL target shape")
  if (url.hostname.endsWith(".")) throw new Error("Staging database hostname aliases are not accepted")
  const parameters = [...url.searchParams.entries()]
  if (new Set(parameters.map(([key]) => key)).size !== parameters.length || parameters.some(([key, value]) => !(key === "sslmode" && ["require", "verify-full"].includes(value) || key === "channel_binding" && value === "require"))) throw new Error("Staging database routing and unsupported URL options are forbidden")
  let database, user, password
  try { database = decodeURIComponent(url.pathname.slice(1)); user = decodeURIComponent(url.username); password = decodeURIComponent(url.password) } catch { throw new Error("Invalid staging database target encoding") }
  if ([database, user, password].some(value => /[\u0000-\u001f\u007f]/.test(value)) || database.includes("/")) throw new Error("Invalid staging database target fields")
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  const local = ["127.0.0.1", "::1"].includes(host)
  const port = Number(url.port || 5432)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid staging database target port")
  const verifiedTls = parameters.some(([key]) => key === "sslmode")
  if (!local && !verifiedTls) throw new Error("Remote staging database requires verified TLS")
  return {
    host, port, database, user, password: () => password,
    options: "-c default_transaction_read_only=on -c statement_timeout=5000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=10000",
    ssl: verifiedTls ? { rejectUnauthorized: true } : false,
    enableChannelBinding: parameters.some(([key]) => key === "channel_binding"),
    application_name: "gridninja-staging-read-only", sslnegotiation: "postgres",
    connectionTimeoutMillis: 5000, query_timeout: 7000,
  }
}

/** No passwords or query tokens in the comparison. A distinct hostname is NOT
 * proof of isolation: the separately reviewed evidence must resolve aliases and
 * verify the actual hosted environment, DB branch and provider account. */
export function stagingDatabaseTargetSha256(connectionString) {
  const { host, port, database } = stagingDatabaseConnection(connectionString)
  return sha256(JSON.stringify({ host, port: String(port), database }))
}

/** Never include the triggering exception or its cause: browser/driver messages
 * can contain recipients, credentials, DOM content or private SQL parameters. */
export async function withStagingFailurePrivacy(operation) {
  try { return await operation() } catch { throw new Error("StagingCanaryFailed") }
}

/** pg emits idle socket/backend errors outside awaited queries. Consume the
 * event without retaining its sensitive payload, and permanently fail closed. */
export function guardStagingDatabaseErrors(client) {
  let unhealthy = false
  client.on("error", () => { unhealthy = true })
  return () => {
    if (unhealthy) throw new Error("StagingDatabaseUnavailable")
  }
}

/** A hash pins the reviewed private record; it is not a signature, permission
 * grant or independent proof merely because this JSON was supplied. The approved
 * deployment must restrict event/ack writes to its authenticated server paths. */
export function assertStagingApproval(raw, config, mode, now = Date.now()) {
  requireEvidence(Buffer.byteLength(raw) <= 16 * 1024 && sha256(raw) === config.approvalSha256, "StagingApprovalHashMismatch")
  let approval
  try { approval = JSON.parse(raw) } catch { throw new Error("StagingApprovalInvalid") }
  requireEvidence(approval?.schemaVersion === "gridninja-staging-approval.v1" && approval.scope === "isolated-staging", "StagingApprovalInvalid")
  requireEvidence(approval.origin === config.baseURL && approval.canaryEmail === config.email && approval.emailTo === config.deliveryEmail, "StagingApprovalDestinationMismatch")
  requireEvidence(approval.buildAttestationSha256 === config.expectedAttestationSha256 && /^[a-f0-9]{40}$/.test(approval.sourceCommit ?? ""), "StagingApprovalBuildMismatch")
  const approved = Date.parse(approval.approvedAt), expires = Date.parse(approval.expiresAt)
  requireEvidence(Number.isFinite(approved) && approved <= now && expires > now && expires - approved <= 24 * 3600_000, "StagingApprovalExpired")
  for (const field of ["approvalReference", "deploymentReference", "isolationEvidenceReference", "hostProtectionEvidenceReference", "providerAccountRef", "providerBindingRef", "providerAuthorizationEvidenceReference", "databaseAccessEvidenceReference"]) requireEvidence(reference.test(approval[field] ?? ""), "StagingApprovalEvidenceMissing")
  requireEvidence(digest.test(approval.providerKeySha256 ?? "") && typeof approval.emailFrom === "string" && approval.emailFrom.length > 0, "StagingApprovalProviderBindingMissing")
  requireEvidence(approval.databaseTargetSha256 === stagingDatabaseTargetSha256(config.databaseUrl) && digest.test(approval.productionDatabaseTargetSha256 ?? "") && approval.databaseTargetSha256 !== approval.productionDatabaseTargetSha256, "StagingDatabaseIsolationUnverified")
  requireEvidence(typeof approval.databaseName === "string" && approval.databaseName.length > 0 && typeof approval.databaseUser === "string" && approval.databaseUser.length > 0, "StagingDatabaseIdentityMissing")
  // The smallest external rehearsal exercises required email only. CRM needs a
  // separately qualified receiver, never an inherited Preview integration.
  requireEvidence(approval.crmEnabled === false, "StagingCrmMustBeDisabled")
  if (mode === "observation-chain") {
    for (const field of ["callbackAuthenticationEvidenceReference", "monitorDeliveryEvidenceReference", "watchdogEvidenceReference", "primaryOperatorReference", "backupOperatorReference"]) requireEvidence(reference.test(approval[field] ?? ""), "StagingStaffedEvidenceMissing")
    requireEvidence(approval.primaryOperatorReference !== approval.backupOperatorReference && [approval.primaryOperatorReference, approval.backupOperatorReference].includes(config.operatorReference), "StagingOperatorNotApproved")
  }
  return approval
}

export async function readStagingApproval(config, mode) {
  let raw
  try { raw = await readFile(config.approvalFile, "utf8") } catch { throw new Error("StagingApprovalUnavailable") }
  return assertStagingApproval(raw, config, mode)
}

export function assertStagingDatabaseIdentity(actual, approval) {
  requireEvidence(actual?.database_name === approval.databaseName && actual?.database_user === approval.databaseUser && actual?.transaction_read_only === "on", "StagingDatabaseIdentityMismatch")
}

export function assertStagingMonitorHealthy(status, body) {
  requireEvidence(status === 200 && body?.ok === true && body?.healthy === true && body?.busy !== true && body?.degraded === false && body?.notificationFailures === 0 && body?.activeIncidents === 0 && body?.databaseAvailable === true, "StagingMonitorOrSinkUnavailable")
}

/** Use one connection. A consistent read-only snapshot avoids manufacturing a
 * passing chain from rows read on opposite sides of a callback/ACK race. */
export async function readStagingDeliveryEvidence(client, leadId) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
  try {
    const lead = (await client.query("select id, accepted_at, redacted_at from lead_submissions where id = $1", [leadId])).rows[0]
    const outboxes = (await client.query("select * from lead_delivery_outbox where lead_id = $1", [leadId])).rows
    const attempts = (await client.query("select a.* from lead_provider_attempts a join lead_delivery_outbox o on o.id = a.outbox_id where o.lead_id = $1", [leadId])).rows
    const events = (await client.query("select e.* from lead_provider_events e where e.outbox_id in (select id from lead_delivery_outbox where lead_id = $1) or e.provider_message_id in (select provider_message_id from lead_delivery_outbox where lead_id = $1 and provider_message_id is not null)", [leadId])).rows
    // Compare exact PostgreSQL timestamps before the driver truncates fractional
    // milliseconds. ACK cutoffs must cover every received event for this outbox.
    const acknowledgements = (await client.query(`select a.*,
      a.reviewed_through >= (select max(e.received_at) from lead_provider_events e where e.outbox_id = a.outbox_id)
      and a.acknowledged_at >= a.reviewed_through and a.acknowledged_at <= clock_timestamp() as review_covers_events
      from lead_delivery_acknowledgements a join lead_delivery_outbox o on o.id = a.outbox_id where o.lead_id = $1`, [leadId])).rows
    await client.query("COMMIT")
    return { lead, outboxes, attempts, events, acknowledgements }
  } catch {
    await client.query("ROLLBACK").catch(() => undefined)
    throw new Error("StagingEvidenceUnavailable")
  }
}

/** Input is read-only DB evidence for this fresh lead only. Returning pending
 * cannot turn provider acceptance, a replay, or an absent operator into success. */
export function evaluateStagingDelivery(evidence, approval, operatorReference, now = Date.now()) {
  const { lead, outboxes = [], attempts = [], events = [], acknowledgements = [] } = evidence
  requireEvidence(lead && /^[a-f0-9-]{36}$/i.test(lead.id), "StagingLeadIdentityMissing")
  requireEvidence(outboxes.length === 1 && outboxes[0].channel === "internal_email" && outboxes[0].lead_id === lead.id, "StagingUnexpectedDeliveryChannel")
  const outbox = outboxes[0]
  requireEvidence(!outbox.review_required_at && !outbox.review_reason && !outbox.dead_lettered_at && !lead.redacted_at, "StagingDeliveryNeedsReview")
  if (!outbox.provider_request_body) return { stage: "durable", complete: false }
  const frozen = stagingFrozenPayloadEvidence(outbox.provider_request_body, approval.emailTo)
  let body
  try { body = JSON.parse(outbox.provider_request_body) } catch { throw new Error("StagingSnapshotInvalid") }
  requireEvidence(frozen.authorizedRecipient && body.from === approval.emailFrom && outbox.prepared_request_version === 1 && frozen.frozenRequestSha256 === outbox.provider_request_body_sha256 && Buffer.byteLength(outbox.provider_request_body) <= 64 * 1024, "StagingSnapshotInvalid")
  requireEvidence(outbox.provider_account_ref === approval.providerAccountRef && outbox.provider_target_url === "https://api.resend.com/emails" && outbox.provider_destination_ref === sha256(JSON.stringify({ from: approval.emailFrom, to: approval.emailTo })) && outbox.idempotency_key === `lead-notification/${lead.id}`, "StagingFrozenIdentityMismatch")
  requireEvidence(Number.isInteger(outbox.attempt_count) && outbox.attempt_count >= 1 && outbox.attempt_count <= 6, "StagingClaimBudgetInvalid")
  const first = timestamp(outbox.first_provider_attempt_at), accepted = timestamp(lead.accepted_at)
  requireEvidence(Number.isFinite(first) && Number.isFinite(accepted) && first >= accepted && first <= now, "StagingFirstClockInvalid")
  requireEvidence(attempts.length > 0 && new Set(attempts.map(x => x.lease_token)).size === attempts.length && attempts.every(x => x.outbox_id === outbox.id && x.provider_account_ref === approval.providerAccountRef && x.claim_ordinal >= 1 && x.claim_ordinal <= outbox.attempt_count && timestamp(x.reserved_at) >= first && timestamp(x.reserved_at) - first < 23 * 3600_000), "StagingReservationMismatch")
  const messageId = outbox.provider_message_id
  if (outbox.status !== "delivered") return { stage: "frozen", complete: false }
  requireEvidence(/^[A-Za-z0-9_-]{1,128}$/.test(messageId ?? "") && attempts.some(x => x.result_category === "provider_accepted" && x.provider_message_id === messageId && x.result_http_status >= 200 && x.result_http_status < 300 && x.completed_at), "StagingProviderAcceptanceMissing")
  const base = { stage: "provider-accepted", complete: false, outboxId: outbox.id, frozenRequestSha256: frozen.frozenRequestSha256 }
  requireEvidence(events.every(x => x.provider_account_ref === approval.providerAccountRef && x.provider_message_id === messageId && x.outbox_id === outbox.id), "StagingCallbackIdentityMismatch")
  requireEvidence(new Set(events.map(x => `${x.provider_account_ref}/${x.provider_event_id}`)).size === events.length && events.every(x => !x.conflicted_at), "StagingCallbackReplayConflict")
  requireEvidence(!events.some(x => ["email.bounced", "email.failed", "email.complained", "email.suppressed", "email.delivery_delayed"].includes(x.event_type)), "StagingRecipientAdverseObservation")
  requireEvidence(events.every(x => Number.isFinite(timestamp(x.received_at)) && timestamp(x.received_at) >= accepted && timestamp(x.received_at) <= now && Number.isFinite(timestamp(x.provider_occurred_at)) && timestamp(x.provider_occurred_at) >= accepted - 300_000 && timestamp(x.provider_occurred_at) <= now + 300_000), "StagingCallbackClockInvalid")
  if (!events.some(x => x.event_type === "email.delivered")) return base
  const through = Math.max(...events.map(x => timestamp(x.received_at)))
  const handled = acknowledgements.some(x => x.review_covers_events === true && x.outbox_id === outbox.id && x.operator_reference === operatorReference && timestamp(x.reviewed_through) >= through && timestamp(x.reviewed_through) <= now && timestamp(x.acknowledged_at) >= timestamp(x.reviewed_through) && timestamp(x.acknowledged_at) <= now)
  return { ...base, stage: handled ? "human-acknowledged" : "recipient-observed", complete: handled }
}

export function assertStagingRequestTarget(requestUrl, authorizedOrigin) {
  const url = new URL(requestUrl)
  if (url.origin !== authorizedOrigin || url.username || url.password) {
    throw new Error("Canary navigation and contact requests must stay on the authorized staging origin")
  }
}

export function assertStagingResponseStatus(status) {
  if (status >= 300 && status < 400) {
    throw new Error("Canary navigation and contact requests must not redirect")
  }
}

/** Return evidence, never message contents, for the exact frozen provider request. */
export function stagingFrozenPayloadEvidence(raw, recipient) {
  const frozenRequestSha256 = typeof raw === "string" ? createHash("sha256").update(raw).digest("hex") : null
  let authorizedRecipient = false
  try {
    const value = JSON.parse(raw)
    authorizedRecipient = value?.to === recipient && !Object.hasOwn(value, "cc") && !Object.hasOwn(value, "bcc")
  } catch { /* An absent/malformed snapshot cannot qualify. */ }
  return { authorizedRecipient, frozenRequestSha256 }
}
