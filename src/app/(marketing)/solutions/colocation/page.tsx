import type { Metadata } from "next"

import { SolutionPageTemplate } from "@/components/marketing/solution-page-template"
import { SeoBreadcrumbs } from "@/components/seo/breadcrumbs"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { solutionPages } from "@/content/copy/solutions"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "Colocation & REIT Solutions | GridNinja",
    description:
      "Increase sellable kW, oversubscribe more safely, and protect uptime with proof-backed control.",
    path: "/solutions/colocation",
  })
}

export default function ColocationPage() {
  return (
    <>
      <SeoPageJsonLd path="/solutions/colocation" />
      <SeoBreadcrumbs path="/solutions/colocation" />
      <SolutionPageTemplate config={solutionPages.colocation} />
    </>
  )
}
