"use client"

import { type FormEvent, useMemo, useRef, useState } from "react"

import {
  buyerTypes,
  constraintOptions,
  intentLabels,
  siteTypes,
  timelineOptions,
} from "@/lib/constants"
import { contactLeadSchema, mapZodErrors } from "@/lib/validators"
import type { LeadIntent } from "@/types/site"

import { buildContactLeadCandidate } from "@/components/forms/lead-form-data"
import { NativeSelect } from "@/components/forms/native-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type ContactFormProps = {
  intent: LeadIntent
  source: string
}

export function ContactForm({ intent, source }: ContactFormProps) {
  const startedAt = useRef(Date.now())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, setIsPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  const successCopy = useMemo(() => {
    if (intent === "shadow-mode") {
      return "We'll use this to scope the Shadow Mode walkthrough, the evidence package, and the right operating context."
    }

    if (intent === "sellable-capacity") {
      return "We'll use this to frame a sellable-capacity assessment and the proof package needed for constrained-market stakeholders."
    }

    if (intent === "partnership") {
      return "We'll use this to frame the partnership workflow, integration surface, and proof artifacts involved."
    }

    if (intent === "book-demo") {
      return "We'll use this to frame the proof demo around the stakeholder lens, artifact set, and operating constraint you care about."
    }

    if (intent === "dcii-memo") {
      return "We'll use this to route the DCII memo request and follow up with the deployment boundary, evidence outputs, and source notes."
    }

    if (intent === "load-passport") {
      return "We'll use this to frame the Load Passport sample around your site type, proof gap, and review audience."
    }

    return "We'll use this to frame the first Capacity Audit, the recurring constraints, and the path into Shadow Mode evidence."
  }, [intent])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const candidate = buildContactLeadCandidate(new FormData(event.currentTarget), {
      intent,
      source,
      startedAt: startedAt.current,
    })
    const parsed = contactLeadSchema.safeParse(candidate)

    if (!parsed.success) {
      setErrors(mapZodErrors(parsed))
      return
    }

    setErrors({})
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
        fieldErrors?: Record<string, string>
        message?: string
      }

      if (!response.ok || !payload.ok) {
        setErrors(payload.fieldErrors ?? {})
        setServerMessage(payload.message ?? "Unable to submit the request.")
        return
      }

      setSubmitted(true)
    } catch {
      setServerMessage("Unable to submit the request.")
    } finally {
      setIsPending(false)
    }
  }

  if (submitted) {
    return (
      <div
        className="rounded-[1.8rem] border border-border/70 bg-surface p-6"
        role="status"
      >
        <p className="text-sm tracking-[0.28em] text-primary uppercase">
          {intentLabels[intent]}
        </p>
        <h3 className="mt-4 text-[2.1rem] font-medium text-foreground">
          Intake submitted
        </h3>
        <p className="mt-4 max-w-xl text-base leading-8 text-muted-foreground">
          {successCopy}
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
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-name" className="text-base text-foreground">
            Name
          </label>
          <Input
            id="contact-name"
            name="name"
            required
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
          />
          {errors.name ? (
            <p id="contact-name-error" className="text-base text-danger" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-company" className="text-base text-foreground">
            Company
          </label>
          <Input
            id="contact-company"
            name="company"
            required
            autoComplete="organization"
            aria-invalid={Boolean(errors.company)}
            aria-describedby={errors.company ? "contact-company-error" : undefined}
          />
          {errors.company ? (
            <p id="contact-company-error" className="text-base text-danger" role="alert">
              {errors.company}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-role" className="text-base text-foreground">
            Role
          </label>
          <Input
            id="contact-role"
            name="role"
            required
            autoComplete="organization-title"
            aria-invalid={Boolean(errors.role)}
            aria-describedby={errors.role ? "contact-role-error" : undefined}
          />
          {errors.role ? (
            <p id="contact-role-error" className="text-base text-danger" role="alert">
              {errors.role}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-email" className="text-base text-foreground">
            Email
          </label>
          <Input
            id="contact-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
          />
          {errors.email ? (
            <p id="contact-email-error" className="text-base text-danger" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label
            id="contact-buyer-type-label"
            htmlFor="contact-buyer-type"
            className="text-base text-foreground"
          >
            Buyer type
          </label>
          <NativeSelect
            id="contact-buyer-type"
            name="buyerType"
            required
            autoComplete="off"
            defaultValue=""
            aria-invalid={Boolean(errors.buyerType)}
            aria-describedby={
              errors.buyerType ? "contact-buyer-type-error" : undefined
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
              id="contact-buyer-type-error"
              className="text-base text-danger"
              role="alert"
            >
              {errors.buyerType}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label
            id="contact-site-type-label"
            htmlFor="contact-site-type"
            className="text-base text-foreground"
          >
            Site type
          </label>
          <NativeSelect
            id="contact-site-type"
            name="siteType"
            required
            autoComplete="off"
            defaultValue=""
            aria-invalid={Boolean(errors.siteType)}
            aria-describedby={
              errors.siteType ? "contact-site-type-error" : undefined
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
              id="contact-site-type-error"
              className="text-base text-danger"
              role="alert"
            >
              {errors.siteType}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label
            id="contact-timeline-label"
            htmlFor="contact-timeline"
            className="text-base text-foreground"
          >
            Desired timeline
          </label>
          <NativeSelect
            id="contact-timeline"
            name="timeline"
            required
            autoComplete="off"
            defaultValue=""
            aria-invalid={Boolean(errors.timeline)}
            aria-describedby={
              errors.timeline ? "contact-timeline-error" : undefined
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
              id="contact-timeline-error"
              className="text-base text-danger"
              role="alert"
            >
              {errors.timeline}
            </p>
          ) : null}
        </div>
      </div>

      <fieldset
        className="mt-6"
        aria-required="true"
        aria-invalid={Boolean(errors.constraints)}
        aria-describedby={
          errors.constraints ? "contact-constraints-error" : undefined
        }
      >
        <legend className="text-base text-foreground">Current constraints</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {constraintOptions.map((option, index) => (
            <label
              key={option}
              htmlFor={`contact-constraint-${index}`}
              className="flex items-start gap-3 rounded-[1rem] border border-border/70 bg-surface-2 px-4 py-4 text-base text-muted-foreground"
            >
              <input
                id={`contact-constraint-${index}`}
                type="checkbox"
                name="constraints"
                value={option}
                autoComplete="off"
                aria-invalid={Boolean(errors.constraints)}
                className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {errors.constraints ? (
          <p
            id="contact-constraints-error"
            className="mt-3 text-base text-danger"
            role="alert"
          >
            {errors.constraints}
          </p>
        ) : null}
      </fieldset>

      <div className="mt-6 flex flex-col gap-2">
        <label htmlFor="contact-message" className="text-base text-foreground">
          Message
        </label>
        <Textarea
          id="contact-message"
          name="message"
          required
          autoComplete="off"
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          className="min-h-36"
        />
        {errors.message ? (
          <p id="contact-message-error" className="text-base text-danger" role="alert">
            {errors.message}
          </p>
        ) : null}
      </div>

      {serverMessage ? (
        <p className="mt-4 text-base text-danger" role="alert">
          {serverMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-base leading-8 text-muted-foreground">
          Do not submit confidential site drawings, credentials, customer data,
          or security-sensitive topology through this form.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          data-gn-event="contact-submit"
        >
          {isPending ? "Submitting..." : "Start the conversation"}
        </Button>
      </div>
    </form>
  )
}
