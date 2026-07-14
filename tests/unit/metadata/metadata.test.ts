import { describe, expect, it } from "vitest"

import manifest from "@/app/manifest"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import {
  canonicalSiteUrl,
  siteConfig,
} from "@/content/site"
import {
  createPageMetadata,
  openGraphImage,
  socialImageAlt,
  twitterImage,
} from "@/lib/seo"
import {
  HOMEPAGE_PRIMARY_IMAGE,
  PRODUCTION_ORIGIN,
  SITE_IDENTITY,
} from "@/seo/policy"
import {
  getSeoRoute,
  indexableSeoRoutes,
} from "@/seo/route-manifest"
import { buildOrganizationSchema, buildWebsiteSchema } from "@/seo/schema"

describe("public metadata", () => {
  it("locks the public site identity to the immutable apex origin", () => {
    const homepageRoute = getSeoRoute("/")

    expect(canonicalSiteUrl).toBe("https://gridninja.ai/")
    expect(PRODUCTION_ORIGIN).toBe("https://gridninja.ai")
    expect(siteConfig).toMatchObject({
      name: "GridNinja",
      url: canonicalSiteUrl,
      title: homepageRoute.title,
      description: homepageRoute.description,
    })
    expect(buildWebsiteSchema()).toEqual({
      "@type": "WebSite",
      "@id": "https://gridninja.ai/#website",
      url: canonicalSiteUrl,
      name: "GridNinja",
      alternateName: "gridninja.ai",
      publisher: { "@id": "https://gridninja.ai/#organization" },
    })
    expect(buildOrganizationSchema()).toMatchObject({
      "@id": SITE_IDENTITY.organizationId,
      name: "GridNinja",
      logo: { url: "https://gridninja.ai/brand/social/gridninja-og-emblem.png" },
    })
  })

  it("projects homepage identity into metadata and install surfaces", () => {
    const homepageRoute = getSeoRoute("/")
    const pageMetadata = createPageMetadata({ path: "/" })

    expect(pageMetadata).toMatchObject({
      title: homepageRoute.title,
      description: homepageRoute.description,
      openGraph: {
        title: homepageRoute.title,
        description: homepageRoute.description,
      },
      twitter: {
        title: homepageRoute.title,
        description: homepageRoute.description,
      },
    })
    expect(manifest()).toMatchObject({
      name: siteConfig.name,
      description: homepageRoute.description,
    })
  })

  it("uses proof-first accessible text for both social cards", () => {
    expect(socialImageAlt).toBe(
      "GridNinja — proof-backed virtual capacity for AI data centers"
    )
    expect(openGraphImage.alt).toBe(socialImageAlt)
    expect(twitterImage.alt).toBe(socialImageAlt)
  })

  it("appends the square search candidate only to homepage Open Graph metadata", () => {
    const homepageMetadata = createPageMetadata({ path: "/" })

    expect(homepageMetadata.openGraph?.images).toEqual([
      {
        ...openGraphImage,
        url: "https://gridninja.ai/og/home",
      },
      {
        url: `https://gridninja.ai${HOMEPAGE_PRIMARY_IMAGE.path}`,
        width: HOMEPAGE_PRIMARY_IMAGE.width,
        height: HOMEPAGE_PRIMARY_IMAGE.height,
        type: HOMEPAGE_PRIMARY_IMAGE.type,
        alt: HOMEPAGE_PRIMARY_IMAGE.alt,
      },
    ])
    expect(homepageMetadata.twitter?.images).toEqual([
      {
        ...twitterImage,
        url: "https://gridninja.ai/og/home",
      },
    ])
  })

  it("reuses complete social image descriptors on page metadata", () => {
    const pageMetadata = createPageMetadata({
      title: "Capacity Audit",
      description: "A page-specific description.",
      path: "/roi",
    })

    expect(pageMetadata.openGraph).toMatchObject({
      title: "AI Data Center Capacity Audit & ROI | GridNinja",
      url: "https://gridninja.ai/roi",
      siteName: "GridNinja",
      images: [{ ...openGraphImage, url: "https://gridninja.ai/og/capacity-audit" }],
    })
    expect(pageMetadata.twitter).toMatchObject({
      title: "AI Data Center Capacity Audit & ROI | GridNinja",
      images: [{ ...twitterImage, url: "https://gridninja.ai/og/capacity-audit" }],
    })
    expect(openGraphImage).toEqual({
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      type: "image/png",
      alt: socialImageAlt,
    })
  })

  it("canonicalizes query-string states to the registered base route", () => {
    const pageMetadata = createPageMetadata({
      title: siteConfig.title,
      description: siteConfig.description,
      path: "/contact?intent=capacity-audit",
    })

    expect(pageMetadata.alternates).toEqual({ canonical: "https://gridninja.ai/contact" })
    expect(pageMetadata.openGraph).toHaveProperty("url", "https://gridninja.ai/contact")
  })

  it("publishes only apex URLs in robots and the sitemap", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/internal/"],
      },
      sitemap: "https://gridninja.ai/sitemap.xml",
      host: "https://gridninja.ai/",
    })

    const entries = sitemap()
    expect(entries[0]?.url).toBe(canonicalSiteUrl)
    expect(entries.every((entry) => entry.url.startsWith(canonicalSiteUrl))).toBe(
      true
    )
    expect(entries).toHaveLength(indexableSeoRoutes.length)
  })

  it("declares complete 1200 by 630 PNG descriptors for both cards", () => {
    expect(openGraphImage).toMatchObject({
      width: 1200,
      height: 630,
      type: "image/png",
      alt: socialImageAlt,
    })
    expect(twitterImage).toMatchObject({
      width: 1200,
      height: 630,
      type: "image/png",
      alt: socialImageAlt,
    })
  })

  it("defines standard and maskable install icons without offline claims", () => {
    const value = manifest()

    expect(value).toMatchObject({
      name: "GridNinja",
      short_name: "GridNinja",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#070a0d",
      theme_color: "#070a0d",
    })
    expect(value.icons).toEqual([
      {
        src: "/gridninja-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/gridninja-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icons/pwa-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/icons/pwa-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ])
    expect(value).not.toHaveProperty("serviceworker")
    expect(value).not.toHaveProperty("related_applications")
    expect(value.icons?.filter((icon) => icon.purpose === "any")).toHaveLength(2)
    expect(
      value.icons?.filter((icon) => icon.purpose === "maskable")
    ).toHaveLength(2)
  })
})
