import { randomUUID } from "node:crypto"

import { publishOperatorAlert } from "@/lib/contact/alerts"
import { getContactRuntimeConfig } from "@/lib/contact/config"
import { classifyContactError, logContactEvent } from "@/lib/contact/log"
import { sweepLeadDeliveryQueue } from "@/lib/contact/operations"
import { withVerifiedQstashSignature } from "@/lib/contact/qstash-receiver"
import { publishLeadDeliveryWake } from "@/lib/contact/queue"
import { deliveryOperationsRepository } from "@/lib/contact/repository-adapter"

export const runtime = "nodejs"

export const POST = withVerifiedQstashSignature(async () => {
  const config = getContactRuntimeConfig()

  try {
    const result = await sweepLeadDeliveryQueue(deliveryOperationsRepository, {
      publishWake: (outboxIds) => publishLeadDeliveryWake(config, outboxIds),
      publishAlert: (alert) => publishOperatorAlert(config, alert),
    })

    return Response.json({ ok: true, ...result })
  } catch (error) {
    const errorCode = classifyContactError(error)

    logContactEvent("error", "lead_delivery_sweep_failed", {
      errorCode,
      state: "database_or_queue_failure",
    })

    try {
      await publishOperatorAlert(config, {
        schemaVersion: 1,
        eventId: `database/${randomUUID()}`,
        type: "database_failure",
        occurredAt: new Date().toISOString(),
        errorCode,
      })
    } catch (alertError) {
      logContactEvent("error", "lead_alert_publish_failed", {
        errorCode: classifyContactError(alertError),
        state: "qstash_failure",
      })
    }

    return Response.json({ ok: false }, { status: 500 })
  }
})
