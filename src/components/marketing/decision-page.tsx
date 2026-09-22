import Link from "next/link"
import { SectionShell } from "@/components/layout/section-shell"
import { AssessmentCards } from "@/components/marketing/assessment-cards"
import { Hero } from "@/components/marketing/hero"
import { SectionHeader } from "@/components/marketing/section-header"
import { CtaBand } from "@/components/marketing/cta-band"
import { SeoBreadcrumbs } from "@/components/seo/breadcrumbs"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { RelatedSeoLinks } from "@/components/seo/related-seo-links"
import type { PublicPath } from "@/seo/route-manifest"
export type DecisionPageContent = { eyebrow: string; headline: string; body: string; sections: readonly { title: string; body: string; items?: readonly { title: string; body: string }[]; link?: { label: string; href: string } }[] }
export function DecisionPage({ path, content }: { path: PublicPath; content: DecisionPageContent }) {
return <div className="space-y-16 pb-16"><SeoPageJsonLd path={path} /><SeoBreadcrumbs path={path} /><Hero eyebrow={content.eyebrow} headline={content.headline} body={content.body} primaryCta={{ label: "Scope an assessment", href: "/assessment" }} secondaryCta={{ label: "See a sample decision brief", href: "/demo#decision-brief" }} />{content.sections.map(section => <SectionShell key={section.title} deferRendering={false}><div className="space-y-8"><SectionHeader headline={section.title} body={section.body} />{section.items ? <AssessmentCards items={section.items} /> : null}{section.link ? <Link prefetch={false} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href={section.link.href}>{section.link.label} →</Link> : null}</div></SectionShell>)}<RelatedSeoLinks path={path} /><SectionShell deferRendering={false}><CtaBand eyebrow="Proof before autonomy" headline="Start with one capacity question." body="Agree the decision, evidence boundary, responsibilities, and paid scope before work begins." label="Scope an assessment" href="/assessment#scope" /></SectionShell></div>
}
