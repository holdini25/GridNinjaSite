import { beforeEach, describe, expect, it, vi } from "vitest"

const { track } = vi.hoisted(() => ({ track: vi.fn() }))

vi.mock("@vercel/analytics", () => ({ track }))

import {
  analyticsEventNames,
  isAnalyticsEventName,
  trackGridNinjaEvent,
  normalizeAnalyticsRoute,
  sanitizeTelemetryUrl,
} from "@/lib/analytics"

describe("privacy-first measurement policy", () => {
  beforeEach(() => {
    track.mockClear()
    window.history.replaceState({}, "", "/proof?email=private@example.com#person")
  })

  it("allows only the approved successful-outcome and engagement events", () => {
    expect(analyticsEventNames).toEqual([
      "contact_form_start",
      "contact_form_submit",
      "contact_form_error",
      "capacity_audit_request_success",
      "contact_submit_success",
      "proof_pack_download",
      "evidence_artifact_view",
      "demo_start",
      "proof_demo_complete",
      "partner_inquiry_success",
      "outbound_schedule_click",
      "assessment_cta_selected",
      "sample_opened",
      "scenario_selected",
      "perspective_selected",
      "sample_download_clicked",
    ])
    expect(analyticsEventNames.every(isAnalyticsEventName)).toBe(true)
    expect(isAnalyticsEventName("form_submit_attempt")).toBe(false)
  })

  it("strips query strings and ignores properties outside the non-PII allowlist", () => {
    trackGridNinjaEvent("contact_submit_success", {
      route: "/contact?intent=audit&email=private@example.com#form",
      source: "contact-page",
      intent: "capacity-audit",
      success: true,
      email: "private@example.com",
      facility: "customer-site-17",
    } as never)

    expect(track).toHaveBeenCalledWith("contact_submit_success", {
      route: "/contact",
      source: "contact-page",
      intent: "capacity-audit",
      success: true,
    })
  })

  it("drops arbitrary strings even when they look like safe identifiers", () => {
    trackGridNinjaEvent("evidence_artifact_view", {
      source: "customer-jane", intent: "private-company", artifact: "/secret.pdf",
      version: "customer-123", errorCategory: "customer-error", route: "/private/customer-name",
    } as never)
    expect(track).toHaveBeenCalledWith("evidence_artifact_view", { route: "/unknown" })
  })

  it("removes query, fragment and unapproved paths from both telemetry streams", () => {
    expect(sanitizeTelemetryUrl("https://gridninja.com/contact?email=private@example.com#person")).toBe("https://gridninja.com/contact")
    expect(sanitizeTelemetryUrl("https://gridninja.com/private-person")).toBe("https://gridninja.com/unknown")
    expect(normalizeAnalyticsRoute("/demo?scenario=b")).toBe("/demo")
  })

  it.each([
    "mailto:private@example.com",
    "data:text/plain,private-customer-information",
    "javascript:alert('private-information')",
    "file:///private/customer-name",
  ])("withholds non-HTTP telemetry URL payloads: %s", (value) => {
    expect(sanitizeTelemetryUrl(value)).toBe("https://gridninja.ai/unknown")
  })

  it("measurement failure cannot break the action", () => {
    track.mockImplementationOnce(() => { throw new Error("unavailable") })
    expect(() => trackGridNinjaEvent("assessment_cta_selected", { source: "home-hero" })).not.toThrow()
  })

  it("records only an approved contact failure category", () => {
    trackGridNinjaEvent("contact_form_error", {
      source: "contact-page",
      intent: "shadow-mode",
      errorCategory: "verification",
      success: false,
    })

    expect(track).toHaveBeenCalledWith("contact_form_error", {
      route: "/proof",
      source: "contact-page",
      intent: "shadow-mode",
      errorCategory: "verification",
      success: false,
    })
  })
})
