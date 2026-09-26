import "server-only"
import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"
import { getTrustedClientIp, hashContactIdentifier } from "@/lib/contact/request"

let cached: { url: string; token: string; perIp: Ratelimit; global: Ratelimit } | undefined
export async function allowCspReport(request: Request): Promise<"allowed" | "limited" | "unavailable"> {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN, secret = process.env.LEAD_PSEUDONYM_SECRET
  if (!url || !token || !secret || secret.length < 32) return "unavailable"
  try {
    if (!cached || cached.url !== url || cached.token !== token) {
      const redis = new Redis({ url, token })
      cached = { url, token,
        perIp: new Ratelimit({ redis, prefix: "gridninja:csp:ip", limiter: Ratelimit.fixedWindow(10, "1 m"), analytics: false, timeout: 1000 }),
        global: new Ratelimit({ redis, prefix: "gridninja:csp:global", limiter: Ratelimit.fixedWindow(120, "1 m"), analytics: false, timeout: 1000 }),
      }
    }
    const key = hashContactIdentifier(getTrustedClientIp(request), secret)
    const [ip, global] = await Promise.all([cached.perIp.limit(key), cached.global.limit("reports")])
    // Upstash timeout can return success=true with reason=timeout; fail closed.
    if (ip.reason === "timeout" || global.reason === "timeout") return "unavailable"
    return ip.success && global.success ? "allowed" : "limited"
  } catch { return "unavailable" }
}
