import type { MetadataRoute } from "next"

import { absoluteUrl } from "@/seo/policy"
import { indexableSeoRoutes } from "@/seo/route-manifest"

export default function sitemap(): MetadataRoute.Sitemap {
  return indexableSeoRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: route.contentUpdatedAt,
    changeFrequency: route.tier === 0 ? "monthly" : "yearly",
    priority: route.tier === 0 ? 1 : route.tier === 1 ? 0.7 : 0.5,
  }))
}
