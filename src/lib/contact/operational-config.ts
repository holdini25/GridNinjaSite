import "server-only"
import { approvedResendConfiguration, qualifiedCrmConfiguration } from "@/lib/contact/provider-request"

const reference = /^[A-Za-z0-9_-]{1,64}$/
type Environment = Record<string, string | undefined>
export function operationalReference(value: string | undefined): string | null {
  return value && reference.test(value) ? value : null
}

export type MonitorThresholds = { recipientObservationMs: number; handlingMs: number }

export function getMonitorThresholds(env: Environment = process.env): MonitorThresholds {
  function seconds(name: string) {
    const raw = env[name]
    if (!raw || !/^[1-9][0-9]*$/.test(raw)) throw new Error("MonitorThresholdNotConfigured")
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value > 365 * 86400) throw new Error("MonitorThresholdInvalid")
    return value * 1000
  }
  return {
    recipientObservationMs: seconds("LEAD_RECIPIENT_OBSERVATION_SECONDS"),
    handlingMs: seconds("LEAD_HANDLING_SECONDS"),
  }
}

export function getMonitorSink(env: Environment = process.env) {
  const alertWebhookUrl = env.LEAD_ALERT_WEBHOOK_URL?.trim()
  const alertWebhookToken = env.LEAD_ALERT_WEBHOOK_TOKEN?.trim()
  const url = new URL(alertWebhookUrl ?? "")
  if (url.protocol !== "https:" || url.username || url.password || url.hash || !alertWebhookToken || alertWebhookToken.length < 32) {
    throw new Error("MonitorSinkNotConfigured")
  }
  return { alertWebhookUrl: url.toString(), alertWebhookToken }
}

export function configuredOperators(env: Environment = process.env): readonly string[] {
  return (env.LEAD_OPERATOR_REFERENCES ?? "").split(",").map(x => x.trim()).filter(x => reference.test(x))
}

export function isObservationConfigurationReady(env: Environment = process.env) {
  try {
    getMonitorThresholds(env)
    const owners = configuredOperators(env)
    return Boolean(env.DATABASE_URL && approvedResendConfiguration(env)
      && env.RESEND_WEBHOOK_SECRET?.startsWith("whsec_")
      && (!env.RESEND_WEBHOOK_SECRET_PREVIOUS || operationalReference(env.RESEND_WEBHOOK_PREVIOUS_ACCOUNT_REF))
      && (env.LEAD_WEBHOOK_ENABLED !== "true" || qualifiedCrmConfiguration(env))
      && (env.LEAD_OPERATIONS_SECRET?.length ?? 0) >= 32
      && operationalReference(env.LEAD_MONITOR_NAMESPACE)
      && owners.length >= 2 && new Set(owners).size === owners.length)
  } catch { return false }
}
