"use client"

import {
  type FocusEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import {
  type ContactConversationType,
  constraintOptions,
  siteTypes,
  timelineOptions,
} from "@/lib/constants"
import type { ContactLeadInput } from "@/lib/validators"
import { loadContactValidation } from "@/components/forms/contact-validation-loader"
import { isLeadSource } from "@/lib/lead"
import {
  CONTACT_REFERENCE_LIFETIME_MS, clearContactAttempt, contactAttemptStorageKey,
  fingerprintContactCandidate, parseStoredAttempt, parseStoredReceipt, readContactStorage,
  sendContactInquiry, storeContactReceipt, writeContactStorage, parseRejectedResponse,
  type ContactAttempt, type ContactReceipt,
} from "@/components/forms/contact-receipt"
import type { LeadIntent } from "@/types/site"

import {
  contactSubmissionStorageKey,
  conversationTypeForIntent,
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
  { label: "Capacity assessment", value: "capacity-audit" },
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

const subscribeToHydration = () => () => undefined

export function ContactForm({
  source: defaultSource = "contact-page",
  initialIntent = "capacity-audit",
}: { source?: string; initialIntent?: LeadIntent } = {}) {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false)
  const startedAt = useRef(Date.now())
  const inFlight = useRef(false)
  const validationInFlight = useRef(false)
  const inputRevision = useRef(0)
  const formStarted = useRef(false)
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const receiptRef = useRef<HTMLDivElement>(null)
  const turnstileRef = useRef<TurnstileFieldHandle>(null)
  const [clientSubmissionId, setClientSubmissionId] = useState(() => crypto.randomUUID())
  const [intent, setIntent] = useState<LeadIntent>(initialIntent)
  const [conversationType, setConversationType] = useState<ContactConversationType>(() => conversationTypeForIntent(initialIntent))
  const [source, setSource] = useState(defaultSource)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [verificationEnabled, setVerificationEnabled] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, setIsPending] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const isBusy = isPending || isValidating
  const [serverMessage, setServerMessage] = useState<string | null>(null)
  const [errorFocusVersion, setErrorFocusVersion] = useState(0)
  const [uncertain, setUncertain] = useState(false)
  const [expiredAttempt, setExpiredAttempt] = useState(false)
  const [receipt, setReceipt] = useState<ContactReceipt | null>(null)
  const attemptRef = useRef<ContactAttempt | null>(null)
  const originalPayloadRef = useRef<Omit<ContactLeadInput, "turnstileToken"> | null>(null)
  const countedReceipts = useRef(new Set<string>())

  useEffect(() => {
    const stored = readContactStorage(contactAttemptStorageKey)
    const attempt = parseStoredAttempt(stored)
    const attribution = resolveContactAttribution(window.location.search, {
      intent: attempt?.intent ?? initialIntent, source: attempt?.source ?? defaultSource,
    })
    setIntent(attempt?.intent ?? attribution.intent)
    setConversationType(attempt ? conversationTypeForIntent(attempt.intent) : attribution.conversationType)
    setSource(attempt?.source ?? attribution.source)
    if (attempt) {
      attemptRef.current = attempt
      setClientSubmissionId(attempt.clientSubmissionId)
      startedAt.current = attempt.startedAt
      setUncertain(true)
      setServerMessage("A previous inquiry has no confirmed receipt in this tab. Re-enter the original details to retry with its existing reference, or explicitly start another inquiry.")
    } else if (stored) {
      setExpiredAttempt(true)
      setServerMessage("The previous inquiry reference has expired or cannot be recovered. That does not prove nonreceipt. Starting another inquiry may create a duplicate.")
    }
  }, [defaultSource, initialIntent])

  useEffect(() => { if (errorFocusVersion > 0) errorSummaryRef.current?.focus() }, [errorFocusVersion])
  useEffect(() => { if (receipt) receiptRef.current?.focus() }, [receipt])

  function startForm() {
    inputRevision.current += 1
    setVerificationEnabled(true)
    if (formStarted.current) return
    formStarted.current = true
    trackGridNinjaEvent("contact_form_start", { source, intent })
  }

  function buildCandidate(form: HTMLFormElement) {
    return buildContactLeadCandidate(new FormData(form), {
      schemaVersion: 2, formType: "contact", clientSubmissionId,
      turnstileToken, intent, source, startedAt: startedAt.current,
    })
  }

  async function handleBlur(event: FocusEvent<HTMLFormElement>) {
    const target = event.target
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return
    if (!blurValidatedFields.has(target.name) || inFlight.current || validationInFlight.current) return
    const name = target.name
    const candidate = buildCandidate(event.currentTarget)
    const revision = inputRevision.current
    try {
      const { contactLeadSchema, mapZodErrors } = await loadContactValidation()
      if (revision !== inputRevision.current || inFlight.current || validationInFlight.current) return
      const parsed = contactLeadSchema.safeParse(candidate)
      const nextMessage = parsed.success ? undefined : mapZodErrors(parsed)[name]
      setErrors(current => {
        const next = { ...current }
        if (nextMessage) next[name] = nextMessage
        else delete next[name]
        return next
      })
    } catch {
      // Submission provides a visible recovery message if validation cannot load.
    }
  }

  function handleConversationChange(value: string) {
    if (!isContactConversationType(value)) return
    setConversationType(value)
    setIntent(intentAfterConversationSelection(value))
  }

  function reportError(category: AnalyticsErrorCategory) {
    trackGridNinjaEvent("contact_form_error", { source, intent, errorCategory: category, success: false })
  }
  function focusErrorSummary() { setErrorFocusVersion(version => version + 1) }

  function startAnotherInquiry() {
    if (inFlight.current || validationInFlight.current) return
    inputRevision.current += 1
    clearContactAttempt()
    attemptRef.current = null
    originalPayloadRef.current = null
    setClientSubmissionId(crypto.randomUUID())
    startedAt.current = Date.now()
    setUncertain(false)
    setExpiredAttempt(false)
    setErrors({})
    setServerMessage("A new inquiry reference is ready. Your previous inquiry may still have been received.")
    turnstileRef.current?.reset()
  }

  async function submitCandidate(candidate: ContactLeadInput) {
    if (inFlight.current) return
    inFlight.current = true
    setIsPending(true)
    setErrors({})
    setServerMessage(null)
    try {
      const fingerprint = await fingerprintContactCandidate(candidate)
      if (attemptRef.current && attemptRef.current.fingerprint !== fingerprint) {
        setUncertain(true)
        setServerMessage("These details differ from the original inquiry. Retry the original details or choose Start another inquiry to use a new reference.")
        reportError("conflict")
        focusErrorSummary()
        return
      }
      if (!isLeadSource(candidate.source)) throw new Error("Invalid source")
      const attempt: ContactAttempt = attemptRef.current ?? {
        version: 1, clientSubmissionId: candidate.clientSubmissionId, fingerprint,
        intent: candidate.intent, source: candidate.source, startedAt: candidate.startedAt,
        expiresAt: candidate.startedAt + CONTACT_REFERENCE_LIFETIME_MS,
      }
      if (attempt.expiresAt <= Date.now()) {
        setExpiredAttempt(true)
        setServerMessage("This inquiry reference has expired. Expiry does not prove nonreceipt. Explicitly start another inquiry to continue.")
        focusErrorSummary()
        return
      }
      attemptRef.current = attempt
      // Verification can expire or be consumed by a request that later fails.
      // Keep the business payload and inquiry identity immutable, not its token.
      const { turnstileToken: verificationToken, ...retryPayload } = candidate
      void verificationToken
      originalPayloadRef.current = retryPayload
      writeContactStorage(contactAttemptStorageKey, attempt)
      trackGridNinjaEvent("contact_form_submit", { source, intent })
      const result = await sendContactInquiry(candidate)
      if (result.receipt) {
        const previous = parseStoredReceipt(readContactStorage(contactSubmissionStorageKey))
        if (!countedReceipts.current.has(result.receipt.submissionId) && previous?.submissionId !== result.receipt.submissionId) {
          countedReceipts.current.add(result.receipt.submissionId)
          trackGridNinjaEvent(contactSuccessEventName(candidate.intent), { source, intent: candidate.intent, success: true })
        }
        const confirmed = storeContactReceipt(result.receipt.submissionId, candidate.intent)
        attemptRef.current = null
        originalPayloadRef.current = null
        setReceipt(confirmed)
        setUncertain(false)
        return
      }
      const rejected = parseRejectedResponse(result.body)
      if (result.status >= 400 && result.status < 500 && rejected) {
        setErrors(rejected.fieldErrors ?? {})
        setServerMessage(rejected.message ?? "Unable to accept this inquiry. Review the form and try again.")
        if (result.status === 409) {
          setUncertain(true)
          setServerMessage("This reference belongs to different inquiry details. Retry the original inquiry or explicitly start another inquiry.")
        } else if (!uncertain) {
          // A definite rejection of a first attempt permits correction. An earlier
          // uncertain attempt remains recoverable even when this retry is rejected.
          clearContactAttempt()
          attemptRef.current = null
          originalPayloadRef.current = null
        }
        reportError(errorCategoryForStatus(result.status, rejected.fieldErrors))
        turnstileRef.current?.reset()
      } else {
        setUncertain(true)
        setServerMessage("Receipt is unconfirmed. The inquiry may have been received. Retry the original inquiry with the same reference before starting another.")
        reportError("server")
      }
      focusErrorSummary()
    } catch {
      setUncertain(true)
      setServerMessage("Receipt is unconfirmed. The connection ended or timed out; the inquiry may have been received. Retry the original inquiry with the same reference.")
      reportError("network")
      focusErrorSummary()
    } finally {
      inFlight.current = false
      setIsPending(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startForm()
    if (!hydrated || inFlight.current || validationInFlight.current || expiredAttempt) return
    // Capture autofill/current DOM values before the async import and before
    // controls are disabled. No transport occurs until the unchanged schema passes.
    const candidate = buildCandidate(event.currentTarget)
    validationInFlight.current = true
    setIsValidating(true)
    setServerMessage(null)
    try {
      const { contactLeadSchema, mapZodErrors } = await loadContactValidation()
      const parsed = contactLeadSchema.safeParse(candidate)
      if (!parsed.success) {
        const nextErrors = mapZodErrors(parsed)
        setErrors(nextErrors)
        setServerMessage("Review the highlighted fields before submitting.")
        reportError(Object.keys(nextErrors).every(field => field === "turnstileToken") ? "verification" : "validation")
        focusErrorSummary()
        return
      }
      setIsValidating(false)
      await submitCandidate(parsed.data)
    } catch {
      setServerMessage("Form validation could not load. Your details remain here and no new request was sent. Check the connection and try again; reload if the problem continues.")
      reportError("network")
      focusErrorSummary()
    } finally {
      validationInFlight.current = false
      setIsValidating(false)
    }
  }

  if (receipt) {
    return <div ref={receiptRef} tabIndex={-1} role="status" className="rounded-2xl border border-primary/50 bg-surface p-6 outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <h2 className="text-2xl font-medium">Inquiry received</h2>
      <p className="mt-3 leading-7 text-muted-foreground">Your inquiry is recorded for review. This receipt confirms intake; it does not confirm engagement fit, email delivery, an assessment purchase, or permission to operate equipment.</p>
      <p className="mt-4 break-all text-sm">Reference: <span className="font-mono">{receipt.submissionId}</span></p>
      <p className="mt-3 text-sm text-muted-foreground">Keep this reference. Browser recovery is limited to this tab for 24 hours and may be unavailable when storage is blocked.</p>
    </div>
  }

  const summaryMessage =
    serverMessage ??
    (Object.keys(errors).length > 0
      ? "Review the highlighted fields before submitting your request again."
      : null)

  return (
    <form
      onSubmit={handleSubmit}
      onBlur={handleBlur}
      onInput={startForm}
      onFocusCapture={() => setVerificationEnabled(true)}
      action="/api/contact"
      method="post"
      encType="application/x-www-form-urlencoded"
      noValidate
      aria-busy={isBusy}
      className="gn-lead-form rounded-2xl border border-white/10 bg-[#0D151C] p-5 [--ring:#22D3EE] sm:p-7"
    >
      <noscript><p className="mb-5 leading-7">This form needs JavaScript and security verification to submit safely. Enable JavaScript and reload this page. No inquiry has been sent by opening this page.</p></noscript>
      <fieldset disabled={!hydrated || isBusy || (uncertain && Boolean(originalPayloadRef.current)) || expiredAttempt} className="min-w-0">
      <legend className="sr-only">Assessment inquiry details</legend>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="gn-eyebrow">Scope an assessment</p>
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
            autoComplete="off"
            className="min-h-36 resize-y bg-background/35"
            aria-invalid={Boolean(errors.message)}
            aria-describedby="contact-message-helper contact-message-error"
          />
          <p
            id="contact-message-helper"
            className="mt-2 text-sm leading-6 text-muted-foreground"
          >
            Optional. Describe the operating decision, capacity claim, recurring constraint,
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

      </fieldset>

      <div className="mt-5 min-h-24">
        {summaryMessage ? (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            aria-labelledby="contact-error-summary-title"
            className="flex min-h-24 flex-col justify-center rounded-xl border border-danger/50 bg-danger/8 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]"
          >
            <p id="contact-error-summary-title" className="font-medium text-foreground">
              Review this request
            </p>
            <p className="mt-1 text-sm leading-5 text-danger">{summaryMessage}</p>
          </div>
        ) : null}
      </div>

      {(uncertain || expiredAttempt) ? <div className="mt-4 flex flex-wrap gap-3">
        {originalPayloadRef.current && !expiredAttempt ? <Button type="button" disabled={isBusy || !turnstileToken} onClick={() => {
          const original = originalPayloadRef.current
          if (original && turnstileToken) void submitCandidate({ ...original, turnstileToken })
        }}>Retry original inquiry</Button> : null}
        <Button type="button" variant="outline" disabled={isBusy} onClick={startAnotherInquiry}>Start another inquiry</Button>
        {originalPayloadRef.current && !expiredAttempt && !turnstileToken ? <p className="text-sm leading-6 text-muted-foreground">Complete security verification again to retry the original inquiry with its existing reference.</p> : null}
        <p className="text-sm leading-6 text-muted-foreground">Starting another inquiry creates a new reference and may duplicate an earlier inquiry whose receipt is unconfirmed.</p>
      </div> : null}

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
        disabled={!hydrated || isBusy || expiredAttempt || (uncertain && Boolean(originalPayloadRef.current))}
        aria-busy={isBusy}
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
          isValidating ? "Checking details…" : uncertain ? "Retry original details" : "Scope an assessment"
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
  if (status === 409) return "conflict"
  return "server"
}

function contactSuccessEventName(intent: LeadIntent): AnalyticsEventName {
  if (intent === "capacity-audit") return "capacity_audit_request_success"
  if (intent === "partnership") return "partner_inquiry_success"
  return "contact_submit_success"
}
