import { describe, expect, it } from "vitest"

import manifest from "@/app/manifest"
import {
  createPageMetadata,
  openGraphImage,
  socialImageAlt,
  twitterImage,
} from "@/lib/seo"

describe("public metadata", () => {
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
        src: "/brand/icons/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icons/pwa-512.png",
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
