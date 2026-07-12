import { describe, expect, it } from "vitest"

import {
  buildCapacityAuditCandidate,
  buildContactLeadCandidate,
} from "@/components/forms/lead-form-data"

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
        intent: "capacity-audit",
        source: "roi-page",
        startedAt: 1_725_000_000_000,
      })
    ).toEqual({
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
        intent: "shadow-mode",
        source: "contact-page",
        startedAt: 1_725_000_000_123,
      })
    ).toMatchObject({
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
})
