import type { Metadata } from "next"

import { SolutionPageTemplate } from "@/components/marketing/solution-page-template"
import { SeoBreadcrumbs } from "@/components/seo/breadcrumbs"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { solutionPages } from "@/content/copy/solutions"
import { createPageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "AI Cloud Solutions | GridNinja",
    description:
      "Bring compute online faster, avoid power-driven throttling, and convert constrained infrastructure into billable capacity.",
    path: "/solutions/ai-cloud",
  })
}

export default function AiCloudPage() {
  return (
    <>
      <SeoPageJsonLd path="/solutions/ai-cloud" />
      <SeoBreadcrumbs path="/solutions/ai-cloud" />
      <SolutionPageTemplate config={solutionPages["ai-cloud"]} />
    </>
  )
}
