import { cinematicAssetResponse } from "@/lib/cinematic/releases"

export const runtime = "nodejs"
type Context = { params: Promise<{ release: string; file: string }> }
export async function GET(request: Request, context: Context) {
  const { release, file } = await context.params
  return cinematicAssetResponse(release, file, request)
}
export const HEAD = GET
