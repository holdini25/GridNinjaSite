// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProviderConfigurationError } from "@/lib/contact/providers"
import { enforceLeadRetention, processOneLeadDelivery, sweepLeadDeliveryQueue, type ClaimedDelivery, type DeliveryOperationsRepository } from "@/lib/contact/operations"
const mocks = vi.hoisted(() => ({ deliver: vi.fn(), prepare: vi.fn(), log: vi.fn() }))
vi.mock("@/lib/contact/providers", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/contact/providers")>(), deliverToConfiguredProvider: mocks.deliver, prepareProviderRequest: mocks.prepare }))
vi.mock("@/lib/contact/log", () => ({ logContactEvent: mocks.log }))
const now = new Date("2026-09-24T12:00:00Z")
const claim: ClaimedDelivery = { delivery: { id: "outbox", leadId: "lead", channel: "internal_email", attemptCount: 1, leaseToken: "lease", idempotencyKey: "stable-key", firstProviderAttemptAt: null, frozenRequest: null }, lead: { id: "lead", schemaVersion: 2, acceptedAt: now, formType: "contact", name: "Private Name", company: "Private Company", email: "private@example.test", buyerType: null, siteType: null, timeline: null, capacityRange: null, intent: "other", source: "contact", role: null, constraints: [], message: "Private inquiry" } }
function repository(): DeliveryOperationsRepository {
  return { beginProviderAttempt: vi.fn().mockResolvedValue({ firstProviderAttemptAt: now, frozenRequest: { body: "frozen", targetUrl: "https://api.resend.com/emails" } }), recordHeartbeat: vi.fn(), pruneProviderEvents: vi.fn(), claimNextDueOutbox: vi.fn().mockResolvedValue(claim), claimOutboxById: vi.fn().mockResolvedValue(claim), markOutboxDelivered: vi.fn().mockResolvedValue(true), rescheduleOutbox: vi.fn().mockResolvedValue(true), markOutboxDeadLetter: vi.fn().mockResolvedValue(true), getOldestDueOutboxAge: vi.fn().mockResolvedValue(null), listDueOrLeaseExpiredOutbox: vi.fn().mockResolvedValue([]), redactExpiredLeads: vi.fn().mockResolvedValue(2), deleteExpiredLeads: vi.fn().mockResolvedValue(1) }
}
beforeEach(() => { vi.clearAllMocks(); mocks.prepare.mockReturnValue({ body: "frozen", targetUrl: "https://api.resend.com/emails" }); mocks.deliver.mockResolvedValue({ ok: true, status: 200, providerMessageId: "provider" }) })
describe("contact operations with isolated provider sinks", () => {
  it("does not report delivery when another worker owns the lease", async () => {
    const repo = repository(); vi.mocked(repo.markOutboxDelivered).mockResolvedValue(false)
    expect(await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })).toEqual({ state: "stale" })
    expect(repo.markOutboxDelivered).toHaveBeenCalledWith("outbox", "lease", "provider")
    expect(JSON.stringify(mocks.log.mock.calls)).not.toMatch(/Private|private@example|stable-key/)
  })
  it("persists a deterministic bounded retry and retains the provider idempotency key", async () => {
    const repo = repository(); mocks.deliver.mockResolvedValue({ ok: false, status: 503, retryable: true, errorCode: "provider_503" })
    const result = await processOneLeadDelivery(repo, { now, random: () => .5, publishAlert: vi.fn() })
    expect(result).toMatchObject({ state: "retry_scheduled", nextAttemptAt: new Date(now.getTime() + 60_000) })
    expect(mocks.deliver).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "stable-key" }))
    expect(repo.markOutboxDeadLetter).not.toHaveBeenCalled()
  })
  it("persists terminal state even when queue-based alerting fails", async () => {
    const repo = repository(); mocks.deliver.mockResolvedValue({ ok: false, status: 400, retryable: false, errorCode: "provider_400" })
    const publishAlert = vi.fn().mockRejectedValue(new Error("sink unavailable"))
    expect(await processOneLeadDelivery(repo, { now, publishAlert })).toEqual({ state: "dead_letter" })
    expect(publishAlert).toHaveBeenCalledWith(expect.objectContaining({ type: "dead_letter" }))
    expect(repo.markOutboxDeadLetter).toHaveBeenCalled()
  })
  it("dead-letters an exhausted retry before best-effort alerting", async () => {
    const repo = repository(); vi.mocked(repo.claimNextDueOutbox).mockResolvedValue({ ...claim, delivery: { ...claim.delivery, attemptCount: 6 } })
    mocks.deliver.mockResolvedValue({ ok: false, status: 503, retryable: true, errorCode: "provider_503" })
    const publishAlert = vi.fn().mockResolvedValue(undefined)
    expect(await processOneLeadDelivery(repo, { now, publishAlert })).toEqual({ state: "dead_letter" })
    expect(publishAlert.mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(repo.markOutboxDeadLetter).mock.invocationCallOrder[0])
    expect(repo.rescheduleOutbox).not.toHaveBeenCalled()
  })
  it("bounds sweep/retention batches and reports overdue queue health to a mock sink", async () => {
    const repo = repository(); vi.mocked(repo.listDueOrLeaseExpiredOutbox).mockResolvedValue([{ id: "outbox" }]); vi.mocked(repo.getOldestDueOutboxAge).mockResolvedValue(300_001)
    const publishWake = vi.fn().mockResolvedValue(undefined), publishAlert = vi.fn().mockResolvedValue(undefined)
    await sweepLeadDeliveryQueue(repo, { now, publishWake, publishAlert })
    expect(repo.listDueOrLeaseExpiredOutbox).toHaveBeenCalledWith(now, 25)
    expect(publishWake).toHaveBeenCalledWith(["outbox"])
    expect(publishAlert).toHaveBeenCalledWith(expect.objectContaining({ type: "queue_age" }))
    expect(await enforceLeadRetention(repo, now)).toEqual({ redacted: 2, deleted: 1 })
    expect(repo.redactExpiredLeads).toHaveBeenCalledWith(now, 1000)
    expect(repo.deleteExpiredLeads).toHaveBeenCalledWith(now, 1000)
  })
  it("stops before any provider request at the 23-hour idempotency safety boundary", async () => {
    const repo = repository()
    vi.mocked(repo.claimNextDueOutbox).mockResolvedValue({ ...claim, delivery: { ...claim.delivery, firstProviderAttemptAt: new Date(now.getTime() - 23 * 3_600_000) } })
    expect(await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })).toEqual({ state: "needs_review" })
    expect(mocks.deliver).not.toHaveBeenCalled()
    expect(repo.beginProviderAttempt).not.toHaveBeenCalled()
    expect(repo.markOutboxDeadLetter).toHaveBeenCalledWith("outbox", "lease", { errorCode: "needs_review_idempotency_window", reviewRequiredAt: now })
  })
  it("persists removed CRM configuration as a terminal configuration stop before any request", async () => {
    const repo = repository(), publishAlert = vi.fn().mockRejectedValue(new Error("queue unavailable"))
    vi.mocked(repo.claimNextDueOutbox).mockResolvedValue({ ...claim, delivery: { ...claim.delivery, channel: "crm_webhook" } })
    mocks.prepare.mockImplementationOnce(() => { throw new ProviderConfigurationError("crm_webhook_not_configured") })
    expect(await processOneLeadDelivery(repo, { now, publishAlert })).toEqual({ state: "configuration_failure" })
    expect(repo.markOutboxDeadLetter).toHaveBeenCalledWith("outbox", "lease", { errorCode: "crm_webhook_not_configured" })
    expect(publishAlert).toHaveBeenCalledWith(expect.objectContaining({ type: "configuration_failure" }))
    expect(repo.beginProviderAttempt).not.toHaveBeenCalled()
    expect(mocks.deliver).not.toHaveBeenCalled()
    expect(repo.rescheduleOutbox).not.toHaveBeenCalled()
  })
  it("rechecks the persisted clock rather than trusting the earlier claim", async () => {
    const repo = repository()
    vi.mocked(repo.beginProviderAttempt).mockResolvedValue({ firstProviderAttemptAt: new Date(now.getTime() - 23 * 3_600_000), frozenRequest: { body: "frozen", targetUrl: "https://api.resend.com/emails" } })
    expect(await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })).toEqual({ state: "needs_review" })
    expect(mocks.deliver).not.toHaveBeenCalled()
  })
  it("never sends if durable request persistence fails or loses its lease", async () => {
    const repo = repository()
    vi.mocked(repo.beginProviderAttempt).mockRejectedValueOnce(new Error("database offline")).mockResolvedValueOnce(null)
    await expect(processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })).rejects.toThrow("database offline")
    expect(await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })).toEqual({ state: "stale" })
    expect(mocks.deliver).not.toHaveBeenCalled()
  })
  it("reuses persisted request bytes across configuration or template changes", async () => {
    const repo = repository()
    const frozenRequest = { body: "original private body", targetUrl: "https://api.resend.com/emails" }
    vi.mocked(repo.claimNextDueOutbox).mockResolvedValue({ ...claim, delivery: { ...claim.delivery, frozenRequest, firstProviderAttemptAt: now } })
    vi.mocked(repo.beginProviderAttempt).mockResolvedValue({ firstProviderAttemptAt: now, frozenRequest })
    expect(await processOneLeadDelivery(repo, { now, publishAlert: vi.fn() })).toEqual({ state: "provider_accepted" })
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(mocks.deliver).toHaveBeenCalledWith(expect.objectContaining({ frozenRequest, idempotencyKey: "stable-key" }))
    expect(repo.beginProviderAttempt).toHaveBeenCalledWith("outbox", "lease", frozenRequest, now)
    expect(vi.mocked(repo.beginProviderAttempt).mock.invocationCallOrder[0]).toBeLessThan(mocks.deliver.mock.invocationCallOrder[0])
  })

})
