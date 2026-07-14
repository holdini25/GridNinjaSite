import { describe, expect, it } from "vitest"

import {
  buildOrganizationSchema,
  buildTechArticleSchema,
  buildWebPageSchema,
  buildWebsiteSchema,
  serializeJsonLd,
} from "@/seo/schema"
import { getSeoRoute } from "@/seo/route-manifest"

describe("structured identity and safe serialization", () => {
  it("uses stable apex IDs without unsupported identity properties", () => {
    expect(buildWebsiteSchema()).toEqual({
      "@type": "WebSite",
      "@id": "https://gridninja.ai/#website",
      url: "https://gridninja.ai/",
      name: "GridNinja",
      alternateName: "gridninja.ai",
      publisher: { "@id": "https://gridninja.ai/#organization" },
    })
    expect(buildOrganizationSchema()).toEqual({
      "@type": "Organization",
      "@id": "https://gridninja.ai/#organization",
      name: "GridNinja",
      url: "https://gridninja.ai/",
      logo: {
        "@type": "ImageObject",
        url: "https://gridninja.ai/brand/social/gridninja-og-emblem.png",
        width: 400,
        height: 400,
      },
    })
    expect(buildOrganizationSchema()).not.toHaveProperty("sameAs")
  })

  it("refuses to manufacture authorless TechArticle records", () => {
    expect(() =>
      buildTechArticleSchema(
        getSeoRoute("/insights/virtual-capacity-control-plane"),
        []
      )
    ).toThrow(/requires at least one real public author/i)
  })

  it("publishes the square primary image on the homepage WebPage only", () => {
    expect(buildWebPageSchema(getSeoRoute("/"))).toMatchObject({
      "@type": "WebPage",
      "@id": "https://gridninja.ai/#webpage",
      name: "GridNinja | Virtual Capacity Control Plane",
      description:
        "Unlock safe, usable and auditable capacity from constrained AI infrastructure with GridNinja’s runtime-assured virtual capacity control plane.",
      primaryImageOfPage: {
        "@type": "ImageObject",
        "@id": "https://gridninja.ai/#primaryimage",
        url: "https://gridninja.ai/brand/search/gridninja-virtual-capacity.png",
        contentUrl:
          "https://gridninja.ai/brand/search/gridninja-virtual-capacity.png",
        width: 1200,
        height: 1200,
      },
    })
    expect(
      buildWebPageSchema(getSeoRoute("/platform"))
    ).not.toHaveProperty("primaryImageOfPage")
  })

  it("neutralizes script-breaking input in server-rendered JSON-LD", () => {
    const value = "</script><script>alert('claim')</script>&\u2028\u2029"
    const serialized = serializeJsonLd({ value })

    expect(serialized).not.toContain("<")
    expect(serialized).not.toContain(">")
    expect(serialized).not.toContain("&")
    expect(serialized).toContain("\\u003c/script\\u003e")
    expect(JSON.parse(serialized).value).toBe(value)
  })
})
