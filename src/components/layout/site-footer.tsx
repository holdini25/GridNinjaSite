import Link from "next/link"

import { GridNinjaMark } from "@/components/brand/gridninja-logo"
import { footerGroups } from "@/content/nav"
import { siteConfig } from "@/content/site"

import { SectionShell } from "./section-shell"

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70 bg-background/95">
      <SectionShell className="py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <div className="grid w-fit max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
              <GridNinjaMark
                variant="detailed"
                className="row-start-1 size-[4.5rem] sm:row-span-2"
              />
              <span className="font-medium tracking-[0.14em] text-foreground uppercase sm:text-[1.05rem]">
                GridNinja
              </span>
              <span className="col-span-2 whitespace-nowrap font-mono text-[0.6rem] leading-tight tracking-[0.05em] text-muted-foreground uppercase sm:col-span-1 sm:col-start-2">
                Infrastructure · Intelligence · Control
              </span>
            </div>
            <h2 className="max-w-md text-[1.9rem] font-medium text-foreground">
              {siteConfig.footerCopy}
            </h2>
            <p className="max-w-md text-base leading-8 text-muted-foreground">
              Unlock safe, usable, auditable capacity from constrained AI infrastructure.
            </p>
          </div>
          {footerGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="text-base font-medium text-foreground">{group.title}</h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      className="text-base text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionShell>
    </footer>
  )
}
