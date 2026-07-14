import { getSeoRoute, type PublicPath } from "@/seo/route-manifest"
import { buildSeoGraph, serializeJsonLd } from "@/seo/schema"

export function JsonLd({ id, data }: { id: string; data: unknown }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}

export function SeoPageJsonLd({
  path,
  includeSiteIdentity = false,
}: {
  path: PublicPath
  includeSiteIdentity?: boolean
}) {
  const route = getSeoRoute(path)
  return (
    <JsonLd
      id={`gridninja-schema-${route.key}`}
      data={buildSeoGraph(route, includeSiteIdentity)}
    />
  )
}
