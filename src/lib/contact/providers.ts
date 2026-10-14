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
  signWebhookBody,
} from "@/lib/contact/delivery-core"

import { ContactPayloadTimeoutError, readBodyLimited } from "@/lib/contact/request"
import { providerIdentity, ProviderConfigurationError, requestDigest, validPreparedRequest, qualifiedCrmConfiguration, type PreparedProviderRequest } from "@/lib/contact/provider-request"
export { ProviderConfigurationError } from "@/lib/contact/provider-request"

export type DeliveryRequest = {
  channel: DeliveryChannel
  eventId: string
  idempotencyKey: string
  preparedRequest: PreparedProviderRequest
}

export function prepareProviderRequest(request: { channel: DeliveryChannel; eventId: string; idempotencyKey: string; lead: LeadDeliveryPayload }): PreparedProviderRequest {
  const identity = providerIdentity(request.channel)
  const body = request.channel === "internal_email" ? JSON.stringify({
    from: identity.from, to: identity.to, reply_to: request.lead.email,
    subject: buildLeadEmailSubject(request.lead), text: buildLeadEmailText(request.lead), html: buildLeadEmailHtml(request.lead),
  }) : JSON.stringify(buildLeadAcceptedEvent(request.lead, request.eventId))
  return { version: 1, channel: request.channel, idempotencyKey: request.idempotencyKey, bodyUtf8: body, bodySha256: requestDigest(body), targetUrl: identity.targetUrl,
    accountRef: identity.accountRef, destinationRef: identity.destinationRef }
}

export function preparedRequestAuthorization(channel: DeliveryChannel, prepared: PreparedProviderRequest): string | null {
  if (channel !== prepared.channel) return "provider_request_identity_changed"
  if (!validPreparedRequest(prepared)) return "provider_snapshot_invalid"
  try {
    const current = providerIdentity(channel)
    if (current.accountRef !== prepared.accountRef) return "provider_account_changed"
    if (current.targetUrl !== prepared.targetUrl || current.destinationRef !== prepared.destinationRef) return "provider_destination_changed"
    return null
  } catch (error) { return error instanceof ProviderConfigurationError ? error.errorCode : "provider_not_configured" }
}

export async function deliverToConfiguredProvider(
  request: DeliveryRequest,
  fetcher: typeof fetch = fetch
): Promise<DeliveryProviderResult> {
  if (request.channel !== request.preparedRequest.channel || request.idempotencyKey !== request.preparedRequest.idempotencyKey) return configurationFailure("provider_request_identity_changed")
  const authorizationError = preparedRequestAuthorization(request.channel, request.preparedRequest)
  if (authorizationError) return configurationFailure(authorizationError)
  if (request.channel === "internal_email") {
    return deliverToResend(request, fetcher)
  }

  return deliverToCrmWebhook(request, fetcher)
}

async function deliverToResend(
  request: DeliveryRequest,
  fetcher: typeof fetch
): Promise<DeliveryProviderResult> {
  const apiKey = process.env.RESEND_API_KEY!.trim()

  try {
    const response = await fetcher(request.preparedRequest.targetUrl, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": request.preparedRequest.idempotencyKey,
      },
      body: request.preparedRequest.bodyUtf8,
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
  const crm = qualifiedCrmConfiguration()
  if (!crm) return configurationFailure("crm_contract_not_configured")
  const url = request.preparedRequest.targetUrl, secret = crm.secret
  const exactBody = request.preparedRequest.bodyUtf8
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signWebhookBody(timestamp, exactBody, secret)

  try {
    const response = await fetcher(url, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": request.preparedRequest.idempotencyKey,
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
    const payload = JSON.parse(await readBodyLimited(response, 64 * 1024, PROVIDER_TIMEOUT_MS)) as {
      id?: unknown
      name?: unknown
      error?: { name?: unknown }
    }
    const id = typeof payload.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(payload.id) ? payload.id : undefined
    const providerCode = payload.name ?? payload.error?.name

    return {
      id,
      errorCode: providerCode === "concurrent_idempotent_requests" || providerCode === "invalid_idempotent_request"
        ? providerCode : `resend_http_${response.status}`,
    }
  } catch (error) {
    if (error instanceof ContactPayloadTimeoutError || (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name))) throw error
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
  const timedOut = error instanceof ContactPayloadTimeoutError || (
    error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError"))

  return {
    ok: false,
    status: 0,
    errorCode: timedOut ? "provider_timeout" : fallback,
    retryable: true,
  }
}
