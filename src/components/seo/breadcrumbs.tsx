import Link from "next/link"

import { getSeoRoute, type PublicPath } from "@/seo/route-manifest"

export function SeoBreadcrumbs({ path }: { path: PublicPath }) {
  const route = getSeoRoute(path)
  if (route.breadcrumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="gn-breadcrumbs mx-auto w-full pt-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <li><Link href="/" prefetch={false} className="hover:text-foreground">Home</Link></li>
        {route.breadcrumbs.map((crumb) => (
          <li key={crumb.path} className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            <Link href={crumb.path} prefetch={false} className="hover:text-foreground">{crumb.name}</Link>
          </li>
        ))}
        <li className="flex items-center gap-2 text-foreground" aria-current="page">
          <span aria-hidden="true">/</span>
          <span>{({ "/solutions/ai-cloud": "AI Cloud", "/solutions/colocation": "Colocation & REITs", "/solutions/bridge-power": "Bridge Power & DER", "/platform": "Platform", "/proof": "Proof", "/about": "About", "/proof/proof-pack": "Proof pack" } as Partial<Record<PublicPath, string>>)[path] ?? route.h1}</span>
        </li>
      </ol>
    </nav>
  )
}
