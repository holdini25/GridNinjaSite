"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { MenuIcon } from "lucide-react"

import { navItems } from "@/content/nav"
import { buildLeadHref } from "@/lib/lead"
import { cn } from "@/lib/utils"

import { GridNinjaLogo } from "@/components/brand/gridninja-logo"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function NavDrawer() {
  const pathname = usePathname()
  const isPathActive = (href: string) =>
    href === "/"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Sheet key={pathname}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className="border-border/80 bg-surface/80 text-foreground xl:hidden"
        >
          <MenuIcon />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="overflow-hidden border-border bg-background/98 px-0 text-foreground"
      >
        <SheetHeader className="border-b border-border/70">
          <SheetTitle>
            <SheetClose asChild>
              <Link
                href="/"
                prefetch={false}
                aria-label="GridNinja home"
                data-gn-logo-trigger
              >
                <GridNinjaLogo
                  variant="micro"
                  motion="micro-response"
                  className="gap-2.5"
                  markClassName="size-[36px]"
                  textClassName="text-sm"
                />
              </Link>
            </SheetClose>
          </SheetTitle>
          <SheetDescription>
            Runtime-assured virtual capacity for AI data centers.
          </SheetDescription>
        </SheetHeader>
        <nav
          aria-label="Primary"
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          {navItems.map((item) => {
            const itemActive = item.children
              ? item.children.some((child) => isPathActive(child.href))
              : isPathActive(item.href)

            return (
              <div key={item.label} className="flex flex-col gap-3">
                <SheetClose asChild>
                  <Link
                    href={item.href}
                    prefetch={false}
                    aria-current={isPathActive(item.href) ? "page" : undefined}
                    className={cn(
                      "rounded-xl px-3 py-2 text-base font-medium tracking-wide text-foreground transition-colors hover:bg-surface-2 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/45",
                      itemActive && "bg-surface-2 text-primary"
                    )}
                  >
                    {item.label}
                  </Link>
                </SheetClose>
                {item.children ? (
                  <div className="flex flex-col gap-2 border-l border-border/70 pl-4">
                    {item.children.map((child) => {
                      const childActive = isPathActive(child.href)

                      return (
                        <SheetClose key={child.href} asChild>
                          <Link
                            href={child.href}
                            prefetch={false}
                            aria-current={childActive ? "page" : undefined}
                            className={cn(
                              "rounded-lg px-3 py-2 text-base text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                              childActive && "bg-surface-2 text-foreground"
                            )}
                          >
                            {child.label}
                          </Link>
                        </SheetClose>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
          <SheetClose asChild>
            <Button asChild size="lg" className="w-full">
              <Link
                href={buildLeadHref("capacity-audit", "mobile-nav")}
                prefetch={false}
                data-gn-event="mobile-nav-capacity-audit"
              >
                Request Capacity Audit
              </Link>
            </Button>
          </SheetClose>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
