import { describe, expect, it } from "vitest"

import {
  buildCapacityAuditCandidate,
  buildContactLeadCandidate,
} from "@/components/forms/lead-form-data"
import { leadSubmissionSchema } from "@/lib/validators"

const clientSubmissionId = "0191f7d6-9f48-7be7-9d17-f6ea958a70c2"

const capacityAttribution = {
  schemaVersion: 1 as const,
  formType: "capacity_audit" as const,
  clientSubmissionId,
  turnstileToken: "turnstile-test-token",
  intent: "capacity-audit" as const,
  source: "roi-page",
  startedAt: 1_725_000_000_000,
}

describe("lead form data candidates", () => {
  it("builds a capacity audit candidate from current DOM values", () => {
    const formData = new FormData()
    formData.set("name", "Avery Operator")
    formData.set("company", "Example Compute")
    formData.set("email", "avery@example.com")
    formData.set("buyerType", "AI cloud operator")
    formData.set("siteType", "AI training campus")
    formData.set("timeline", "Immediate (0-3 months)")
    formData.set("website", "")

    expect(
      buildCapacityAuditCandidate(formData, {
        ...capacityAttribution,
      })
    ).toEqual({
      schemaVersion: 1,
      formType: "capacity_audit",
      clientSubmissionId,
      turnstileToken: "turnstile-test-token",
      name: "Avery Operator",
      company: "Example Compute",
      email: "avery@example.com",
      buyerType: "AI cloud operator",
      siteType: "AI training campus",
      timeline: "Immediate (0-3 months)",
      intent: "capacity-audit",
      source: "roi-page",
      website: "",
      startedAt: 1_725_000_000_000,
    })
  })

  it("preserves the honeypot and every selected constraint", () => {
    const formData = new FormData()
    formData.set("name", "Morgan Operator")
    formData.set("company", "Capacity Works")
    formData.set("role", "VP Infrastructure")
    formData.set("email", "morgan@example.com")
    formData.set("buyerType", "Colo / REIT")
    formData.set("siteType", "Colocation facility")
    formData.set("timeline", "Near term (3-6 months)")
    formData.append("constraints", "interconnection delay")
    formData.append("constraints", "SLA protection")
    formData.set("message", "We need an auditable view of usable capacity.")
    formData.set("website", "bot.example")

    expect(
      buildContactLeadCandidate(formData, {
        schemaVersion: 2,
        formType: "contact",
        clientSubmissionId,
        turnstileToken: "turnstile-contact-token",
        intent: "shadow-mode",
        source: "contact-page",
        startedAt: 1_725_000_000_123,
      })
    ).toMatchObject({
      schemaVersion: 2,
      constraints: ["interconnection delay", "SLA protection"],
      website: "bot.example",
      intent: "shadow-mode",
      source: "contact-page",
      startedAt: 1_725_000_000_123,
    })
  })

  it("uses current attribution and the stable start time instead of form entries", () => {
    const formData = new FormData()
    formData.set("intent", "partnership")
    formData.set("source", "stale-source")
    formData.set("startedAt", "999")

    const candidate = buildCapacityAuditCandidate(formData, {
      ...capacityAttribution,
      intent: "book-demo",
      source: "current-source",
      startedAt: 1_725_000_000_456,
    })

    expect(candidate).toMatchObject({
      intent: "book-demo",
      source: "current-source",
      startedAt: 1_725_000_000_456,
    })
  })

  it("validates the explicit discriminated capacity-audit contract", () => {
    const formData = new FormData()
    formData.set("name", "Avery Operator")
    formData.set("company", "Example Compute")
    formData.set("email", "avery@example.com")
    formData.set("buyerType", "AI cloud operator")
    formData.set("siteType", "AI training campus")
    formData.set("timeline", "Immediate (0-3 months)")

    const result = leadSubmissionSchema.safeParse(
      buildCapacityAuditCandidate(formData, capacityAttribution)
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.formType).toBe("capacity_audit")
      expect(result.data.clientSubmissionId).toBe(clientSubmissionId)
    }
  })

  it("rejects unsafe control characters and oversized verification tokens", () => {
    const formData = new FormData()
    formData.set("name", "Avery\u0007Operator")
    formData.set("company", "Example Compute")
    formData.set("email", "avery@example.com")
    formData.set("buyerType", "AI cloud operator")
    formData.set("siteType", "AI training campus")
    formData.set("timeline", "Immediate (0-3 months)")

    const result = leadSubmissionSchema.safeParse(
      buildCapacityAuditCandidate(formData, {
        ...capacityAttribution,
        turnstileToken: "x".repeat(2049),
      })
    )

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["name", "turnstileToken"])
      )
    }
  })

  it("allows normal line breaks in contact messages", () => {
    const candidate = {
      schemaVersion: 2,
      formType: "contact",
      clientSubmissionId,
      turnstileToken: "turnstile-contact-token",
      name: "Morgan Operator",
      company: "Capacity Works",
      role: "VP Infrastructure",
      email: "morgan@example.com",
      siteType: "Colocation facility",
      timeline: "Near term (3-6 months)",
      constraints: ["SLA protection"],
      message: "First constraint.\nSecond constraint.",
      intent: "shadow-mode",
      source: "contact-page",
      website: "",
      startedAt: 1_725_000_000_123,
    }

    expect(leadSubmissionSchema.safeParse(candidate).success).toBe(true)
  })

  it("accepts a contact v2 request with only four required visitor fields", () => {
    const formData = new FormData()
    formData.set("name", "Morgan Operator")
    formData.set("company", "Capacity Works")
    formData.set("email", "morgan@example.com")
    formData.set(
      "message",
      "We need to determine which capacity claim can be accepted."
    )

    const candidate = buildContactLeadCandidate(formData, {
      schemaVersion: 2,
      formType: "contact",
      clientSubmissionId,
      turnstileToken: "turnstile-contact-token",
      intent: "other",
      source: "contact-page",
      startedAt: 1_725_000_000_123,
    })

    expect(contactCandidate(candidate)).toEqual({
      success: true,
      buyerType: undefined,
      siteType: undefined,
      timeline: undefined,
      capacityRange: undefined,
    })
  })
})

function contactCandidate(candidate: unknown) {
  const result = leadSubmissionSchema.safeParse(candidate)

  if (!result.success || result.data.formType !== "contact") {
    return { success: false }
  }

  return {
    success: true,
    buyerType: "buyerType" in result.data ? result.data.buyerType : undefined,
    siteType: result.data.siteType,
    timeline: result.data.timeline,
    capacityRange:
      "capacityRange" in result.data ? result.data.capacityRange : undefined,
  }
}
