import { randomUUID } from "node:crypto"

import { after } from "next/server"

import {
  ContactConfigurationError,
  getContactRuntimeConfig,
} from "@/lib/contact/config"
import { classifyContactError, logContactEvent } from "@/lib/contact/log"
import { publishLeadDeliveryWake } from "@/lib/contact/queue"
import {
  checkEligibleSubmissionLimits,
  checkIpAttemptLimits,
} from "@/lib/contact/rate-limit"
import {
  ContactPayloadTooLargeError,
  fingerprintContactSubmission,
  getTrustedClientIp,
  hashContactIdentifier,
  isBotSignal,
  readBodyLimited,
} from "@/lib/contact/request"
import { verifyTurnstile } from "@/lib/contact/turnstile"
import {
  leadSubmissionSchema,
  mapZodErrors,
  stripLeadSecurityFields,
} from "@/lib/validators"
import {
  acceptLead,
  findLeadByClientSubmissionId,
} from "@/server/leads/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const requestId = randomUUID()
  const startedAt = Date.now()

  try {
    const config = getContactRuntimeConfig()
    const origin = request.headers.get("origin")

    if (!origin || !config.allowedOrigins.has(origin)) {
      return jsonError(403, "Request could not be accepted.", requestId)
    }

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? ""
    if (!contentType.startsWith("application/json")) {
      return jsonError(415, "Unsupported request format.", requestId)
    }

    const clientIp = getTrustedClientIp(request)
    const ipHash = hashContactIdentifier(clientIp, config.pseudonymSecret)
    const attemptLimit = await checkIpAttemptLimits(
      { redisUrl: config.redisUrl, redisToken: config.redisToken },
      ipHash
    )

    if (attemptLimit.unavailable) {
      return jsonError(
        503,
        "Unable to accept the request right now. Please try again shortly.",
        requestId
      )
    }

    if (!attemptLimit.ok) {
      return rateLimitError(requestId, attemptLimit.resetAt)
    }

    const rawBody = await readBodyLimited(request)
    let payload: unknown

    try {
      payload = JSON.parse(rawBody)
    } catch {
      return jsonError(400, "Request body is not valid JSON.", requestId)
    }

    const parsed = leadSubmissionSchema.safeParse(payload)
    if (!parsed.success) {
      return jsonResponse(
        {
          ok: false,
          requestId,
          fieldErrors: mapZodErrors(parsed),
          message: "Please correct the highlighted fields.",
        },
        400
      )
    }

    if (isBotSignal(parsed.data)) {
      return jsonError(403, "Request could not be accepted.", requestId)
    }

    const submission = stripLeadSecurityFields(parsed.data)
    const normalizedEmail = submission.email.toLowerCase()
    const normalizedSubmission = {
      ...submission,
      email: normalizedEmail,
    }
    const requestFingerprint = fingerprintContactSubmission(
      normalizedSubmission,
      config.pseudonymSecret
    )

    const existing = await findLeadByClientSubmissionId(
      submission.clientSubmissionId
    )

    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) {
        return jsonError(
          409,
          "This submission reference was already used for different data.",
          requestId
        )
      }

      logContactEvent("info", "contact.duplicate", {
        requestId,
        leadId: existing.id,
        formType: existing.formType,
        latencyMs: Date.now() - startedAt,
      })

      return jsonResponse(
        {
          ok: true,
          requestId,
          submissionId: existing.id,
          status: "already_received",
        },
        200
      )
    }

    const turnstile = await verifyTurnstile({
      token: parsed.data.turnstileToken,
      remoteIp: clientIp,
      requestId,
      expectedAction: parsed.data.formType,
      secretKey: config.turnstileSecretKey,
      allowedHostnames: config.allowedTurnstileHostnames,
    })

    if (turnstile.status === "unavailable") {
      logContactEvent("error", "contact.turnstile_unavailable", {
        requestId,
        errorCode: turnstile.errorCode,
      })
      return jsonError(
        503,
        "Security verification is temporarily unavailable. Please try again.",
        requestId
      )
    }

    if (turnstile.status === "invalid") {
      logContactEvent("warn", "contact.turnstile_rejected", {
        requestId,
        errorCode: turnstile.errorCode,
      })
      return jsonError(403, "Request could not be verified.", requestId)
    }

    const emailHash = hashContactIdentifier(
      normalizedEmail,
      config.pseudonymSecret
    )
    const eligibleLimit = await checkEligibleSubmissionLimits(
      { redisUrl: config.redisUrl, redisToken: config.redisToken },
      emailHash,
      hashContactIdentifier(`${ipHash}:${emailHash}`, config.pseudonymSecret)
    )

    if (eligibleLimit.unavailable) {
      return jsonError(
        503,
        "Unable to accept the request right now. Please try again shortly.",
        requestId
      )
    }

    if (!eligibleLimit.ok) {
      return rateLimitError(requestId, eligibleLimit.resetAt)
    }

    const acceptedAt = new Date()
    const accepted = await acceptLead({
      requestId,
      clientSubmissionId: submission.clientSubmissionId,
      requestFingerprint,
      schemaVersion: submission.schemaVersion,
      formType: submission.formType,
      intent: submission.intent,
      name: submission.name,
      company: submission.company,
      email: submission.email,
      normalizedEmail,
      role: submission.formType === "contact" ? submission.role : null,
      buyerType: submission.buyerType,
      siteType: submission.siteType,
      timeline: submission.timeline,
      constraints:
        submission.formType === "contact" ? submission.constraints : null,
      message: submission.formType === "contact" ? submission.message : null,
      source: submission.source,
      ipHash,
      turnstileHostname: turnstile.hostname,
      turnstileAction: turnstile.action,
      turnstileChallengeAt: turnstile.challengeTimestamp
        ? new Date(turnstile.challengeTimestamp)
        : null,
      acceptedAt,
      includeCrmWebhook: Boolean(config.crmWebhookUrl),
    })

    if (accepted.kind === "conflict") {
      return jsonError(
        409,
        "This submission reference was already used for different data.",
        requestId
      )
    }

    if (accepted.kind === "accepted") {
      after(async () => {
        try {
          await publishLeadDeliveryWake(config, accepted.outboxIds)
        } catch (error) {
          logContactEvent("error", "contact.queue_wake_failed", {
            requestId,
            leadId: accepted.leadId,
            errorCode: classifyContactError(error),
          })
        }
      })
    }

    const duplicate = accepted.kind === "duplicate"
    logContactEvent("info", duplicate ? "contact.duplicate" : "contact.accepted", {
      requestId,
      leadId: accepted.leadId,
      formType: accepted.lead.formType,
      intent: accepted.lead.intent,
      duplicate,
      latencyMs: Date.now() - startedAt,
    })

    return jsonResponse(
      {
        ok: true,
        requestId,
        submissionId: accepted.submissionId,
        status: duplicate ? "already_received" : "queued",
      },
      duplicate ? 200 : 202
    )
  } catch (error) {
    if (error instanceof ContactPayloadTooLargeError) {
      return jsonError(413, "Request is too large.", requestId)
    }

    const configurationFailure = error instanceof ContactConfigurationError
    logContactEvent("error", "contact.accept_failed", {
      requestId,
      errorCode: classifyContactError(error),
      state: configurationFailure
        ? "configuration_failure"
        : "persistence_failure",
      latencyMs: Date.now() - startedAt,
    })

    return jsonError(
      503,
      "Unable to accept the request right now. Please try again shortly.",
      requestId
    )
  }
}

function rateLimitError(requestId: string, resetAt?: number) {
  const retryAfter = resetAt
    ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000))
    : 60

  return jsonResponse(
    {
      ok: false,
      requestId,
      message: "Please wait before submitting another request.",
    },
    429,
    { "Retry-After": String(retryAfter) }
  )
}

function jsonError(status: number, message: string, requestId: string) {
  return jsonResponse({ ok: false, requestId, message }, status)
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string> = {}
) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  })
}
