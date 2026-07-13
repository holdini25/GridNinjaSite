export const canonicalSiteUrl = "https://www.gridninja.ai/" as const

export const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${canonicalSiteUrl}#website`,
  url: canonicalSiteUrl,
  name: "GridNinja",
  alternateName: ["GridNinja AI", "gridninja.ai"],
} as const

export const siteConfig = {
  name: "GridNinja",
  url: canonicalSiteUrl,
  title: "Virtual Capacity Control Plane for AI Data Centers | GridNinja",
  description:
    "GridNinja is the virtual capacity control plane for AI data centers, proving safe, usable capacity to accelerate time-to-power while protecting infrastructure.",
  lastModified: "2026-07-13",
  footerCopy:
    "GridNinja is the runtime-assured virtual capacity engine for AI data centers.",
}
