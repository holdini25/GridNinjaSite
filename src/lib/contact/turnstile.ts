import "server-only"

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

type TurnstileResponse = {
  success?: boolean
  hostname?: string
  action?: string
  challenge_ts?: string
  "error-codes"?: string[]
}

export type TurnstileVerification =
  | {
      status: "valid"
      hostname: string
      action: string
      challengeTimestamp?: string
    }
  | { status: "invalid"; errorCode: string }
  | { status: "unavailable"; errorCode: string }

export async function verifyTurnstile(input: {
  token: string
  remoteIp: string
  requestId: string
  expectedAction: "contact" | "capacity_audit"
  secretKey: string
  allowedHostnames: ReadonlySet<string>
}): Promise<TurnstileVerification> {
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      signal: AbortSignal.timeout(5_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: input.secretKey,
        response: input.token,
        remoteip: input.remoteIp,
        idempotency_key: input.requestId,
      }),
      cache: "no-store",
    })

    if (!response.ok) {
      return { status: "unavailable", errorCode: `http_${response.status}` }
    }

    const result = (await response.json()) as TurnstileResponse

    if (!result.success) {
      return {
        status: "invalid",
        errorCode: result["error-codes"]?.[0] || "verification_failed",
      }
    }

    if (!result.hostname || !input.allowedHostnames.has(result.hostname)) {
      return { status: "invalid", errorCode: "hostname_mismatch" }
    }

    if (result.action !== input.expectedAction) {
      return { status: "invalid", errorCode: "action_mismatch" }
    }

    return {
      status: "valid",
      hostname: result.hostname,
      action: result.action,
      challengeTimestamp: result.challenge_ts,
    }
  } catch (error) {
    return {
      status: "unavailable",
      errorCode:
        error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : "request_failed",
    }
  }
}

