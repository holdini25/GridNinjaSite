/** Previous publication-gated candidates have been withdrawn from public storage. */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const status = path[0] === "v1.0.0" ? 410 : 404
  return new Response(status === 410 ? "This candidate evidence release is not published." : "Not found", { status, headers: { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" } })
}
