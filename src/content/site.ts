import { PRODUCTION_ORIGIN } from "@/seo/policy"

export const canonicalSiteUrl = `${PRODUCTION_ORIGIN}/` as const

export const siteConfig = {
  name: "GridNinja",
  url: canonicalSiteUrl,
  title: "AI Data Center Virtual Capacity Control Plane | GridNinja",
  description:
    "GridNinja is the virtual capacity control plane for AI data centers, proving safe, usable capacity to accelerate time-to-power while protecting infrastructure.",
  footerCopy:
    "GridNinja is the runtime-assured virtual capacity engine for AI data centers.",
}
