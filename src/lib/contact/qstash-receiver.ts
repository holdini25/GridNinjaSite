import "server-only"

import { Receiver } from "@upstash/qstash"

import {
  ContactConfigurationError,
  getContactRuntimeConfig,
} from "@/lib/contact/config"
import { classifyContactError, logContactEvent } from "@/lib/contact/log"

type SignedHandler = (request: Request, body: unknown) => Promise<Response>

export function withVerifiedQstashSignature(handler: SignedHandler) {
  return async function verifiedQstashHandler(request: Request) {
    try {
      const config = getContactRuntimeConfig()
      const rawBody = await request.text()
      const signature = request.headers.get("upstash-signature")

      if (!signature) {
        return Response.json({ ok: false }, { status: 401 })
      }

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
        return Response.json({ ok: false }, { status: 401 })
      }

      let body: unknown = {}

      if (rawBody.trim()) {
        try {
          body = JSON.parse(rawBody)
        } catch {
          return Response.json({ ok: false }, { status: 400 })
        }
      }

      return handler(request, body)
    } catch (error) {
      const configurationFailure = error instanceof ContactConfigurationError

      logContactEvent("error", "internal_handler_rejected", {
        errorCode: classifyContactError(error),
        state: configurationFailure
          ? "configuration_failure"
          : "verification_failure",
      })

      return Response.json(
        { ok: false },
        { status: configurationFailure ? 503 : 401 }
      )
    }
  }
}
