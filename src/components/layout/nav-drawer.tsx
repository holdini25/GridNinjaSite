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
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className="border-border/80 bg-surface/80 text-foreground lg:hidden"
        >
          <MenuIcon />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="border-border bg-background/98 px-0 text-foreground"
      >
        <SheetHeader className="border-b border-border/70">
          <SheetTitle>
            <GridNinjaLogo
              className="gap-2.5"
              markClassName="size-8"
              textClassName="text-sm"
            />
          </SheetTitle>
          <SheetDescription>
            Runtime-assured virtual capacity for AI data centers.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 py-6">
          {navItems.map((item) => {
            const itemActive = item.children
              ? item.children.some((child) => isPathActive(child.href))
              : isPathActive(item.href)

            return (
              <div key={item.label} className="flex flex-col gap-3">
                <SheetClose asChild>
                  <Link
                    href={item.href}
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
          <Button asChild size="lg" className="w-full">
            <Link href={buildLeadHref("capacity-audit", "mobile-nav")}>
              Request Capacity Audit
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
