export const PRODUCTION_ORIGIN = "https://gridninja.ai" as const

export const HOMEPAGE_PRIMARY_IMAGE = {
  id: `${PRODUCTION_ORIGIN}/#primaryimage`,
  path: "/brand/search/gridninja-virtual-capacity.png",
  width: 1200,
  height: 1200,
  type: "image/png",
  alt: "GridNinja twin-guardian virtual capacity emblem on a navy field",
} as const

export const SITE_IDENTITY = {
  name: "GridNinja",
  alternateName: "gridninja.ai",
  organizationId: `${PRODUCTION_ORIGIN}/#organization`,
  websiteId: `${PRODUCTION_ORIGIN}/#website`,
  logoPath: "/brand/social/gridninja-og-emblem.png",
} as const

export const SEO_ROBOTS_POLICY = {
  disallow: ["/api/", "/internal/"],
  maxImagePreview: "large",
  maxSnippet: -1,
  maxVideoPreview: -1,
} as const

export function absoluteUrl(path: string): string {
  return new URL(path, `${PRODUCTION_ORIGIN}/`).toString()
}

export function isPreviewDeployment(): boolean {
  return Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production")
}

export function operationalOrigin(): string {
  const candidate = process.env.NEXT_PUBLIC_SITE_URL

  if (!candidate) {
    return PRODUCTION_ORIGIN
  }

  try {
    return new URL(candidate).origin
  } catch {
    return PRODUCTION_ORIGIN
  }
}
