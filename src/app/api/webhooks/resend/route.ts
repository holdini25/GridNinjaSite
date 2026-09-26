import { readBodyLimited, ContactPayloadTooLargeError, ContactPayloadTimeoutError } from "@/lib/contact/request"
import { DELIVERY_EVENT_TYPES, parseProviderDeliveryEvent, verifyResendSignature } from "@/lib/contact/provider-events"
import { receiveProviderEvent } from "@/server/leads/enterprise-repository"
import { logContactEvent } from "@/lib/contact/log"

export const runtime = "nodejs"
export const maxDuration = 15
export async function POST(request: Request) {
  const secrets = [process.env.RESEND_WEBHOOK_SECRET, process.env.RESEND_WEBHOOK_SECRET_PREVIOUS].filter((value): value is string => !!value?.trim()).map((value) => value.trim())
  if (!secrets.length) return reply({ ok: false }, { status: 503 })
  if (!["svix-id", "svix-timestamp", "svix-signature"].every((key) => request.headers.has(key))) return reply({ ok: false }, { status: 401 })
  let body: string
  try { body = await readBodyLimited(request, 16 * 1024, 5_000) } catch (error) {
    return reply({ ok: false }, { status: error instanceof ContactPayloadTooLargeError ? 413 : error instanceof ContactPayloadTimeoutError ? 408 : 400 })
  }
  if (!verifyResendSignature(body, request.headers, secrets)) return reply({ ok: false }, { status: 401 })
  let payload: unknown
  try { payload = JSON.parse(body) } catch { return reply({ ok: false }, { status: 400 }) }
  // Signed but unsubscribed event types (especially open/click data) are discarded.
  const type = (payload as { type?: unknown } | null)?.type
  if (!DELIVERY_EVENT_TYPES.includes(type as typeof DELIVERY_EVENT_TYPES[number])) return reply({ ok: true, ignored: true })
  const event = parseProviderDeliveryEvent(payload, request.headers.get("svix-id")!)
  if (!event) return reply({ ok: false }, { status: 400 })
  try {
    await receiveProviderEvent(event)
    return reply({ ok: true })
  } catch {
    logContactEvent("error", "provider_event_persistence_failed", { errorCode: "database_unavailable" })
    return reply({ ok: false }, { status: 503 })
  }
}

function reply(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, { ...init, headers: { "Cache-Control": "no-store" } })
}
