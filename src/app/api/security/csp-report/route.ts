import { ContactPayloadTooLargeError, ContactPayloadTimeoutError, readBodyLimited } from "@/lib/contact/request"
import { sanitizeCspReports } from "@/lib/security/csp"
import { allowCspReport } from "@/lib/security/csp-rate-limit"

export const maxDuration = 10
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const empty = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })

export async function POST(request: Request) {
  if (!["application/csp-report", "application/reports+json", "application/json"].includes((request.headers.get("content-type") ?? "").split(";")[0].trim())) return empty(415)
  const limit = await allowCspReport(request)
  if (limit !== "allowed") return empty(limit === "limited" ? 429 : 503)
  try {
    const reports = sanitizeCspReports(JSON.parse(await readBodyLimited(request, 16 * 1024, 5_000)), new URL(request.url).origin)
    if (reports.length) {
      const candidate = process.env.GRIDNINJA_CANDIDATE_ID
      console.info(JSON.stringify({ event: "csp_violation", candidate: candidate && /^[a-z0-9-]{1,64}$/.test(candidate) ? candidate : "unassigned", reports }))
    }
    return empty(204)
  } catch (error) { return empty(error instanceof ContactPayloadTooLargeError ? 413 : error instanceof ContactPayloadTimeoutError ? 408 : 400) }
}
