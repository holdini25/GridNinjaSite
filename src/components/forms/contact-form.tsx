"use client"

import { type FormEvent, useMemo, useState } from "react"

import {
  buyerTypes,
  constraintOptions,
  intentLabels,
  siteTypes,
  timelineOptions,
} from "@/lib/constants"
import { contactLeadSchema, mapZodErrors } from "@/lib/validators"
import type { LeadIntent } from "@/types/site"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type ContactFormProps = {
  intent: LeadIntent
  source: string
}

export function ContactForm({ intent, source }: ContactFormProps) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    role: "",
    email: "",
    buyerType: "",
    siteType: "",
    timeline: "",
    constraints: [] as string[],
    message: "",
    intent,
    source,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, setIsPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  const successCopy = useMemo(() => {
    if (intent === "shadow-mode") {
      return "We’ll use this to scope the Shadow Mode walkthrough, the evidence package, and the right operating context."
    }

    if (intent === "sellable-capacity") {
      return "We’ll use this to frame a sellable-capacity assessment and the proof package needed for constrained-market stakeholders."
    }

    if (intent === "partnership") {
      return "We’ll use this to frame the partnership workflow, integration surface, and proof artifacts involved."
    }

    if (intent === "book-demo") {
      return "We’ll use this to frame the proof demo around the stakeholder lens, artifact set, and operating constraint you care about."
    }

    if (intent === "dcii-memo") {
      return "We’ll use this to route the DCII memo request and follow up with the deployment boundary, evidence outputs, and source notes."
    }

    if (intent === "load-passport") {
      return "We’ll use this to frame the Load Passport sample around your site type, proof gap, and review audience."
    }

    return "We’ll use this to frame the first Capacity Audit, the recurring constraints, and the path into Shadow Mode evidence."
  }, [intent])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = contactLeadSchema.safeParse(form)

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

  function toggleConstraint(option: string, checked: boolean | "indeterminate") {
    setForm((current) => ({
      ...current,
      constraints:
        checked === true
          ? Array.from(new Set([...current.constraints, option]))
          : current.constraints.filter((value) => value !== option),
    }))
  }

  if (submitted) {
    return (
      <div className="rounded-[1.8rem] border border-border/70 bg-surface p-6">
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
      className="rounded-[1.8rem] border border-border/70 bg-surface p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-name" className="text-base text-foreground">
            Name
          </label>
          <Input
            id="contact-name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? <p className="text-base text-danger">{errors.name}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-company" className="text-base text-foreground">
            Company
          </label>
          <Input
            id="contact-company"
            value={form.company}
            onChange={(event) =>
              setForm((current) => ({ ...current, company: event.target.value }))
            }
            aria-invalid={Boolean(errors.company)}
          />
          {errors.company ? (
            <p className="text-base text-danger">{errors.company}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-role" className="text-base text-foreground">
            Role
          </label>
          <Input
            id="contact-role"
            value={form.role}
            onChange={(event) =>
              setForm((current) => ({ ...current, role: event.target.value }))
            }
            aria-invalid={Boolean(errors.role)}
          />
          {errors.role ? <p className="text-base text-danger">{errors.role}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="contact-email" className="text-base text-foreground">
            Email
          </label>
          <Input
            id="contact-email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email ? (
            <p className="text-base text-danger">{errors.email}</p>
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
          <Select
            value={form.buyerType}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, buyerType: value }))
            }
          >
            <SelectTrigger
              id="contact-buyer-type"
              aria-labelledby="contact-buyer-type-label contact-buyer-type"
              aria-invalid={Boolean(errors.buyerType)}
            >
              <SelectValue placeholder="Select buyer type" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {buyerTypes.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {errors.buyerType ? (
            <p className="text-base text-danger">{errors.buyerType}</p>
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
          <Select
            value={form.siteType}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, siteType: value }))
            }
          >
            <SelectTrigger
              id="contact-site-type"
              aria-labelledby="contact-site-type-label contact-site-type"
              aria-invalid={Boolean(errors.siteType)}
            >
              <SelectValue placeholder="Select site type" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {siteTypes.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {errors.siteType ? (
            <p className="text-base text-danger">{errors.siteType}</p>
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
          <Select
            value={form.timeline}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, timeline: value }))
            }
          >
            <SelectTrigger
              id="contact-timeline"
              aria-labelledby="contact-timeline-label contact-timeline"
              aria-invalid={Boolean(errors.timeline)}
            >
              <SelectValue placeholder="Select timeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {timelineOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {errors.timeline ? (
            <p className="text-base text-danger">{errors.timeline}</p>
          ) : null}
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="text-base text-foreground">Current constraints</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {constraintOptions.map((option) => (
            <label
              key={option}
              className="flex items-start gap-3 rounded-[1rem] border border-border/70 bg-surface-2 px-4 py-4 text-base text-muted-foreground"
            >
              <Checkbox
                checked={form.constraints.includes(option)}
                onCheckedChange={(checked) => toggleConstraint(option, checked)}
                aria-invalid={Boolean(errors.constraints)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {errors.constraints ? (
          <p className="mt-3 text-base text-danger">{errors.constraints}</p>
        ) : null}
      </fieldset>

      <div className="mt-6 flex flex-col gap-2">
        <label htmlFor="contact-message" className="text-base text-foreground">
          Message
        </label>
        <Textarea
          id="contact-message"
          value={form.message}
          onChange={(event) =>
            setForm((current) => ({ ...current, message: event.target.value }))
          }
          aria-invalid={Boolean(errors.message)}
          className="min-h-36"
        />
        {errors.message ? (
          <p className="text-base text-danger">{errors.message}</p>
        ) : null}
      </div>

      {serverMessage ? (
        <p className="mt-4 text-base text-danger">{serverMessage}</p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-base leading-8 text-muted-foreground">
          Intent and source stay attached to the submission so downstream delivery
          can be wired without changing the UI contract.
        </p>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Submitting..." : "Start the conversation"}
        </Button>
      </div>
    </form>
  )
}
