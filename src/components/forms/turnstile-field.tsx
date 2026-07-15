"use client"

import Script from "next/script"
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

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

type TurnstileFieldProps = {
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
  const onTokenChangeRef = useRef(onTokenChange)
  const [scriptReady, setScriptReady] = useState(false)
  const [verificationState, setVerificationState] =
    useState<VerificationState>(siteKey ? "loading" : "error")

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange
  }, [onTokenChange])

  useImperativeHandle(forwardedRef, () => ({
    reset() {
      onTokenChangeRef.current("")
      setVerificationState("ready")

      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
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

    widgetIdRef.current = turnstile.render(container, {
      sitekey: siteKey,
      action,
      theme: "auto",
      appearance: "interaction-only",
      callback(token) {
        onTokenChangeRef.current(token)
        setVerificationState("verified")
      },
      "error-callback"() {
        onTokenChangeRef.current("")
        setVerificationState("error")
      },
      "expired-callback"() {
        onTokenChangeRef.current("")
        setVerificationState("expired")
      },
      "timeout-callback"() {
        onTokenChangeRef.current("")
        setVerificationState("expired")
      },
    })
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
      widgetIdRef.current = null
    }
  }, [action, enabled, scriptReady, siteKey])

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
      {siteKey && enabled ? (
        <Script
          id="gridninja-cloudflare-turnstile"
          src={TURNSTILE_SCRIPT_URL}
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
          onError={() => setVerificationState("error")}
        />
      ) : null}
      <div
        ref={containerRef}
        className="min-h-[72px]"
        data-turnstile-container={action}
      />
      <div className="h-16 overflow-y-auto">
        <p
          className={`mt-2 text-sm ${stateIsError ? "text-danger" : "text-muted-foreground"}`}
          role={stateIsError ? "alert" : "status"}
          aria-live="polite"
        >
          {stateMessage}
        </p>
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
