import { Client } from "pg"
import { createHash } from "node:crypto"
import { expect, test } from "@playwright/test"
import { stagingCanaryConfig, stagingFrozenPayloadEvidence } from "../../scripts/qa/staging-contract.mjs"
import { deriveDeliveryObservation, type ProviderDeliveryEvent } from "../../src/lib/contact/provider-events"
import { stagingDatabaseTargetSha256 } from "../../src/lib/contact/staging-database-target.mjs"

const { baseURL, databaseUrl, email, operatorReference, deliveryEmail, expectedAttestationSha256, preflightToken } = stagingCanaryConfig(process.env)
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
type OutboxEvidence = {
  id: string; channel: string; status: string; provider_message_id: string | null
  first_provider_attempt_at: Date | null; operator_acknowledged_at: Date | null
  operator_reference: string | null; operator_reviewed_through: Date | null
  idempotency_key: string; authorizedRecipient: boolean; frozenRequestSha256: string | null
}
type EventEvidence = ProviderDeliveryEvent & { receivedAt: Date }

test("one inquiry is durably accepted, delivered to the recipient server, and acknowledged by its operator", async ({ page }, testInfo) => {
  // Node fetch keeps the operational bearer out of Playwright browser traces.
  // Reject redirects before any inquiry or verification action is attempted.
  const response = await fetch(`${baseURL}/api/internal/lead-staging-preflight`, {
    headers: { authorization: `Bearer ${preflightToken}` }, redirect: "error", signal: AbortSignal.timeout(10_000),
  })
  expect(response.status, "Authenticated staging preflight must pass before submission").toBe(200)
  const preflight = await response.json()
  expect(preflight.schemaVersion).toBe("lead-staging-preflight.v1")
  expect(preflight.ok).toBe(true)
  expect(preflight.attestationSha256).toBe(expectedAttestationSha256)
  expect(preflight.recipientSha256).toBe(digest(deliveryEmail))
  expect(preflight.databaseTargetSha256).toBe(stagingDatabaseTargetSha256(databaseUrl))
  expect(preflight.crmEnabled).toBe(false)
  await testInfo.attach("staging-preflight", { body: Buffer.from(JSON.stringify({
    attestationSha256: preflight.attestationSha256, artifact: preflight.artifact,
    recipientSha256: preflight.recipientSha256, configurationSha256: preflight.configurationSha256,
    databaseTargetSha256: preflight.databaseTargetSha256,
  }, null, 2)), contentType: "application/json" })
  let blockedContactPosts = 0
  await page.route(/\/api\/contact(?:\?|$)/, async route => {
    if (route.request().method() === "POST" && new URL(route.request().url()).origin !== baseURL) {
      blockedContactPosts++; await route.abort("blockedbyclient"); return
    }
    await route.continue()
  })
  await page.goto("/contact?intent=capacity-audit&source=staging-canary")
  expect(new URL(page.url()).origin, "Staging must not redirect intake to another origin").toBe(baseURL)
  await page.getByLabel("Name", { exact: true }).fill("GridNinja Canary")
  await page.getByLabel("Organization", { exact: true }).fill("GridNinja Staging")
  await page.getByLabel("Work email", { exact: true }).fill(email)
  await page.getByLabel("Decision context (optional)", { exact: true }).fill(
    "Authorized staging-only inquiry delivery and operator acknowledgement rehearsal.",
  )
  await expect(page.getByText("Security verification complete.")).toBeVisible()
  expect(new URL(page.url()).origin).toBe(baseURL)
  await page.getByRole("button", { name: "Scope an assessment" }).click()
  await expect(page.getByRole("heading", { name: "Inquiry received" })).toBeVisible()
  expect(new URL(page.url()).origin).toBe(baseURL)
  const reference = page.getByText(/^Reference:/)
  await expect(reference).toBeVisible()
  const submissionId = (await reference.textContent())?.replace("Reference:", "").trim()
  expect(submissionId).toMatch(/^[0-9a-f-]{36}$/i)

  // Reads isolated staging evidence. Never inserts a delivery event or
  // acknowledges on behalf of the assigned human operator.
  const client = new Client({ connectionString: databaseUrl, statement_timeout: 10_000, connectionTimeoutMillis: 10_000 })
  await client.connect()
  let emailOutbox: OutboxEvidence | undefined
  let events: EventEvidence[] = []
  const readOutboxes = async (): Promise<OutboxEvidence[]> => (await client.query<Omit<OutboxEvidence, "authorizedRecipient" | "frozenRequestSha256"> & { provider_request_body: string | null }>(
    `select o.id, o.channel, o.status, o.provider_message_id, o.first_provider_attempt_at,
      o.operator_acknowledged_at, o.operator_reference, o.operator_reviewed_through,
      o.idempotency_key, o.provider_request_body
     from lead_delivery_outbox o join lead_submissions l on l.id = o.lead_id
     where l.id = $1 order by o.channel`, [submissionId],
  )).rows.map(({ provider_request_body, ...row }) => ({
    ...row, ...stagingFrozenPayloadEvidence(provider_request_body, deliveryEmail),
  }))
  try {
    await test.step("durable outbox and provider acceptance", async () => {
      await expect.poll(async () => {
        const rows = await readOutboxes()
        const mail = rows.filter(row => row.channel === "internal_email")
        emailOutbox = mail[0]
        return rows.length === 1 && mail.length === 1 && emailOutbox.authorizedRecipient &&
          rows.every(row => row.status === "delivered") && !!emailOutbox.provider_message_id &&
          !!emailOutbox.first_provider_attempt_at
      }, { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }).toBe(true)
    })
    const outboxId = emailOutbox!.id, messageId = emailOutbox!.provider_message_id
    const readEvents = async () => (await client.query<EventEvidence>(
      `select event_id as "eventId", provider_message_id as "providerMessageId",
        event_type as "eventType", occurred_at as "occurredAt", received_at as "receivedAt"
       from lead_provider_events where outbox_id = $1 and provider_message_id = $2
       order by occurred_at, event_id`, [outboxId, messageId],
    )).rows
    await test.step("signed recipient-delivery event", async () => {
      await expect.poll(async () => {
        events = await readEvents()
        return deriveDeliveryObservation(true, events, false).recipientDelivery
      }, { timeout: 120_000, intervals: [1_000, 2_000, 5_000] }).toBe("delivered")
    })
    const delivered = events.filter(event => event.eventType === "email.delivered")
    const reviewedThrough = new Date(Math.max(...delivered.map(event => event.occurredAt.getTime())))
    const receivedAt = Math.max(...delivered.map(event => event.receivedAt.getTime()))
    // Non-sensitive IDs only. The operator uses the authenticated operations
    // endpoint after inspecting this receipt; no secret is attached or logged.
    const receipt = { submissionId, outboxId, providerMessageId: messageId, operatorReference,
      reviewedThrough: reviewedThrough.toISOString(), action: "Review the recipient-delivery evidence, then acknowledge through the authenticated lead-acknowledgement endpoint." }
    console.log("Operator acknowledgement required:", JSON.stringify(receipt))
    await testInfo.attach("recipient-delivery-receipt", { body: Buffer.from(JSON.stringify(receipt, null, 2)), contentType: "application/json" })
    await test.step("assigned operator acknowledges after recipient evidence arrives", async () => {
      await expect.poll(async () => {
        emailOutbox = (await readOutboxes()).find(row => row.id === outboxId)
        events = await readEvents()
        return !!emailOutbox && emailOutbox.provider_message_id === messageId &&
          emailOutbox.operator_reference === operatorReference &&
          (emailOutbox.operator_acknowledged_at?.getTime() ?? 0) >= receivedAt &&
          (emailOutbox.operator_reviewed_through?.getTime() ?? 0) >= reviewedThrough.getTime() &&
          deriveDeliveryObservation(emailOutbox.status === "delivered", events, true).recipientDelivery === "delivered"
      }, { timeout: 180_000, intervals: [2_000, 5_000] }).toBe(true)
    })
  } finally {
    try {
      await testInfo.attach("delivery-observations", {
        body: Buffer.from(JSON.stringify({ submissionId, outbox: emailOutbox, events, blockedContactPosts,
          limitations: "Recipient delivery means acceptance by the recipient mail server; acknowledgement is separate from email reading. No open/click tracking." }, null, 2)),
        contentType: "application/json",
      })
      expect(blockedContactPosts, "No cross-origin inquiry post is allowed").toBe(0)
    } finally { await client.end() }
  }
})
