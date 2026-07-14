import { readFile } from "node:fs/promises"
import path from "node:path"

import { ImageResponse } from "next/og"

import { GridNinjaOgCard } from "@/components/brand/gridninja-og-card"
import { PRODUCTION_ORIGIN } from "@/seo/policy"
import { seoRoutes } from "@/seo/route-manifest"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params
  const route = seoRoutes.find((candidate) => candidate.socialImageKey === key)
  if (!route) return new Response("Not found", { status: 404 })

  const emblem = await readFile(
    path.join(process.cwd(), "public/brand/social/gridninja-og-emblem.png")
  )
  const emblemSrc = `data:image/png;base64,${emblem.toString("base64")}`

  return new ImageResponse(
    <GridNinjaOgCard
      description={route.description}
      headline={route.h1}
      eyebrow={route.topicCluster.replaceAll("-", " ")}
      host={new URL(PRODUCTION_ORIGIN).host}
      emblemSrc={emblemSrc}
    />,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  )
}
