"use client"

import { track } from "@vercel/analytics"
import { leadIntents } from "@/lib/constants"
import { leadSources } from "@/lib/lead"

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
  "assessment_cta_selected",
  "sample_opened",
  "scenario_selected",
  "perspective_selected",
  "sample_download_clicked",
] as const

export type AnalyticsEventName = (typeof analyticsEventNames)[number]

export const analyticsErrorCategories = [
  "validation",
  "verification",
  "rate_limit",
  "server",
  "network",
  "conflict",
] as const

export type AnalyticsErrorCategory =
  (typeof analyticsErrorCategories)[number]

type AnalyticsProperties = {
  route?: string
  source?: string
  intent?: string
  artifact?: string
  version?: string
  scenario?: string
  perspective?: string
  maturity?: string
  success?: boolean
  errorCategory?: AnalyticsErrorCategory
}

const analyticsEventNameSet = new Set<string>(analyticsEventNames)

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return analyticsEventNameSet.has(value)
}

export const analyticsRoutes = [
  "/", "/assessment", "/data-handling", "/contact", "/contact/thanks", "/demo", "/about", "/roi",
  "/platform", "/platform/dispatch-envelope", "/proof", "/proof/proof-pack", "/why-gridninja", "/dcii",
  "/solutions/ai-cloud", "/solutions/colocation", "/solutions/bridge-power", "/insights", "/evidence", "/methodology",
  "/insights/virtual-capacity-control-plane", "/insights/proof-adjusted-data-center-capacity",
  "/insights/runtime-assurance-ai-data-centers", "/insights/data-center-shadow-mode",
  "/insights/cross-domain-capacity-constraints", "/insights/safe-data-center-grid-flexibility",
  "/insights/ai-data-center-time-to-power", "/evidence/virtual-capacity-proof-test",
  "/evidence/sample-rta-trace", "/evidence/accepted-headroom-ledger", "/evidence/load-passport-specification",
  "/methodology/claims-and-evidence", "/methodology/comparison-policy", "/methodology/editorial-corrections",
  "/methodology/capacity-audit", "/evidence/assessments/demo-01-a/v1.0.0",
  "/evidence/assessments/demo-01-b/v1.0.0", "/evidence/assessments/demo-01-c/v1.0.0",
  "/evidence/assessments/demo-01-d/v1.0.0",
] as const
const propertyValues = {
  source: leadSources,
  intent: leadIntents,
  artifact: ["sample-proof-pack", "demo-01-a", "demo-01-b", "demo-01-c", "demo-01-d"],
  version: ["1.0", "1.0.0"],
  scenario: ["a", "b", "c", "d"],
  perspective: ["business", "engineering"],
  maturity: ["specified", "implemented-and-tested", "evaluated-with-authorized-site-data", "accepted-for-customer-decision"],
  errorCategory: analyticsErrorCategories,
} as const

export function trackGridNinjaEvent(name: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (!isAnalyticsEventName(name)) return
  const payload: Record<string, string | boolean> = {
    route: normalizeAnalyticsRoute(properties.route ?? window.location.pathname),
  }
  for (const key of Object.keys(propertyValues) as (keyof typeof propertyValues)[]) {
    const value = properties[key]
    if (typeof value === "string" && (propertyValues[key] as readonly string[]).includes(value)) payload[key] = value
  }
  if (typeof properties.success === "boolean") payload.success = properties.success
  try { track(name, payload) } catch {
    // Measurement must never interfere with navigation or durable intake.
  }
}

export function normalizeAnalyticsRoute(value: string) {
  try {
    const url = new URL(value, "https://gridninja.ai")
    return (analyticsRoutes as readonly string[]).includes(url.pathname) ? url.pathname : "/unknown"
  } catch { return "/unknown" }
}

// Both vendor streams receive approved route IDs without query/fragment data.
export function sanitizeTelemetryUrl(value: string) {
  try {
    const url = new URL(value)
    // Opaque URLs ignore pathname assignment; allowing data: or mailto: here
    // would retain their payload even after the path/query scrub below.
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "https://gridninja.ai/unknown"
    }
    url.pathname = normalizeAnalyticsRoute(url.pathname)
    url.search = ""
    url.hash = ""
    url.username = ""
    url.password = ""
    return url.toString()
  } catch { return "https://gridninja.ai/unknown" }
}
