import "server-only"

import { Receiver } from "@upstash/qstash"

import {
  ContactConfigurationError,
  getContactRuntimeConfig,
} from "@/lib/contact/config"
import { classifyContactError, logContactEvent } from "@/lib/contact/log"
import { ContactPayloadTooLargeError, ContactPayloadTimeoutError, readBodyLimited } from "@/lib/contact/request"

const rejected = (status: number) => Response.json({ ok: false }, { status, headers: { "Cache-Control": "no-store" } })

type SignedHandler = (request: Request, body: unknown) => Promise<Response>

export function withVerifiedQstashSignature(handler: SignedHandler) {
  return async function verifiedQstashHandler(request: Request) {
    try {
      const signature = request.headers.get("upstash-signature")

      if (!signature) {
        return rejected(401)
      }

      const config = getContactRuntimeConfig()
      // Internal messages contain identifiers/alerts, never unbounded lead data.
      // Reject unauthenticated requests before reading, then enforce the same
      // byte bound as intake before signature verification or JSON parsing.
      const rawBody = await readBodyLimited(request)

      const receiver = new Receiver({
        currentSigningKey: config.qstashCurrentSigningKey,
        nextSigningKey: config.qstashNextSigningKey,
      })
      const pathname = new URL(request.url).pathname
      const valid = await receiver.verify({
        body: rawBody,
        signature,
        url: `${config.publicBaseUrl}${pathname}`,
      })

      if (!valid) {
        return rejected(401)
      }

      let body: unknown = {}

      if (rawBody.trim()) {
        try {
          body = JSON.parse(rawBody)
        } catch {
          return rejected(400)
        }
      }

      return handler(request, body)
    } catch (error) {
      if (error instanceof ContactPayloadTimeoutError) return rejected(408)
      if (error instanceof ContactPayloadTooLargeError) {
        return rejected(413)
      }
      const configurationFailure = error instanceof ContactConfigurationError

      logContactEvent("error", "internal_handler_rejected", {
        errorCode: classifyContactError(error),
        state: configurationFailure
          ? "configuration_failure"
          : "verification_failure",
      })

      return rejected(configurationFailure ? 503 : 401)
    }
  }
}
