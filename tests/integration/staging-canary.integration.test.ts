import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { Pool } from "pg"
import { Webhook } from "svix"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { requestDigest } from "@/lib/contact/provider-request"
import { runIndependentMonitor } from "@/lib/contact/monitor"
import { createLeadRepository } from "@/server/leads/repository"
import { createObservationsRepository } from "@/server/leads/observations-repository"
import { POST as callbackPost } from "@/app/api/webhooks/resend/route"
import { POST as acknowledgementPost } from "@/app/api/internal/lead-acknowledgement/route"
import { assertStagingMonitorHealthy, evaluateStagingDelivery, readStagingDeliveryEvidence } from "../../scripts/qa/staging-contract.mjs"
import { localDatabase } from "./helpers/local-database"

vi.mock("server-only", () => ({}))
let observations: ReturnType<typeof createObservationsRepository>
vi.mock("@/server/leads/observations-repository", async importOriginal => ({
  ...await importOriginal<typeof import("@/server/leads/observations-repository")>(),
  observationsRepository: () => observations,
}))

const connectionString = process.env.TEST_DATABASE_URL
const describeDatabase = connectionString ? describe : describe.skip
const approval = { providerAccountRef: "staging-account", emailFrom: "sender@example.test", emailTo: "recipient@example.test" }
const callbackSecret = `whsec_${Buffer.from("synthetic-staging-signing-key-32!!").toString("base64")}`
const operationsSecret = "synthetic-operation-secret".padEnd(32, "x")

describeDatabase("staging canary projection over authenticated routes and disposable PostgreSQL", () => {
  const schema = `staging_canary_${randomUUID().replaceAll("-", "")}`
  const admin = new Pool({ connectionString })
  const pool = new Pool({ connectionString, options: `-c search_path=${schema},public -c statement_timeout=10000`, max: 1 })
  const repository = createLeadRepository(localDatabase(pool))
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA "${schema}"`)
    for (const name of ["0000_contact_intake.sql", "0001_contact_intake_v2.sql", "0002_delivery_safeguards.sql"]) {
      await pool.query((await readFile(new URL(`../../drizzle/${name}`, import.meta.url), "utf8")).replaceAll('"public".', `"${schema}".`))
    }
    observations = createObservationsRepository(localDatabase(pool))
  })
  beforeEach(async () => {
    await pool.query("TRUNCATE lead_submissions, lead_provider_events, lead_operations_heartbeats CASCADE")
    vi.stubEnv("RESEND_ACCOUNT_REF", approval.providerAccountRef)
    vi.stubEnv("RESEND_WEBHOOK_SECRET", callbackSecret)
    vi.stubEnv("RESEND_WEBHOOK_SECRET_PREVIOUS", "")
    vi.stubEnv("LEAD_OPERATIONS_SECRET", operationsSecret)
    vi.stubEnv("LEAD_OPERATOR_REFERENCES", "primary,backup")
  })
  afterEach(() => vi.unstubAllEnvs())
  afterAll(async () => {
    await pool.end()
    try { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`) } finally { await admin.end() }
  })

  async function fixture() {
    const accepted = await repository.acceptLead({
      requestId: randomUUID(), clientSubmissionId: randomUUID(), requestFingerprint: "a".repeat(64),
      schemaVersion: 2, formType: "contact", intent: "capacity-audit", name: "Synthetic Canary", company: "Synthetic",
      email: "canary@example.test", normalizedEmail: "canary@example.test", source: "contact-page", ipHash: "b".repeat(64),
      turnstileHostname: "localhost", turnstileAction: "contact", acceptedAt: new Date(Date.now() - 60_000), includeCrmWebhook: false,
    })
    if (accepted.kind !== "accepted") throw new Error("FixtureAcceptFailed")
    const outboxId = accepted.outboxIds[0]
    const claim = await repository.claimOutboxById(outboxId, new Date(), 30_000)
    if (!claim?.delivery.leaseToken) throw new Error("FixtureClaimFailed")
    const body = JSON.stringify({ from: approval.emailFrom, to: approval.emailTo, text: "Synthetic fixture" })
    const prepared = await repository.prepareAndReserveProviderAttempt(outboxId, claim.delivery.leaseToken, {
      version: 1, channel: "internal_email", idempotencyKey: claim.delivery.idempotencyKey,
      bodyUtf8: body, bodySha256: requestDigest(body), targetUrl: "https://api.resend.com/emails",
      accountRef: approval.providerAccountRef, destinationRef: requestDigest(JSON.stringify({ from: approval.emailFrom, to: approval.emailTo })),
    })
    if (prepared.kind !== "ready") throw new Error("FixtureReservationFailed")
    const messageId = randomUUID()
    await repository.recordProviderAttemptResult(prepared.reservationId, { ok: true, status: 200, providerMessageId: messageId })
    await repository.markOutboxDelivered(outboxId, claim.delivery.leaseToken, messageId)
    return { leadId: accepted.leadId, outboxId, messageId }
  }
  async function snapshot(leadId: string) {
    const connection = await pool.connect()
    try { return await readStagingDeliveryEvidence(connection, leadId) } finally { connection.release() }
  }
  function callback(messageId: string, type = "email.delivered", id = randomUUID(), secret = callbackSecret) {
    const payload = JSON.stringify({ type, created_at: new Date().toISOString(), data: { email_id: messageId } })
    const timestamp = new Date()
    return new Request("https://staging.example.test/api/webhooks/resend", { method: "POST", body: payload, headers: {
      "content-type": "application/json", "svix-id": id, "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": new Webhook(secret).sign(id, timestamp, payload),
    } })
  }
  async function acknowledge(outboxId: string, token = operationsSecret) {
    // Synthetic in-process route fixture only. The external canary has no ACK
    // secret, never invokes this route and still requires an actual human.
    // Cross the current millisecond so a valid review can cover PostgreSQL's
    // microsecond receipt timestamp; the precision rejection is tested below.
    await new Promise(resolve => setTimeout(resolve, 2))
    return acknowledgementPost(new Request("https://staging.example.test/api/internal/lead-acknowledgement", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ outboxId, operatorReference: "primary", reviewedThrough: new Date().toISOString() }) }))
  }

  it("does not qualify missing callbacks or missing handling and only advances after authenticated evidence", async () => {
    const value = await fixture()
    expect(evaluateStagingDelivery(await snapshot(value.leadId), approval, "primary")).toMatchObject({ stage: "provider-accepted", complete: false })
    const wrongSecret = `whsec_${Buffer.from("another-synthetic-key").toString("base64")}`
    expect((await callbackPost(callback(value.messageId, "email.delivered", randomUUID(), wrongSecret))).status).toBe(401)
    expect((await snapshot(value.leadId)).events).toHaveLength(0)
    const request = callback(value.messageId)
    expect((await callbackPost(request.clone())).status).toBe(200)
    expect((await callbackPost(request.clone())).status).toBe(200)
    expect((await snapshot(value.leadId)).events).toHaveLength(1)
    expect(evaluateStagingDelivery(await snapshot(value.leadId), approval, "primary")).toMatchObject({ stage: "recipient-observed", complete: false })
    expect((await acknowledge(value.outboxId, "unauthorized")).status).toBe(401)
    expect((await snapshot(value.leadId)).acknowledgements).toHaveLength(0)
    expect((await acknowledge(value.outboxId)).status).toBe(200)
    expect(evaluateStagingDelivery(await snapshot(value.leadId), approval, "primary")).toMatchObject({ stage: "human-acknowledged", complete: true })
  })

  it("rejects a validly authenticated callback for the wrong account", async () => {
    const value = await fixture()
    vi.stubEnv("RESEND_ACCOUNT_REF", "different-account")
    expect((await callbackPost(callback(value.messageId))).status).toBe(200)
    const evidence = await snapshot(value.leadId)
    expect(evidence.events[0].outbox_id).toBeNull()
    expect(() => evaluateStagingDelivery(evidence, approval, "primary")).toThrow(/CallbackIdentityMismatch/)
  })

  it("fails a conflicting replay without treating its earlier delivery as sufficient", async () => {
    const value = await fixture(), id = randomUUID()
    expect((await callbackPost(callback(value.messageId, "email.delivered", id))).status).toBe(200)
    expect((await callbackPost(callback(value.messageId, "email.failed", id))).status).toBe(200)
    const evidence = await snapshot(value.leadId)
    expect(evidence.events).toHaveLength(1)
    expect(evidence.events[0].conflicted_at).not.toBeNull()
    expect(() => evaluateStagingDelivery(evidence, approval, "primary")).toThrow(/ReplayConflict/)
  })

  it("does not lose PostgreSQL microsecond review boundaries when projecting to JavaScript", async () => {
    const value = await fixture()
    await callbackPost(callback(value.messageId))
    const row = (await pool.query("update lead_provider_events set received_at = date_trunc('milliseconds', clock_timestamp() - interval '1 second') + interval '500 microseconds' where outbox_id = $1 returning received_at", [value.outboxId])).rows[0]
    // pg returns a Date truncated to milliseconds, before the real event.
    expect(await observations.acknowledgeDelivery(value.outboxId, "primary", row.received_at)).toBe(true)
    const evidence = await snapshot(value.leadId)
    expect(evidence.acknowledgements[0].review_covers_events).toBe(false)
    expect(evaluateStagingDelivery(evidence, approval, "primary")).toMatchObject({ stage: "recipient-observed", complete: false })
  })

  it("rejects adverse evidence arriving after handling and a failing monitor sink", async () => {
    const value = await fixture()
    await callbackPost(callback(value.messageId))
    expect((await acknowledge(value.outboxId)).status).toBe(200)
    await callbackPost(callback(value.messageId, "email.bounced"))
    const evidence = await snapshot(value.leadId)
    expect(() => evaluateStagingDelivery(evidence, approval, "primary")).toThrow(/Adverse/)
    const result = await runIndependentMonitor({ configured: true,
      store: { get: async () => null, set: async () => undefined },
      readSnapshot: now => observations.readMonitorSnapshot(now, { recipientObservationMs: 60_000, handlingMs: 300_000 }),
      sendAlert: async () => { throw new Error("SyntheticSinkUnavailable") },
    })
    expect(result.notificationFailures).toBeGreaterThan(0)
    expect(() => assertStagingMonitorHealthy(503, { ok: false, ...result })).toThrow(/SinkUnavailable/)
  })
})
