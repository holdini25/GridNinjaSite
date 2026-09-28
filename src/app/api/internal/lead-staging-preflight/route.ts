import { getContactRuntimeConfig } from "@/lib/contact/config"
import { hasInternalBearer } from "@/lib/contact/internal-auth"
import { assertStagingPreflightBoundary, inspectStagingPreflight, readPackagedStagingAttestation, StagingPreflightError } from "@/lib/contact/staging-preflight"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const reply = (body: unknown, status: number) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" },
})

/** Authenticated read-only rehearsal guard. No database, queue or sender import. */
export async function GET(request: Request) {
  if (!hasInternalBearer(request, process.env.LEAD_OPERATIONS_SECRET)) return reply({ ok: false }, 401)
  try {
    const origin = assertStagingPreflightBoundary(request.url, process.env)
    const config = getContactRuntimeConfig()
    const artifact = await readPackagedStagingAttestation()
    return reply(inspectStagingPreflight({ origin, config, ...artifact }), 200)
  } catch (error) {
    return reply({ ok: false, code: error instanceof StagingPreflightError ? error.code : "preflight_unavailable" }, 503)
  }
}
