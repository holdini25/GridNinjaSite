"use client"

import {
  type FocusEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  type ContactConversationType,
  constraintOptions,
  siteTypes,
  timelineOptions,
} from "@/lib/constants"
import { contactLeadSchema, mapZodErrors } from "@/lib/validators"
import type { LeadIntent } from "@/types/site"

import {
  contactSubmissionStorageKey,
  intentAfterConversationSelection,
  isContactConversationType,
  resolveContactAttribution,
} from "@/components/forms/contact-attribution"
import { buildContactLeadCandidate } from "@/components/forms/lead-form-data"
import { NativeSelect } from "@/components/forms/native-select"
import {
  TurnstileField,
  type TurnstileFieldHandle,
} from "@/components/forms/turnstile-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  trackGridNinjaEvent,
  type AnalyticsErrorCategory,
  type AnalyticsEventName,
} from "@/lib/analytics"

const conversationOptions = [
  { label: "Capacity Audit", value: "capacity-audit" },
  { label: "Shadow Mode", value: "shadow-mode" },
  { label: "Partnership", value: "partnership" },
  { label: "Other", value: "other" },
] as const satisfies readonly {
  label: string
  value: ContactConversationType
}[]

const blurValidatedFields = new Set([
  "name",
  "email",
  "company",
  "message",
  "role",
  "siteType",
  "timeline",
  "capacityRange",
])

export function ContactForm() {
  const startedAt = useRef(Date.now())
  const inFlight = useRef(false)
  const formStarted = useRef(false)
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const turnstileRef = useRef<TurnstileFieldHandle>(null)
  const [clientSubmissionId] = useState(() => crypto.randomUUID())
  const [intent, setIntent] = useState<LeadIntent>("capacity-audit")
  const [conversationType, setConversationType] =
    useState<ContactConversationType>("capacity-audit")
  const [source, setSource] = useState("contact-page")
  const [turnstileToken, setTurnstileToken] = useState("")
  const [verificationEnabled, setVerificationEnabled] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, setIsPending] = useState(false)
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const [errorFocusVersion, setErrorFocusVersion] = useState(0)

  useEffect(() => {
    const attribution = resolveContactAttribution(window.location.search)
    setIntent(attribution.intent)
    setConversationType(attribution.conversationType)
    setSource(attribution.source)
  }, [])

  useEffect(() => {
    if (errorFocusVersion > 0) {
      errorSummaryRef.current?.focus()
    }
  }, [errorFocusVersion])

  useEffect(() => {
    const activate = () => setVerificationEnabled(true)
    const idleWindow = window as Window & {
      requestIdleCallback?: Window["requestIdleCallback"]
      cancelIdleCallback?: Window["cancelIdleCallback"]
    }

    if (
      typeof idleWindow.requestIdleCallback === "function" &&
      typeof idleWindow.cancelIdleCallback === "function"
    ) {
      const idleId = idleWindow.requestIdleCallback(activate, {
        timeout: 4_000,
      })
      return () => idleWindow.cancelIdleCallback?.(idleId)
    }

    const timeoutId = globalThis.setTimeout(activate, 2_500)
    return () => globalThis.clearTimeout(timeoutId)
  }, [])

  function startForm() {
    setVerificationEnabled(true)

    if (formStarted.current) return
    formStarted.current = true
    trackGridNinjaEvent("contact_form_start", { source, intent })
  }

  function buildCandidate(form: HTMLFormElement) {
    return buildContactLeadCandidate(new FormData(form), {
      schemaVersion: 2,
      formType: "contact",
      clientSubmissionId,
      turnstileToken,
      intent,
      source,
      startedAt: startedAt.current,
    })
  }

  function handleBlur(event: FocusEvent<HTMLFormElement>) {
    const target = event.target
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return
    }
    if (!blurValidatedFields.has(target.name)) return

    const parsed = contactLeadSchema.safeParse(buildCandidate(event.currentTarget))
    const nextMessage = parsed.success
      ? undefined
      : mapZodErrors(parsed)[target.name]

    setErrors((current) => {
      const next = { ...current }
      if (nextMessage) next[target.name] = nextMessage
      else delete next[target.name]
      return next
    })
  }

  function handleConversationChange(value: string) {
    if (!isContactConversationType(value)) return

    setConversationType(value)
    setIntent(intentAfterConversationSelection(value))
  }

  function reportError(category: AnalyticsErrorCategory) {
    trackGridNinjaEvent("contact_form_error", {
      source,
      intent,
      errorCategory: category,
      success: false,
    })
  }

  function focusErrorSummary() {
    setErrorFocusVersion((version) => version + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startForm()

    if (inFlight.current) return

    const parsed = contactLeadSchema.safeParse(buildCandidate(event.currentTarget))

    if (!parsed.success) {
      const nextErrors = mapZodErrors(parsed)
      setErrors(nextErrors)
      setServerMessage("Review the highlighted fields before submitting.")
      reportError(
        Object.keys(nextErrors).every((field) => field === "turnstileToken")
          ? "verification"
          : "validation"
      )
      focusErrorSummary()
      return
    }

    setErrors({})
    inFlight.current = true
    setIsPending(true)
    setServerMessage(null)
    trackGridNinjaEvent("contact_form_submit", { source, intent })

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      const payload = (await response.json()) as {
        ok: boolean
        requestId?: string
        submissionId?: string
        status?: "queued" | "already_received"
        fieldErrors?: Record<string, string>
        message?: string
      }
      const acceptedStatus = response.status === 200 || response.status === 202

      if (
        !acceptedStatus ||
        !payload.ok ||
        typeof payload.submissionId !== "string" ||
        !payload.submissionId
      ) {
        setErrors(payload.fieldErrors ?? {})
        setServerMessage(payload.message ?? "Unable to submit the request.")
        reportError(errorCategoryForStatus(response.status, payload.fieldErrors))
        turnstileRef.current?.reset()
        focusErrorSummary()
        return
      }

      trackGridNinjaEvent(contactSuccessEventName(intent), {
        source,
        intent,
        success: true,
      })

      try {
        window.sessionStorage.setItem(
          contactSubmissionStorageKey,
          JSON.stringify({ submissionId: payload.submissionId, intent })
        )
      } catch {
        // Confirmation remains useful when storage is unavailable.
      }

      window.location.assign("/contact/thanks")
    } catch {
      setServerMessage("Unable to submit the request.")
      reportError("network")
      turnstileRef.current?.reset()
      focusErrorSummary()
    } finally {
      inFlight.current = false
      setIsPending(false)
    }
  }

  const summaryMessages = [
    ...new Set([...Object.values(errors), ...(serverMessage ? [serverMessage] : [])]),
  ]

  return (
    <form
      onSubmit={handleSubmit}
      onBlur={handleBlur}
      onFocusCapture={startForm}
      onPointerDownCapture={startForm}
      noValidate
      aria-busy={isPending}
      className="gn-lead-form rounded-2xl border border-white/10 bg-[#0D151C] p-5 [--ring:#22D3EE] sm:p-7"
    >
      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="gn-eyebrow">Request an assessment</p>
      <h2 className="mt-3 text-[1.75rem] leading-tight font-medium text-foreground">
        Start with the decision in front of your team
      </h2>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-foreground">
          Conversation type
        </legend>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {conversationOptions.map((option) => (
            <label
              key={option.value}
              className="relative flex min-h-11 cursor-pointer items-center rounded-xl border border-white/10 bg-background/45 px-3 py-2.5 text-sm text-muted-foreground transition-[border-color,background-color,color,transform] duration-150 has-checked:border-primary/70 has-checked:bg-primary/10 has-checked:text-foreground focus-within:border-[#22D3EE] focus-within:ring-2 focus-within:ring-[#22D3EE]/25 active:translate-y-px motion-reduce:transition-none"
            >
              <input
                type="radio"
                name="conversationType"
                value={option.value}
                checked={conversationType === option.value}
                onChange={(changeEvent) =>
                  handleConversationChange(changeEvent.currentTarget.value)
                }
                className="sr-only"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-x-4 sm:grid-cols-2">
        <ContactField label="Name" name="name" error={errors.name}>
          <Input
            id="contact-name"
            name="name"
            required
            autoComplete="name"
            className="min-h-12 bg-background/35"
            aria-invalid={Boolean(errors.name)}
            aria-describedby="contact-name-error"
          />
        </ContactField>
        <ContactField label="Work email" name="email" error={errors.email}>
          <Input
            id="contact-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            className="min-h-12 bg-background/35"
            aria-invalid={Boolean(errors.email)}
            aria-describedby="contact-email-error"
          />
        </ContactField>
        <ContactField
          label="Company"
          name="company"
          error={errors.company}
          className="sm:col-span-2"
        >
          <Input
            id="contact-company"
            name="company"
            required
            autoComplete="organization"
            className="min-h-12 bg-background/35"
            aria-invalid={Boolean(errors.company)}
            aria-describedby="contact-company-error"
          />
        </ContactField>
        <ContactField
          label="What constraint or decision are you working through?"
          name="message"
          error={errors.message}
          className="sm:col-span-2"
        >
          <Textarea
            id="contact-message"
            name="message"
            required
            autoComplete="off"
            className="min-h-36 resize-y bg-background/35"
            aria-invalid={Boolean(errors.message)}
            aria-describedby="contact-message-helper contact-message-error"
          />
          <p
            id="contact-message-helper"
            className="mt-2 text-sm leading-6 text-muted-foreground"
          >
            Describe the operating decision, capacity claim, recurring constraint,
            or evidence gap. Do not include credentials, site drawings, customer
            data or sensitive topology.
          </p>
        </ContactField>
      </div>

      <details className="mt-2 rounded-xl border border-white/10 bg-background/25">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-foreground marker:content-none">
          Add optional site details
          <span aria-hidden="true" className="text-primary">+</span>
        </summary>
        <div className="grid gap-x-4 border-t border-white/10 px-4 pt-4 sm:grid-cols-2">
          <OptionalSelect
            id="contact-site-type"
            label="Site type"
            name="siteType"
            error={errors.siteType}
            options={siteTypes}
          />
          <OptionalSelect
            id="contact-timeline"
            label="Desired timeline"
            name="timeline"
            error={errors.timeline}
            options={timelineOptions}
          />
          <ContactField label="Role" name="role" error={errors.role}>
            <Input
              id="contact-role"
              name="role"
              autoComplete="organization-title"
              className="min-h-12 bg-background/35"
              aria-invalid={Boolean(errors.role)}
              aria-describedby="contact-role-error"
            />
          </ContactField>
          <ContactField
            label="Approximate capacity range"
            name="capacityRange"
            controlId="contact-capacity-range"
            error={errors.capacityRange}
          >
            <Input
              id="contact-capacity-range"
              name="capacityRange"
              maxLength={80}
              autoComplete="off"
              placeholder="For example, 5–20 MW"
              className="min-h-12 bg-background/35"
              aria-invalid={Boolean(errors.capacityRange)}
              aria-describedby="contact-capacityRange-error"
            />
          </ContactField>
          <fieldset className="pb-5 sm:col-span-2">
            <legend className="text-sm font-medium text-foreground">
              Current constraints
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {constraintOptions.map((option, index) => (
                <label
                  key={option}
                  htmlFor={`contact-constraint-${index}`}
                  className="flex min-h-11 items-start gap-3 rounded-lg border border-white/10 bg-background/30 px-3 py-3 text-sm text-muted-foreground"
                >
                  <input
                    id={`contact-constraint-${index}`}
                    type="checkbox"
                    name="constraints"
                    value={option}
                    autoComplete="off"
                    className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            <ErrorSlot id="contact-constraints-error" message={errors.constraints} />
          </fieldset>
        </div>
      </details>

      <div className="mt-5 h-36 overflow-y-auto">
        {summaryMessages.length > 0 ? (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            aria-labelledby="contact-error-summary-title"
            className="rounded-xl border border-danger/50 bg-danger/8 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]"
          >
            <p id="contact-error-summary-title" className="font-medium text-foreground">
              Review this request
            </p>
            <ul className="mt-2 space-y-1 text-sm text-danger">
              {summaryMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <TurnstileField
        ref={turnstileRef}
        action="contact"
        enabled={verificationEnabled}
        error={errors.turnstileToken}
        onTokenChange={setTurnstileToken}
      />

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        aria-busy={isPending}
        data-gn-event="contact-submit"
        className="mt-5 min-h-12 w-full rounded-[10px]"
      >
        {isPending ? (
          <>
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground motion-reduce:animate-none"
            />
            Submitting request…
          </>
        ) : (
          "Request assessment"
        )}
      </Button>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Do not include security-sensitive or confidential information.
      </p>
    </form>
  )
}

function ContactField({
  label,
  name,
  error,
  className = "",
  controlId,
  children,
}: {
  label: string
  name: string
  error?: string
  className?: string
  controlId?: string
  children: ReactNode
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label htmlFor={controlId ?? `contact-${name}`} className="mb-2 text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      <ErrorSlot id={`contact-${name}-error`} message={error} />
    </div>
  )
}

function OptionalSelect({
  id,
  label,
  name,
  error,
  options,
}: {
  id: string
  label: string
  name: string
  error?: string
  options: readonly string[]
}) {
  return (
    <ContactField label={label} name={name} controlId={id} error={error}>
      <NativeSelect
        id={id}
        name={name}
        autoComplete="off"
        defaultValue=""
        className="min-h-12 bg-background/35"
        aria-invalid={Boolean(error)}
        aria-describedby={`contact-${name}-error`}
      >
        <option value="">Not specified</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </NativeSelect>
    </ContactField>
  )
}

function ErrorSlot({ id, message }: { id: string; message?: string }) {
  return (
    <div className="h-12 overflow-y-auto pt-1 sm:h-7">
      <p
        id={id}
        className="text-sm text-danger"
        role={message ? "alert" : undefined}
      >
        {message ?? ""}
      </p>
    </div>
  )
}

function errorCategoryForStatus(
  status: number,
  fieldErrors?: Record<string, string>
): AnalyticsErrorCategory {
  if (fieldErrors && Object.keys(fieldErrors).length > 0) return "validation"
  if (status === 403) return "verification"
  if (status === 429) return "rate_limit"
  return "server"
}

function contactSuccessEventName(intent: LeadIntent): AnalyticsEventName {
  if (intent === "capacity-audit") return "capacity_audit_request_success"
  if (intent === "partnership") return "partner_inquiry_success"
  return "contact_submit_success"
}
