import { civicAssetResponse } from "@/lib/civic/releases"

export const runtime = "nodejs"
type Context = { params: Promise<{ release: string; file: string }> }
export async function GET(request: Request, context: Context) {
  const { release, file } = await context.params
  return civicAssetResponse(release, file, request)
}
export const HEAD = GET
