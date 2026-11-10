import type { Metadata } from "next"
import { FoundersPage } from "@/components/marketing/founders-page"
import { RelatedSeoLinks } from "@/components/seo/related-seo-links"
import { createPageMetadata } from "@/lib/seo"

export function generateMetadata(): Metadata {
  return createPageMetadata({ path: "/about/founders" })
}

export default function Page() {
  return <><FoundersPage /><RelatedSeoLinks path="/about/founders" /></>
}
