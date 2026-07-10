import { DispatchEnvelopeExportSchema } from "@/schemas/dispatch-envelope.schema"
import type { DispatchEnvelopeDTO } from "@/types/dispatch-envelope"

import { assertDispatchEnvelopeInvariants } from "./invariants"

export function serializeDispatchEnvelopeExport(input: unknown) {
  const dto = DispatchEnvelopeExportSchema.parse(input) as DispatchEnvelopeDTO
  assertDispatchEnvelopeInvariants(dto)
  return `${JSON.stringify(sortValue(dto), null, 2)}\n`
}

export function sanitizeDispatchExportFilename(value: string) {
  const safe = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)
  return safe || "scenario"
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortValue(item)]))
  return value
}
