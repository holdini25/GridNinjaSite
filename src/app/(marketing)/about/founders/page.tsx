import type { Metadata } from "next"
import { FoundersPage } from "@/components/marketing/founders-page"
import { createPageMetadata } from "@/lib/seo"

export function generateMetadata(): Metadata {
  return createPageMetadata({ path: "/about/founders" })
}

export default function Page() {
  return <FoundersPage />
}
