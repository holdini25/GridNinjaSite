import { editorialAssetResponse } from "@/lib/editorial/releases"

export const runtime = "nodejs"
type Context = { params: Promise<{ release: string; file: string }> }
export async function GET(request: Request, context: Context) {
  const { release, file } = await context.params
  return editorialAssetResponse(release, file, request)
}
export const HEAD = GET
