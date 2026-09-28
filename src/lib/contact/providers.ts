import "server-only"

import {
  buildLeadAcceptedEvent,
  buildLeadEmailHtml,
  buildLeadEmailSubject,
  buildLeadEmailText,
  type DeliveryChannel,
  type DeliveryProviderResult,
  isRetryableProviderStatus,
  type LeadDeliveryPayload,
  PROVIDER_TIMEOUT_MS,
  sanitizeProviderErrorCode,
  signWebhookBody,
} from "@/lib/contact/delivery-core"

const RESEND_API_URL = "https://api.resend.com/emails"

export class ProviderConfigurationError extends Error {
  constructor(readonly errorCode: "resend_not_configured" | "crm_webhook_not_configured") {
    super(errorCode)
    this.name = "ProviderConfigurationError"
  }
}

export type FrozenProviderRequest = { body: string; targetUrl: string }

export type DeliveryRequest = {
  channel: DeliveryChannel
  eventId: string
  idempotencyKey: string
  lead: LeadDeliveryPayload
  frozenRequest?: FrozenProviderRequest
}

// This is persisted before sending, so a deploy or recipient change cannot
// silently change the payload associated with an existing idempotency key.
export function prepareProviderRequest(request: DeliveryRequest): FrozenProviderRequest {
  if (request.channel === "internal_email") {
    const from = process.env.LEAD_EMAIL_FROM?.trim()
    const to = process.env.LEAD_EMAIL_TO?.trim()
    if (!from || !to) throw new ProviderConfigurationError("resend_not_configured")
    return { targetUrl: RESEND_API_URL, body: JSON.stringify({
      from, to, reply_to: request.lead.email,
      subject: buildLeadEmailSubject(request.lead),
      text: buildLeadEmailText(request.lead),
      html: buildLeadEmailHtml(request.lead),
    }) }
  }
  const targetUrl = process.env.LEAD_WEBHOOK_URL?.trim()
  if (!targetUrl || !process.env.LEAD_WEBHOOK_SIGNING_SECRET?.trim()) throw new ProviderConfigurationError("crm_webhook_not_configured")
  return { targetUrl, body: JSON.stringify(buildLeadAcceptedEvent(request.lead, request.eventId)) }
}

export async function deliverToConfiguredProvider(
  request: DeliveryRequest,
  fetcher: typeof fetch = fetch
): Promise<DeliveryProviderResult> {
  if (request.channel === "internal_email") {
    return deliverToResend(request, fetcher)
  }

  return deliverToCrmWebhook(request, fetcher)
}

async function deliverToResend(
  request: DeliveryRequest,
  fetcher: typeof fetch
): Promise<DeliveryProviderResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey || (!request.frozenRequest && (!process.env.LEAD_EMAIL_TO?.trim() || !process.env.LEAD_EMAIL_FROM?.trim()))) {
    return configurationFailure("resend_not_configured")
  }

  try {
    const frozen = request.frozenRequest ?? prepareProviderRequest(request)
    if (frozen.targetUrl !== RESEND_API_URL) return configurationFailure("provider_target_changed")
    const response = await fetcher(frozen.targetUrl, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": request.idempotencyKey,
      },
      body: frozen.body,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    })

    const providerResponse = await readResendResponse(response)

    if (!response.ok) {
      const retryable =
        providerResponse.errorCode === "concurrent_idempotent_requests" ||
        (providerResponse.errorCode !== "invalid_idempotent_request" &&
          isRetryableProviderStatus(response.status))

      return {
        ok: false,
        status: response.status,
        errorCode: providerResponse.errorCode,
        retryable,
      }
    }

    if (!providerResponse.id) return { ok: false, status: response.status, errorCode: "resend_invalid_success", retryable: true }
    return { ok: true, status: response.status, providerMessageId: providerResponse.id }
  } catch (error) {
    return transportFailure(error, "resend_transport_error")
  }
}

async function deliverToCrmWebhook(
  request: DeliveryRequest,
  fetcher: typeof fetch
): Promise<DeliveryProviderResult> {
  const url = process.env.LEAD_WEBHOOK_URL?.trim()
  const secret = process.env.LEAD_WEBHOOK_SIGNING_SECRET?.trim()

  if (!url || !secret) {
    return configurationFailure("crm_webhook_not_configured")
  }

  const frozen = request.frozenRequest ?? prepareProviderRequest(request)
  // A configuration change requires reconciliation, never send old PII to a
  // newly configured CRM host automatically.
  if (frozen.targetUrl !== url) return configurationFailure("provider_target_changed")
  const exactBody = frozen.body
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signWebhookBody(timestamp, exactBody, secret)

  try {
    const response = await fetcher(url, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": request.idempotencyKey,
        "X-GridNinja-Event-Id": request.eventId,
        "X-GridNinja-Timestamp": timestamp,
        "X-GridNinja-Signature": `v1=${signature}`,
      },
      body: exactBody,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    })

    // Intentionally do not read, retain, or log webhook response bodies.
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        errorCode: `crm_http_${response.status}`,
        retryable: isRetryableProviderStatus(response.status),
      }
    }

    return { ok: true, status: response.status }
  } catch (error) {
    return transportFailure(error, "crm_transport_error")
  }
}

async function readResendResponse(response: Response) {
  try {
    const payload = (await response.json()) as {
      id?: unknown
      name?: unknown
      error?: { name?: unknown }
    }
    const id = typeof payload.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(payload.id) ? payload.id : undefined
    const providerCode = payload.name ?? payload.error?.name

    return {
      id,
      errorCode: sanitizeProviderErrorCode(
        providerCode,
        `resend_http_${response.status}`
      ),
    }
  } catch {
    return { errorCode: `resend_http_${response.status}` }
  }
}

function configurationFailure(errorCode: string): DeliveryProviderResult {
  return { ok: false, status: 0, errorCode, retryable: false }
}

function transportFailure(
  error: unknown,
  fallback: string
): DeliveryProviderResult {
  const timedOut =
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")

  return {
    ok: false,
    status: 0,
    errorCode: timedOut ? "provider_timeout" : fallback,
    retryable: true,
  }
}
