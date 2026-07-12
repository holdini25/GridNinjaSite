import "server-only"

type ContactLogValue = string | number | boolean | null | undefined

export function logContactEvent(
  level: "info" | "warn" | "error",
  event: string,
  attributes: Record<string, ContactLogValue> = {}
) {
  const payload = JSON.stringify({
    event,
    occurredAt: new Date().toISOString(),
    ...attributes,
  })

  if (level === "error") {
    console.error(payload)
    return
  }

  if (level === "warn") {
    console.warn(payload)
    return
  }

  console.info(payload)
}

export function classifyContactError(error: unknown) {
  if (error instanceof Error) {
    return error.name || "Error"
  }

  return "UnknownError"
}

