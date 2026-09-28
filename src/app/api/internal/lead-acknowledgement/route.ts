import { z } from "zod"
import { hasInternalBearer } from "@/lib/contact/internal-auth"
import { ContactPayloadTooLargeError, ContactPayloadTimeoutError, readBodyLimited } from "@/lib/contact/request"
import { acknowledgeDelivery, getDeliveryObservation } from "@/server/leads/enterprise-repository"

export const runtime = "nodejs"
const reply = (body: Record<string, unknown>, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
const acknowledgement = z.object({ outboxId: z.uuid(), reviewedThrough: z.iso.datetime(), operatorReference: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/) }).strict()
export async function POST(request: Request) {
  if (!hasInternalBearer(request, process.env.LEAD_OPERATIONS_SECRET)) return reply({ ok: false }, 401)
  let input
  try { input = acknowledgement.safeParse(JSON.parse(await readBodyLimited(request, 1024))) } catch (error) { return reply({ ok: false }, error instanceof ContactPayloadTimeoutError ? 408 : error instanceof ContactPayloadTooLargeError ? 413 : 400) }
  if (!input.success) return reply({ ok: false }, 400)
  try {
    const found = await acknowledgeDelivery(input.data.outboxId, input.data.operatorReference, new Date(input.data.reviewedThrough))
    return reply({ ok: found, ...(found ? { observation: await getDeliveryObservation(input.data.outboxId) } : {}) }, found ? 200 : 404)
  } catch { return reply({ ok: false }, 503) }
}
