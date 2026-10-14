import { ContactPayloadTimeoutError, ContactPayloadTooLargeError, readBodyLimited } from "@/lib/contact/request"
import { DELIVERY_EVENT_TYPES, parseProviderDeliveryEvent, verifyResendPayload } from "@/lib/contact/provider-events"
import { operationalReference } from "@/lib/contact/operational-config"
import { observationsRepository } from "@/server/leads/observations-repository"
import { logContactEvent } from "@/lib/contact/log"

export const runtime = "nodejs"
export const maxDuration = 15
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(request: Request) {
  const currentAccount = operationalReference(process.env.RESEND_ACCOUNT_REF)
  const currentSecret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  const previousSecret = process.env.RESEND_WEBHOOK_SECRET_PREVIOUS?.trim()
  const previousAccount = operationalReference(process.env.RESEND_WEBHOOK_PREVIOUS_ACCOUNT_REF)
  if (!currentAccount || !currentSecret || (previousSecret && !previousAccount)) return reply({ ok: false }, 503)
  const bindings = [{ secret: currentSecret, accountRef: currentAccount }, ...(previousSecret && previousAccount ? [{ secret: previousSecret, accountRef: previousAccount }] : [])]
  if (!["svix-id", "svix-timestamp", "svix-signature"].every(key => request.headers.has(key))) return reply({ ok: false }, 401)
  let body: string
  try { body = await readBodyLimited(request, 16 * 1024, 5000) } catch (error) {
    return reply({ ok: false }, error instanceof ContactPayloadTooLargeError ? 413 : error instanceof ContactPayloadTimeoutError ? 408 : 400)
  }
  let payload: unknown
  let accountRef: string | undefined
  for (const binding of bindings) {
    try { payload = verifyResendPayload(body, request.headers, [binding.secret]); accountRef = binding.accountRef; break } catch { /* Try only explicitly account-bound rotation keys. */ }
  }
  if (!accountRef) return reply({ ok: false }, 401)
  const type = (payload as { type?: unknown } | null)?.type
  // Authenticated open/click and other unused events are discarded, not stored.
  if (!DELIVERY_EVENT_TYPES.includes(type as typeof DELIVERY_EVENT_TYPES[number])) return reply({ ok: true, ignored: true })
  const event = parseProviderDeliveryEvent(payload, request.headers.get("svix-id")!, accountRef)
  if (!event) return reply({ ok: false }, 400)
  try {
    const result = await observationsRepository().receiveProviderEvent(event)
    if (result.conflict) logContactEvent("error", "provider_event_conflict", { errorCode: "provider_event_conflict" })
    return reply({ ok: true })
  } catch {
    logContactEvent("error", "provider_event_persistence_failed", { errorCode: "database_unavailable" })
    return reply({ ok: false }, 503)
  }
}
