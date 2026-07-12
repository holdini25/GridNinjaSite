import { createHmac } from "node:crypto"

export const MAX_DELIVERY_ATTEMPTS = 6
export const PROVIDER_TIMEOUT_MS = 8_000

const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
] as const

const ASCII_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g

export type DeliveryChannel = "internal_email" | "crm_webhook"

export type LeadDeliveryPayload = {
  id: string
  acceptedAt: Date
  formType: "capacity_audit" | "contact"
  name: string
  company: string
  email: string
  buyerType: string
  siteType: string
  timeline: string
  intent: string
  source: string
  role: string | null
  constraints: string[]
  message: string | null
}

export type DeliveryProviderResult =
  | {
      ok: true
      status: number
      providerMessageId?: string
    }
  | {
      ok: false
      status: number
      errorCode: string
      retryable: boolean
    }

export type LeadAcceptedEvent = {
  schemaVersion: 1
  type: "lead.accepted.v1"
  eventId: string
  occurredAt: string
  data: {
    submissionId: string
    formType: LeadDeliveryPayload["formType"]
    acceptedAt: string
    contact: {
      name: string
      company: string
      email: string
      role: string | null
    }
    qualification: {
      buyerType: string
      siteType: string
      timeline: string
      intent: string
      constraints: string[]
      message: string | null
    }
    attribution: {
      source: string
    }
  }
}

export function getNextAttemptAt(
  attemptCount: number,
  now: Date,
  random = Math.random
) {
  const baseDelay = RETRY_DELAYS_MS[attemptCount - 1]

  if (baseDelay === undefined) {
    return null
  }

  // Keep provider recovery staggered without making the documented delay hard
  // to reason about. Tests can inject a deterministic random source.
  const jitterMultiplier = 0.9 + clamp(random(), 0, 1) * 0.2

  return new Date(now.getTime() + Math.round(baseDelay * jitterMultiplier))
}

export function isRetryableProviderStatus(status: number) {
  return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500
}

export function buildLeadAcceptedEvent(
  lead: LeadDeliveryPayload,
  eventId: string
): LeadAcceptedEvent {
  return {
    schemaVersion: 1,
    type: "lead.accepted.v1",
    eventId,
    occurredAt: lead.acceptedAt.toISOString(),
    data: {
      submissionId: lead.id,
      formType: lead.formType,
      acceptedAt: lead.acceptedAt.toISOString(),
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
      attribution: {
        source: lead.source,
      },
    },
  }
}

export function signWebhookBody(
  timestamp: string,
  exactBody: string,
  secret: string
) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${exactBody}`, "utf8")
    .digest("hex")
}

export function buildLeadEmailSubject(lead: LeadDeliveryPayload) {
  const company = singleLine(lead.company, 80) || "Unknown company"
  const timeline = singleLine(lead.timeline, 48) || "Timeline not specified"

  return `[${lead.formType === "capacity_audit" ? "Capacity Audit" : "Contact"}] ${company} — ${timeline}`
}

export function buildLeadEmailText(lead: LeadDeliveryPayload) {
  const lines = [
    `Submission ID: ${lead.id}`,
    `Accepted at: ${lead.acceptedAt.toISOString()}`,
    `Form: ${lead.formType}`,
    `Name: ${lead.name}`,
    `Company: ${lead.company}`,
    `Email: ${lead.email}`,
    `Buyer type: ${lead.buyerType}`,
    `Site type: ${lead.siteType}`,
    `Timeline: ${lead.timeline}`,
    `Intent: ${lead.intent}`,
    `Source: ${lead.source}`,
  ]

  if (lead.role) {
    lines.push(`Role: ${lead.role}`)
  }

  if (lead.constraints.length > 0) {
    lines.push(`Constraints: ${lead.constraints.join(", ")}`)
  }

  if (lead.message) {
    lines.push("", "Message:", lead.message)
  }

  return lines.join("\n")
}

export function buildLeadEmailHtml(lead: LeadDeliveryPayload) {
  const rows: Array<[string, string]> = [
    ["Submission ID", lead.id],
    ["Accepted at", lead.acceptedAt.toISOString()],
    ["Form", lead.formType],
    ["Name", lead.name],
    ["Company", lead.company],
    ["Email", lead.email],
    ["Buyer type", lead.buyerType],
    ["Site type", lead.siteType],
    ["Timeline", lead.timeline],
    ["Intent", lead.intent],
    ["Source", lead.source],
  ]

  if (lead.role) {
    rows.push(["Role", lead.role])
  }

  if (lead.constraints.length > 0) {
    rows.push(["Constraints", lead.constraints.join(", ")])
  }

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><th scope="row" style="padding:5px 16px 5px 0;color:#9fb0bf;text-align:left;vertical-align:top;font-weight:600;">${escapeHtml(label)}</th><td style="padding:5px 0;color:#f5f7fa;">${escapeHtml(value)}</td></tr>`
    )
    .join("")

  const message = lead.message
    ? `<section style="margin-top:20px;padding:16px;border:1px solid #263743;border-radius:12px;background:#0d1720;"><h2 style="margin:0 0 8px;color:#9fb0bf;font-size:14px;">Message</h2><div style="white-space:pre-wrap;line-height:1.6;color:#f5f7fa;">${escapeHtml(lead.message)}</div></section>`
    : ""

  return `<div style="font-family:Arial,sans-serif;background:#07111a;color:#f5f7fa;padding:24px;line-height:1.5;"><h1 style="margin:0 0 8px;font-size:24px;">GridNinja capacity inquiry</h1><p style="margin:0 0 20px;color:#9fb0bf;">Qualification details for proof-backed virtual capacity.</p><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">${tableRows}</table>${message}</div>`
}

export function sanitizeProviderErrorCode(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64)

  return sanitized || fallback
}

function singleLine(value: string, maxLength: number) {
  return value.replace(ASCII_CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
