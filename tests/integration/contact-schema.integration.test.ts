import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const connectionString = process.env.TEST_DATABASE_URL
const describeWithPostgres = connectionString ? describe : describe.skip

describeWithPostgres("contact intake PostgreSQL migration", () => {
  const client = new Client({ connectionString })

  beforeAll(async () => {
    await client.connect()
    const migration = await readFile(
      new URL("../../drizzle/0000_contact_intake.sql", import.meta.url),
      "utf8"
    )
    await client.query(migration)
  })

  afterAll(async () => {
    await client.end()
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

