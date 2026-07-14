import Link from "next/link"

import { getSeoRoute, type PublicPath } from "@/seo/route-manifest"

export function SeoBreadcrumbs({ path }: { path: PublicPath }) {
  const route = getSeoRoute(path)
  if (route.breadcrumbs.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-7xl px-5 pt-6 sm:px-8 lg:px-10">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <li><Link href="/" className="hover:text-foreground">Home</Link></li>
        {route.breadcrumbs.map((crumb) => (
          <li key={crumb.path} className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            <Link href={crumb.path} className="hover:text-foreground">{crumb.name}</Link>
          </li>
        ))}
        <li className="flex items-center gap-2 text-foreground" aria-current="page">
          <span aria-hidden="true">/</span>
          <span>{route.h1}</span>
        </li>
      </ol>
    </nav>
  )
}
