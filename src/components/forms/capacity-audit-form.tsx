"use client"

import { type FormEvent, useRef, useState } from "react"

import { buyerTypes, siteTypes, timelineOptions } from "@/lib/constants"
import { capacityAuditSchema, mapZodErrors } from "@/lib/validators"

import { buildCapacityAuditCandidate } from "@/components/forms/lead-form-data"
import { NativeSelect } from "@/components/forms/native-select"
import {
  TurnstileField,
  type TurnstileFieldHandle,
} from "@/components/forms/turnstile-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type CapacityAuditFormProps = {
  intent: "capacity-audit" | "shadow-mode" | "sellable-capacity" | "partnership"
  source: string
}

export function CapacityAuditForm({
  intent,
  source,
}: CapacityAuditFormProps) {
  const startedAt = useRef(Date.now())
  const inFlight = useRef(false)
  const turnstileRef = useRef<TurnstileFieldHandle>(null)
  const [clientSubmissionId] = useState(() => crypto.randomUUID())
  const [turnstileToken, setTurnstileToken] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, setIsPending] = useState(false)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (inFlight.current) {
      return
    }

    const candidate = buildCapacityAuditCandidate(new FormData(event.currentTarget), {
      schemaVersion: 1,
      formType: "capacity_audit",
      clientSubmissionId,
      turnstileToken,
      intent,
      source,
      startedAt: startedAt.current,
    })
    const parsed = capacityAuditSchema.safeParse(candidate)

    if (!parsed.success) {
      setErrors(mapZodErrors(parsed))
      return
    }

    setErrors({})
    inFlight.current = true
    setIsPending(true)
    setServerMessage(null)

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
        turnstileRef.current?.reset()
        return
      }

      setSubmissionId(payload.submissionId)
    } catch {
      setServerMessage("Unable to submit the request.")
      turnstileRef.current?.reset()
    } finally {
      inFlight.current = false
      setIsPending(false)
    }
  }

  if (submissionId) {
    return (
      <div
        className="rounded-[1.8rem] border border-border/70 bg-surface p-6"
        role="status"
      >
        <p className="text-sm tracking-[0.28em] text-primary uppercase">
          Request received
        </p>
        <h3 className="mt-4 text-[2.1rem] font-medium text-foreground">
          Capacity Audit intake submitted
        </h3>
        <p className="mt-4 max-w-xl text-base leading-8 text-muted-foreground">
          We&apos;ll use this to frame the first pass on stranded headroom, recurring
          constraints, and the best path into Shadow Mode.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Reference:{" "}
          <span className="font-mono text-foreground">{submissionId}</span>
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="gn-lead-form rounded-[1.8rem] border border-border/70 bg-surface p-6"
    >
      <div className="hidden" aria-hidden="true">
        <label htmlFor="audit-website">Website</label>
        <input
          id="audit-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="audit-name" className="text-base text-foreground">
            Name
          </label>
          <Input
            id="audit-name"
            name="name"
            required
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "audit-name-error" : undefined}
          />
          {errors.name ? (
            <p id="audit-name-error" className="text-base text-danger" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="audit-company" className="text-base text-foreground">
            Company
          </label>
          <Input
            id="audit-company"
            name="company"
            required
            autoComplete="organization"
            aria-invalid={Boolean(errors.company)}
            aria-describedby={errors.company ? "audit-company-error" : undefined}
          />
          {errors.company ? (
            <p id="audit-company-error" className="text-base text-danger" role="alert">
              {errors.company}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="audit-email" className="text-base text-foreground">
            Email
          </label>
          <Input
            id="audit-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "audit-email-error" : undefined}
          />
          {errors.email ? (
            <p id="audit-email-error" className="text-base text-danger" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label
            id="audit-buyer-type-label"
            htmlFor="audit-buyer-type"
            className="text-base text-foreground"
          >
            Buyer type
          </label>
          <NativeSelect
            id="audit-buyer-type"
            name="buyerType"
            required
            autoComplete="off"
            defaultValue=""
            aria-invalid={Boolean(errors.buyerType)}
            aria-describedby={
              errors.buyerType ? "audit-buyer-type-error" : undefined
            }
          >
            <option value="" disabled>
              Select buyer type
            </option>
            {buyerTypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
          {errors.buyerType ? (
            <p
              id="audit-buyer-type-error"
              className="text-base text-danger"
              role="alert"
            >
              {errors.buyerType}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label
            id="audit-site-type-label"
            htmlFor="audit-site-type"
            className="text-base text-foreground"
          >
            Site type
          </label>
          <NativeSelect
            id="audit-site-type"
            name="siteType"
            required
            autoComplete="off"
            defaultValue=""
            aria-invalid={Boolean(errors.siteType)}
            aria-describedby={
              errors.siteType ? "audit-site-type-error" : undefined
            }
          >
            <option value="" disabled>
              Select site type
            </option>
            {siteTypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
          {errors.siteType ? (
            <p
              id="audit-site-type-error"
              className="text-base text-danger"
              role="alert"
            >
              {errors.siteType}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label
            id="audit-timeline-label"
            htmlFor="audit-timeline"
            className="text-base text-foreground"
          >
            Desired timeline
          </label>
          <NativeSelect
            id="audit-timeline"
            name="timeline"
            required
            autoComplete="off"
            defaultValue=""
            aria-invalid={Boolean(errors.timeline)}
            aria-describedby={
              errors.timeline ? "audit-timeline-error" : undefined
            }
          >
            <option value="" disabled>
              Select timeline
            </option>
            {timelineOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>
          {errors.timeline ? (
            <p
              id="audit-timeline-error"
              className="text-base text-danger"
              role="alert"
            >
              {errors.timeline}
            </p>
          ) : null}
        </div>
      </div>
      {serverMessage ? (
        <p className="mt-4 text-base text-danger" role="alert">
          {serverMessage}
        </p>
      ) : null}
      <TurnstileField
        ref={turnstileRef}
        action="capacity_audit"
        error={errors.turnstileToken}
        onTokenChange={setTurnstileToken}
      />
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-base leading-8 text-muted-foreground">
          Do not submit confidential site drawings, credentials, customer data,
          or security-sensitive topology through this form.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          data-gn-event="capacity-audit-submit"
        >
          {isPending ? "Submitting..." : "Request Capacity Audit"}
        </Button>
      </div>
    </form>
  )
}
