import { beforeEach, describe, expect, it, vi } from "vitest"

const { track } = vi.hoisted(() => ({ track: vi.fn() }))

vi.mock("@vercel/analytics", () => ({ track }))

import {
  analyticsEventNames,
  isAnalyticsEventName,
  trackGridNinjaEvent,
} from "@/lib/analytics"

describe("privacy-first measurement policy", () => {
  beforeEach(() => {
    track.mockClear()
    window.history.replaceState({}, "", "/proof?email=private@example.com#person")
  })

  it("allows only the approved successful-outcome and engagement events", () => {
    expect(analyticsEventNames).toEqual([
      "capacity_audit_request_success",
      "contact_submit_success",
      "proof_pack_download",
      "evidence_artifact_view",
      "demo_start",
      "proof_demo_complete",
      "partner_inquiry_success",
      "outbound_schedule_click",
    ])
    expect(analyticsEventNames.every(isAnalyticsEventName)).toBe(true)
    expect(isAnalyticsEventName("form_submit_attempt")).toBe(false)
  })

  it("strips query strings and ignores properties outside the non-PII allowlist", () => {
    trackGridNinjaEvent("contact_submit_success", {
      route: "/contact?intent=audit&email=private@example.com#form",
      source: "contact-page",
      intent: "capacity audit",
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
})
