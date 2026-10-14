import { NextResponse } from "next/server"

import manifest from "@/lib/web-app-manifest"

export const dynamic = "force-static"

export function GET() {
  // Preserve the former metadata route's JSON bytes and response headers.
  return new NextResponse(JSON.stringify(manifest()), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  })
}
