import { z } from "zod"

import {
  buyerTypes,
  constraintOptions,
  leadIntents,
  siteTypes,
  timelineOptions,
} from "@/lib/constants"

const buyerTypeSchema = z.enum(buyerTypes)
const siteTypeSchema = z.enum(siteTypes)
const timelineSchema = z.enum(timelineOptions)
const leadIntentSchema = z.enum(leadIntents)

const baseLeadSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120, "Name is too long."),
  company: z
    .string()
    .trim()
    .min(2, "Enter your company.")
    .max(160, "Company name is too long."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254, "Email is too long."),
  buyerType: buyerTypeSchema,
  siteType: siteTypeSchema,
  timeline: timelineSchema,
  intent: leadIntentSchema,
  source: z
    .string()
    .trim()
    .min(2, "Missing lead source.")
    .max(120, "Lead source is too long."),
  website: z.string().trim().max(0).optional(),
  startedAt: z.number().int().positive().optional(),
})

export const capacityAuditSchema = baseLeadSchema

export const contactLeadSchema = baseLeadSchema.extend({
  role: z
    .string()
    .trim()
    .min(2, "Enter your role.")
    .max(120, "Role is too long."),
  constraints: z
    .array(z.enum(constraintOptions))
    .max(8, "Select fewer constraints.")
    .min(1, "Select at least one current constraint."),
  message: z
    .string()
    .trim()
    .min(12, "Add a little more context for the site.")
    .max(2000, "Message is too long."),
})

export const leadSubmissionSchema = baseLeadSchema
  .omit({ website: true, startedAt: true })
  .extend({
  role: z.string().trim().min(2).optional(),
  constraints: z.array(z.enum(constraintOptions)).max(8).optional(),
  message: z.string().trim().min(12).max(2000).optional(),
})

export type CapacityAuditInput = z.infer<typeof capacityAuditSchema>
export type ContactLeadInput = z.infer<typeof contactLeadSchema>
export type LeadSubmissionInput = z.infer<typeof leadSubmissionSchema>

export function stripLeadSecurityFields(
  submission: CapacityAuditInput | ContactLeadInput
): LeadSubmissionInput {
  const { website, startedAt, ...leadSubmission } = submission

  void website
  void startedAt

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
