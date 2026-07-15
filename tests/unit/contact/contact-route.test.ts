import { beforeEach, describe, expect, it, vi } from "vitest"

import { fingerprintContactSubmission } from "@/lib/contact/request"
import { stripLeadSecurityFields } from "@/lib/validators"

const mocks = vi.hoisted(() => ({
  acceptLead: vi.fn(),
  findLead: vi.fn(),
  ipLimit: vi.fn(),
  eligibleLimit: vi.fn(),
  verifyTurnstile: vi.fn(),
  publishWake: vi.fn(),
  after: vi.fn((task: () => unknown) => task()),
}))

vi.mock("next/server", () => ({ after: mocks.after }))
vi.mock("@/server/leads/repository", () => ({
  acceptLead: mocks.acceptLead,
  findLeadByClientSubmissionId: mocks.findLead,
}))
vi.mock("@/lib/contact/rate-limit", () => ({
  checkIpAttemptLimits: mocks.ipLimit,
  checkEligibleSubmissionLimits: mocks.eligibleLimit,
}))
vi.mock("@/lib/contact/turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile,
}))
vi.mock("@/lib/contact/queue", () => ({
  publishLeadDeliveryWake: mocks.publishWake,
}))
vi.mock("@/lib/contact/config", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/contact/config")>()
  return {
    ...original,
    getContactRuntimeConfig: () => runtimeConfig,
  }
})

const runtimeConfig = {
  databaseUrl: "postgresql://test",
  publicBaseUrl: "https://www.gridninja.ai",
  allowedOrigins: new Set(["https://www.gridninja.ai"]),
  allowedTurnstileHostnames: new Set(["gridninja.ai"]),
  turnstileSecretKey: "turnstile-secret",
  pseudonymSecret: "pseudonym-secret-at-least-32-characters",
  redisUrl: "https://redis.example.test",
  redisToken: "redis-token",
  qstashToken: "qstash-token",
  qstashCurrentSigningKey: "current",
  qstashNextSigningKey: "next",
  resendApiKey: "resend",
  emailFrom: "GridNinja <no-reply@gridninja.ai>",
  emailTo: "leads@gridninja.ai",
  alertWebhookUrl: "https://alerts.example.test",
}

const payload = {
  schemaVersion: 1 as const,
  formType: "capacity_audit" as const,
  clientSubmissionId: "0191f7d6-9f48-7be7-9d17-f6ea958a70c2",
  turnstileToken: "test-token",
  name: "Avery Operator",
  company: "Example Compute",
  email: "Avery@Example.com",
  buyerType: "AI cloud operator" as const,
  siteType: "AI training campus" as const,
  timeline: "Immediate (0-3 months)" as const,
  intent: "capacity-audit" as const,
  source: "unit-test",
  website: "",
  startedAt: 1_725_000_000_000,
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ipLimit.mockResolvedValue({ ok: true })
    mocks.eligibleLimit.mockResolvedValue({ ok: true })
    mocks.findLead.mockResolvedValue(null)
    mocks.verifyTurnstile.mockResolvedValue({
      status: "valid",
      hostname: "gridninja.ai",
      action: "capacity_audit",
      challengeTimestamp: "2026-07-12T16:00:00.000Z",
    })
    mocks.publishWake.mockResolvedValue([])
    mocks.acceptLead.mockResolvedValue({
      kind: "accepted",
      lead: {
        id: "lead-123",
        formType: "capacity_audit",
        intent: "capacity-audit",
      },
      leadId: "lead-123",
      submissionId: "lead-123",
      outboxIds: ["outbox-123"],
    })
  })

  it("durably accepts an explicit capacity-audit request", async () => {
    const response = await post(payload)

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      submissionId: "lead-123",
      status: "queued",
      requestId: expect.any(String),
    })
    expect(mocks.acceptLead).toHaveBeenCalledWith(
      expect.objectContaining({
        formType: "capacity_audit",
        normalizedEmail: "avery@example.com",
      })
    )
    expect(mocks.publishWake).toHaveBeenCalledWith(
      runtimeConfig,
      ["outbox-123"]
    )
  })

  it("accepts contact v2 without optional qualification fields", async () => {
    const response = await post({
      schemaVersion: 2,
      formType: "contact",
      clientSubmissionId: "0191f7d6-9f48-7be7-9d17-f6ea958a70c3",
      turnstileToken: "test-token",
      name: "Morgan Operator",
      company: "Proof Compute",
      email: "morgan@example.com",
      message: "We need to review a constrained capacity decision.",
      constraints: [],
      intent: "other",
      source: "contact-page",
      website: "",
      startedAt: 1_725_000_000_000,
    })

    expect(response.status).toBe(202)
    expect(mocks.acceptLead).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 2,
        formType: "contact",
        intent: "other",
        buyerType: null,
        siteType: null,
        timeline: null,
        capacityRange: null,
      })
    )
  })

  it("returns the original submission without spending another Turnstile token", async () => {
    const normalized = {
      ...stripLeadSecurityFields(payload),
      email: payload.email.toLowerCase(),
    }
    mocks.findLead.mockResolvedValue({
      id: "lead-existing",
      formType: "capacity_audit",
      requestFingerprint: fingerprintContactSubmission(
        normalized,
        runtimeConfig.pseudonymSecret
      ),
    })

    const response = await post(payload)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: "already_received",
      submissionId: "lead-existing",
    })
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled()
    expect(mocks.acceptLead).not.toHaveBeenCalled()
  })

  it("rejects reused client IDs with different normalized content", async () => {
    mocks.findLead.mockResolvedValue({
      id: "lead-existing",
      requestFingerprint: "different",
    })

    expect((await post(payload)).status).toBe(409)
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled()
  })

  it.each([
    ["bad origin", { origin: "https://attacker.example" }, 403],
    ["wrong content type", { contentType: "text/plain" }, 415],
    ["oversized body", { declaredLength: "20000" }, 413],
  ])("maps %s to %i", async (_label, overrides, status) => {
    expect((await post(payload, overrides)).status).toBe(status)
  })

  it("maps invalid schemas to field-aware 400 responses", async () => {
    const response = await post({ ...payload, email: "not-an-email" })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      requestId: expect.any(String),
      fieldErrors: { email: expect.any(String) },
    })
  })

  it("fails closed for rate-limit and Turnstile outages", async () => {
    mocks.ipLimit.mockResolvedValueOnce({ ok: false, unavailable: true })
    expect((await post(payload)).status).toBe(503)

    mocks.verifyTurnstile.mockResolvedValueOnce({
      status: "unavailable",
      errorCode: "timeout",
    })
    expect((await post(payload)).status).toBe(503)
  })

  it("returns 429 with Retry-After and 403 for invalid challenges", async () => {
    mocks.eligibleLimit.mockResolvedValueOnce({
      ok: false,
      resetAt: Date.now() + 10_000,
    })
    const limited = await post(payload)
    expect(limited.status).toBe(429)
    expect(limited.headers.get("retry-after")).toBeTruthy()

    mocks.verifyTurnstile.mockResolvedValueOnce({
      status: "invalid",
      errorCode: "invalid-input-response",
    })
    expect((await post(payload)).status).toBe(403)
  })

  it("does not report success when persistence fails", async () => {
    mocks.acceptLead.mockRejectedValueOnce(new Error("database unavailable"))
    const response = await post(payload)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      requestId: expect.any(String),
    })
  })
})

async function post(
  body: unknown,
  overrides: {
    origin?: string
    contentType?: string
    declaredLength?: string
  } = {}
) {
  const { POST } = await import("@/app/api/contact/route")
  const serialized = JSON.stringify(body)

  return POST(
    new Request("https://www.gridninja.ai/api/contact", {
      method: "POST",
      headers: {
        origin: overrides.origin ?? "https://www.gridninja.ai",
        "content-type": overrides.contentType ?? "application/json",
        "content-length": overrides.declaredLength ?? String(serialized.length),
        "x-vercel-forwarded-for": "203.0.113.10",
      },
      body: serialized,
    })
  )
}
