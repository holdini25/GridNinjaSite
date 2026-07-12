import {
  parseOperatorAlert,
  sendOperatorAlert,
} from "@/lib/contact/alerts"
import { getContactRuntimeConfig } from "@/lib/contact/config"
import { classifyContactError, logContactEvent } from "@/lib/contact/log"
import { withVerifiedQstashSignature } from "@/lib/contact/qstash-receiver"

export const runtime = "nodejs"

export const POST = withVerifiedQstashSignature(async (_request, body) => {
  const alert = parseOperatorAlert(body)

  if (!alert) {
    return Response.json({ ok: false }, { status: 400 })
  }

  try {
    const result = await sendOperatorAlert(getContactRuntimeConfig(), alert)

    logContactEvent("info", "lead_alert_processed", {
      state: result.skipped ? "skipped" : "delivered",
    })

    return Response.json({ ok: true, ...result })
  } catch (error) {
    logContactEvent("error", "lead_alert_delivery_failed", {
      errorCode: classifyContactError(error),
      state: "provider_failure",
    })

    // Non-2xx makes QStash retry this provider-neutral alert adapter.
    return Response.json({ ok: false }, { status: 502 })
  }
})
