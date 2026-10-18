import { PRODUCTION_ORIGIN } from "@/seo/policy"
import { getSeoRoute } from "@/seo/route-manifest"
import { footerCopy } from "@/content/footer"

export const canonicalSiteUrl = `${PRODUCTION_ORIGIN}/` as const
const homepageSeoRoute = getSeoRoute("/")

export const siteConfig = {
  name: "GridNinja",
  url: canonicalSiteUrl,
  title: homepageSeoRoute.title,
  description: homepageSeoRoute.description,
  footerCopy,
}
