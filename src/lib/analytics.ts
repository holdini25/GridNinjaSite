"use client"

import { track } from "@vercel/analytics"

export const analyticsEventNames = [
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

type AnalyticsProperties = {
  route?: string
  source?: string
  intent?: string
  artifact?: string
  version?: string
  success?: boolean
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
