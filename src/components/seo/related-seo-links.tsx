import Link from "next/link"

import { SectionShell } from "@/components/layout/section-shell"
import {
  getRelatedSeoRoutes,
  getSeoRoute,
  type PublicPath,
} from "@/seo/route-manifest"

export function RelatedSeoLinks({ path }: { path: PublicPath }) {
  const route = getSeoRoute(path)
  const relatedRoutes = getRelatedSeoRoutes(path)

  return (
    <SectionShell>
      <section
        aria-labelledby={`related-seo-${route.key}`}
        className="rounded-[1.8rem] border border-border/70 bg-surface px-6 py-7"
        data-seo-related-source={route.path}
        data-seo-related-paths={JSON.stringify(route.relatedPaths)}
        data-seo-route-tier={route.tier}
      >
        <p className="gn-eyebrow">Related operator resources</p>
        <h2
          id={`related-seo-${route.key}`}
          className="mt-4 text-balance text-[1.85rem] leading-tight font-medium text-foreground"
        >
          Continue the proof path
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {relatedRoutes.map((relatedRoute) => (
            <li key={relatedRoute.path}>
              <Link
                href={relatedRoute.path}
                prefetch={false}
                className="block h-full rounded-[1.15rem] border border-border/70 bg-background/35 px-5 py-5 transition-colors hover:border-primary/45 hover:bg-primary/5"
                data-seo-related-target={relatedRoute.path}
              >
                <span className="font-medium text-foreground">
                  {relatedRoute.h1}
                </span>
                <span className="mt-2 block text-sm leading-7 text-muted-foreground">
                  {relatedRoute.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </SectionShell>
  )
}
