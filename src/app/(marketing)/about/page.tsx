import type { Metadata } from "next"
import { DecisionPage } from "@/components/marketing/decision-page"
import { decisionPages } from "@/content/copy/decision-pages"
import { createPageMetadata } from "@/lib/seo"
import { getCivicRelease } from "@/lib/civic/releases"
export async function generateMetadata(): Promise<Metadata> { return createPageMetadata({ path: "/about" }) }
export default async function Page() { return <DecisionPage path="/about" content={decisionPages.about} civicRelease={await getCivicRelease()} /> }
