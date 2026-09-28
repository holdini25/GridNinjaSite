import { FacilityEntry } from "@/components/marketing/facility-entry"
import type { Metadata } from "next"
import { DecisionPage } from "@/components/marketing/decision-page"
import { decisionPages } from "@/content/copy/decision-pages"
import { createPageMetadata } from "@/lib/seo"
export async function generateMetadata(): Promise<Metadata> { return createPageMetadata({ path: "/solutions/ai-cloud" }) }
export default async function Page() { return <DecisionPage path="/solutions/ai-cloud" facilityEntry={await FacilityEntry({ topic: "ai-cloud" })} content={decisionPages.aiCloud} /> }
