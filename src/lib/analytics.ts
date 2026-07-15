"use client"

import { track } from "@vercel/analytics"

export const analyticsEventNames = [
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
] as const

export type AnalyticsEventName = (typeof analyticsEventNames)[number]

export const analyticsErrorCategories = [
  "validation",
  "verification",
  "rate_limit",
  "server",
  "network",
] as const

export type AnalyticsErrorCategory =
  (typeof analyticsErrorCategories)[number]

type AnalyticsProperties = {
  route?: string
  source?: string
  intent?: string
  artifact?: string
  version?: string
  success?: boolean
  errorCategory?: AnalyticsErrorCategory
}

const analyticsEventNameSet = new Set<string>(analyticsEventNames)

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return analyticsEventNameSet.has(value)
}

export function trackGridNinjaEvent(
  name: AnalyticsEventName,
  properties: AnalyticsProperties = {}
) {
  const route = normalizeRoute(properties.route ?? window.location.pathname)
  const payload = {
    route,
    ...toSafeStringProperty("source", properties.source),
    ...toSafeStringProperty("intent", properties.intent),
    ...toSafeStringProperty("artifact", properties.artifact),
    ...toSafeStringProperty("version", properties.version),
    ...(properties.errorCategory
      ? { errorCategory: properties.errorCategory }
      : {}),
    ...(typeof properties.success === "boolean"
      ? { success: properties.success }
      : {}),
  }

  try {
    track(name, payload)
  } catch {
    // Measurement must never interfere with navigation or a successful intake.
  }
}

function normalizeRoute(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    return url.pathname.startsWith("/") ? url.pathname : "/"
  } catch {
    return "/"
  }
}

function toSafeStringProperty(key: string, value: string | undefined) {
  if (!value) return {}

  const normalized = value
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9_./:-]/g, "-")

  return normalized ? { [key]: normalized } : {}
}
