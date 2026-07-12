import { randomUUID } from "node:crypto"

import { z } from "zod"

import { publishOperatorAlert } from "@/lib/contact/alerts"
import { getContactRuntimeConfig } from "@/lib/contact/config"
import { classifyContactError, logContactEvent } from "@/lib/contact/log"
import { processOneLeadDelivery } from "@/lib/contact/operations"
import { withVerifiedQstashSignature } from "@/lib/contact/qstash-receiver"
import { deliveryOperationsRepository } from "@/lib/contact/repository-adapter"

export const runtime = "nodejs"

const deliveryWakeSchema = z
  .object({ outboxId: z.string().uuid().optional() })
  .strict()

export const POST = withVerifiedQstashSignature(async (_request, body) => {
  const parsed = deliveryWakeSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ ok: false }, { status: 400 })
  }

  const config = getContactRuntimeConfig()

  try {
    const result = await processOneLeadDelivery(deliveryOperationsRepository, {
      outboxId: parsed.data.outboxId,
      publishAlert: (alert) => publishOperatorAlert(config, alert),
    })

    return Response.json({ ok: true, ...result })
  } catch (error) {
    const errorCode = classifyContactError(error)

    logContactEvent("error", "lead_delivery_worker_failed", {
      outboxId: parsed.data.outboxId,
      errorCode,
      state: "database_or_queue_failure",
    })

    try {
      await publishOperatorAlert(config, {
        schemaVersion: 1,
        eventId: `database/${randomUUID()}`,
        type: "database_failure",
        occurredAt: new Date().toISOString(),
        outboxId: parsed.data.outboxId,
        errorCode,
      })
    } catch (alertError) {
      logContactEvent("error", "lead_alert_publish_failed", {
        errorCode: classifyContactError(alertError),
        state: "qstash_failure",
      })
    }

    // QStash owns invocation retries; provider retry timing remains in Postgres.
    return Response.json({ ok: false }, { status: 500 })
  }
})
