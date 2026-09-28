import { FacilityEntry } from "@/components/marketing/facility-entry"
import type { Metadata } from "next"
import { DecisionPage } from "@/components/marketing/decision-page"
import { decisionPages } from "@/content/copy/decision-pages"
import { createPageMetadata } from "@/lib/seo"
export async function generateMetadata(): Promise<Metadata> { return createPageMetadata({ path: "/solutions/colocation" }) }
export default async function Page() { return <DecisionPage path="/solutions/colocation" facilityEntry={await FacilityEntry({ topic: "colocation" })} content={decisionPages.colocation} /> }
