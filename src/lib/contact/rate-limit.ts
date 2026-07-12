import "server-only"

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

type RateLimitConfig = {
  redisUrl: string
  redisToken: string
}

type LimitResult = {
  ok: boolean
  resetAt?: number
  unavailable?: boolean
}

type Limiters = {
  ipShort: Ratelimit
  ipDaily: Ratelimit
  emailHourly: Ratelimit
  pairShort: Ratelimit
}

let cached:
  | { key: string; limiters: Limiters }
  | undefined

function getLimiters(config: RateLimitConfig) {
  const key = `${config.redisUrl}:${config.redisToken}`
  if (cached?.key === key) return cached.limiters

  const redis = new Redis({ url: config.redisUrl, token: config.redisToken })
  const create = (prefix: string, limiter: ReturnType<typeof Ratelimit.slidingWindow>) =>
    new Ratelimit({
      redis,
      prefix: `gridninja:contact:${prefix}`,
      limiter,
      analytics: true,
      timeout: 1_500,
    })

  const limiters = {
    ipShort: create("ip-10m", Ratelimit.slidingWindow(8, "10 m")),
    ipDaily: create("ip-24h", Ratelimit.slidingWindow(30, "24 h")),
    emailHourly: create("email-1h", Ratelimit.slidingWindow(4, "1 h")),
    pairShort: create("pair-10m", Ratelimit.slidingWindow(3, "10 m")),
  }

  cached = { key, limiters }
  return limiters
}

async function runLimits(
  checks: Array<Promise<Awaited<ReturnType<Ratelimit["limit"]>>>>
): Promise<LimitResult> {
  try {
    const results = await Promise.all(checks)
    const timedOut = results.some(
      (result) => (result as typeof result & { reason?: string }).reason === "timeout"
    )

    if (timedOut) return { ok: false, unavailable: true }

    const denied = results.filter((result) => !result.success)
    if (denied.length === 0) return { ok: true }

    return {
      ok: false,
      resetAt: Math.max(...denied.map((result) => result.reset)),
    }
  } catch {
    return { ok: false, unavailable: true }
  }
}

export function checkIpAttemptLimits(config: RateLimitConfig, ipHash: string) {
  const limiters = getLimiters(config)
  return runLimits([
    limiters.ipShort.limit(ipHash),
    limiters.ipDaily.limit(ipHash),
  ])
}

export function checkEligibleSubmissionLimits(
  config: RateLimitConfig,
  emailHash: string,
  pairHash: string
) {
  const limiters = getLimiters(config)
  return runLimits([
    limiters.emailHourly.limit(emailHash),
    limiters.pairShort.limit(pairHash),
  ])
}

