import type { Metadata } from "next"
import Link from "next/link"

import { GridNinjaMark } from "@/components/brand/gridninja-logo"
import { ContactConfirmation } from "@/components/forms/contact-confirmation"
import { SectionShell } from "@/components/layout/section-shell"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { createPageMetadata } from "@/lib/seo"

export const dynamic = "force-static"

export const metadata: Metadata = createPageMetadata({ path: "/contact/thanks" })

export default function ContactThanksPage() {
  return (
    <SectionShell
      deferRendering={false}
      className="py-16 sm:py-24"
      containerClassName="max-w-3xl"
    >
      <SeoPageJsonLd path="/contact/thanks" />
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/contact" className="hover:text-foreground">
          Contact
        </Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <span aria-current="page">Inquiry reference</span>
      </nav>

      <div className="mt-8 rounded-2xl border border-white/10 bg-[#0D151C] p-6 sm:p-9">
        <div className="flex items-center gap-3">
          <GridNinjaMark variant="proof-core" className="size-8" priority />
          <p className="gn-eyebrow">Scoped review</p>
        </div>
        <h1 className="mt-6 text-[2.5rem] leading-tight font-medium text-foreground sm:text-[3.25rem]">
          Check your inquiry receipt.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
          A confirmed receipt appears below only when this browser tab holds a
          valid response from the intake service. Keep your reference for any follow-up.
        </p>

        <ContactConfirmation />

        <Link
          href="/proof"
          prefetch={false}
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-proof-cyan hover:border-proof-cyan/50 hover:text-foreground"
          data-seo-related-target="/proof"
        >
          Review proof before autonomy
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </SectionShell>
  )
}
