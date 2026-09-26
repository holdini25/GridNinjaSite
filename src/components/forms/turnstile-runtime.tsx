"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

let scriptRequest: Promise<void> | null = null
function loadVerificationScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptRequest) return scriptRequest
  const request = new Promise<void>((resolve, reject) => {
    document.getElementById("gridninja-cloudflare-turnstile")?.remove()
    const script = document.createElement("script")
    script.id = "gridninja-cloudflare-turnstile"
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    const finish = (error?: Error) => {
      clearTimeout(timer)
      script.onload = null; script.onerror = null
      if (error) { script.remove(); reject(error) } else resolve()
    }
    const timer = setTimeout(() => finish(new Error("Verification script timed out")), 10_000)
    script.onload = () => finish(window.turnstile ? undefined : new Error("Verification API unavailable"))
    script.onerror = () => finish(new Error("Verification script unavailable"))
    document.head.append(script)
  })
  scriptRequest = request
  const clearRequest = () => { if (scriptRequest === request) scriptRequest = null }
  void request.then(clearRequest, clearRequest)
  return request
}

type TurnstileWidgetOptions = {
  sitekey: string
  action: string
  theme: "auto"
  appearance: "interaction-only"
  callback: (token: string) => void
  "error-callback": () => void
  "expired-callback": () => void
  "timeout-callback": () => void
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileWidgetOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export type TurnstileFieldHandle = {
  reset: () => void
}

export type TurnstileFieldProps = {
  action: "contact" | "capacity_audit"
  enabled?: boolean
  error?: string
  onTokenChange: (token: string) => void
}

type VerificationState =
  | "loading"
  | "ready"
  | "verified"
  | "expired"
  | "error"

export const TurnstileField = forwardRef<
  TurnstileFieldHandle,
  TurnstileFieldProps
>(function TurnstileField(
  { action, enabled = true, error, onTokenChange },
  forwardedRef
) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const widgetGeneration = useRef(0)
  const onTokenChangeRef = useRef(onTokenChange)
  const [scriptReady, setScriptReady] = useState(false)
  const [retry, setRetry] = useState(0)
  const [verificationState, setVerificationState] =
    useState<VerificationState>(siteKey ? "loading" : "error")

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange
  }, [onTokenChange])

  useEffect(() => {
    if (!enabled || !siteKey) return
    let current = true
    void loadVerificationScript().then(() => { if (current) setScriptReady(true) }, () => {
      if (current) { onTokenChangeRef.current(""); setVerificationState("error") }
    })
    return () => { current = false }
  }, [enabled, siteKey, retry])

  useImperativeHandle(forwardedRef, () => ({
    reset() {
      onTokenChangeRef.current("")
      setVerificationState("ready")

      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current)
        } catch {
          ++widgetGeneration.current
          onTokenChangeRef.current("")
          const failedWidget = widgetIdRef.current
          widgetIdRef.current = null
          try { window.turnstile.remove(failedWidget) } catch { containerRef.current?.replaceChildren() }
          setVerificationState("error")
        }
      }
    },
  }))

  useEffect(() => {
    const container = containerRef.current
    const turnstile = window.turnstile

    if (!enabled || !siteKey || !scriptReady || !container || !turnstile) {
      return
    }

    if (widgetIdRef.current) {
      return
    }

    let active = true
    let mounted = true
    const generation = ++widgetGeneration.current
    onTokenChangeRef.current("")
    try {
      widgetIdRef.current = turnstile.render(container, {
        sitekey: siteKey,
        action,
        theme: "auto",
        appearance: "interaction-only",
        callback(token) {
          if (!active || generation !== widgetGeneration.current) return
          onTokenChangeRef.current(token)
          setVerificationState("verified")
        },
        "error-callback"() {
          if (!active || generation !== widgetGeneration.current) return
          onTokenChangeRef.current("")
          setVerificationState("error")
        },
        "expired-callback"() {
          if (!active || generation !== widgetGeneration.current) return
          onTokenChangeRef.current("")
          setVerificationState("expired")
        },
        "timeout-callback"() {
          if (!active || generation !== widgetGeneration.current) return
          onTokenChangeRef.current("")
          setVerificationState("expired")
        },
      })
    } catch {
      active = false
      ++widgetGeneration.current
      widgetIdRef.current = null
      container.replaceChildren()
      onTokenChangeRef.current("")
      const failedGeneration = widgetGeneration.current
      queueMicrotask(() => {
        if (mounted && widgetGeneration.current === failedGeneration) setVerificationState("error")
      })
    }
    return () => {
      active = false
      mounted = false
      onTokenChangeRef.current("")
      const retiredWidget = widgetIdRef.current
      widgetIdRef.current = null
      if (retiredWidget && window.turnstile) {
        try { window.turnstile.remove(retiredWidget) } catch { container.replaceChildren() }
      }
    }
  }, [action, enabled, scriptReady, siteKey, retry])

  const stateMessage = getVerificationStateMessage(
    verificationState,
    Boolean(siteKey),
    enabled
  )
  const stateIsError =
    verificationState === "error" || verificationState === "expired"

  return (
    <div
      className="mt-6"
      aria-describedby={error ? `${action}-turnstile-error` : undefined}
    >
      <p className="mb-3 text-base text-foreground">Security verification</p>
      <div
        ref={containerRef}
        className="min-h-[72px]"
        data-turnstile-container={action}
      />
      <div className="min-h-16">
        <p
          className={`mt-2 text-sm ${stateIsError ? "text-danger" : "text-muted-foreground"}`}
          role={stateIsError ? "alert" : "status"}
          aria-live="polite"
        >
          {stateMessage}
        </p>
        {siteKey && enabled && stateIsError && <button type="button" className="min-h-11 rounded-lg px-3 text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary" onClick={() => {
          onTokenChangeRef.current("")
          setVerificationState("loading")
          setScriptReady(false)
          setRetry(value => value + 1)
        }}>Retry verification</button>}
        <p
          id={`${action}-turnstile-error`}
          className="mt-1 text-sm text-danger"
          role={error ? "alert" : undefined}
        >
          {error ?? ""}
        </p>
      </div>
    </div>
  )
})

function getVerificationStateMessage(
  state: VerificationState,
  hasSiteKey: boolean,
  enabled: boolean
) {
  if (!hasSiteKey) {
    return "Security verification is temporarily unavailable. Please try again later."
  }

  if (!enabled) {
    return "Security verification will load when the form is engaged."
  }

  if (state === "verified") {
    return "Security verification complete."
  }

  if (state === "expired") {
    return "Security verification expired. Complete it again before submitting."
  }

  if (state === "error") {
    return "Security verification could not load. Please try again."
  }

  return "Complete the verification before submitting."
}
