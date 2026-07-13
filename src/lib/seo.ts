import type { Metadata } from "next"

import { siteConfig } from "@/content/site"

export const socialImageAlt =
  "GridNinja — proof-backed virtual capacity for AI data centers"

export const openGraphImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: socialImageAlt,
} as const

export const twitterImage = {
  url: "/twitter-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: socialImageAlt,
} as const

type MetadataInput = {
  title: string
  description: string
  path: string
}

export function createPageMetadata({
  title,
  description,
  path,
}: MetadataInput): Metadata {
  const url = new URL(path, siteConfig.url)

  return {
    metadataBase: new URL(siteConfig.url),
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: siteConfig.name,
      images: [openGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [twitterImage],
    },
  }
}
