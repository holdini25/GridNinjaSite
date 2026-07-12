import "server-only"

import { Client } from "@upstash/qstash"

import type { ContactRuntimeConfig } from "@/lib/contact/config"

export async function publishLeadDeliveryWake(
  config: ContactRuntimeConfig,
  outboxIds: readonly string[]
) {
  if (outboxIds.length === 0) return []

  const qstash = new Client({ token: config.qstashToken })
  const destination = `${config.publicBaseUrl}/api/internal/lead-delivery`

  return Promise.all(
    outboxIds.map((outboxId) =>
      qstash.publishJSON({
        url: destination,
        body: { outboxId },
        retries: 3,
        timeout: "15s",
      })
    )
  )
}
