import { PRODUCTION_ORIGIN } from "@/seo/policy"
import { getSeoRoute } from "@/seo/route-manifest"

export const canonicalSiteUrl = `${PRODUCTION_ORIGIN}/` as const
const homepageSeoRoute = getSeoRoute("/")

export const siteConfig = {
  name: "GridNinja",
  url: canonicalSiteUrl,
  title: homepageSeoRoute.title,
  description: homepageSeoRoute.description,
  footerCopy:
    "GridNinja is the runtime-assured virtual capacity engine for AI data centers.",
}
