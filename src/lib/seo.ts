import type { Metadata } from "next"

import { siteConfig } from "@/content/site"
import { absoluteUrl, isPreviewDeployment, PRODUCTION_ORIGIN } from "@/seo/policy"
import { getSeoRoute, type PublicPath } from "@/seo/route-manifest"

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
  title?: string
  description?: string
  path: PublicPath | string
  includeCanonicalUrl?: boolean
  indexable?: boolean
}

export function createPageMetadata({
  path,
  includeCanonicalUrl = true,
  title: titleOverride,
  description: descriptionOverride,
  indexable: indexableOverride,
}: MetadataInput): Metadata {
  const routePath = path.split(/[?#]/, 1)[0] || "/"
  let manifestRoute
  try {
    manifestRoute = getSeoRoute(routePath)
  } catch {
    manifestRoute = undefined
  }

  const title = manifestRoute?.title ?? titleOverride
  const description = manifestRoute?.description ?? descriptionOverride
  if (!title || !description) {
    throw new Error(`Metadata for ${path} requires a registered route or explicit title and description`)
  }

  const canonical = absoluteUrl(routePath)
  const preview = isPreviewDeployment()
  const indexable = !preview && (indexableOverride ?? manifestRoute?.indexable ?? false)
  const socialImageKey = manifestRoute?.socialImageKey ?? "home"
  const socialImage = {
    ...openGraphImage,
    url: absoluteUrl(`/og/${socialImageKey}`),
  }

  return {
    metadataBase: new URL(PRODUCTION_ORIGIN),
    title,
    description,
    alternates: includeCanonicalUrl
      ? {
          canonical,
        }
      : undefined,
    robots: preview
      ? { index: false, follow: false, noarchive: true }
      : indexable
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : { index: false, follow: true, noarchive: true },
    openGraph: {
      title,
      description,
      type: "website",
      ...(includeCanonicalUrl ? { url: canonical } : {}),
      siteName: siteConfig.name,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ ...twitterImage, url: socialImage.url }],
    },
  }
}
