import {
  absoluteUrl,
  HOMEPAGE_PRIMARY_IMAGE,
  SITE_IDENTITY,
} from "@/seo/policy"
import type { SeoRoute } from "@/seo/route-manifest"

type JsonLd = Record<string, unknown>

export function buildOrganizationSchema(): JsonLd {
  return {
    "@type": "Organization",
    "@id": SITE_IDENTITY.organizationId,
    name: SITE_IDENTITY.name,
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(SITE_IDENTITY.logoPath),
      width: 400,
      height: 400,
    },
  }
}

export function buildWebsiteSchema(): JsonLd {
  return {
    "@type": "WebSite",
    "@id": SITE_IDENTITY.websiteId,
    url: absoluteUrl("/"),
    name: SITE_IDENTITY.name,
    alternateName: SITE_IDENTITY.alternateName,
    publisher: { "@id": SITE_IDENTITY.organizationId },
  }
}

export function buildWebPageSchema(route: SeoRoute): JsonLd {
  return {
    "@type": "WebPage",
    "@id": `${absoluteUrl(route.path)}#webpage`,
    url: absoluteUrl(route.path),
    name: route.title,
    description: route.description,
    isPartOf: { "@id": SITE_IDENTITY.websiteId },
    about: { "@id": SITE_IDENTITY.organizationId },
    dateModified: route.contentUpdatedAt,
    ...(route.path === "/"
      ? {
          primaryImageOfPage: {
            "@type": "ImageObject",
            "@id": HOMEPAGE_PRIMARY_IMAGE.id,
            url: absoluteUrl(HOMEPAGE_PRIMARY_IMAGE.path),
            contentUrl: absoluteUrl(HOMEPAGE_PRIMARY_IMAGE.path),
            width: HOMEPAGE_PRIMARY_IMAGE.width,
            height: HOMEPAGE_PRIMARY_IMAGE.height,
          },
        }
      : {}),
    ...(route.breadcrumbs.length > 0
      ? { breadcrumb: { "@id": `${absoluteUrl(route.path)}#breadcrumbs` } }
      : {}),
  }
}

export function buildBreadcrumbSchema(route: SeoRoute): JsonLd | null {
  if (route.breadcrumbs.length === 0) return null

  const crumbs = [
    { name: "Home", path: "/" },
    ...route.breadcrumbs,
    { name: route.h1, path: route.path },
  ]

  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(route.path)}#breadcrumbs`,
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  }
}

export function buildCapacityAuditServiceSchema(route: SeoRoute): JsonLd {
  return {
    "@type": "Service",
    "@id": `${absoluteUrl(route.path)}#service`,
    name: "AI Data Center Capacity Audit",
    description: route.description,
    url: absoluteUrl(route.path),
    provider: { "@id": SITE_IDENTITY.organizationId },
    serviceType: "AI data center virtual capacity assessment",
    areaServed: "Worldwide",
  }
}

export function buildTechArticleSchema(
  route: SeoRoute,
  authors: readonly { name: string; path: string }[],
  reviewer?: { name: string; path: string }
): JsonLd {
  if (authors.length === 0) {
    throw new Error(`TechArticle ${route.path} requires at least one real public author`)
  }

  return {
    "@type": "TechArticle",
    "@id": `${absoluteUrl(route.path)}#article`,
    headline: route.h1,
    description: route.description,
    url: absoluteUrl(route.path),
    dateModified: route.contentUpdatedAt,
    author: authors.map((author) => ({
      "@type": "Person",
      name: author.name,
      url: absoluteUrl(author.path),
    })),
    ...(reviewer
      ? {
          reviewedBy: {
            "@type": "Person",
            name: reviewer.name,
            url: absoluteUrl(reviewer.path),
          },
        }
      : {}),
    publisher: { "@id": SITE_IDENTITY.organizationId },
    mainEntityOfPage: { "@id": `${absoluteUrl(route.path)}#webpage` },
  }
}

export function buildSeoGraph(route: SeoRoute, includeSiteIdentity = false): JsonLd {
  const graph: JsonLd[] = []
  if (includeSiteIdentity) {
    graph.push(buildOrganizationSchema(), buildWebsiteSchema())
  }
  graph.push(buildWebPageSchema(route))

  const breadcrumb = buildBreadcrumbSchema(route)
  if (breadcrumb) graph.push(breadcrumb)
  if (route.schemaTypes.includes("Service")) {
    graph.push(buildCapacityAuditServiceSchema(route))
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  }
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
