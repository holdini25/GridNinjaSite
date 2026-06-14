"use client"

import { type FormEvent, useState } from "react"

import { buyerTypes, siteTypes, timelineOptions } from "@/lib/constants"
import { capacityAuditSchema, mapZodErrors } from "@/lib/validators"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type CapacityAuditFormProps = {
  intent: "capacity-audit" | "shadow-mode" | "sellable-capacity" | "partnership"
  source: string
}

export function CapacityAuditForm({
  intent,
  source,
}: CapacityAuditFormProps) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    buyerType: "",
    siteType: "",
    timeline: "",
    intent,
    source,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, setIsPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverMessage, setServerMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = capacityAuditSchema.safeParse(form)

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
      <div className="rounded-[1.8rem] border border-border/70 bg-surface p-6">
        <p className="text-sm tracking-[0.28em] text-primary uppercase">
          Request received
        </p>
        <h3 className="mt-4 text-[2.1rem] font-medium text-foreground">
          Capacity Audit intake submitted
        </h3>
        <p className="mt-4 max-w-xl text-base leading-8 text-muted-foreground">
          We’ll use this to frame the first pass on stranded headroom, recurring
          constraints, and the best path into Shadow Mode.
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
          <label htmlFor="audit-name" className="text-base text-foreground">
            Name
          </label>
          <Input
            id="audit-name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? (
            <p className="text-base text-danger">{errors.name}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="audit-company" className="text-base text-foreground">
            Company
          </label>
          <Input
            id="audit-company"
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
          <label htmlFor="audit-email" className="text-base text-foreground">
            Email
          </label>
          <Input
            id="audit-email"
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
            id="audit-buyer-type-label"
            htmlFor="audit-buyer-type"
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
              id="audit-buyer-type"
              aria-labelledby="audit-buyer-type-label audit-buyer-type"
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
            id="audit-site-type-label"
            htmlFor="audit-site-type"
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
              id="audit-site-type"
              aria-labelledby="audit-site-type-label audit-site-type"
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
        <div className="flex flex-col gap-2">
          <label
            id="audit-timeline-label"
            htmlFor="audit-timeline"
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
              id="audit-timeline"
              aria-labelledby="audit-timeline-label audit-timeline"
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
      {serverMessage ? (
        <p className="mt-4 text-base text-danger">{serverMessage}</p>
      ) : null}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-base leading-8 text-muted-foreground">
          This phase-one form records the request internally and keeps delivery
          wiring isolated behind the API route.
        </p>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Submitting..." : "Request Capacity Audit"}
        </Button>
      </div>
    </form>
  )
}
