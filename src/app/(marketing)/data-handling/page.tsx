import type { Metadata } from "next"
import { DecisionPage } from "@/components/marketing/decision-page"
import { decisionPages } from "@/content/copy/decision-pages"
import { createPageMetadata } from "@/lib/seo"
export async function generateMetadata(): Promise<Metadata> { return createPageMetadata({ path: "/data-handling" }) }
export default function Page() { return <DecisionPage path="/data-handling" content={decisionPages.dataHandling} /> }
