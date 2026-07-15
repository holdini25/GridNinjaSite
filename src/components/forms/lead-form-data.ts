import type { LeadIntent } from "@/types/site"

type LeadAttribution<TSchemaVersion extends 1 | 2 = 1 | 2> = {
  schemaVersion: TSchemaVersion
  clientSubmissionId: string
  turnstileToken: string
  intent: LeadIntent
  source: string
  startedAt: number
}

function getString(formData: FormData, name: string) {
  const value = formData.get(name)

  return typeof value === "string" ? value : ""
}

function getStrings(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string")
}

function getOptionalString(formData: FormData, name: string) {
  const value = getString(formData, name).trim()

  return value || undefined
}

export function buildCapacityAuditCandidate(
  formData: FormData,
  attribution: LeadAttribution<1> & { formType: "capacity_audit" }
) {
  return buildBaseLeadCandidate(formData, attribution)
}

function buildBaseLeadCandidate(
  formData: FormData,
  attribution: LeadAttribution & { formType: "contact" | "capacity_audit" }
) {
  return {
    schemaVersion: attribution.schemaVersion,
    formType: attribution.formType,
    clientSubmissionId: attribution.clientSubmissionId,
    turnstileToken: attribution.turnstileToken,
    name: getString(formData, "name"),
    company: getString(formData, "company"),
    email: getString(formData, "email"),
    buyerType: getString(formData, "buyerType"),
    siteType: getString(formData, "siteType"),
    timeline: getString(formData, "timeline"),
    intent: attribution.intent,
    source: attribution.source,
    website: getString(formData, "website"),
    startedAt: attribution.startedAt,
  }
}

export function buildContactLeadCandidate(
  formData: FormData,
  attribution: LeadAttribution<2> & { formType: "contact" }
) {
  return {
    ...buildBaseLeadCandidate(formData, attribution),
    role: getOptionalString(formData, "role"),
    siteType: getOptionalString(formData, "siteType"),
    timeline: getOptionalString(formData, "timeline"),
    constraints: getStrings(formData, "constraints"),
    capacityRange: getOptionalString(formData, "capacityRange"),
    message: getString(formData, "message"),
  }
}
