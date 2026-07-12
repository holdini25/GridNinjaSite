import { createHmac } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  buildLeadAcceptedEvent,
  buildLeadEmailHtml,
  buildLeadEmailSubject,
  getNextAttemptAt,
  isRetryableProviderStatus,
  type LeadDeliveryPayload,
  sanitizeProviderErrorCode,
  signWebhookBody,
} from "@/lib/contact/delivery-core"

const acceptedAt = new Date("2026-07-12T16:00:00.000Z")

const lead: LeadDeliveryPayload = {
  id: "0a40bf9f-3e46-4d0c-b550-89e992ed5eef",
  acceptedAt,
  formType: "contact",
  name: "Ada Operator",
  company: "Grid <script>alert(1)</script>\nInjected",
  email: "ada@example.com",
  buyerType: "AI cloud operator",
  siteType: "AI data center",
  timeline: "0–6 months",
  intent: "capacity-audit",
  source: "contact-page",
  role: "VP Infrastructure",
  constraints: ["Utility interconnect", "Bridge power"],
  message: "Need <strong>safe MW</strong> with proof & runtime assurance.",
}

describe("contact delivery core", () => {
  it("uses the documented retry schedule with bounded jitter", () => {
    const expectedDelays = [
      60_000,
      5 * 60_000,
      30 * 60_000,
      2 * 60 * 60_000,
      12 * 60 * 60_000,
    ]

    expectedDelays.forEach((delay, index) => {
      expect(
        getNextAttemptAt(index + 1, acceptedAt, () => 0.5)?.getTime()
      ).toBe(acceptedAt.getTime() + delay)

      const earliest = getNextAttemptAt(index + 1, acceptedAt, () => 0)
      const latest = getNextAttemptAt(index + 1, acceptedAt, () => 1)

      expect(earliest?.getTime()).toBe(
        acceptedAt.getTime() + Math.round(delay * 0.9)
      )
      expect(latest?.getTime()).toBe(
        acceptedAt.getTime() + Math.round(delay * 1.1)
      )
    })

    expect(getNextAttemptAt(6, acceptedAt, () => 0.5)).toBeNull()
  })

  it("classifies transient HTTP responses without treating validation as retryable", () => {
    expect(isRetryableProviderStatus(0)).toBe(true)
    expect(isRetryableProviderStatus(408)).toBe(true)
    expect(isRetryableProviderStatus(409)).toBe(false)
    expect(isRetryableProviderStatus(429)).toBe(true)
    expect(isRetryableProviderStatus(503)).toBe(true)
    expect(isRetryableProviderStatus(400)).toBe(false)
    expect(isRetryableProviderStatus(422)).toBe(false)
  })

  it("signs the exact timestamp and webhook body", () => {
    const body = JSON.stringify(buildLeadAcceptedEvent(lead, "event-123"))
    const expected = createHmac("sha256", "test-secret")
      .update(`1720800000.${body}`, "utf8")
      .digest("hex")

    expect(signWebhookBody("1720800000", body, "test-secret")).toBe(
      expected
    )
  })

  it("builds the versioned CRM envelope without transport metadata", () => {
    expect(buildLeadAcceptedEvent(lead, "event-123")).toEqual({
      schemaVersion: 1,
      type: "lead.accepted.v1",
      eventId: "event-123",
      occurredAt: acceptedAt.toISOString(),
      data: {
        submissionId: lead.id,
        formType: "contact",
        acceptedAt: acceptedAt.toISOString(),
        contact: {
          name: lead.name,
          company: lead.company,
          email: lead.email,
          role: lead.role,
        },
        qualification: {
          buyerType: lead.buyerType,
          siteType: lead.siteType,
          timeline: lead.timeline,
          intent: lead.intent,
          constraints: lead.constraints,
          message: lead.message,
        },
        attribution: { source: lead.source },
      },
    })
  })

  it("removes subject control characters and HTML-escapes visitor content", () => {
    const subject = buildLeadEmailSubject(lead)
    const html = buildLeadEmailHtml(lead)

    expect(subject).not.toMatch(/[\r\n]/)
    expect(subject).toContain("Grid <script>alert(1)</script> Injected")
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).not.toContain("<strong>safe MW</strong>")
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
    expect(html).toContain("proof &amp; runtime assurance")
  })

  it("persists only bounded provider error codes", () => {
    expect(
      sanitizeProviderErrorCode("Concurrent Idempotent Requests!", "fallback")
    ).toBe("concurrent_idempotent_requests")
    expect(sanitizeProviderErrorCode({ body: "secret" }, "fallback")).toBe(
      "fallback"
    )
  })
})
