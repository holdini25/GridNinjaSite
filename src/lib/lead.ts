import type { LeadIntent } from "@/types/site"

export function buildLeadHref(
  intent: LeadIntent,
  source: string,
  context?: Record<string, string | undefined>
) {
  const params = new URLSearchParams({
    intent,
    source,
  })

  Object.entries(context ?? {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value)
    }
  })

  return `/contact?${params.toString()}`
}

export function getFirstQueryValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}
