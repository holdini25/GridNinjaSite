// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { processOneLeadDelivery, type ClaimedDelivery, type DeliveryOperationsRepository } from "@/lib/contact/operations"
import { prepareProviderRequest, preparedRequestAuthorization, deliverToConfiguredProvider } from "@/lib/contact/providers"
import { PROVIDER_RETRY_WINDOW_MS, type PreparedProviderRequest } from "@/lib/contact/provider-request"
import { pendingTerminalError } from "@/server/leads/repository"
import { mapClaim } from "@/lib/contact/repository-adapter"
import type { LeadDeliveryContext } from "@/server/leads/repository"

vi.mock("@/lib/contact/providers", () => ({ deliverToConfiguredProvider: vi.fn(), prepareProviderRequest: vi.fn(), preparedRequestAuthorization: vi.fn() }))
vi.mock("@/lib/contact/log", () => ({ logContactEvent: vi.fn() }))

const now = new Date("2026-10-11T12:00:00Z")
const lease = { id: "outbox", leadId: "lead", channel: "internal_email" as const, attemptCount: 6, leaseToken: "lease", idempotencyKey: "retained-key" }
const send: ClaimedDelivery = { kind: "send", delivery: lease, lead: {
  id: "lead", schemaVersion: 2, acceptedAt: now, formType: "contact", name: "Operator",
  company: "Example", email: "operator@example.test", buyerType: null, siteType: null,
  timeline: null, capacityRange: null, intent: "capacity-audit", source: "contact-page",
  role: null, constraints: [], message: null,
} }
const prepared: PreparedProviderRequest = { version: 1, channel: lease.channel, idempotencyKey: lease.idempotencyKey, bodyUtf8: "original body", bodySha256: "hash", targetUrl: "https://api.resend.com/emails", accountRef: "account", destinationRef: "destination" }
function repository(claim: ClaimedDelivery = send) {
  return {
    claimNextDueOutbox: vi.fn().mockResolvedValue(claim), claimOutboxById: vi.fn().mockResolvedValue(claim),
    prepareAndReserveProviderAttempt: vi.fn().mockResolvedValue({ kind: "ready", reservationId: "reservation", firstAttemptAt: now, request: prepared }),
    recordProviderAttemptResult: vi.fn().mockResolvedValue(true),
    isOutboxSendAllowed: vi.fn().mockResolvedValue(true), isOutboxAlertAllowed: vi.fn().mockResolvedValue(true),
    markOutboxDelivered: vi.fn().mockResolvedValue(true), rescheduleOutbox: vi.fn().mockResolvedValue(true),
    markOutboxDeadLetter: vi.fn().mockResolvedValue(true), markTerminalAlertPublished: vi.fn().mockResolvedValue(true),
    getOldestDueOutboxAge: vi.fn().mockResolvedValue(null), listDueOrLeaseExpiredOutbox: vi.fn().mockResolvedValue([]),
    redactExpiredLeads: vi.fn().mockResolvedValue(0), deleteExpiredLeads: vi.fn().mockResolvedValue(0),
  } satisfies DeliveryOperationsRepository
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(prepareProviderRequest).mockReturnValue(prepared); vi.mocked(preparedRequestAuthorization).mockReturnValue(null) })

describe("durable terminal delivery and alert recovery", () => {
  it("records credential approval failure as review-required configuration failure", async () => {
    const repo = repository(), publish = vi.fn().mockResolvedValue(undefined)
    vi.mocked(deliverToConfiguredProvider).mockResolvedValue({ ok: false, status: 0, errorCode: "resend_account_binding_invalid", retryable: false })
    await processOneLeadDelivery(repo, { now, publishAlert: publish })
    expect(repo.markOutboxDeadLetter).toHaveBeenCalledWith("outbox", "lease", { errorCode: "resend_account_binding_invalid", reviewReason: "resend_account_binding_invalid" }, now)
    expect(publish.mock.calls.map(call => call[0].type)).toEqual(["configuration_failure", "dead_letter"])
  })
  it("stops sends before queue publication and recovers an alert without another provider attempt", async () => {
    const repo = repository()
    vi.mocked(deliverToConfiguredProvider).mockResolvedValue({ ok: false, status: 500, retryable: true, errorCode: "resend_http_500" })
    const publish = vi.fn().mockImplementation(async () => {
      expect(repo.markOutboxDeadLetter).toHaveBeenCalledWith("outbox", "lease", { errorCode: "resend_http_500", reviewReason: "resend_http_500" }, now)
      throw new Error("queue outage")
    })
    await expect(processOneLeadDelivery(repo, { now, publishAlert: publish })).rejects.toThrow("queue outage")
    expect(repo.markTerminalAlertPublished).not.toHaveBeenCalled()
    repo.claimNextDueOutbox.mockResolvedValue({ kind: "alert", delivery: lease, errorCode: "resend_http_500", terminalAt: now })
    publish.mockResolvedValue(undefined)
    await expect(processOneLeadDelivery(repo, { now: new Date(now.getTime() + 31_000), publishAlert: publish })).resolves.toEqual({ state: "dead_letter" })
    expect(deliverToConfiguredProvider).toHaveBeenCalledTimes(1)
    expect(publish.mock.calls[1][0]).toEqual(publish.mock.calls[0][0])
    expect(repo.markTerminalAlertPublished).toHaveBeenCalledTimes(1)
  })

  it("rejects a reclaimed exhausted attempt before sending, preserving its provider key", async () => {
    const repo = repository({ ...send, delivery: { ...lease, attemptCount: 7 } })
    const publish = vi.fn()
    await processOneLeadDelivery(repo, { now, publishAlert: publish })
    expect(deliverToConfiguredProvider).not.toHaveBeenCalled()
    expect(repo.markOutboxDeadLetter).toHaveBeenCalledWith("outbox", "lease", { errorCode: "attempt_limit_reached", reviewReason: "attempt_limit_reached" }, now)
    expect(send.delivery.idempotencyKey).toBe("retained-key")
  })

  it("publishes nothing if a terminal transition lost its lease", async () => {
    const repo = repository({ ...send, delivery: { ...lease, attemptCount: 7 } })
    repo.markOutboxDeadLetter.mockResolvedValue(false)
    const publish = vi.fn()
    await expect(processOneLeadDelivery(repo, { now, publishAlert: publish })).resolves.toEqual({ state: "stale" })
    expect(publish).not.toHaveBeenCalled()
  })

  it("does not send after retention or lease expiry invalidates authorization", async () => {
    const repo = repository()
    repo.isOutboxSendAllowed.mockResolvedValue(false)
    await expect(processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })).resolves.toEqual({ state: "stale" })
    expect(deliverToConfiguredProvider).not.toHaveBeenCalled()
  })

  it("retries configuration and terminal alerts with original metadata after partial publication", async () => {
    const repo = repository({ kind: "alert", delivery: lease, errorCode: "resend_not_configured", terminalAt: now })
    const publish = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("queue outage"))
    await expect(processOneLeadDelivery(repo, { now, publishAlert: publish })).rejects.toThrow()
    publish.mockResolvedValue(undefined)
    await processOneLeadDelivery(repo, { now: new Date(now.getTime() + 31_000), publishAlert: publish })
    expect(publish.mock.calls.map(call => call[0].eventId)).toEqual(["configuration/outbox", "dead-letter/outbox", "configuration/outbox", "dead-letter/outbox"])
    expect(publish.mock.calls[2][0]).toEqual(publish.mock.calls[0][0])
    expect(publish.mock.calls[3][0]).toEqual(publish.mock.calls[1][0])
    expect(deliverToConfiguredProvider).not.toHaveBeenCalled()
  })

  it("does not acknowledge a pending alert while its lease has been replaced", async () => {
    const repo = repository({ kind: "alert", delivery: lease, errorCode: "resend_http_500", terminalAt: now })
    repo.isOutboxAlertAllowed.mockResolvedValue(false)
    const publish = vi.fn()
    await expect(processOneLeadDelivery(repo, { now, publishAlert: publish })).resolves.toEqual({ state: "stale" })
    expect(publish).not.toHaveBeenCalled()
    expect(repo.markTerminalAlertPublished).not.toHaveBeenCalled()
  })

  it("keeps the final permitted send and original idempotency key", async () => {
    const repo = repository()
    vi.mocked(deliverToConfiguredProvider).mockResolvedValue({ ok: true, status: 200, providerMessageId: "provider-id" })
    await expect(processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })).resolves.toEqual({ state: "delivered" })
    expect(deliverToConfiguredProvider).toHaveBeenCalledWith({ channel: "internal_email", eventId: "outbox", idempotencyKey: "retained-key", preparedRequest: prepared })
  })

  it("bounds and reserves the marker without truncating provider errors", () => {
    expect(pendingTerminalError("x".repeat(64))).toHaveLength(78)
    expect(() => pendingTerminalError("x".repeat(65))).toThrow()
    expect(() => pendingTerminalError("alert_pending:failure")).toThrow()
  })

  it("maps a redacted pending alert without retaining inquiry PII", () => {
    const context = { delivery: { ...lease, status: "dead_letter", deadLetteredAt: now, lastErrorCode: "alert_pending:resend_not_configured" }, lead: { redactedAt: now, name: null, email: null } } as unknown as LeadDeliveryContext
    expect(mapClaim(context)).toEqual({ kind: "alert", delivery: lease, errorCode: "resend_not_configured", terminalAt: now })
    expect(mapClaim({ ...context, delivery: { ...context.delivery, status: "processing" } })).toBeNull()
  })
})

describe("prepared attempt permission and bounded uncertainty", () => {
  it.each(["already_reserved", "stale"] as const)("never sends after %s preparation", async kind => {
    const repo = repository(); repo.prepareAndReserveProviderAttempt.mockResolvedValue({ kind })
    expect(await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })).toEqual({ state: kind })
    expect(deliverToConfiguredProvider).not.toHaveBeenCalled()
  })
  it.each([PROVIDER_RETRY_WINDOW_MS, PROVIDER_RETRY_WINDOW_MS + 1])("stops at elapsed %i before HTTP", async elapsed => {
    const repo = repository(); repo.prepareAndReserveProviderAttempt.mockResolvedValue({ kind: "ready", reservationId: "r", firstAttemptAt: new Date(now.getTime() - elapsed), request: prepared })
    await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })
    expect(deliverToConfiguredProvider).not.toHaveBeenCalled()
    expect(repo.markOutboxDeadLetter).toHaveBeenCalledWith("outbox", "lease", { errorCode: "provider_retry_window_expired", reviewReason: "provider_retry_window_expired" }, now)
  })
  it("uses persisted original bytes immediately below the cutoff", async () => {
    const repo = repository(); repo.prepareAndReserveProviderAttempt.mockResolvedValue({ kind: "ready", reservationId: "r", firstAttemptAt: new Date(now.getTime() - PROVIDER_RETRY_WINDOW_MS + 1), request: prepared })
    vi.mocked(deliverToConfiguredProvider).mockResolvedValue({ ok: true, status: 200, providerMessageId: "provider" })
    await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })
    expect(deliverToConfiguredProvider).toHaveBeenCalledWith(expect.objectContaining({ preparedRequest: prepared }))
  })
  it.each([new Date(NaN)])("stops an invalid provider clock", async firstAttemptAt => {
    const repo = repository(); repo.prepareAndReserveProviderAttempt.mockResolvedValue({ kind: "ready", reservationId: "r", firstAttemptAt, request: prepared })
    await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })
    expect(deliverToConfiguredProvider).not.toHaveBeenCalled()
  })
  it("records minimal late response evidence before a stale authoritative completion", async () => {
    const repo = repository(); repo.markOutboxDelivered.mockResolvedValue(false)
    const result = { ok: true as const, status: 200, providerMessageId: "late-provider" }
    vi.mocked(deliverToConfiguredProvider).mockResolvedValue(result)
    expect(await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })).toEqual({ state: "stale" })
    expect(repo.recordProviderAttemptResult).toHaveBeenCalledWith("reservation", result)
    expect(repo.recordProviderAttemptResult.mock.invocationCallOrder[0]).toBeLessThan(repo.markOutboxDelivered.mock.invocationCallOrder[0])
  })
  it("rechecks destination authorization after reservation and before HTTP", async () => {
    const repo = repository(); vi.mocked(preparedRequestAuthorization).mockReturnValue("provider_destination_changed")
    await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })
    expect(deliverToConfiguredProvider).not.toHaveBeenCalled()
  })
})
