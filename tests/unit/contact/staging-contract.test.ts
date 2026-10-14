// @vitest-environment node
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  assertStagingApproval, assertStagingDatabaseIdentity, assertStagingMonitorHealthy,
  assertStagingRequestTarget, assertStagingResponseStatus, evaluateStagingDelivery,
  stagingIntakeConfig, stagingCanaryConfig, stagingDatabaseTargetSha256,
  stagingFrozenPayloadEvidence, stagingRehearsalMode,
} from "../../../scripts/qa/staging-contract.mjs"

const sha = (value: string) => createHash("sha256").update(value).digest("hex")
const now = Date.parse("2026-10-13T12:00:00.500Z")
const env = {
  STAGING_BASE_URL: "https://preview.example.test", STAGING_CANARY_AUTHORIZED_ORIGIN: "https://preview.example.test",
  STAGING_CANARY_AUTHORIZED: "staging-only", STAGING_DATABASE_URL: "postgresql://reader:secret@staging.example.test/staging",
  STAGING_CANARY_EMAIL: "sink@example.test", STAGING_CANARY_DELIVERY_EMAIL: "notification-sink@example.test",
  STAGING_CANARY_APPROVAL_FILE: "/private/staging-approval.json", STAGING_CANARY_APPROVAL_SHA256: "a".repeat(64),
  STAGING_CANARY_EXPECTED_ATTESTATION_SHA256: "b".repeat(64), STAGING_CANARY_DEPLOYMENT_BYPASS: "x".repeat(32),
  STAGING_CANARY_OPERATOR_REFERENCE: "primary", STAGING_CANARY_MONITOR_SECRET: "m".repeat(32),
  STAGING_CANARY_ACK_TIMEOUT_SECONDS: "120",
}
const approval = {
  schemaVersion: "gridninja-staging-approval.v1", scope: "isolated-staging", origin: env.STAGING_BASE_URL,
  approvedAt: "2026-10-13T11:00:00Z", expiresAt: "2026-10-13T13:00:00Z", approvalReference: "approval-1",
  deploymentReference: "deployment-1", isolationEvidenceReference: "isolation-1", hostProtectionEvidenceReference: "protected-1",
  sourceCommit: "a".repeat(40), buildAttestationSha256: env.STAGING_CANARY_EXPECTED_ATTESTATION_SHA256,
  databaseTargetSha256: stagingDatabaseTargetSha256(env.STAGING_DATABASE_URL), productionDatabaseTargetSha256: "c".repeat(64),
  databaseName: "staging", databaseUser: "reader", databaseAccessEvidenceReference: "readonly-1",
  providerAccountRef: "staging-account", providerBindingRef: "key-approval-1", providerKeySha256: "d".repeat(64),
  providerAuthorizationEvidenceReference: "provider-1", emailFrom: "GridNinja <sender@example.test>",
  emailTo: env.STAGING_CANARY_DELIVERY_EMAIL, canaryEmail: env.STAGING_CANARY_EMAIL, crmEnabled: false,
  callbackAuthenticationEvidenceReference: "callback-1", monitorDeliveryEvidenceReference: "monitor-1", watchdogEvidenceReference: "watchdog-1",
  primaryOperatorReference: "primary", backupOperatorReference: "backup",
}
function approvedRecord(overrides: Record<string, unknown> = {}) {
  const raw = JSON.stringify({ ...approval, ...overrides })
  return { raw, config: stagingCanaryConfig({ ...env, STAGING_CANARY_APPROVAL_SHA256: sha(raw) }) }
}
const leadId = "00000000-0000-4000-8000-000000000001", outboxId = "00000000-0000-4000-8000-000000000002"
function delivery() {
  const body = JSON.stringify({ from: approval.emailFrom, to: approval.emailTo, text: "private synthetic fixture" })
  return {
    lead: { id: leadId, accepted_at: "2026-10-13T11:59:58Z", redacted_at: null },
    outboxes: [{ id: outboxId, lead_id: leadId, channel: "internal_email", status: "delivered", attempt_count: 1,
      prepared_request_version: 1, provider_request_body: body, provider_request_body_sha256: sha(body),
      provider_account_ref: approval.providerAccountRef, provider_target_url: "https://api.resend.com/emails",
      provider_destination_ref: sha(JSON.stringify({ from: approval.emailFrom, to: approval.emailTo })),
      idempotency_key: `lead-notification/${leadId}`, first_provider_attempt_at: "2026-10-13T11:59:58.100Z", provider_message_id: "msg_1" }],
    attempts: [{ outbox_id: outboxId, lease_token: "lease1", claim_ordinal: 1, provider_account_ref: approval.providerAccountRef,
      reserved_at: "2026-10-13T11:59:58.100Z", result_category: "provider_accepted", provider_message_id: "msg_1", result_http_status: 200, completed_at: "2026-10-13T11:59:59Z" }],
    events: [{ outbox_id: outboxId, provider_account_ref: approval.providerAccountRef, provider_event_id: "evt_1", provider_message_id: "msg_1", event_type: "email.delivered", received_at: "2026-10-13T12:00:00.100Z", provider_occurred_at: "2026-10-13T12:00:00Z", conflicted_at: null as string | null }],
    acknowledgements: [{ outbox_id: outboxId, operator_reference: "primary", review_covers_events: true, reviewed_through: "2026-10-13T12:00:00.200Z", acknowledged_at: "2026-10-13T12:00:00.300Z" }],
  }
}

describe("explicit canary modes and traffic authorization", () => {
  it("defaults to intake smoke without claiming staffed observation coverage", () => {
    expect(stagingRehearsalMode({})).toBe("intake-smoke")
    expect(stagingRehearsalMode({ STAGING_CANARY_MODE: "observation-chain" })).toBe("observation-chain")
    expect(() => stagingRehearsalMode({ STAGING_CANARY_MODE: "release" })).toThrow()
    const intake: Partial<typeof env> = { ...env }
    delete intake.STAGING_CANARY_OPERATOR_REFERENCE
    delete intake.STAGING_CANARY_MONITOR_SECRET
    delete intake.STAGING_CANARY_ACK_TIMEOUT_SECONDS
    expect(stagingIntakeConfig(intake).baseURL).toBe(env.STAGING_BASE_URL)
    for (const key of Object.keys(intake)) expect(() => stagingIntakeConfig({ ...intake, [key]: "" })).toThrow()
    for (const key of Object.keys(env)) expect(() => stagingCanaryConfig({ ...env, [key]: "" })).toThrow()
  })
  it("rejects production aliases, credentials, redirects and origin escape", () => {
    for (const baseURL of ["https://gridninja.ai", "https://www.gridninja.ai", "https://gridninja.ai.", "https://staging.gridninja.ai.", "https://preview.example.test.", "https://GRIDNINJA.AI:443", "https://gridninja.ai:8443", "https://%67ridninja.ai", "https://gridninja\u3002ai", "https://user:secret@preview.example.test", "https://preview.example.test/contact", "http://preview.example.test"]) {
      expect(() => stagingIntakeConfig({ ...env, STAGING_BASE_URL: baseURL, STAGING_CANARY_AUTHORIZED_ORIGIN: new URL(baseURL).origin })).toThrow()
    }
    expect(() => stagingIntakeConfig({ ...env, STAGING_CANARY_AUTHORIZED: "yes" })).toThrow(/staging-only/)
    expect(() => stagingIntakeConfig({ ...env, STAGING_DATABASE_URL: "https://database.example.test" })).toThrow(/PostgreSQL/)
    expect(() => assertStagingRequestTarget("https://gridninja.ai/api/contact", env.STAGING_BASE_URL)).toThrow()
    expect(() => assertStagingRequestTarget(`${env.STAGING_BASE_URL}/api/contact`, env.STAGING_BASE_URL)).not.toThrow()
    for (const status of [301, 302, 303, 307, 308]) expect(() => assertStagingResponseStatus(status)).toThrow()
    expect(() => assertStagingResponseStatus(202)).not.toThrow()
  })
  it("requires one exact recipient, bounded operator reference, authentication and wait", () => {
    for (const value of ["invalid", "Name <sink@example.test>", "a@example.test,b@example.test", "a@example.test;b@example.test"]) {
      expect(() => stagingIntakeConfig({ ...env, STAGING_CANARY_EMAIL: value })).toThrow()
      expect(() => stagingIntakeConfig({ ...env, STAGING_CANARY_DELIVERY_EMAIL: value })).toThrow()
    }
    expect(() => stagingCanaryConfig({ ...env, STAGING_CANARY_OPERATOR_REFERENCE: "name@example.test" })).toThrow()
    expect(() => stagingCanaryConfig({ ...env, STAGING_CANARY_MONITOR_SECRET: "short" })).toThrow()
    for (const value of ["0", "901", "1.5", "NaN"]) expect(() => stagingCanaryConfig({ ...env, STAGING_CANARY_ACK_TIMEOUT_SECONDS: value })).toThrow()
  })
})

describe("independently reviewed private isolation record", () => {
  it("pins fresh origin, build, database, provider authorization and staffed ownership", () => {
    const { raw, config } = approvedRecord()
    expect(assertStagingApproval(raw, config, "observation-chain", now)).toEqual(approval)
    expect(() => assertStagingApproval(raw + " ", config, "observation-chain", now)).toThrow(/HashMismatch/)
    expect(() => assertStagingApproval(raw, config, "observation-chain", now + 3600_000)).toThrow(/Expired/)
    expect(() => assertStagingApproval(raw, { ...config, expectedAttestationSha256: "f".repeat(64) }, "observation-chain", now)).toThrow(/BuildMismatch/)
  })
  it.each([
    { databaseTargetSha256: "e".repeat(64) }, { productionDatabaseTargetSha256: approval.databaseTargetSha256 },
    { isolationEvidenceReference: "" }, { hostProtectionEvidenceReference: "" }, { providerAuthorizationEvidenceReference: "" },
    { providerKeySha256: "" }, { crmEnabled: true }, { emailTo: "other@example.test" },
    { primaryOperatorReference: "backup" }, { monitorDeliveryEvidenceReference: "" }, { watchdogEvidenceReference: "" },
  ])("fails closed on missing or conflicting approval %j", override => {
    const { raw, config } = approvedRecord(override)
    expect(() => assertStagingApproval(raw, config, "observation-chain", now)).toThrow()
  })
  it("matches actual database/user and forces read-only inspection", () => {
    expect(() => assertStagingDatabaseIdentity({ database_name: "staging", database_user: "reader", transaction_read_only: "on" }, approval)).not.toThrow()
    for (const change of [{ database_name: "production" }, { database_user: "writer" }, { transaction_read_only: "off" }]) {
      expect(() => assertStagingDatabaseIdentity({ database_name: "staging", database_user: "reader", transaction_read_only: "on", ...change }, approval)).toThrow()
    }
    expect(stagingDatabaseTargetSha256(env.STAGING_DATABASE_URL)).toBe(stagingDatabaseTargetSha256("postgresql://other:different@staging.example.test:5432/staging?secret=hidden"))
  })
})

describe("durable receipt, exact frozen request, recipient observation and human handling", () => {
  it("separates provider acceptance, recipient delivery and human acknowledgement", () => {
    const value = delivery()
    expect(evaluateStagingDelivery(value, approval, "primary", now)).toMatchObject({ stage: "human-acknowledged", complete: true })
    value.acknowledgements = []
    expect(evaluateStagingDelivery(value, approval, "primary", now)).toMatchObject({ stage: "recipient-observed", complete: false })
    value.events = []
    expect(evaluateStagingDelivery(value, approval, "primary", now)).toMatchObject({ stage: "provider-accepted", complete: false })
  })
  it("rejects changed bytes/key/account/destination and unapproved extra outboxes", () => {
    for (const change of [{ provider_request_body: "{}" }, { idempotency_key: "fresh-retry-key" }, { provider_account_ref: "other-account" }, { provider_target_url: "https://other.test/emails" }, { provider_destination_ref: "0".repeat(64) }, { attempt_count: 7 }, { prepared_request_version: 2 }]) {
      const value = delivery(); Object.assign(value.outboxes[0], change)
      expect(() => evaluateStagingDelivery(value, approval, "primary", now)).toThrow()
    }
    const value = delivery(); value.outboxes.push({ ...value.outboxes[0], channel: "crm_webhook" })
    expect(() => evaluateStagingDelivery(value, approval, "primary", now)).toThrow(/UnexpectedDeliveryChannel/)
  })
  it("requires an accepted ledger response and unique lease reservations", () => {
    for (const change of [{ result_category: "uncertain" }, { result_http_status: 500 }, { provider_message_id: "other-message" }, { provider_account_ref: "other-account" }]) {
      const value = delivery(); Object.assign(value.attempts[0], change)
      expect(() => evaluateStagingDelivery(value, approval, "primary", now)).toThrow()
    }
    const value = delivery(); value.attempts.push({ ...value.attempts[0] })
    expect(() => evaluateStagingDelivery(value, approval, "primary", now)).toThrow(/ReservationMismatch/)
  })
  it("rejects wrong-account, unmatched, replay-conflicted or old callback evidence", () => {
    for (const change of [{ provider_account_ref: "other-account" }, { provider_message_id: "other-message" }, { outbox_id: "other-outbox" }, { conflicted_at: "2026-10-13T12:00:00Z" }, { received_at: "2026-10-12T00:00:00Z" }]) {
      const value = delivery(); Object.assign(value.events[0], change)
      expect(() => evaluateStagingDelivery(value, approval, "primary", now)).toThrow()
    }
    const duplicate = delivery(); duplicate.events.push({ ...duplicate.events[0] })
    expect(() => evaluateStagingDelivery(duplicate, approval, "primary", now)).toThrow(/ReplayConflict/)
  })
  it.each(["email.bounced", "email.failed", "email.complained", "email.suppressed", "email.delivery_delayed"])("does not hide %s behind prior delivery or acknowledgement", event_type => {
    const value = delivery(); value.events.push({ ...value.events[0], provider_event_id: "evt_2", event_type })
    expect(() => evaluateStagingDelivery(value, approval, "primary", now)).toThrow(/Adverse/)
  })
  it("requires the assigned human to review every received event, preserving millisecond cutoffs", () => {
    const value = delivery()
    value.acknowledgements[0].reviewed_through = "2026-10-13T12:00:00.099Z"
    expect(evaluateStagingDelivery(value, approval, "primary", now).complete).toBe(false)
    const pgDates = { ...value, events: value.events.map(x => ({ ...x, received_at: new Date(x.received_at) })), acknowledgements: value.acknowledgements.map(x => ({ ...x, reviewed_through: new Date(x.reviewed_through) })) }
    expect(evaluateStagingDelivery(pgDates, approval, "primary", now).complete).toBe(false)
    expect(evaluateStagingDelivery(delivery(), approval, "unassigned", now).complete).toBe(false)
  })
  it("returns only bounded evidence, not bodies, recipients or provider secrets", () => {
    const result = evaluateStagingDelivery(delivery(), approval, "primary", now)
    expect(JSON.stringify(result)).not.toMatch(/private|example.test|providerKey/)
    const body = { to: approval.emailTo, text: "private" }
    for (const raw of [null, "{", "null", JSON.stringify({ ...body, cc: [] }), JSON.stringify({ ...body, bcc: "hidden@example.test" }), JSON.stringify({ ...body, to: [approval.emailTo] })]) expect(stagingFrozenPayloadEvidence(raw, approval.emailTo).authorizedRecipient).toBe(false)
  })
})

describe("independent monitor is not a status-code-only check", () => {
  const healthy = { ok: true, healthy: true, busy: false, degraded: false, notificationFailures: 0, activeIncidents: 0, databaseAvailable: true }
  it("requires a completed healthy run", () => {
    expect(() => assertStagingMonitorHealthy(200, healthy)).not.toThrow()
    for (const body of [{}, { ...healthy, busy: true }, { ...healthy, notificationFailures: 1 }, { ...healthy, degraded: true }, { ...healthy, healthy: false }, { ...healthy, activeIncidents: 1 }, { ...healthy, databaseAvailable: null }]) expect(() => assertStagingMonitorHealthy(200, body)).toThrow()
    expect(() => assertStagingMonitorHealthy(503, healthy)).toThrow(/SinkUnavailable/)
  })
})
