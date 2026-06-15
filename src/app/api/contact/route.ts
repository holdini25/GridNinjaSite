import { deliverLead } from "@/lib/lead-delivery"
import {
  capacityAuditSchema,
  contactLeadSchema,
  mapZodErrors,
  stripLeadSecurityFields,
} from "@/lib/validators"

const MIN_SUBMIT_AGE_MS = 1200
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX_SUBMISSIONS = 4

const submissionBuckets = new Map<
  string,
  {
    count: number
    resetAt: number
  }
>()

export async function POST(request: Request) {
  try {
    const payload = await request.json()

    if (isBotSubmission(payload)) {
      return Response.json(
        {
          ok: false,
          message: "Unable to submit the request right now.",
        },
        { status: 400 }
      )
    }

    const detailed = Boolean(payload.role || payload.message)
    const result = detailed
      ? contactLeadSchema.safeParse(payload)
      : capacityAuditSchema.safeParse(payload)

    if (!result.success) {
      return Response.json(
        {
          ok: false,
          fieldErrors: mapZodErrors(result),
          message: "Please correct the highlighted fields.",
        },
        { status: 400 }
      )
    }

    const leadSubmission = stripLeadSecurityFields(result.data)
    const limitResult = checkSubmissionLimit(request, leadSubmission.email)

    if (!limitResult.ok) {
      return Response.json(
        {
          ok: false,
          message: "Please wait before submitting another request.",
        },
        { status: 429 }
      )
    }

    await deliverLead(leadSubmission)

    return Response.json({
      ok: true,
      message: "Lead accepted.",
    })
  } catch (error) {
    console.error("[contact] lead submission failed", error)

    return Response.json(
      {
        ok: false,
        message:
          "Unable to submit the request right now. Please email the GridNinja team directly.",
      },
      { status: 502 }
    )
  }
}

function isBotSubmission(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return false
  }

  const candidate = payload as {
    website?: unknown
    startedAt?: unknown
  }

  if (typeof candidate.website === "string" && candidate.website.trim()) {
    return true
  }

  if (typeof candidate.startedAt === "number") {
    return Date.now() - candidate.startedAt < MIN_SUBMIT_AGE_MS
  }

  return false
}

function checkSubmissionLimit(request: Request, email: string) {
  const now = Date.now()
  const key = `${getClientKey(request)}:${email.toLowerCase()}`
  const bucket = submissionBuckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    submissionBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })

    return { ok: true }
  }

  if (bucket.count >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return { ok: false }
  }

  bucket.count += 1
  submissionBuckets.set(key, bucket)

  return { ok: true }
}

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }

  return request.headers.get("x-real-ip") ?? "unknown"
}
