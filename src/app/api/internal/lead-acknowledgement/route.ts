import { z } from "zod"
import { hasInternalBearer } from "@/lib/contact/internal-auth"
import { configuredOperators } from "@/lib/contact/operational-config"
import { ContactPayloadTimeoutError, ContactPayloadTooLargeError, readBodyLimited } from "@/lib/contact/request"
import { observationsRepository } from "@/server/leads/observations-repository"

export const runtime = "nodejs"
export const maxDuration = 15
const reply = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
const schema = z.object({ outboxId: z.uuid(), reviewedThrough: z.iso.datetime(), operatorReference: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }).strict()

export async function POST(request: Request) {
  if (!hasInternalBearer(request, process.env.LEAD_OPERATIONS_SECRET)) return reply({ ok: false }, 401)
  let input
  try { input = schema.safeParse(JSON.parse(await readBodyLimited(request, 1024))) } catch (error) {
    return reply({ ok: false }, error instanceof ContactPayloadTimeoutError ? 408 : error instanceof ContactPayloadTooLargeError ? 413 : 400)
  }
  if (!input.success || !configuredOperators().includes(input.data.operatorReference)) return reply({ ok: false }, 400)
  const reviewedThrough = new Date(input.data.reviewedThrough)
  if (reviewedThrough.getTime() > Date.now()) return reply({ ok: false }, 400)
  try {
    const repository = observationsRepository()
    const found = await repository.acknowledgeDelivery(input.data.outboxId, input.data.operatorReference, reviewedThrough)
    return reply({ ok: found, ...(found ? { observation: await repository.getDeliveryObservation(input.data.outboxId) } : {}) }, found ? 200 : 404)
  } catch { return reply({ ok: false }, 503) }
}
