import { readFile } from "node:fs/promises"
import path from "node:path"

import { ImageResponse } from "next/og"

import { GridNinjaOgCard } from "@/components/brand/gridninja-og-card"
import { siteConfig } from "@/content/site"
import { socialImageAlt } from "@/lib/seo"

export const runtime = "nodejs"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"
export const alt = socialImageAlt

export default async function TwitterImage() {
  const host = new URL(siteConfig.url).host
  const emblem = await readFile(
    path.join(process.cwd(), "public/brand/social/gridninja-og-emblem.png")
  )
  const emblemSrc = `data:image/png;base64,${emblem.toString("base64")}`

  return new ImageResponse(
    (
      <GridNinjaOgCard
        description={siteConfig.description}
        host={host}
        emblemSrc={emblemSrc}
      />
    ),
    {
      ...size,
    }
  )
}
