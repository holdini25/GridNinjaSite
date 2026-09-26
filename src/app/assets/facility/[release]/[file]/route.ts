import { facilityAssetResponse } from "@/lib/facility/releases"

export const runtime = "nodejs"

export async function GET(request: Request, context: { params: Promise<{ release: string; file: string }> }) {
  const { release, file } = await context.params
  return facilityAssetResponse(release, file, request.headers.get("if-none-match"), request.headers.get("accept-encoding"))
}
