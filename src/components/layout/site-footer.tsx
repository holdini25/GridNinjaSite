import Link from "next/link"

import { GridNinjaMark } from "@/components/brand/gridninja-logo"
import { footerGroups } from "@/content/nav"
import { siteConfig } from "@/content/site"
import { assessmentScopeHref } from "@/lib/marketing-journeys"

import { SectionShell } from "./section-shell"

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-divider bg-background">
      <SectionShell className="py-12">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
          <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
            <div className="grid w-fit max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
              <GridNinjaMark
                variant="detailed"
                className="row-start-1 size-[4.5rem] sm:row-span-2"
              />
              <span className="min-w-0 font-medium tracking-[0.14em] text-foreground uppercase sm:text-[1.05rem]">
                GridNinja
              </span>
              <span className="col-span-2 min-w-0 font-mono text-[0.6rem] leading-tight tracking-[0.05em] text-muted-foreground uppercase sm:col-span-1 sm:col-start-2">
                Infrastructure · Intelligence · Control
              </span>
            </div>
            <h2 className="max-w-md text-[1.9rem] font-medium text-foreground">
              {siteConfig.footerCopy}
            </h2>
            <p className="max-w-md text-base leading-8 text-muted-foreground">
              A bounded assessment today. Developing toward a runtime-assured virtual capacity engine, with proof before autonomy.
            </p>
            <Link href={assessmentScopeHref("footer")} prefetch={false} data-analytics-event="assessment_cta_selected" data-analytics-source="footer" className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">Scope an assessment <span aria-hidden="true">→</span></Link>
          </div>
          <nav id="footer-navigation" aria-label="Footer" tabIndex={-1} className="flex min-w-0 scroll-mt-24 flex-wrap gap-x-5 gap-y-8 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          {footerGroups.map((group) => (
            <div key={group.title} className="min-w-min max-w-full flex-1 basis-32 space-y-3">
              <h3 className="text-base font-medium text-foreground">{group.title}</h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      className="inline-flex min-h-11 items-center text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          </nav>
        </div>
      </SectionShell>
    </footer>
  )
}
