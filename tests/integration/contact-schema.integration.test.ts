import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const connectionString = process.env.TEST_DATABASE_URL
const describeWithPostgres = connectionString ? describe : describe.skip

describeWithPostgres("contact intake PostgreSQL migration", () => {
  const client = new Client({ connectionString })
  const attemptedLead = randomUUID(), attemptedOutbox = randomUUID(), acceptedLead = randomUUID(), acceptedOutbox = randomUUID()

  beforeAll(async () => {
    await client.connect()
    for (const name of ["0000_contact_intake.sql", "0001_contact_intake_v2.sql"]) {
      const migration = await readFile(
        new URL(`../../drizzle/${name}`, import.meta.url),
        "utf8"
      )
      await client.query(migration)
    }
    await insertLead(client, attemptedLead)
    await insertLead(client, acceptedLead)
    await client.query("INSERT INTO lead_delivery_outbox(id,lead_id,channel,idempotency_key,status,attempt_count) VALUES ($1,$2,'internal_email',$3,'retry_scheduled',1),($4,$5,'internal_email',$6,'delivered',1)", [attemptedOutbox, attemptedLead, `legacy/${attemptedLead}`, acceptedOutbox, acceptedLead, `legacy/${acceptedLead}`])
    await client.query(await readFile(new URL("../../drizzle/0002_delivery_safeguards.sql", import.meta.url), "utf8"))
  })

  afterAll(async () => {
    await client.end()
  })

  it("quarantines unresolved historical sends without inventing clocks or recipient evidence", async () => {
    const attempted = (await client.query("SELECT * FROM lead_delivery_outbox WHERE id = $1", [attemptedOutbox])).rows[0]
    expect(attempted).toMatchObject({ status: "dead_letter", attempt_count: 1, first_provider_attempt_at: null,
      provider_request_body: null, provider_account_ref: null, review_reason: "legacy_attempt_unknown", last_error_code: "alert_pending:legacy_attempt_unknown" })
    expect(attempted.review_required_at).toBeInstanceOf(Date)
    const accepted = (await client.query("SELECT * FROM lead_delivery_outbox WHERE id = $1", [acceptedOutbox])).rows[0]
    expect(accepted).toMatchObject({ status: "delivered", review_required_at: null, first_provider_attempt_at: null })
    expect((await client.query("SELECT count(*) FROM lead_provider_events")).rows[0].count).toBe("0")
  })

  it("rolls back a lead when its required outbox insert fails", async () => {
    const leadId = randomUUID()

    await client.query("begin")
    try {
      await insertLead(client, leadId)
      await client.query(
        `insert into lead_delivery_outbox
          (id, lead_id, channel, idempotency_key, next_attempt_at)
         values ($1, $2, 'internal_email', $3, now())`,
        [randomUUID(), randomUUID(), `lead-notification/${leadId}`]
      )
      await client.query("commit")
      throw new Error("Expected the foreign-key insert to fail.")
    } catch {
      await client.query("rollback")
    }

    const result = await client.query(
      "select id from lead_submissions where id = $1",
      [leadId]
    )
    expect(result.rowCount).toBe(0)
  })

  it("enforces idempotency and cascades delivery rows", async () => {
    const leadId = randomUUID()
    const clientSubmissionId = randomUUID()
    await insertLead(client, leadId, clientSubmissionId)

    await client.query(
      `insert into lead_delivery_outbox
        (id, lead_id, channel, idempotency_key, next_attempt_at)
       values ($1, $2, 'internal_email', $3, now())`,
      [randomUUID(), leadId, `lead-notification/${leadId}`]
    )

    await expect(
      insertLead(client, randomUUID(), clientSubmissionId)
    ).rejects.toMatchObject({ code: "23505" })

    await expect(
      client.query(
        `insert into lead_delivery_outbox
          (id, lead_id, channel, idempotency_key, next_attempt_at)
         values ($1, $2, 'internal_email', $3, now())`,
        [randomUUID(), leadId, `other/${leadId}`]
      )
    ).rejects.toMatchObject({ code: "23505" })

    await client.query("delete from lead_submissions where id = $1", [leadId])
    const deliveries = await client.query(
      "select id from lead_delivery_outbox where lead_id = $1",
      [leadId]
    )
    expect(deliveries.rowCount).toBe(0)
  })

  it("stores contact v2 with nullable qualification and a bounded capacity range", async () => {
    const id = randomUUID()
    await client.query(
      `insert into lead_submissions
        (id, client_submission_id, request_id, schema_version, form_type, intent,
         request_fingerprint, name, company, email, normalized_email,
         capacity_range, message, source, ip_hash, turnstile_hostname,
         turnstile_action, redact_after, delete_after)
       values
        ($1, $2, $3, 2, 'contact', 'other', $4, 'Test Operator',
         'Test Compute', 'operator@example.com', 'operator@example.com',
         '5–20 MW', 'Review this capacity decision.', 'integration-test', $5,
         'localhost', 'contact', now() + interval '180 days',
         now() + interval '365 days')`,
      [id, randomUUID(), randomUUID(), "a".repeat(64), "b".repeat(64)]
    )

    const result = await client.query(
      `select buyer_type, site_type, timeline, capacity_range
       from lead_submissions where id = $1`,
      [id]
    )

    expect(result.rows[0]).toEqual({
      buyer_type: null,
      site_type: null,
      timeline: null,
      capacity_range: "5–20 MW",
    })
  })
})

async function insertLead(
  client: Client,
  id: string,
  clientSubmissionId = randomUUID()
) {
  return client.query(
    `insert into lead_submissions
      (id, client_submission_id, request_id, schema_version, form_type, intent,
       request_fingerprint, name, company, email, normalized_email, buyer_type,
       site_type, timeline, source, ip_hash, turnstile_hostname,
       turnstile_action, redact_after, delete_after)
     values
      ($1, $2, $3, 1, 'capacity_audit', 'capacity-audit', $4, 'Test Operator',
       'Test Compute', 'operator@example.com', 'operator@example.com',
       'AI cloud operator', 'AI training campus', 'Immediate (0-3 months)',
       'integration-test', $5, 'localhost', 'capacity_audit',
       now() + interval '180 days', now() + interval '365 days')`,
    [id, clientSubmissionId, randomUUID(), "a".repeat(64), "b".repeat(64)]
  )
}
