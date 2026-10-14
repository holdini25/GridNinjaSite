import { createHash } from "node:crypto"
import type { DeliveryChannel } from "@/lib/contact/delivery-core"

export const PROVIDER_RETRY_WINDOW_MS = 23 * 3_600_000
export const RESEND_API_URL = "https://api.resend.com/emails"
export type PreparedRequest = Readonly<{
  version: 1
  channel: DeliveryChannel
  idempotencyKey: string
  bodyUtf8: string
  bodySha256: string
  targetUrl: string
  accountRef: string
  destinationRef: string
}>
export type PreparedProviderRequest = PreparedRequest
const REVIEW_REASONS = [
  "provider_request_identity_changed", "provider_review_required", "attempt_limit_reached",
  "provider_snapshot_invalid", "provider_clock_invalid", "provider_retry_window_expired",
  "provider_account_changed", "provider_destination_changed",
] as const
export type ReviewReason = typeof REVIEW_REASONS[number]
export function parseReviewReason(value: unknown): ReviewReason {
  const reason = REVIEW_REASONS.find(reason => reason === value)
  if (!reason) throw new Error("InvalidProviderReviewReason")
  return reason
}
export type SendDecision =
  | { kind: "ready"; reservationId: string; firstAttemptAt: Date; request: PreparedProviderRequest }
  | { kind: "already_reserved" }
  | { kind: "stale" }
  | { kind: "stopped"; reason: ReviewReason; terminalAt: Date }

export type ProviderReservation = SendDecision

export function requestDigest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex")
}
export function validPreparedRequest(request: PreparedProviderRequest) {
  return request.version === 1 && ["internal_email", "crm_webhook"].includes(request.channel) &&
    /^[A-Za-z0-9_/-]{1,160}$/.test(request.idempotencyKey) && request.bodyUtf8.length > 0 && Buffer.byteLength(request.bodyUtf8, "utf8") <= 64 * 1024 &&
    /^[a-zA-Z0-9_-]{1,64}$/.test(request.accountRef) && /^[a-f0-9]{64}$/.test(request.destinationRef) &&
    request.bodySha256 === requestDigest(request.bodyUtf8)
}
export class ProviderConfigurationError extends Error {
  constructor(readonly errorCode: string) { super(errorCode); this.name = "ProviderConfigurationError" }
}
export function providerIdentity(channel: DeliveryChannel) {
  if (channel === "internal_email") {
    const from = process.env.LEAD_EMAIL_FROM?.trim(), to = process.env.LEAD_EMAIL_TO?.trim()
    const approved = approvedResendConfiguration()
    if (!from || !to) throw new ProviderConfigurationError("resend_not_configured")
    if (!approved) throw new ProviderConfigurationError("resend_account_binding_invalid")
    return { accountRef: approved.accountRef, targetUrl: RESEND_API_URL, destinationRef: requestDigest(JSON.stringify({ from, to })), from, to }
  }
  const crm = qualifiedCrmConfiguration()
  if (!crm) throw new ProviderConfigurationError("crm_contract_not_configured")
  return { accountRef: crm.accountRef, targetUrl: crm.targetUrl, destinationRef: requestDigest(JSON.stringify({ targetUrl: crm.targetUrl, contractRef: crm.contractRef })) }
}
// The private approval record must establish real provider-account ownership.
// A digest forces every credential rotation to be re-approved; neither secret
// nor its fingerprint is included in a frozen request or delivery log.
export function approvedResendConfiguration(env: Record<string, string | undefined> = process.env) {
  const apiKey = env.RESEND_API_KEY?.trim(), accountRef = env.RESEND_ACCOUNT_REF?.trim()
  const bindingRef = env.RESEND_ACCOUNT_BINDING_REF?.trim(), approvedDigest = env.RESEND_APPROVED_KEY_SHA256?.trim()
  if (!apiKey || !accountRef || !/^[A-Za-z0-9_-]{1,64}$/.test(accountRef) ||
      !bindingRef || !/^[A-Za-z0-9_-]{1,64}$/.test(bindingRef) || !approvedDigest ||
      !/^[a-f0-9]{64}$/.test(approvedDigest) || requestDigest(apiKey) !== approvedDigest) return null
  return { accountRef, bindingRef }
}
export function qualifiedCrmConfiguration(env: Record<string, string | undefined> = process.env) {
  if (env.LEAD_WEBHOOK_ENABLED !== "true") return null
  const targetUrl = env.LEAD_WEBHOOK_URL?.trim(), secret = env.LEAD_WEBHOOK_SIGNING_SECRET?.trim()
  const accountRef = env.LEAD_WEBHOOK_ACCOUNT_REF?.trim(), contractRef = env.LEAD_WEBHOOK_CONTRACT_REF?.trim()
  const hours = Number(env.LEAD_WEBHOOK_DEDUPLICATION_HOURS)
  if (!targetUrl || !secret || secret.length < 32 || !accountRef || !/^[a-zA-Z0-9_-]{1,64}$/.test(accountRef) ||
      !contractRef || !/^[a-zA-Z0-9_-]{1,64}$/.test(contractRef) || !Number.isSafeInteger(hours) || hours < 24) return null
  try {
    const url = new URL(targetUrl)
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null
    return { targetUrl: url.toString(), secret, accountRef, contractRef }
  } catch { return null }
}
