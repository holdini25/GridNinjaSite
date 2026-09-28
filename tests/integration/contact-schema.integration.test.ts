import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { Client } from "pg"
import type { SQL } from "drizzle-orm"
import { beginProviderAttemptQuery, redactExpiredLeadsQuery } from "@/lib/contact/delivery-query"
import { PgDialect } from "drizzle-orm/pg-core"
import { monitorCountsQuery } from "@/lib/contact/monitor-query"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const connectionString = process.env.TEST_DATABASE_URL
const describeWithPostgres = connectionString ? describe : describe.skip

describeWithPostgres("contact intake PostgreSQL migration", () => {
  const client = new Client({ connectionString })
  const legacyId = randomUUID()
  const legacyOutboxId = randomUUID()

  beforeAll(async () => {
    await client.connect()
    for (const name of ["0000_contact_intake.sql", "0001_contact_intake_v2.sql", "0002_public_assessment_topic.sql"]) {
      const migration = await readFile(
        new URL(`../../drizzle/${name}`, import.meta.url),
        "utf8"
      )
      await client.query(migration)
    }
    await insertLead(client, legacyId)
    await client.query("insert into lead_delivery_outbox(id, lead_id, channel, idempotency_key, attempt_count, status) values($1, $2, 'internal_email', $3, 1, 'retry_scheduled')", [legacyOutboxId, legacyId, `legacy/${legacyId}`])
    await client.query(await readFile(new URL("../../drizzle/0003_enterprise_contact_delivery.sql", import.meta.url), "utf8"))
  })

  afterAll(async () => {
    await client.end()
  })

  it("quarantines attempted legacy work without inventing a first provider timestamp", async () => {
    const row = (await client.query("select status, review_required_at, first_provider_attempt_at, provider_request_body, last_error_code from lead_delivery_outbox where id = $1", [legacyOutboxId])).rows[0]
    expect(row.status).toBe("dead_letter")
    expect(row.review_required_at).toBeInstanceOf(Date)
    expect(row.first_provider_attempt_at).toBeNull()
    expect(row.provider_request_body).toBeNull()
    expect(row.last_error_code).toBe("needs_review_legacy_attempt_unknown")
  })

  it("retains exact callback identity, supports callback-before-response association, and cascades events", async () => {
    const leadId = randomUUID(), outboxId = randomUUID(), messageId = randomUUID(), eventId = `msg_${randomUUID()}`
    await insertLead(client, leadId)
    await client.query("insert into lead_delivery_outbox(id, lead_id, channel, idempotency_key) values($1, $2, 'internal_email', $3)", [outboxId, leadId, `delivery/${leadId}`])
    await client.query("insert into lead_provider_events(event_id, provider_message_id, event_type, occurred_at) values($1, $2, 'email.delivered', now()) ON CONFLICT DO NOTHING", [eventId, messageId])
    await client.query("insert into lead_provider_events(event_id, provider_message_id, event_type, occurred_at) values($1, $2, 'email.delivered', now()) ON CONFLICT DO NOTHING", [eventId, messageId])
    expect((await client.query("select * from lead_provider_events where event_id = $1", [eventId])).rows).toHaveLength(1)
    expect((await client.query("select outbox_id from lead_provider_events where event_id = $1", [eventId])).rows[0].outbox_id).toBeNull()
    await client.query("update lead_delivery_outbox set provider_message_id = $1, status = 'delivered' where id = $2", [messageId, outboxId])
    await client.query("UPDATE lead_provider_events e SET outbox_id = o.id FROM lead_delivery_outbox o WHERE e.outbox_id IS NULL AND o.channel = 'internal_email' AND o.provider_message_id = e.provider_message_id")
    expect((await client.query("select outbox_id from lead_provider_events where event_id = $1", [eventId])).rows[0].outbox_id).toBe(outboxId)
    await client.query("delete from lead_submissions where id = $1", [leadId])
    expect((await client.query("select * from lead_provider_events where event_id = $1", [eventId])).rows).toHaveLength(0)
  })

  it("executes the actual monitor aggregate SQL without exposing inquiry data", async () => {
    const query = new PgDialect().sqlToQuery(monitorCountsQuery(new Date()))
    const result = await client.query(query.sql, query.params)
    expect(Number(result.rows[0].dead_letters)).toBeGreaterThan(0)
    expect(Number(result.rows[0].needs_review)).toBeGreaterThan(0)
    expect(Object.keys(result.rows[0]).sort()).toEqual(["oldest_due_ms", "dead_letters", "needs_review", "configuration_failures", "recipient_failures", "unmatched_events", "dead_letter_revision", "review_revision", "recipient_revision"].sort())
  })

  it("excludes settled delivery archives from the outer queue aggregate", async () => {
    const leadId = randomUUID(), outboxId = randomUUID()
    const query = new PgDialect().sqlToQuery(monitorCountsQuery(new Date()))
    const baseline = (await client.query(query.sql, query.params)).rows[0]
    await insertLead(client, leadId)
    await client.query("insert into lead_delivery_outbox(id, lead_id, channel, idempotency_key, status, next_attempt_at) values($1, $2, 'internal_email', $3, 'delivered', now() - interval '100 days')", [outboxId, leadId, `archive/${leadId}`])
    expect((await client.query(query.sql, query.params)).rows[0]).toEqual(baseline)
    expect(query.sql).toContain("WHERE status IN ('pending', 'retry_scheduled', 'processing', 'dead_letter')")
    await client.query("delete from lead_submissions where id = $1", [leadId])
  })
  it("keeps a later bounce actionable after an earlier operator review", async () => {
    const leadId = randomUUID(), outboxId = randomUUID(), messageId = randomUUID(), observed = new Date()
    await insertLead(client, leadId)
    await client.query("insert into lead_delivery_outbox(id, lead_id, channel, idempotency_key, status, provider_message_id, operator_acknowledged_at, operator_reviewed_through) values($1, $2, 'internal_email', $3, 'delivered', $4, $5, $5)", [outboxId, leadId, `late/${leadId}`, messageId, observed])
    await client.query("insert into lead_provider_events(event_id, provider_message_id, outbox_id, event_type, occurred_at, received_at) values($1, $2, $3, 'email.bounced', $4, $5)", [`msg_${randomUUID()}`, messageId, outboxId, observed, new Date(observed.getTime() + 1000)])
    const query = new PgDialect().sqlToQuery(monitorCountsQuery(new Date(observed.getTime() + 2000)))
    expect(Number((await client.query(query.sql, query.params)).rows[0].recipient_failures)).toBe(1)
    await client.query("update lead_delivery_outbox set operator_reviewed_through = $1 where id = $2", [new Date(observed.getTime() + 2000), outboxId])
    expect(Number((await client.query(query.sql, query.params)).rows[0].recipient_failures)).toBe(0)
    await client.query("delete from lead_submissions where id = $1", [leadId])
  })
  it("invalidates a claimed lease and cannot restore PII after retention commits", async () => {
    const leadId = randomUUID(), outboxId = randomUUID(), leaseToken = randomUUID(), now = new Date()
    await insertLead(client, leadId)
    await client.query("insert into lead_delivery_outbox(id, lead_id, channel, idempotency_key, status, lease_token, lease_expires_at, provider_request_body, provider_target_url) values($1, $2, 'internal_email', $3, 'processing', $4, now() + interval '1 minute', 'old private snapshot', 'https://api.resend.com/emails')", [outboxId, leadId, `retention/${leadId}`, leaseToken])
    const settledId = randomUUID(), settledAt = new Date(now.getTime() - 1000)
    await client.query("insert into lead_delivery_outbox(id, lead_id, channel, idempotency_key, status, provider_request_body, updated_at) values($1, $2, 'crm_webhook', $3, 'delivered', 'old CRM snapshot', $4)", [settledId, leadId, `settled/${leadId}`, settledAt])
    const oldClaim = { body: "private PII from an old in-memory claim", targetUrl: "https://api.resend.com/emails" }
    await client.query("update lead_submissions set redact_after = $1 where id = $2", [new Date(now.getTime() - 1), leadId])
    expect((await querySql(client, redactExpiredLeadsQuery(now, 1000))).rows).toContainEqual({ id: leadId })
    expect((await querySql(client, beginProviderAttemptQuery(outboxId, leaseToken, oldClaim, now))).rows).toHaveLength(0)
    const row = (await client.query("select o.status, o.lease_token, o.lease_expires_at, o.provider_request_body, o.provider_target_url, l.name, l.redacted_at from lead_delivery_outbox o join lead_submissions l on l.id = o.lead_id where o.id = $1", [outboxId])).rows[0]
    expect(row).toMatchObject({ status: "dead_letter", lease_token: null, lease_expires_at: null, provider_request_body: null, provider_target_url: null, name: null })
    expect(row.redacted_at).toBeInstanceOf(Date)
    expect((await client.query("select provider_request_body, status, updated_at from lead_delivery_outbox where id = $1", [settledId])).rows[0]).toEqual({ provider_request_body: null, status: "delivered", updated_at: settledAt })
    expect((await client.query("select status from lead_submissions where id = $1", [leadId])).rows[0].status).toBe("partially_delivered")
    await client.query("delete from lead_submissions where id = $1", [leadId])
  })

  it("checks expired lead eligibility even if retention has not run yet", async () => {
    const leadId = randomUUID(), outboxId = randomUUID(), leaseToken = randomUUID(), now = new Date()
    await insertLead(client, leadId)
    await client.query("insert into lead_delivery_outbox(id, lead_id, channel, idempotency_key, status, lease_token, lease_expires_at) values($1, $2, 'internal_email', $3, 'processing', $4, now() + interval '1 minute')", [outboxId, leadId, `expired/${leadId}`, leaseToken])
    await client.query("update lead_submissions set redact_after = now() - interval '1 second' where id = $1", [leadId])
    expect((await querySql(client, beginProviderAttemptQuery(outboxId, leaseToken, { body: "private", targetUrl: "https://api.resend.com/emails" }, now))).rows).toHaveLength(0)
    expect((await client.query("select provider_request_body from lead_delivery_outbox where id = $1", [outboxId])).rows[0].provider_request_body).toBeNull()
    await client.query("delete from lead_submissions where id = $1", [leadId])
  })

  it("serializes begin-provider with retention on the lead row and rechecks after waiting", async () => {
    const worker = new Client({ connectionString }), retention = new Client({ connectionString })
    await worker.connect(); await retention.connect()
    const leadId = randomUUID(), outboxId = randomUUID(), leaseToken = randomUUID(), now = new Date()
    try {
      await insertLead(client, leadId)
      await client.query("update lead_submissions set redact_after = $1 where id = $2", [new Date(now.getTime() + 3_600_000), leadId])
      await client.query("insert into lead_delivery_outbox(id, lead_id, channel, idempotency_key, status, lease_token, lease_expires_at) values($1, $2, 'internal_email', $3, 'processing', $4, now() + interval '1 minute')", [outboxId, leadId, `race/${leadId}`, leaseToken])
      await retention.query("begin")
      await querySql(retention, redactExpiredLeadsQuery(new Date(now.getTime() + 7_200_000), 1000))
      let settled = false
      const attempt = querySql(worker, beginProviderAttemptQuery(outboxId, leaseToken, { body: "stale private bytes", targetUrl: "https://api.resend.com/emails" }, now)).finally(() => { settled = true })
      await new Promise((resolve) => setTimeout(resolve, 30))
      expect(settled).toBe(false)
      await retention.query("commit")
      expect((await attempt).rows).toHaveLength(0)
      expect((await client.query("select provider_request_body, lease_token from lead_delivery_outbox where id = $1", [outboxId])).rows[0]).toEqual({ provider_request_body: null, lease_token: null })
    } finally {
      await retention.query("rollback")
      await worker.end(); await retention.end()
      await client.query("delete from lead_submissions where id = $1", [leadId])
    }
  })

  it("freezes first attempt and request bytes even across another valid worker attempt", async () => {
    const outboxId = randomUUID(), leadId = randomUUID(), leaseToken = randomUUID()
    await insertLead(client, leadId)
    await client.query("insert into lead_delivery_outbox(id, lead_id, channel, idempotency_key, status, lease_token, lease_expires_at) values($1, $2, 'internal_email', $3, 'processing', $4, now() + interval '30 seconds')", [outboxId, leadId, `frozen/${leadId}`, leaseToken])
    const original = new Date("2026-09-24T12:00:00Z")
    await querySql(client, beginProviderAttemptQuery(outboxId, leaseToken, { body: "exact original bytes", targetUrl: "https://api.resend.com/emails" }, original))
    const row = (await querySql(client, beginProviderAttemptQuery(outboxId, leaseToken, { body: "changed bytes", targetUrl: "https://different.test" }, new Date()))).rows[0]
    expect(row.first_provider_attempt_at).toEqual(original)
    expect(row.provider_request_body).toBe("exact original bytes")
    expect(row.provider_target_url).toBe("https://api.resend.com/emails")
    expect((await querySql(client, beginProviderAttemptQuery(outboxId, randomUUID(), { body: "changed bytes", targetUrl: "https://different.test" }, new Date()))).rows).toHaveLength(0)
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

  it("keeps legacy topics null and persists an explicit public topic separately", async () => {
    const id = randomUUID()
    await insertLead(client, id)
    expect((await client.query("select topic from lead_submissions where id = $1", [id])).rows[0].topic).toBeNull()
    await client.query("update lead_submissions set topic = $2 where id = $1", [id, "cooling"])
    const row = (await client.query("select topic, message from lead_submissions where id = $1", [id])).rows[0]
    expect(row.topic).toBe("cooling")
    expect(row.message ?? "").not.toContain("cooling")
    await client.query("delete from lead_submissions where id = $1", [id])
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

async function querySql(client: Client, statement: SQL) {
  const query = new PgDialect().sqlToQuery(statement)
  return client.query(query.sql, query.params)
}
