import "server-only"

import type { LeadSubmissionInput } from "@/lib/validators"

type DeliveryTarget =
  | {
      kind: "webhook"
      url: string
      bearerToken?: string
    }
  | {
      kind: "resend"
      apiKey: string
      to: string
      from: string
    }

type DeliveryAttempt = {
  target: DeliveryTarget["kind"]
  ok: boolean
  status: number
  response: string
}

type DeliverLeadResult = {
  acceptedAt: string
  deliveries: DeliveryAttempt[]
}

const RESEND_API_URL = "https://api.resend.com/emails"

export async function deliverLead(
  submission: LeadSubmissionInput
): Promise<DeliverLeadResult> {
  const targets = getDeliveryTargets()

  if (targets.length === 0) {
    throw new Error(
      "No lead delivery target configured. Set LEAD_WEBHOOK_URL or RESEND_API_KEY with LEAD_EMAIL_TO."
    )
  }

  const acceptedAt = new Date().toISOString()

  const deliveries = await Promise.all(
    targets.map((target) =>
      deliverToTarget(target, submission, acceptedAt).catch((error) => ({
        target: target.kind,
        ok: false,
        status: 0,
        response:
          error instanceof Error ? error.message : "Unknown delivery failure.",
      }))
    )
  )

  const successful = deliveries.filter((delivery) => delivery.ok)

  if (successful.length === 0) {
    throw new Error(
      `Lead delivery failed for ${deliveries.map((delivery) => delivery.target).join(", ")}.`
    )
  }

  return {
    acceptedAt,
    deliveries,
  }
}

function getDeliveryTargets(): DeliveryTarget[] {
  const targets: DeliveryTarget[] = []

  const webhookUrl = process.env.LEAD_WEBHOOK_URL?.trim()
  if (webhookUrl) {
    targets.push({
      kind: "webhook",
      url: webhookUrl,
      bearerToken: process.env.LEAD_WEBHOOK_BEARER_TOKEN?.trim() || undefined,
    })
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  const resendTo = process.env.LEAD_EMAIL_TO?.trim()
  const resendFrom =
    process.env.LEAD_EMAIL_FROM?.trim() || "GridNinja <no-reply@gridninja.ai>"

  if (resendApiKey && resendTo) {
    targets.push({
      kind: "resend",
      apiKey: resendApiKey,
      to: resendTo,
      from: resendFrom,
    })
  }

  return targets
}

async function deliverToTarget(
  target: DeliveryTarget,
  submission: LeadSubmissionInput,
  acceptedAt: string
): Promise<DeliveryAttempt> {
  if (target.kind === "webhook") {
    return deliverToWebhook(target, submission, acceptedAt)
  }

  return deliverToResend(target, submission, acceptedAt)
}

async function deliverToWebhook(
  target: Extract<DeliveryTarget, { kind: "webhook" }>,
  submission: LeadSubmissionInput,
  acceptedAt: string
): Promise<DeliveryAttempt> {
  const response = await fetch(target.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(target.bearerToken
        ? { Authorization: `Bearer ${target.bearerToken}` }
        : {}),
    },
    body: JSON.stringify({
      acceptedAt,
      lead: submission,
      source: "gridninja-lead-form",
    }),
  })

  const responseText = await readResponseText(response)

  if (!response.ok) {
    throw new Error(
      `Webhook delivery failed with status ${response.status}: ${responseText}`
    )
  }

  return {
    target: target.kind,
    ok: true,
    status: response.status,
    response: responseText,
  }
}

async function deliverToResend(
  target: Extract<DeliveryTarget, { kind: "resend" }>,
  submission: LeadSubmissionInput,
  acceptedAt: string
): Promise<DeliveryAttempt> {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${target.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: target.from,
      to: target.to,
      subject: buildLeadEmailSubject(submission),
      text: buildLeadEmailText(submission, acceptedAt),
      html: buildLeadEmailHtml(submission, acceptedAt),
    }),
  })

  const responseText = await readResponseText(response)

  if (!response.ok) {
    throw new Error(
      `Resend delivery failed with status ${response.status}: ${responseText}`
    )
  }

  return {
    target: target.kind,
    ok: true,
    status: response.status,
    response: responseText,
  }
}

function buildLeadEmailSubject(submission: LeadSubmissionInput) {
  return `GridNinja lead: ${submission.company}`
}

function buildLeadEmailText(submission: LeadSubmissionInput, acceptedAt: string) {
  const lines = [
    `Accepted at: ${acceptedAt}`,
    `Name: ${submission.name}`,
    `Company: ${submission.company}`,
    `Email: ${submission.email}`,
    `Buyer type: ${submission.buyerType}`,
    `Site type: ${submission.siteType}`,
    `Timeline: ${submission.timeline}`,
    `Intent: ${submission.intent}`,
    `Source: ${submission.source}`,
  ]

  if ("role" in submission && submission.role) {
    lines.push(`Role: ${submission.role}`)
  }

  if ("constraints" in submission && submission.constraints?.length) {
    lines.push(`Constraints: ${submission.constraints.join(", ")}`)
  }

  if ("message" in submission && submission.message) {
    lines.push("")
    lines.push("Message:")
    lines.push(submission.message)
  }

  return lines.join("\n")
}

function buildLeadEmailHtml(submission: LeadSubmissionInput, acceptedAt: string) {
  const constraints =
    "constraints" in submission && submission.constraints?.length
      ? `<tr><td style="padding:4px 12px 4px 0;color:#9fb0bf;">Constraints</td><td style="padding:4px 0;">${escapeHtml(submission.constraints.join(", "))}</td></tr>`
      : ""

  const role =
    "role" in submission && submission.role
      ? `<tr><td style="padding:4px 12px 4px 0;color:#9fb0bf;">Role</td><td style="padding:4px 0;">${escapeHtml(submission.role)}</td></tr>`
      : ""

  const message =
    "message" in submission && submission.message
      ? `<div style="margin-top:20px;padding:16px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:#0d1720;"><div style="color:#9fb0bf;margin-bottom:8px;">Message</div><div style="white-space:pre-wrap;line-height:1.6;">${escapeHtml(submission.message)}</div></div>`
      : ""

  return `
    <div style="font-family:Arial,sans-serif;background:#07111a;color:#f5f7fa;padding:24px;line-height:1.5;">
      <h1 style="margin:0 0 12px;font-size:24px;">GridNinja lead</h1>
      <p style="margin:0 0 20px;color:#9fb0bf;">Accepted at ${escapeHtml(acceptedAt)}</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:4px 12px 4px 0;color:#9fb0bf;">Name</td><td style="padding:4px 0;">${escapeHtml(submission.name)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#9fb0bf;">Company</td><td style="padding:4px 0;">${escapeHtml(submission.company)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#9fb0bf;">Email</td><td style="padding:4px 0;">${escapeHtml(submission.email)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#9fb0bf;">Buyer type</td><td style="padding:4px 0;">${escapeHtml(submission.buyerType)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#9fb0bf;">Site type</td><td style="padding:4px 0;">${escapeHtml(submission.siteType)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#9fb0bf;">Timeline</td><td style="padding:4px 0;">${escapeHtml(submission.timeline)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#9fb0bf;">Intent</td><td style="padding:4px 0;">${escapeHtml(submission.intent)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#9fb0bf;">Source</td><td style="padding:4px 0;">${escapeHtml(submission.source)}</td></tr>
        ${role}
        ${constraints}
      </table>
      ${message}
    </div>
  `
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

async function readResponseText(response: Response) {
  const text = await response.text()
  return text.trim() || response.statusText || "No response body."
}
