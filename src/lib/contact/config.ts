import "server-only"

import { canonicalSiteUrl } from "@/content/site"

export class ContactConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ContactConfigurationError"
  }
}

export type ContactRuntimeConfig = {
  databaseUrl: string
  publicBaseUrl: string
  allowedOrigins: ReadonlySet<string>
  allowedTurnstileHostnames: ReadonlySet<string>
  turnstileSecretKey: string
  pseudonymSecret: string
  redisUrl: string
  redisToken: string
  qstashToken: string
  qstashCurrentSigningKey: string
  qstashNextSigningKey: string
  resendApiKey: string
  emailFrom: string
  emailTo: string
  crmWebhookUrl?: string
  crmWebhookSigningSecret?: string
  alertWebhookUrl?: string
  alertWebhookToken?: string
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new ContactConfigurationError(`${name} is not configured.`)
  }

  return value
}

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    throw new ContactConfigurationError(`Invalid contact origin: ${value}`)
  }
}

function optionalHttpUrl(name: string) {
  const value = process.env[name]?.trim()
  if (!value) return undefined

  try {
    const url = new URL(value)
    if (!["http:", "https:"].includes(url.protocol)) throw new Error()
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      throw new Error()
    }
    return url.toString()
  } catch {
    throw new ContactConfigurationError(`${name} must be a valid HTTPS URL.`)
  }
}

function requireLongSecret(name: string) {
  const value = requireEnv(name)
  if (value.length < 32) {
    throw new ContactConfigurationError(`${name} must be at least 32 characters.`)
  }
  return value
}

export function getContactRuntimeConfig(): ContactRuntimeConfig {
  const publicBaseUrl = normalizeOrigin(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || canonicalSiteUrl
  )
  const allowedOrigins = new Set([
    publicBaseUrl,
    ...parseCsv(process.env.CONTACT_ALLOWED_ORIGINS).map(normalizeOrigin),
  ])

  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://127.0.0.1:3000")
    allowedOrigins.add("http://localhost:3000")
  }

  const configuredHostnames = parseCsv(
    process.env.TURNSTILE_ALLOWED_HOSTNAMES
  )
  const allowedTurnstileHostnames = new Set(
    configuredHostnames.length > 0
      ? configuredHostnames
      : [...allowedOrigins].map((origin) => new URL(origin).hostname)
  )

  const crmWebhookUrl = optionalHttpUrl("LEAD_WEBHOOK_URL")
  const crmWebhookSigningSecret =
    process.env.LEAD_WEBHOOK_SIGNING_SECRET?.trim() || undefined

  if (Boolean(crmWebhookUrl) !== Boolean(crmWebhookSigningSecret)) {
    throw new ContactConfigurationError(
      "LEAD_WEBHOOK_URL and LEAD_WEBHOOK_SIGNING_SECRET must be configured together."
    )
  }

  if (crmWebhookSigningSecret && crmWebhookSigningSecret.length < 32) {
    throw new ContactConfigurationError(
      "LEAD_WEBHOOK_SIGNING_SECRET must be at least 32 characters."
    )
  }

  const alertWebhookUrl = optionalHttpUrl("LEAD_ALERT_WEBHOOK_URL")

  if (process.env.NODE_ENV === "production" && !alertWebhookUrl) {
    throw new ContactConfigurationError(
      "LEAD_ALERT_WEBHOOK_URL is required in production."
    )
  }

  return {
    databaseUrl: requireEnv("DATABASE_URL"),
    publicBaseUrl,
    allowedOrigins,
    allowedTurnstileHostnames,
    turnstileSecretKey: requireEnv("TURNSTILE_SECRET_KEY"),
    pseudonymSecret: requireLongSecret("LEAD_PSEUDONYM_SECRET"),
    redisUrl: requireEnv("UPSTASH_REDIS_REST_URL"),
    redisToken: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
    qstashToken: requireEnv("QSTASH_TOKEN"),
    qstashCurrentSigningKey: requireEnv("QSTASH_CURRENT_SIGNING_KEY"),
    qstashNextSigningKey: requireEnv("QSTASH_NEXT_SIGNING_KEY"),
    resendApiKey: requireEnv("RESEND_API_KEY"),
    emailFrom: requireEnv("LEAD_EMAIL_FROM"),
    emailTo: requireEnv("LEAD_EMAIL_TO"),
    crmWebhookUrl,
    crmWebhookSigningSecret,
    alertWebhookUrl,
    alertWebhookToken:
      process.env.LEAD_ALERT_WEBHOOK_TOKEN?.trim() || undefined,
  }
}
