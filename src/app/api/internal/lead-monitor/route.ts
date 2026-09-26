import { randomUUID } from "node:crypto"
import { Redis } from "@upstash/redis"
import { getContactRuntimeConfig } from "@/lib/contact/config"
import { hasInternalBearer } from "@/lib/contact/internal-auth"
import { runIndependentMonitor, type IncidentState, type IncidentStore } from "@/lib/contact/monitor"
import { sendOperatorAlert } from "@/lib/contact/alerts"
import { readMonitorSnapshot } from "@/server/leads/enterprise-repository"
import { logContactEvent } from "@/lib/contact/log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 45

export async function GET(request: Request) {
  if (!hasInternalBearer(request, process.env.CRON_SECRET)) return Response.json({ ok: false }, { status: 401 })
  const sink = { alertWebhookUrl: process.env.LEAD_ALERT_WEBHOOK_URL?.trim(), alertWebhookToken: process.env.LEAD_ALERT_WEBHOOK_TOKEN?.trim() }
  if (!sink.alertWebhookUrl || !/^https:\/\//.test(sink.alertWebhookUrl)) {
    logContactEvent("error", "lead_monitor_unavailable", { errorCode: "alert_sink_not_configured" })
    return Response.json({ ok: false }, { status: 503 })
  }
  let configured = true
  try {
    getContactRuntimeConfig()
    if (!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(process.env.RESEND_WEBHOOK_SECRET ?? "") ||
        (process.env.LEAD_OPERATIONS_SECRET?.length ?? 0) < 32) configured = false
  } catch { configured = false }

  // This route neither constructs a QStash client nor queues its alerts.
  let redis: Redis | undefined
  let store: IncidentStore | null = null
  const lockToken = randomUUID()
  const lockKey = "gridninja:contact:monitor:lock:v1"
  let locked = false
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error("RedisUnavailable")
    redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, retry: { retries: 0 }, signal: () => AbortSignal.timeout(2_000) })
    locked = !!await redis.set(lockKey, lockToken, { nx: true, ex: 55 })
    if (!locked) return Response.json({ ok: true, busy: true }, { headers: { "Cache-Control": "no-store" } })
    const client = redis
    store = {
      get: (code) => client.get<IncidentState>(`gridninja:contact:monitor:v1:${code}`),
      async set(code, state) { await client.set(`gridninja:contact:monitor:v1:${code}`, state, { ex: 90 * 86_400 }) },
    }
  } catch { /* Direct bounded fallback below remains independent of Redis. */ }

  try {
    const result = await runIndependentMonitor({ configured, store, readSnapshot: readMonitorSnapshot,
      sendAlert: (alert) => sendOperatorAlert(sink, alert) })
    logContactEvent(result.healthy ? "info" : "error", "lead_monitor_completed", { state: result.healthy ? "healthy" : "incident", count: result.activeIncidents })
    return Response.json({ ok: !result.degraded && !result.notificationFailures, ...result }, {
      status: result.degraded || result.notificationFailures ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    })
  } finally {
    if (redis && locked) try {
      await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", [lockKey], [lockToken])
    } catch { logContactEvent("warn", "lead_monitor_lock_expiry_required", { errorCode: "redis_unavailable" }) }
  }
}
