import type { MetadataRoute } from "next"

import { absoluteUrl, isPreviewDeployment, SEO_ROBOTS_POLICY } from "@/seo/policy"

export default function robots(): MetadataRoute.Robots {
  if (isPreviewDeployment()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...SEO_ROBOTS_POLICY.disallow],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  }
}
