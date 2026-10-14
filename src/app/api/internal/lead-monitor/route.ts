import { randomUUID } from "node:crypto"
import { Redis } from "@upstash/redis"
import { hasInternalBearer } from "@/lib/contact/internal-auth"
import { getMonitorSink, getMonitorThresholds, isObservationConfigurationReady, operationalReference, type MonitorThresholds } from "@/lib/contact/operational-config"
import { runIndependentMonitor, type IncidentState, type IncidentStore } from "@/lib/contact/monitor"
import { sendOperatorAlert } from "@/lib/contact/alerts"
import { logContactEvent } from "@/lib/contact/log"
import { observationsRepository } from "@/server/leads/observations-repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 45
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function GET(request: Request) {
  if (!hasInternalBearer(request, process.env.LEAD_MONITOR_SECRET)) return reply({ ok: false }, 401)
  const namespace = operationalReference(process.env.LEAD_MONITOR_NAMESPACE)
  let sink: ReturnType<typeof getMonitorSink>
  try { sink = getMonitorSink() } catch {
    logContactEvent("error", "lead_monitor_unavailable", { errorCode: "alert_sink_not_configured" })
    return reply({ ok: false }, 503)
  }
  if (!namespace) return reply({ ok: false }, 503)
  let thresholds: MonitorThresholds | undefined
  try { thresholds = getMonitorThresholds() } catch { /* A configuration incident is reported; database health remains unknown. */ }
  const configured = isObservationConfigurationReady()
  let redis: Redis | undefined
  let store: IncidentStore | null = null
  const lockToken = randomUUID()
  const prefix = `gridninja:contact:${namespace}:monitor:v2`
  const lockKey = `${prefix}:lock`
  let locked = false
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error("RedisUnavailable")
    redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, retry: { retries: 0 }, signal: () => AbortSignal.timeout(2000) })
    locked = !!await redis.set(lockKey, lockToken, { nx: true, ex: 55 })
    if (!locked) return reply({ ok: true, busy: true })
    const client = redis
    store = {
      get: code => client.get<IncidentState>(`${prefix}:${code}`),
      async set(code, state) { await client.set(`${prefix}:${code}`, state, { ex: 90 * 86400 }) },
    }
  } catch { /* Direct bounded fallback remains independent of Redis and QStash. */ }

  try {
    const policy = thresholds
    const result = await runIndependentMonitor({ configured, store,
      readSnapshot: policy ? now => observationsRepository().readMonitorSnapshot(now, policy) : undefined,
      sendAlert: alert => sendOperatorAlert(sink, { ...alert, eventId: `${namespace}/${alert.eventId}` }),
    })
    logContactEvent(result.healthy ? "info" : "error", "lead_monitor_completed", { state: result.healthy ? "healthy" : "incident", count: result.activeIncidents })
    return reply({ ok: !result.degraded && !result.notificationFailures && configured, ...result }, result.degraded || result.notificationFailures || !configured ? 503 : 200)
  } finally {
    if (redis && locked) try {
      await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", [lockKey], [lockToken])
    } catch { logContactEvent("warn", "lead_monitor_lock_expiry_required", { errorCode: "redis_unavailable" }) }
  }
}
