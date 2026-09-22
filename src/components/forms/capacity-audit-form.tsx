"use client"

import { ContactForm } from "@/components/forms/contact-form"

type CapacityAuditFormProps = {
  intent: "capacity-audit" | "shadow-mode" | "sellable-capacity" | "partnership"
  source: string
}

// Existing callers retain their attribution; public intake shares the same
// receipt/recovery behavior. The API continues to accept legacy v1 payloads.
export function CapacityAuditForm({ intent, source }: CapacityAuditFormProps) {
  return <ContactForm initialIntent={intent} source={source} />
}
