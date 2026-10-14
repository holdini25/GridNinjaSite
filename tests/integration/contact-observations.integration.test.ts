import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { Pool } from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProviderDeliveryEvent } from "@/lib/contact/provider-events"
import { requestDigest, type PreparedProviderRequest } from "@/lib/contact/provider-request"
import { createLeadRepository } from "@/server/leads/repository"
import { createObservationsRepository } from "@/server/leads/observations-repository"
import { localDatabase } from "./helpers/local-database"

vi.mock("server-only", () => ({}))

const connectionString = process.env.TEST_DATABASE_URL
const describeDatabase = connectionString ? describe : describe.skip
const thresholds = { recipientObservationMs: 60_000, handlingMs: 300_000 }

describeDatabase("deployed-schema provider observations and operator handling", () => {
  const schema = `contact_observations_${randomUUID().replaceAll("-", "")}`
  const admin = new Pool({ connectionString })
  const options = `-c search_path=${schema},public -c statement_timeout=10000`
  // Independent single-connection pools make concurrent calls use competing
  // PostgreSQL sessions, including unique-index and visibility races.
  const pool = new Pool({ connectionString, options, max: 1 })
  const peerPool = new Pool({ connectionString, options, max: 1 })
  const database = localDatabase(pool)
  const repository = createLeadRepository(database)
  const observations = createObservationsRepository(database)
  const peerObservations = createObservationsRepository(localDatabase(peerPool))

  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    for (const name of ["0000_contact_intake.sql", "0001_contact_intake_v2.sql", "0002_delivery_safeguards.sql"]) {
      const migration = (await readFile(new URL(`../../drizzle/${name}`, import.meta.url), "utf8")).replaceAll('"public".', `"${schema}".`)
      await pool.query(migration)
    }
  })
  beforeEach(async () => {
    // Unmatched events have no lead FK and must be cleared explicitly.
    await pool.query("TRUNCATE lead_submissions, lead_provider_events, lead_operations_heartbeats CASCADE")
  })
  afterAll(async () => {
    await Promise.all([pool.end(), peerPool.end()])
    try { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`) } finally { await admin.end() }
  })

  async function fixture() {
    const result = await repository.acceptLead({
      requestId: randomUUID(), clientSubmissionId: randomUUID(), requestFingerprint: "a".repeat(64),
      schemaVersion: 2, formType: "contact", intent: "capacity-audit", name: "Test Operator", company: "Example",
      email: "operator@example.test", normalizedEmail: "operator@example.test", source: "contact-page", ipHash: "b".repeat(64),
      turnstileHostname: "localhost", turnstileAction: "contact", acceptedAt: new Date(Date.now() - 3_600_000), includeCrmWebhook: false,
    })
    expect(result.kind).toBe("accepted")
    return { leadId: result.leadId, id: result.outboxIds[0] }
  }
  async function outbox(id: string) {
    return (await pool.query("SELECT * FROM lead_delivery_outbox WHERE id = $1", [id])).rows[0]
  }
  async function eventRow(accountRef: string, eventId: string) {
    return (await pool.query("SELECT * FROM lead_provider_events WHERE provider_account_ref = $1 AND provider_event_id = $2", [accountRef, eventId])).rows[0]
  }
  function event(overrides: Partial<ProviderDeliveryEvent> = {}): ProviderDeliveryEvent {
    return { accountRef: "account-a", eventId: randomUUID(), providerMessageId: randomUUID(), eventType: "email.delivered", occurredAt: new Date(), ...overrides }
  }
  async function reserve(id: string, accountRef = "account-a") {
    const claim = await repository.claimOutboxById(id, new Date(), 30_000)
    if (!claim?.delivery.leaseToken) throw new Error("FixtureClaimFailed")
    const body = JSON.stringify({ from: "sender@example.test", to: "operator@example.test", subject: "Synthetic test", text: "Synthetic test" })
    const request: PreparedProviderRequest = {
      version: 1, channel: claim.delivery.channel, idempotencyKey: claim.delivery.idempotencyKey,
      bodyUtf8: body, bodySha256: requestDigest(body), targetUrl: "https://api.resend.com/emails",
      accountRef, destinationRef: requestDigest("synthetic-destination"),
    }
    const reservation = await repository.prepareAndReserveProviderAttempt(id, claim.delivery.leaseToken, request)
    if (reservation.kind !== "ready") throw new Error(`FixtureReservationFailed:${reservation.kind}`)
    return { reservationId: reservation.reservationId, token: claim.delivery.leaseToken }
  }
  async function providerAccept(id: string, providerMessageId: string, accountRef = "account-a") {
    const attempt = await reserve(id, accountRef)
    expect(await repository.recordProviderAttemptResult(attempt.reservationId, { ok: true, status: 200, providerMessageId })).toBe(true)
    expect((await repository.markOutboxDelivered(id, attempt.token, providerMessageId)).updated).toBe(true)
    return attempt
  }

  it("reconciles an early callback after provider acceptance without changing the callback identity", async () => {
    const { id } = await fixture()
    const callback = event()
    await peerObservations.receiveProviderEvent(callback)
    const early = await eventRow(callback.accountRef, callback.eventId)
    expect(early.outbox_id).toBeNull()
    expect(await observations.reconcileProviderEvents()).toBe(0)

    await providerAccept(id, callback.providerMessageId)
    expect(await observations.reconcileProviderEvents()).toBe(1)
    expect(await observations.reconcileProviderEvents()).toBe(0)
    expect(await eventRow(callback.accountRef, callback.eventId)).toMatchObject({ id: early.id, outbox_id: id, received_at: early.received_at })
    expect(await observations.getDeliveryObservation(id)).toEqual({ durableAcceptance: true, providerAcceptance: "accepted", recipientDelivery: "delivered", operatorAcknowledgement: "unknown" })
  })

  it("reconciles a matchable early callback behind a full batch of unrelated unmatched events", async () => {
    const { id } = await fixture()
    const unrelated = Array.from({ length: 1000 }, (_, index) => ({ id: randomUUID(), event_id: `unrelated-event-${index}`, message_id: `unrelated-message-${index}` }))
    await pool.query(`
      INSERT INTO lead_provider_events (id, provider_account_ref, provider_event_id, provider_message_id, event_type, provider_occurred_at, received_at)
      SELECT item.id::uuid, 'account-a', item.event_id, item.message_id, 'email.delivered',
        clock_timestamp() - interval '1 hour', clock_timestamp() - interval '1 hour'
      FROM jsonb_to_recordset($1::jsonb) AS item(id text, event_id text, message_id text)
    `, [JSON.stringify(unrelated)])
    const callback = event()
    await peerObservations.receiveProviderEvent(callback)
    expect((await eventRow(callback.accountRef, callback.eventId)).outbox_id).toBeNull()
    await providerAccept(id, callback.providerMessageId)

    expect(await observations.reconcileProviderEvents()).toBe(1)
    expect((await eventRow(callback.accountRef, callback.eventId)).outbox_id).toBe(id)
    expect((await observations.getDeliveryObservation(id))?.recipientDelivery).toBe("delivered")
    expect((await pool.query("SELECT count(*)::int AS count FROM lead_provider_events WHERE outbox_id IS NULL")).rows[0].count).toBe(1000)
    expect(await observations.reconcileProviderEvents()).toBe(0)
  })

  it("converges when a callback and provider acceptance race on separate sessions", async () => {
    const { id } = await fixture()
    const callback = event()
    const attempt = await reserve(id)
    await Promise.all([
      peerObservations.receiveProviderEvent(callback),
      repository.recordProviderAttemptResult(attempt.reservationId, { ok: true, status: 200, providerMessageId: callback.providerMessageId }),
    ])
    await observations.reconcileProviderEvents()
    expect((await eventRow(callback.accountRef, callback.eventId)).outbox_id).toBe(id)
    expect((await pool.query("SELECT count(*)::int AS count FROM lead_provider_events")).rows[0].count).toBe(1)
    // The attempt ledger proves provider acceptance even before outbox finalization.
    expect((await outbox(id)).status).toBe("processing")
    expect((await observations.getDeliveryObservation(id))?.providerAcceptance).toBe("accepted")
  })

  it("isolates provider accounts even when both message and event IDs collide", async () => {
    const first = await fixture()
    const second = await fixture()
    const callback = event()
    await providerAccept(first.id, callback.providerMessageId, "account-a")
    await observations.receiveProviderEvent({ ...callback, accountRef: "account-b" })
    expect((await eventRow("account-b", callback.eventId)).outbox_id).toBeNull()
    await providerAccept(second.id, callback.providerMessageId, "account-b")
    await observations.receiveProviderEvent(callback)
    await observations.reconcileProviderEvents()
    expect((await eventRow("account-a", callback.eventId)).outbox_id).toBe(first.id)
    expect((await eventRow("account-b", callback.eventId)).outbox_id).toBe(second.id)
    expect((await pool.query("SELECT count(*)::int AS count FROM lead_provider_events")).rows[0].count).toBe(2)
  })

  it("deduplicates competing replays and retains the first evidence when a replay conflicts", async () => {
    const callback = event()
    const results = await Promise.all([observations.receiveProviderEvent(callback), peerObservations.receiveProviderEvent(callback)])
    expect(results).toEqual([{ conflict: false }, { conflict: false }])
    const original = await eventRow(callback.accountRef, callback.eventId)
    expect((await pool.query("SELECT count(*)::int AS count FROM lead_provider_events")).rows[0].count).toBe(1)
    expect(await peerObservations.receiveProviderEvent({ ...callback, eventType: "email.failed", providerMessageId: "different-message" })).toEqual({ conflict: true })
    const conflicted = await eventRow(callback.accountRef, callback.eventId)
    expect(conflicted).toMatchObject({
      id: original.id, provider_message_id: callback.providerMessageId, event_type: callback.eventType,
      provider_occurred_at: callback.occurredAt, received_at: original.received_at,
    })
    expect(conflicted.conflicted_at).toBeInstanceOf(Date)
    await observations.receiveProviderEvent(callback)
    expect(await eventRow(callback.accountRef, callback.eventId)).toEqual(conflicted)
  })

  it("records handling idempotently without requeueing, while a later adverse event opens a new incident", async () => {
    const { id } = await fixture()
    const callback = event({ eventType: "email.bounced" })
    await providerAccept(id, callback.providerMessageId)
    await observations.receiveProviderEvent(callback)
    const reviewedThrough = new Date(Date.now() - 1_000)
    await pool.query("UPDATE lead_provider_events SET received_at = $1 WHERE provider_event_id = $2", [new Date(reviewedThrough.getTime() - 1_000), callback.eventId])
    const before = await outbox(id)
    expect((await observations.readMonitorSnapshot(new Date(), thresholds)).recipientFailures).toBe(1)
    expect(await observations.acknowledgeDelivery(id, "operator-primary", reviewedThrough)).toBe(true)
    expect(await peerObservations.acknowledgeDelivery(id, "operator-primary", reviewedThrough)).toBe(true)
    expect((await pool.query("SELECT count(*)::int AS count FROM lead_delivery_acknowledgements WHERE outbox_id = $1", [id])).rows[0].count).toBe(1)
    expect(await outbox(id)).toEqual(before)
    expect(await repository.claimOutboxById(id, new Date(), 30_000)).toBeNull()
    const reviewed = await observations.readMonitorSnapshot(new Date(), thresholds)
    expect(reviewed).toMatchObject({ recipientFailures: 0, unhandledInquiries: 0 })

    await peerObservations.receiveProviderEvent({ ...callback, eventId: randomUUID(), eventType: "email.complained" })
    const subsequent = await observations.readMonitorSnapshot(new Date(), thresholds)
    expect(subsequent.recipientFailures).toBe(1)
    expect(subsequent.fingerprints?.recipient_failure).toBeDefined()
    expect(await outbox(id)).toEqual(before)
    expect(await observations.getDeliveryObservation(id)).toEqual({ durableAcceptance: true, providerAcceptance: "accepted", recipientDelivery: "failed", operatorAcknowledgement: "acknowledged" })
  })

  it("does not let an early acknowledgement suppress a later recipient-observation deadline", async () => {
    const { id } = await fixture()
    await providerAccept(id, randomUUID())
    const acceptedAt = (await outbox(id)).delivered_at as Date
    expect(await observations.acknowledgeDelivery(id, "operator-primary", new Date())).toBe(true)
    const beforeDeadline = new Date(acceptedAt.getTime() + thresholds.recipientObservationMs - 1)
    expect((await observations.readMonitorSnapshot(beforeDeadline, thresholds)).missingRecipientObservations).toBe(0)
    const afterDeadline = new Date(acceptedAt.getTime() + thresholds.recipientObservationMs + 1)
    const overdue = await observations.readMonitorSnapshot(afterDeadline, thresholds)
    expect(overdue).toMatchObject({ missingRecipientObservations: 1, unhandledInquiries: 0 })
    expect(overdue.fingerprints?.recipient_observation_missing).toBeDefined()
  })

  it("excludes conflicted delivered evidence from both the recipient state and missing-observation suppression", async () => {
    const { id } = await fixture()
    const callback = event()
    await providerAccept(id, callback.providerMessageId)
    await observations.receiveProviderEvent(callback)
    expect((await observations.getDeliveryObservation(id))?.recipientDelivery).toBe("delivered")
    await peerObservations.receiveProviderEvent({ ...callback, eventType: "email.failed" })
    expect((await observations.getDeliveryObservation(id))?.recipientDelivery).toBe("unknown")
    const acceptedAt = (await outbox(id)).delivered_at as Date
    const snapshot = await observations.readMonitorSnapshot(new Date(acceptedAt.getTime() + thresholds.recipientObservationMs + 1), thresholds)
    expect(snapshot).toMatchObject({ eventConflicts: 1, missingRecipientObservations: 1, recipientFailures: 0 })
  })

  it("retains late provider acceptance as evidence when the old worker can no longer finalize its outbox", async () => {
    const { id } = await fixture()
    const attempt = await reserve(id)
    // Advance the lease only; the provider result then arrives after ownership changed.
    await pool.query("UPDATE lead_delivery_outbox SET lease_expires_at = clock_timestamp() - interval '1 second' WHERE id = $1", [id])
    const replacement = await repository.claimOutboxById(id, new Date(), 30_000)
    expect(replacement?.delivery.leaseToken).not.toBe(attempt.token)
    const providerMessageId = randomUUID()
    expect(await repository.recordProviderAttemptResult(attempt.reservationId, { ok: true, status: 200, providerMessageId })).toBe(true)
    expect((await repository.markOutboxDelivered(id, attempt.token, providerMessageId)).updated).toBe(false)
    const unchanged = await outbox(id)
    expect(unchanged).toMatchObject({ status: "processing", provider_message_id: null, delivered_at: null, lease_token: replacement?.delivery.leaseToken })
    expect((await observations.getDeliveryObservation(id))?.providerAcceptance).toBe("accepted")
    const completedAt = (await pool.query("SELECT completed_at FROM lead_provider_attempts WHERE id = $1", [attempt.reservationId])).rows[0].completed_at as Date
    expect((await observations.readMonitorSnapshot(new Date(completedAt.getTime() + thresholds.recipientObservationMs + 2), thresholds)).missingRecipientObservations).toBe(1)
    const callback = event({ providerMessageId })
    await peerObservations.receiveProviderEvent(callback)
    expect((await eventRow(callback.accountRef, callback.eventId)).outbox_id).toBe(id)
    expect((await observations.getDeliveryObservation(id))?.recipientDelivery).toBe("delivered")
    expect(await outbox(id)).toEqual(unchanged)
  })

  it("expires unmatched evidence after seven days without extending retention on duplicate delivery", async () => {
    const expired = event()
    const retained = event()
    await observations.receiveProviderEvent(expired)
    await observations.receiveProviderEvent(retained)
    await pool.query("UPDATE lead_provider_events SET received_at = clock_timestamp() - interval '8 days' WHERE provider_event_id = $1", [expired.eventId])
    await pool.query("UPDATE lead_provider_events SET received_at = clock_timestamp() - interval '6 days' WHERE provider_event_id = $1", [retained.eventId])
    const original = await eventRow(expired.accountRef, expired.eventId)
    await peerObservations.receiveProviderEvent(expired)
    expect((await eventRow(expired.accountRef, expired.eventId)).received_at).toEqual(original.received_at)
    expect(await observations.pruneUnmatchedProviderEvents()).toBe(1)
    expect(await eventRow(expired.accountRef, expired.eventId)).toBeUndefined()
    expect((await eventRow(retained.accountRef, retained.eventId)).outbox_id).toBeNull()
    expect(await observations.pruneUnmatchedProviderEvents()).toBe(0)
  })

  it("reconciles an old unmatched event before pruning and deletes matched evidence with its lead", async () => {
    const { id, leadId } = await fixture()
    const callback = event()
    const unrelated = event()
    await observations.receiveProviderEvent(callback)
    await observations.receiveProviderEvent(unrelated)
    await pool.query("UPDATE lead_provider_events SET received_at = clock_timestamp() - interval '8 days' WHERE provider_event_id = $1", [callback.eventId])
    await providerAccept(id, callback.providerMessageId)
    expect(await observations.pruneUnmatchedProviderEvents()).toBe(0)
    expect((await eventRow(callback.accountRef, callback.eventId)).outbox_id).toBe(id)
    expect(await observations.acknowledgeDelivery(id, "operator-primary", new Date())).toBe(true)
    await pool.query("UPDATE lead_submissions SET delete_after = clock_timestamp() - interval '1 second' WHERE id = $1", [leadId])
    expect(await repository.deleteExpiredLeads(new Date())).toEqual([leadId])
    expect(await observations.getDeliveryObservation(id)).toBeNull()
    expect(await eventRow(callback.accountRef, callback.eventId)).toBeUndefined()
    expect(await eventRow(unrelated.accountRef, unrelated.eventId)).toBeDefined()
    for (const table of ["lead_delivery_outbox", "lead_provider_attempts", "lead_delivery_acknowledgements"]) {
      expect((await pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count).toBe(0)
    }
  })
})
