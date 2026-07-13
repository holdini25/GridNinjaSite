import { describe, expect, it } from "vitest"

import manifest from "@/app/manifest"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import {
  canonicalSiteUrl,
  siteConfig,
  websiteStructuredData,
} from "@/content/site"
import {
  createPageMetadata,
  openGraphImage,
  socialImageAlt,
  twitterImage,
} from "@/lib/seo"

describe("public metadata", () => {
  it("locks the public site identity to the canonical www origin", () => {
    expect(canonicalSiteUrl).toBe("https://www.gridninja.ai/")
    expect(siteConfig).toMatchObject({
      name: "GridNinja",
      url: canonicalSiteUrl,
      title: "Virtual Capacity Control Plane for AI Data Centers | GridNinja",
      description:
        "GridNinja is the virtual capacity control plane for AI data centers, proving safe, usable capacity to accelerate time-to-power while protecting infrastructure.",
    })
    expect(websiteStructuredData).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://www.gridninja.ai/#website",
      url: canonicalSiteUrl,
      name: "GridNinja",
      alternateName: ["GridNinja AI", "gridninja.ai"],
    })
  })

  it("uses proof-first accessible text for both social cards", () => {
    expect(socialImageAlt).toBe(
      "GridNinja — proof-backed virtual capacity for AI data centers"
    )
    expect(openGraphImage.alt).toBe(socialImageAlt)
    expect(twitterImage.alt).toBe(socialImageAlt)
  })

  it("reuses complete social image descriptors on page metadata", () => {
    const pageMetadata = createPageMetadata({
      title: "Capacity Audit",
      description: "A page-specific description.",
      path: "/roi",
    })

    expect(pageMetadata.openGraph).toMatchObject({
      title: "Capacity Audit",
      url: new URL("https://www.gridninja.ai/roi"),
      siteName: "GridNinja",
      images: [openGraphImage],
    })
    expect(pageMetadata.twitter).toMatchObject({
      title: "Capacity Audit",
      images: [twitterImage],
    })
    expect(openGraphImage).toEqual({
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      type: "image/png",
      alt: socialImageAlt,
    })
  })

  it("can defer the homepage canonical and Open Graph URL to literal head resources", () => {
    const pageMetadata = createPageMetadata({
      title: siteConfig.title,
      description: siteConfig.description,
      path: "/",
      includeCanonicalUrl: false,
    })

    expect(pageMetadata.alternates).toBeUndefined()
    expect(pageMetadata.openGraph).not.toHaveProperty("url")
  })

  it("publishes only www URLs in robots and the sitemap", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: "/api/",
      },
      sitemap: "https://www.gridninja.ai/sitemap.xml",
    })

    const entries = sitemap()
    expect(entries[0]?.url).toBe(canonicalSiteUrl)
    expect(entries.every((entry) => entry.url.startsWith(canonicalSiteUrl))).toBe(
      true
    )
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
