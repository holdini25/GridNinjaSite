import type { MetadataRoute } from "next"

import { siteConfig } from "@/content/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/platform",
    "/solutions/ai-cloud",
    "/solutions/colocation",
    "/solutions/bridge-power",
    "/proof",
    "/why-gridninja",
    "/proof/proof-pack",
    "/demo",
    "/dcii",
    "/roi",
    "/about",
    "/contact",
  ]

  return routes.map((route) => ({
    url: new URL(route, siteConfig.url).toString(),
    lastModified: siteConfig.lastModified,
  }))
}
