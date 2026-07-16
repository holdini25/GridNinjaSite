import type { Metadata } from "next"
import Link from "next/link"

import { GridNinjaMark } from "@/components/brand/gridninja-logo"
import { ContactForm } from "@/components/forms/contact-form"
import { SectionShell } from "@/components/layout/section-shell"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import {
  contactHero,
  contactNextSteps,
  contactTrustCommitments,
} from "@/content/copy/contact"
import { createPageMetadata } from "@/lib/seo"

export const dynamic = "force-static"

export const metadata: Metadata = createPageMetadata({ path: "/contact" })

export default function ContactPage() {
  return (
    <div className="relative overflow-hidden bg-[#070A0D] pb-20 sm:pb-24">
      <SeoPageJsonLd path="/contact" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[52rem] opacity-[0.16] [background-image:linear-gradient(rgba(159,176,191,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(159,176,191,0.16)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />

      <SectionShell
        deferRendering={false}
        className="relative pt-7 sm:pt-12 lg:pt-14"
        containerClassName="max-w-[73.75rem]"
      >
        <div className="grid items-start gap-6 sm:gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-16">
          <div className="contents lg:col-span-5 lg:block lg:pt-5">
            <div className="order-1">
              <div className="flex items-center gap-3">
                <GridNinjaMark
                  variant="proof-core"
                  className="size-7"
                  priority
                />
                <p className="gn-eyebrow">{contactHero.eyebrow}</p>
              </div>

              <h1 className="mt-5 max-w-[11ch] text-balance text-[2.5rem] leading-[0.98] font-medium tracking-tight text-foreground sm:mt-6 sm:text-[3.1rem] lg:text-[3.5rem]">
                {contactHero.headline}
              </h1>
              <p className="mt-3 max-w-xl text-[0.9375rem] leading-7 text-muted-foreground sm:mt-6 sm:text-[1.05rem] sm:leading-8">
                {contactHero.body}
              </p>
            </div>

            <section
              aria-labelledby="contact-safeguards"
              className="order-3 mt-5 rounded-[1.25rem] border border-white/10 bg-[#0D151C]/90 p-4 sm:mt-8 sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="gn-eyebrow text-proof-cyan">Assessment safeguards</p>
                  <h2
                    id="contact-safeguards"
                    className="mt-2 text-base font-medium tracking-tight text-foreground"
                  >
                    Proof-first, access-bounded engagement.
                  </h2>
                </div>
                <span className="mt-0.5 shrink-0 rounded-full border border-white/10 bg-background/50 px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
                  01—04
                </span>
              </div>

              <ul
                className="mt-4 grid gap-2 sm:grid-cols-2"
                aria-label="Intake commitments"
              >
                {contactTrustCommitments.map((commitment) => (
                  <li
                    key={commitment}
                    className="flex min-h-16 items-center gap-3 rounded-xl border border-white/[0.08] bg-background/35 px-3 py-3 text-sm font-medium leading-5 text-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-7 shrink-0 place-items-center rounded-lg border border-signal/30 bg-signal/10 text-signal"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="size-3.5"
                      >
                        <path d="m3.25 8.25 2.9 2.9 6.6-6.45" />
                      </svg>
                    </span>
                    <span>{commitment}</span>
                  </li>
                ))}
              </ul>

              <div
                className="mt-4 border-t border-white/[0.08] pt-3"
                data-seo-related-source="/contact"
                data-seo-related-paths='["/proof"]'
                data-seo-route-tier="0"
              >
                <Link
                  href="/proof"
                  prefetch={false}
                  className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-proof-cyan transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-proof-cyan/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D151C] motion-reduce:transition-none"
                  data-seo-related-target="/proof"
                >
                  View proof before autonomy
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </section>
          </div>

          <div className="order-2 min-w-0 lg:col-span-7">
            <ContactForm />
          </div>
        </div>

        <section
          aria-labelledby="contact-next-steps"
          className="mt-12 border-t border-white/10 pt-7 sm:mt-16"
        >
          <h2 id="contact-next-steps" className="sr-only">
            What happens next
          </h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {contactNextSteps.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[auto_1fr] gap-3">
                <span className="font-mono text-sm text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-medium text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </SectionShell>
    </div>
  )
}
