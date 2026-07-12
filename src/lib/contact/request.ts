import "server-only"

import { createHmac } from "node:crypto"

export const CONTACT_MAX_BODY_BYTES = 16 * 1024
export const CONTACT_MIN_SUBMIT_AGE_MS = 1_200

export class ContactPayloadTooLargeError extends Error {
  constructor() {
    super("Contact payload exceeds the configured limit.")
    this.name = "ContactPayloadTooLargeError"
  }
}

export async function readBodyLimited(
  request: Request,
  maximum = CONTACT_MAX_BODY_BYTES
) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0")

  if (Number.isFinite(declaredLength) && declaredLength > maximum) {
    throw new ContactPayloadTooLargeError()
  }

  if (!request.body) {
    return ""
  }

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let body = ""

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      size += value.byteLength
      if (size > maximum) {
        await reader.cancel()
        throw new ContactPayloadTooLargeError()
      }

      body += decoder.decode(value, { stream: true })
    }

    body += decoder.decode()
    return body
  } finally {
    reader.releaseLock()
  }
}

export function getTrustedClientIp(request: Request) {
  const productionIp = request.headers.get("x-vercel-forwarded-for")?.trim()

  if (productionIp) {
    return productionIp.split(",")[0]?.trim() || "unknown"
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Trusted client IP header is unavailable.")
  }

  const forwarded = request.headers.get("x-forwarded-for")
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1"
  )
}

export function hashContactIdentifier(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex")
}

export function fingerprintContactSubmission(
  submission: Record<string, unknown>,
  secret: string
) {
  return hashContactIdentifier(stableStringify(submission), secret)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))

    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}

export function isBotSignal(input: {
  website?: string
  startedAt?: number
}) {
  if (input.website?.trim()) return true

  return typeof input.startedAt === "number"
    ? Date.now() - input.startedAt < CONTACT_MIN_SUBMIT_AGE_MS
    : false
}

export function classifyUserAgent(userAgent: string) {
  const normalized = userAgent.toLowerCase()

  if (normalized.includes("edg/")) return "edge"
  if (normalized.includes("chrome/")) return "chrome"
  if (normalized.includes("firefox/")) return "firefox"
  if (normalized.includes("safari/")) return "safari"
  if (normalized.includes("bot") || normalized.includes("crawler")) return "bot"
  return userAgent ? "other" : "unknown"
}

