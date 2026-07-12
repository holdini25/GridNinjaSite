import { z } from "zod"

import {
  buyerTypes,
  constraintOptions,
  leadIntents,
  siteTypes,
  timelineOptions,
} from "@/lib/constants"

const ASCII_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

function withoutAsciiControlCharacters<T extends z.ZodString>(schema: T) {
  return schema.refine(
    (value) => !ASCII_CONTROL_CHARACTERS.test(value),
    "Remove control characters from this field."
  )
}

const buyerTypeSchema = z.enum(buyerTypes)
const siteTypeSchema = z.enum(siteTypes)
const timelineSchema = z.enum(timelineOptions)
const leadIntentSchema = z.enum(leadIntents)

const commonLeadShape = {
  schemaVersion: z.literal(1),
  clientSubmissionId: z.uuid("Invalid submission reference."),
  turnstileToken: withoutAsciiControlCharacters(
    z
      .string()
      .trim()
      .min(1, "Complete the security verification.")
      .max(2048, "Security verification is invalid.")
  ),
  name: withoutAsciiControlCharacters(
    z.string().trim().min(2, "Enter your name.").max(120, "Name is too long.")
  ),
  company: withoutAsciiControlCharacters(
    z
      .string()
      .trim()
      .min(2, "Enter your company.")
      .max(160, "Company name is too long.")
  ),
  email: withoutAsciiControlCharacters(
    z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .max(254, "Email is too long.")
  ),
  buyerType: buyerTypeSchema,
  siteType: siteTypeSchema,
  timeline: timelineSchema,
  intent: leadIntentSchema,
  source: withoutAsciiControlCharacters(
    z
      .string()
      .trim()
      .min(2, "Missing lead source.")
      .max(120, "Lead source is too long.")
  ),
  website: z.string().trim().max(0).optional(),
  startedAt: z.number().int().positive(),
} satisfies z.ZodRawShape

export const capacityAuditSchema = z.object({
  ...commonLeadShape,
  formType: z.literal("capacity_audit"),
})

export const contactLeadSchema = z.object({
  ...commonLeadShape,
  formType: z.literal("contact"),
  role: withoutAsciiControlCharacters(
    z.string().trim().min(2, "Enter your role.").max(120, "Role is too long.")
  ),
  constraints: z
    .array(z.enum(constraintOptions))
    .max(8, "Select fewer constraints.")
    .min(1, "Select at least one current constraint."),
  message: withoutAsciiControlCharacters(
    z
      .string()
      .trim()
      .min(12, "Add a little more context for the site.")
      .max(2000, "Message is too long.")
  ),
})

export const leadSubmissionSchema = z.discriminatedUnion("formType", [
  contactLeadSchema,
  capacityAuditSchema,
])

export type CapacityAuditInput = z.infer<typeof capacityAuditSchema>
export type ContactLeadInput = z.infer<typeof contactLeadSchema>
export type LeadSubmissionInput = z.infer<typeof leadSubmissionSchema>
export type LeadDeliveryInput =
  | Omit<CapacityAuditInput, "website" | "startedAt" | "turnstileToken">
  | Omit<ContactLeadInput, "website" | "startedAt" | "turnstileToken">

export function stripLeadSecurityFields(
  submission: LeadSubmissionInput
): LeadDeliveryInput {
  const { website, startedAt, turnstileToken, ...leadSubmission } = submission

  void website
  void startedAt
  void turnstileToken

  return leadSubmission
}

export function mapZodErrors<T extends z.ZodType>(
  result: z.ZodSafeParseError<z.input<T>>
) {
  const fieldErrors: Record<string, string> = {}

  for (const issue of result.error.issues) {
    const key = issue.path[0]

    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message
    }
  }

  return fieldErrors
}
