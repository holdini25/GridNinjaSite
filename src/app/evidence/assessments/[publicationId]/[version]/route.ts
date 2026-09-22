import { assessmentPublicationResponse } from "@/lib/assessment/publications"
export const runtime = "nodejs"
export async function GET(_request: Request, { params }: { params: Promise<{ publicationId: string; version: string }> }) {
  const { publicationId, version } = await params
  return assessmentPublicationResponse(publicationId, version, "html")
}
