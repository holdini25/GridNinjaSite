import type { Metadata } from "next"

import { ContactForm } from "@/components/forms/contact-form"
import { AutonomyLadder } from "@/components/marketing/autonomy-ladder"
import { Hero } from "@/components/marketing/hero"
import { ProofLoadingSteps } from "@/components/marketing/proof-loading-steps"
import { SectionHeader } from "@/components/marketing/section-header"
import { SectionShell } from "@/components/layout/section-shell"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { RelatedSeoLinks } from "@/components/seo/related-seo-links"
import { contactHero } from "@/content/copy/contact"
import { ladderSteps } from "@/content/copy/proof"
import { proofLoadingSteps } from "@/content/proof-artifacts"
import { leadIntents } from "@/lib/constants"
import { getFirstQueryValue } from "@/lib/lead"
import { createPageMetadata } from "@/lib/seo"
import type { LeadIntent } from "@/types/site"

type ContactPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  return createPageMetadata({
    title: "Contact | GridNinja",
    description:
      "Start with a Capacity Audit and tell GridNinja about your site, constraints, and operating priorities.",
    path: "/contact",
  })
}

export default async function ContactPage({
  searchParams,
}: ContactPageProps) {
  const query = await searchParams
  const rawIntent = getFirstQueryValue(query.intent)
  const source = getFirstQueryValue(query.source) ?? "contact-page"

  const intent: LeadIntent =
    rawIntent && (leadIntents as readonly string[]).includes(rawIntent)
      ? (rawIntent as LeadIntent)
      : "capacity-audit"

  const paths = [
    {
      title: "Capacity Audit",
      body: "Turn nominal headroom into a Capacity Waterfall, Load Passport, no-proof register, and next-step proof plan.",
    },
    {
      title: "Shadow Mode / Demo",
      body: "Review the proof chain, dispatch envelope, and allow / repair / reject / no-proof behavior before live access.",
    },
    {
      title: "DCII memo",
      body: "Discuss the deployment-focused validation project, evidence outputs, source notes, and read-only boundary.",
    },
    {
      title: "Partnership",
      body: "Map how bridge power, UPS/BESS, cooling, utility, or integration partners show up as validated capacity.",
    },
  ]

  return (
    <div className="space-y-24 pb-24">
      <SeoPageJsonLd path="/contact" />
      <Hero
        eyebrow={contactHero.eyebrow}
        headline={contactHero.headline}
        body={contactHero.body}
      />

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="Engagement paths"
            headline="Every path starts with proof, not a generic demo"
            body="Pick the conversation that matches the decision in front of your team. The same intake form preserves the intent and source for downstream lead delivery."
          />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {paths.map((path) => (
              <div
                key={path.title}
                className="rounded-[1.2rem] border border-border/70 bg-surface px-5 py-6"
              >
                <h2 className="text-[1.25rem] font-medium text-foreground">
                  {path.title}
                </h2>
                <p className="mt-3 text-base leading-7 text-muted-foreground">
                  {path.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="space-y-10">
          <SectionHeader
            eyebrow="What happens next"
            headline="A proof-first path before any live authority is discussed"
            body="Capacity Audit, Shadow Mode, and design-partner conversations all start with evidence collection and visible no-proof gaps."
          />
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
            <AutonomyLadder steps={ladderSteps} layout="contact-split" />
            <ProofLoadingSteps steps={proofLoadingSteps} />
          </div>
        </div>
      </SectionShell>

      <RelatedSeoLinks path="/contact" />

      <SectionShell>
        <ContactForm intent={intent} source={source} />
      </SectionShell>
    </div>
  )
}
