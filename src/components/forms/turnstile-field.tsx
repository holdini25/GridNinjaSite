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
>(function TurnstileField({ action, error, onTokenChange }, forwardedRef) {
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

    if (!siteKey || !scriptReady || !container || !turnstile) {
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
  }, [action, scriptReady, siteKey])

  const stateMessage = getVerificationStateMessage(
    verificationState,
    Boolean(siteKey)
  )
  const stateIsError =
    verificationState === "error" || verificationState === "expired"

  return (
    <div
      className="mt-6"
      aria-describedby={error ? `${action}-turnstile-error` : undefined}
    >
      <p className="mb-3 text-base text-foreground">Security verification</p>
      {siteKey ? (
        <Script
          id="gridninja-cloudflare-turnstile"
          src={TURNSTILE_SCRIPT_URL}
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
          onError={() => setVerificationState("error")}
        />
      ) : null}
      <div ref={containerRef} data-turnstile-container={action} />
      <p
        className={`mt-2 text-sm ${stateIsError ? "text-danger" : "text-muted-foreground"}`}
        role={stateIsError ? "alert" : "status"}
        aria-live="polite"
      >
        {stateMessage}
      </p>
      {error ? (
        <p
          id={`${action}-turnstile-error`}
          className="mt-2 text-base text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
})

function getVerificationStateMessage(
  state: VerificationState,
  hasSiteKey: boolean
) {
  if (!hasSiteKey) {
    return "Security verification is temporarily unavailable. Please try again later."
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
