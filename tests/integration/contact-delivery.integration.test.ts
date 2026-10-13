import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { Pool, type PoolClient } from "pg"
import { drizzle } from "drizzle-orm/neon-http"
import type { NeonQueryFunction } from "@neondatabase/serverless"
import * as leadSchema from "@/db/schema"
import * as observationsSchema from "@/db/observations-schema"
const databaseSchema = { ...leadSchema, ...observationsSchema }
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createLeadRepository } from "@/server/leads/repository"
import { mapClaim } from "@/lib/contact/repository-adapter"
import { processOneLeadDelivery, type DeliveryOperationsRepository } from "@/lib/contact/operations"
import { requestDigest } from "@/lib/contact/provider-request"
import { deliverToConfiguredProvider, prepareProviderRequest } from "@/lib/contact/providers"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/contact/providers", async (original) => ({ ...await original<typeof import("@/lib/contact/providers")>(), deliverToConfiguredProvider: vi.fn() }))
vi.mock("@/lib/contact/log", () => ({ logContactEvent: vi.fn() }))

const connectionString = process.env.TEST_DATABASE_URL
const describeDatabase = connectionString ? describe : describe.skip

// Execute the production Neon/Drizzle query builder against isolated local
// Postgres. Lazy query descriptors preserve Neon batch transaction semantics;
// this adapter never opens an HTTP connection or contacts a provider.
type LocalQuery = { text: string; params: unknown[]; options: { arrayMode?: boolean } }
function localDatabase(pool: Pool) {
  async function execute(query: LocalQuery, client: Pool | PoolClient = pool) {
    return client.query({ text: query.text, values: query.params, ...(query.options.arrayMode ? { rowMode: "array" } : {}) })
  }
  const client = {
    query(text: string, params: unknown[], options: LocalQuery["options"] = {}) {
      const query = { text, params, options }
      return { ...query, then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => execute(query).then(resolve, reject) }
    },
    async transaction(queries: LocalQuery[]) {
      const connection = await pool.connect()
      try {
        await connection.query("begin")
        const results = []
        for (const query of queries) results.push(await execute(query, connection))
        await connection.query("commit")
        return results
      } catch (error) {
        await connection.query("rollback")
        throw error
      } finally { connection.release() }
    },
  }
  return drizzle({ client: client as unknown as NeonQueryFunction<false, false>, schema: databaseSchema })
}

describeDatabase("deployed-schema delivery retirement and retention", () => {
  const schema = `contact_delivery_${randomUUID().replaceAll("-", "")}`
  const admin = new Pool({ connectionString })
  const pool = new Pool({ connectionString, application_name: schema, options: `-c search_path=${schema},public -c statement_timeout=10000` })
  const database = localDatabase(pool)
  const repository = createLeadRepository(database)
  const now = new Date()
  const later = new Date(now.getTime() + 31_000)

  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    for (const name of ["0000_contact_intake.sql", "0001_contact_intake_v2.sql", "0002_delivery_safeguards.sql"]) {
      const migration = (await readFile(new URL(`../../drizzle/${name}`, import.meta.url), "utf8")).replaceAll('"public".', `"${schema}".`)
      await pool.query(migration)
    }
  })
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubEnv("RESEND_API_KEY", "synthetic-token")
    vi.stubEnv("RESEND_ACCOUNT_BINDING_REF", "verified-fixture")
    vi.stubEnv("RESEND_APPROVED_KEY_SHA256", requestDigest("synthetic-token"))
    vi.stubEnv("RESEND_ACCOUNT_REF", "test-account")
    vi.stubEnv("LEAD_EMAIL_FROM", "test@example.test")
    vi.stubEnv("LEAD_EMAIL_TO", "recipient@example.test")
    await pool.query("TRUNCATE lead_submissions CASCADE")
  })
  afterAll(async () => {
    vi.unstubAllEnvs()
    await pool.end()
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await admin.end()
  })

  async function fixture({ attempts = 0, expires = new Date(now.getTime() + 60_000), includeCrm = false } = {}) {
    const result = await repository.acceptLead({
      requestId: randomUUID(), clientSubmissionId: randomUUID(), requestFingerprint: "a".repeat(64),
      schemaVersion: 2, formType: "contact", intent: "capacity-audit", name: "Test Operator", company: "Example",
      email: "operator@example.test", normalizedEmail: "operator@example.test", source: "contact-page", ipHash: "b".repeat(64),
      turnstileHostname: "localhost", turnstileAction: "contact", acceptedAt: now, includeCrmWebhook: includeCrm,
    })
    await pool.query("UPDATE lead_submissions SET redact_after = $1 WHERE id = $2", [expires, result.leadId])
    await pool.query("UPDATE lead_delivery_outbox SET attempt_count = $1 WHERE lead_id = $2", [attempts, result.leadId])
    return { leadId: result.leadId, id: result.outboxIds[0], ids: result.outboxIds }
  }
  async function row(id: string) {
    return (await pool.query("SELECT * FROM lead_delivery_outbox WHERE id = $1", [id])).rows[0]
  }
  function operations(clock: Date): DeliveryOperationsRepository {
    return {
      claimNextDueOutbox: async (time, duration) => mapClaim(await repository.claimNextDueOutbox(time, duration)),
      claimOutboxById: async (id, time, duration) => mapClaim(await repository.claimOutboxById(id, time, duration)),
      prepareAndReserveProviderAttempt: repository.prepareAndReserveProviderAttempt, recordProviderAttemptResult: repository.recordProviderAttemptResult,
      isOutboxSendAllowed: repository.isOutboxSendAllowed, isOutboxAlertAllowed: repository.isOutboxAlertAllowed,
      markTerminalAlertPublished: repository.markTerminalAlertPublished,
      markOutboxDelivered: async (id, token, providerId) => (await repository.markOutboxDelivered(id, token, providerId, clock)).updated,
      rescheduleOutbox: async (id, token, update) => (await repository.rescheduleOutbox(id, token, update, clock)).updated,
      markOutboxDeadLetter: async (id, token, update, time) => (await repository.markOutboxDeadLetter(id, token, update, time)).updated,
      getOldestDueOutboxAge: async time => (await repository.getOldestDueOutboxAge(time))?.ageMs ?? null,
      listDueOrLeaseExpiredOutbox: repository.listDueOrLeaseExpiredOutbox,
      redactExpiredLeads: async (time, limit) => (await repository.redactExpiredLeads(time, limit)).length,
      deleteExpiredLeads: async (time, limit) => (await repository.deleteExpiredLeads(time, limit)).length,
    }
  }

  it("persists exhausted send-stop before failed alert publication and retries alert only", async () => {
    const { id } = await fixture({ attempts: 5 })
    vi.mocked(deliverToConfiguredProvider).mockResolvedValue({ ok: false, status: 500, errorCode: "resend_http_500", retryable: true })
    const publish = vi.fn().mockImplementation(async () => {
      expect((await row(id)).status).toBe("dead_letter")
      throw new Error("queue outage")
    })
    await expect(processOneLeadDelivery(operations(now), { outboxId: id, now, publishAlert: publish })).rejects.toThrow("queue outage")
    expect(await row(id)).toMatchObject({ attempt_count: 6, last_error_code: "alert_pending:resend_http_500" })
    expect(await repository.claimOutboxById(id, now, 30_000)).toBeNull()
    expect((await repository.listDueOrLeaseExpiredOutbox(later)).map(item => item.id)).toEqual([id])
    publish.mockResolvedValue(undefined)
    await expect(processOneLeadDelivery(operations(later), { outboxId: id, now: later, publishAlert: publish })).resolves.toEqual({ state: "dead_letter" })
    expect(deliverToConfiguredProvider).toHaveBeenCalledTimes(1)
    expect(publish.mock.calls[1][0]).toEqual(publish.mock.calls[0][0])
    expect(await row(id)).toMatchObject({ status: "dead_letter", attempt_count: 6, last_error_code: "resend_http_500", lease_token: null })
    expect(await repository.listDueOrLeaseExpiredOutbox(later)).toEqual([])
  })

  it("never sends after a crashed sixth claim is reclaimed", async () => {
    const { id } = await fixture({ attempts: 5 })
    const claim = await repository.claimOutboxById(id, now, 30_000)
    expect(claim?.delivery.attemptCount).toBe(6)
    await processOneLeadDelivery(operations(later), { outboxId: id, now: later, publishAlert: vi.fn() })
    expect(deliverToConfiguredProvider).not.toHaveBeenCalled()
    expect(await row(id)).toMatchObject({ status: "dead_letter", last_error_code: "attempt_limit_reached" })
  })

  it("allows one concurrent claimant and rejects stale send/terminal/alert mutations", async () => {
    const { id } = await fixture()
    const claims = await Promise.all([repository.claimOutboxById(id, now, 30_000), repository.claimOutboxById(id, now, 30_000)])
    expect(claims.filter(Boolean)).toHaveLength(1)
    const old = claims.find(Boolean)!.delivery.leaseToken!
    const next = await repository.claimOutboxById(id, later, 30_000)
    expect(next?.delivery.leaseToken).not.toBe(old)
    expect(await repository.isOutboxSendAllowed(id, old, later)).toBe(false)
    expect((await repository.markOutboxDelivered(id, old, "stale", later)).updated).toBe(false)
    expect((await repository.markOutboxDeadLetter(id, old, { errorCode: "resend_http_500" }, later)).updated).toBe(false)
    expect((await repository.markOutboxDeadLetter(id, next!.delivery.leaseToken!, { errorCode: "resend_http_500" }, later)).updated).toBe(true)
    expect(await repository.markTerminalAlertPublished(id, old, later)).toBe(false)
  })

  it("excludes expired and previously redacted leads from claims and sweep candidates", async () => {
    const expired = await fixture({ expires: now })
    const redacted = await fixture()
    await pool.query("UPDATE lead_submissions SET redacted_at = $1, name = NULL WHERE id = $2", [now, redacted.leadId])
    expect(await repository.claimOutboxById(expired.id, now, 30_000)).toBeNull()
    expect(await repository.claimOutboxById(redacted.id, now, 30_000)).toBeNull()
    expect(await repository.listDueOrLeaseExpiredOutbox(now)).toEqual([])
    expect(await repository.getOldestDueOutboxAge(now)).toBeNull()
    expect((await repository.redactExpiredLeads(now)).sort()).toEqual([expired.leadId, redacted.leadId].sort())
    expect(await row(redacted.id)).toMatchObject({ status: "dead_letter", last_error_code: "retention_expired" })
  })

  it("atomically redacts PII, retires outstanding work and invalidates a processing lease", async () => {
    const { id, ids, leadId } = await fixture({ includeCrm: true })
    const claim = await repository.claimOutboxById(id, now, 30_000)
    await pool.query("UPDATE lead_submissions SET redact_after = $1 WHERE id = $2", [now, leadId])
    await repository.redactExpiredLeads(now)
    const lead = (await pool.query("SELECT * FROM lead_submissions WHERE id = $1", [leadId])).rows[0]
    expect(lead).toMatchObject({ name: null, email: null, request_fingerprint: null, status: "dead_letter" })
    for (const outbox of ids) expect(await row(outbox)).toMatchObject({ status: "dead_letter", lease_token: null, last_error_code: "retention_expired" })
    expect(await repository.isOutboxSendAllowed(id, claim!.delivery.leaseToken!, now)).toBe(false)
    expect((await repository.markOutboxDelivered(id, claim!.delivery.leaseToken!, "late-provider-response", now)).updated).toBe(false)
    expect(await repository.listDueOrLeaseExpiredOutbox(later)).toEqual([])
  })

  it("retains PII-free terminal alerts through redaction without another send or attempt", async () => {
    const { id, leadId } = await fixture()
    const claim = await repository.claimOutboxById(id, now, 30_000)
    await repository.markOutboxDeadLetter(id, claim!.delivery.leaseToken!, { errorCode: "resend_not_configured" }, now)
    await pool.query("UPDATE lead_submissions SET redact_after = $1 WHERE id = $2", [now, leadId])
    await repository.redactExpiredLeads(now)
    const publish = vi.fn()
    await processOneLeadDelivery(operations(now), { outboxId: id, now, publishAlert: publish })
    expect(publish.mock.calls.map(call => call[0].type)).toEqual(["configuration_failure", "dead_letter"])
    expect(await row(id)).toMatchObject({ attempt_count: 1, last_error_code: "resend_not_configured", dead_lettered_at: now })
    expect(deliverToConfiguredProvider).not.toHaveBeenCalled()
  })

  it("rolls back PII redaction if retiring an outbox fails", async () => {
    const { id, leadId } = await fixture({ expires: now })
    await pool.query("CREATE FUNCTION deny_retirement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test retirement failure'; END $$")
    await pool.query("CREATE TRIGGER deny_retirement BEFORE UPDATE ON lead_delivery_outbox FOR EACH ROW EXECUTE FUNCTION deny_retirement()")
    try {
      await expect(repository.redactExpiredLeads(now)).rejects.toThrow()
      expect((await pool.query("SELECT name, redacted_at FROM lead_submissions WHERE id = $1", [leadId])).rows[0]).toEqual({ name: "Test Operator", redacted_at: null })
      expect((await row(id)).status).toBe("pending")
    } finally {
      await pool.query("DROP TRIGGER deny_retirement ON lead_delivery_outbox")
      await pool.query("DROP FUNCTION deny_retirement()")
    }
  })

  it("rolls back frozen-snapshot erasure together with lead PII if retirement fails", async () => {
    const { id, leadId } = await fixture()
    const { request } = await reserve(id)
    await pool.query("UPDATE lead_submissions SET redact_after = now() - interval '1 second' WHERE id = $1", [leadId])
    await pool.query("CREATE FUNCTION deny_snapshot_retirement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test retirement failure'; END $$")
    await pool.query("CREATE TRIGGER deny_snapshot_retirement BEFORE UPDATE ON lead_delivery_outbox FOR EACH ROW EXECUTE FUNCTION deny_snapshot_retirement()")
    try {
      await expect(repository.redactExpiredLeads(new Date())).rejects.toThrow()
      expect((await pool.query("SELECT name, redacted_at FROM lead_submissions WHERE id = $1", [leadId])).rows[0]).toEqual({ name: "Test Operator", redacted_at: null })
      expect(await row(id)).toMatchObject({ status: "processing", provider_request_body: request.bodyUtf8, provider_request_body_sha256: request.bodySha256, provider_target_url: request.targetUrl })
    } finally {
      await pool.query("DROP TRIGGER deny_snapshot_retirement ON lead_delivery_outbox")
      await pool.query("DROP FUNCTION deny_snapshot_retirement()")
    }
  })

  it("claim and retention contend without returning sendable expired work", async () => {
    const { id, leadId } = await fixture({ expires: now })
    const [claim] = await Promise.all([repository.claimOutboxById(id, now, 30_000), repository.redactExpiredLeads(now)])
    expect(claim).toBeNull()
    expect((await row(id)).status).toBe("dead_letter")
    expect((await pool.query("SELECT redacted_at FROM lead_submissions WHERE id = $1", [leadId])).rows[0].redacted_at).toEqual(now)
  })

  it("skips a still-eligible lead locked by retention before touching its outbox", async () => {
    const { id, leadId } = await fixture()
    const retention = await pool.connect()
    try {
      await retention.query("begin")
      await retention.query("SELECT id FROM lead_submissions WHERE id = $1 FOR UPDATE", [leadId])
      // This used to claim the outbox, then block while updating its lead. The
      // joined SKIP LOCKED candidate must decline immediately instead.
      expect(await repository.claimOutboxById(id, now, 30_000)).toBeNull()
      expect(await row(id)).toMatchObject({ status: "pending", attempt_count: 0, lease_token: null })
    } finally {
      await retention.query("rollback")
      retention.release()
    }
  })
  async function reserve(id: string) {
    const claim = await repository.claimOutboxById(id, now, 30_000)
    const mapped = mapClaim(claim)
    if (!mapped || mapped.kind !== "send") throw new Error("Expected send claim")
    const request = prepareProviderRequest({ channel: mapped.delivery.channel, eventId: id, idempotencyKey: mapped.delivery.idempotencyKey, lead: mapped.lead })
    return { claim: mapped, request, reservation: await repository.prepareAndReserveProviderAttempt(id, mapped.delivery.leaseToken, request) }
  }

  it("does not freeze a request when expiry commits while preparation waits on the lead lock", async () => {
    const { id, leadId } = await fixture()
    const claim = mapClaim(await repository.claimOutboxById(id, now, 30_000))
    if (!claim || claim.kind !== "send") throw new Error("Expected send claim")
    const request = prepareProviderRequest({ channel: claim.delivery.channel, eventId: id, idempotencyKey: claim.delivery.idempotencyKey, lead: claim.lead })
    const retention = await pool.connect()
    let preparation: ReturnType<typeof repository.prepareAndReserveProviderAttempt> | undefined
    try {
      await retention.query("begin")
      await retention.query("UPDATE lead_submissions SET redact_after = now() - interval '1 second' WHERE id = $1", [leadId])
      preparation = repository.prepareAndReserveProviderAttempt(id, claim.delivery.leaseToken, request)
      let waiting = false
      for (let attempt = 0; attempt < 200; attempt++) {
        const result = await admin.query("SELECT 1 FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock' AND query LIKE '%WITH eligible_lead AS MATERIALIZED%'", [schema])
        if (result.rows.length) { waiting = true; break }
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      expect(waiting).toBe(true)
      // A concurrent retention pass skips the locked lead, then recovers it on
      // the next pass. Preparation must re-evaluate expiry after the commit.
      expect(await repository.redactExpiredLeads(new Date())).toEqual([])
      await retention.query("commit")
      expect(await preparation).toEqual({ kind: "stale" })
      expect(await repository.redactExpiredLeads(new Date())).toEqual([leadId])
      expect(await row(id)).toMatchObject({ provider_request_body: null, provider_target_url: null, lease_token: null, status: "dead_letter" })
      expect((await pool.query("SELECT count(*) FROM lead_provider_attempts WHERE outbox_id = $1", [id])).rows[0].count).toBe("0")
    } finally {
      await retention.query("rollback")
      await preparation?.catch(() => {})
      retention.release()
    }
  })

  it("only the first same-lease preparation permits a send and preserves original bytes", async () => {
    const { id } = await fixture()
    const { claim, request, reservation } = await reserve(id)
    expect(reservation.kind).toBe("ready")
    const results = await Promise.all([
      repository.prepareAndReserveProviderAttempt(id, claim.delivery.leaseToken, request),
      repository.prepareAndReserveProviderAttempt(id, claim.delivery.leaseToken, request),
    ])
    expect(results).toEqual([{ kind: "already_reserved" }, { kind: "already_reserved" }])
    expect((await pool.query("SELECT count(*) FROM lead_provider_attempts WHERE outbox_id = $1", [id])).rows[0].count).toBe("1")
    expect((await row(id)).provider_request_body).toBe(request.bodyUtf8)
  })

  it("grants one permission when two preparations race for the same first lease", async () => {
    const { id } = await fixture()
    const claimed = mapClaim(await repository.claimOutboxById(id, now, 30_000))
    if (!claimed || claimed.kind !== "send") throw new Error("Missing claim")
    const request = prepareProviderRequest({ channel: claimed.delivery.channel, eventId: id, idempotencyKey: claimed.delivery.idempotencyKey, lead: claimed.lead })
    const results = await Promise.all([
      repository.prepareAndReserveProviderAttempt(id, claimed.delivery.leaseToken, request),
      repository.prepareAndReserveProviderAttempt(id, claimed.delivery.leaseToken, request),
    ])
    expect(results.map(result => result.kind).sort()).toEqual(["already_reserved", "ready"])
  })

  it("keeps original request bytes and clock across a fresh lease after templates change", async () => {
    const { id } = await fixture(); const first = await reserve(id)
    if (first.reservation.kind !== "ready") throw new Error("Missing reservation")
    await repository.rescheduleOutbox(id, first.claim.delivery.leaseToken, { nextAttemptAt: now, errorCode: "provider_timeout" }, now)
    const next = mapClaim(await repository.claimOutboxById(id, now, 30_000))
    if (!next || next.kind !== "send") throw new Error("Missing next claim")
    const body = JSON.stringify({ changedTemplate: true })
    const second = await repository.prepareAndReserveProviderAttempt(id, next.delivery.leaseToken, { ...first.request, bodyUtf8: body, bodySha256: requestDigest(body) })
    expect(second.kind).toBe("ready")
    if (second.kind === "ready") {
      expect(second.firstAttemptAt).toEqual(first.reservation.firstAttemptAt)
      expect(second.request).toEqual(first.request)
    }
  })

  it("stops stale-clock, changed-account and changed-destination attempts durably", async () => {
    for (const reason of ["clock", "account", "destination"] as const) {
      const { id } = await fixture()
      const { claim, request } = await reserve(id)
      if (reason === "clock") await pool.query("UPDATE lead_delivery_outbox SET first_provider_attempt_at = now() - interval '23 hours' WHERE id = $1", [id])
      const changed = { ...request, ...(reason === "account" ? { accountRef: "other-account" } : {}), ...(reason === "destination" ? { destinationRef: "f".repeat(64) } : {}) }
      const result = await repository.prepareAndReserveProviderAttempt(id, claim.delivery.leaseToken, changed)
      expect(result.kind).toBe("stopped")
      expect(await row(id)).toMatchObject({ status: "dead_letter", review_reason: reason === "clock" ? "provider_retry_window_expired" : reason === "account" ? "provider_account_changed" : "provider_destination_changed" })
    }
  })

  it("rejects a future database clock and incomplete snapshot", async () => {
    for (const corruption of ["future", "partial"]) {
      const { id } = await fixture(); const { claim, request } = await reserve(id)
      await pool.query(corruption === "future" ? "UPDATE lead_delivery_outbox SET first_provider_attempt_at = now() + interval '1 hour' WHERE id = $1" : "UPDATE lead_delivery_outbox SET provider_request_body = NULL WHERE id = $1", [id])
      expect((await repository.prepareAndReserveProviderAttempt(id, claim.delivery.leaseToken, request)).kind).toBe("stopped")
    }
  })

  it("erases snapshots at retention but preserves bounded late-result evidence without requeue", async () => {
    const { id, leadId } = await fixture(); const { claim, request, reservation } = await reserve(id)
    if (reservation.kind !== "ready") throw new Error("Missing reservation")
    // PostgreSQL stores microseconds; JS Date has milliseconds. Use an explicit
    // past deadline rather than occasionally asking retention to run before it.
    await pool.query("UPDATE lead_submissions SET redact_after = now() - interval '1 second' WHERE id = $1", [leadId])
    expect(await repository.redactExpiredLeads(new Date())).toEqual([leadId])
    expect(await row(id)).toMatchObject({ provider_request_body: null, provider_target_url: null, lease_token: null, status: "dead_letter" })
    expect(await repository.prepareAndReserveProviderAttempt(id, claim.delivery.leaseToken, request)).toEqual({ kind: "stale" })
    expect(await repository.recordProviderAttemptResult(reservation.reservationId, { ok: true, status: 200, providerMessageId: "late-id" })).toBe(true)
    expect((await pool.query("SELECT provider_message_id FROM lead_provider_attempts WHERE id = $1", [reservation.reservationId])).rows[0].provider_message_id).toBe("late-id")
    expect((await repository.markOutboxDelivered(id, claim.delivery.leaseToken, "late-id")).updated).toBe(false)
    await pool.query("DELETE FROM lead_submissions WHERE id = $1", [leadId])
    expect(await repository.recordProviderAttemptResult(reservation.reservationId, { ok: true, status: 200, providerMessageId: "late-id" })).toBe(false)
  })

})
