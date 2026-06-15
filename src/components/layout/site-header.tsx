"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useEffectEvent, useState } from "react"

import { ChevronDownIcon } from "lucide-react"

import { navItems } from "@/content/nav"
import { buildLeadHref } from "@/lib/lead"
import { cn } from "@/lib/utils"

import { GridNinjaLogo } from "@/components/brand/gridninja-logo"
import { NavDrawer } from "@/components/layout/nav-drawer"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [solutionsOpen, setSolutionsOpen] = useState(false)
  const isPathActive = (href: string) =>
    href === "/"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  const handleScroll = useEffectEvent(() => {
    setScrolled(window.scrollY > 24)
  })

  useEffect(() => {
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 px-3 py-2 transition-all duration-300 sm:px-6 sm:py-4 lg:px-8",
        scrolled
          ? "bg-background/88 backdrop-blur-xl"
          : "bg-transparent backdrop-blur-none"
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between rounded-full border px-3 py-1.5 transition-all duration-300 sm:px-5 sm:py-3",
          scrolled
            ? "border-border/80 bg-surface/92 shadow-[0_24px_90px_-48px_rgba(7,17,26,0.82)]"
            : "border-transparent bg-transparent"
        )}
      >
        <Link href="/" aria-label="GridNinja home">
          <GridNinjaLogo
            className="gap-2 sm:gap-2.5"
            markClassName="size-[1.9rem] sm:size-[2.15rem]"
            textClassName="text-[0.76rem] tracking-[0.16em] sm:text-[0.92rem]"
          />
        </Link>
        <nav className="hidden items-center gap-7 lg:flex">
          {navItems.map((item) => {
            const itemActive = item.children
              ? item.children.some((child) => isPathActive(child.href))
              : isPathActive(item.href)

            return item.children ? (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => setSolutionsOpen(true)}
                onMouseLeave={() => setSolutionsOpen(false)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSolutionsOpen(false)
                  }
                }}
              >
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1.5 text-base text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                    itemActive && "bg-surface-2 text-foreground"
                  )}
                  aria-expanded={solutionsOpen}
                  aria-haspopup="menu"
                  aria-label="Open solutions navigation"
                  onClick={() => setSolutionsOpen(true)}
                  onFocus={() => setSolutionsOpen(true)}
                >
                  {item.label}
                  <ChevronDownIcon
                    className={cn(
                      "size-4 transition-transform",
                      solutionsOpen && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "absolute top-full left-1/2 mt-3 w-60 -translate-x-1/2 rounded-3xl border border-border/80 bg-surface/95 p-3 shadow-[0_32px_120px_-48px_rgba(7,17,26,0.82)] transition-all duration-200",
                    solutionsOpen
                      ? "pointer-events-auto translate-y-0 opacity-100"
                      : "pointer-events-none -translate-y-2 opacity-0"
                  )}
                  aria-hidden={!solutionsOpen}
                  role="menu"
                >
                  <div className="space-y-1">
                    {item.children.map((child) => {
                      const childActive = isPathActive(child.href)

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          role="menuitem"
                          tabIndex={solutionsOpen ? undefined : -1}
                          className={cn(
                            "block rounded-xl border border-transparent px-4 py-3 text-base text-muted-foreground transition-all hover:border-border/80 hover:bg-surface-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                            childActive &&
                              "border-border/80 bg-surface-2 text-foreground"
                          )}
                          onClick={() => setSolutionsOpen(false)}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={itemActive ? "page" : undefined}
                className={cn(
                  "rounded-full px-2.5 py-1.5 text-base text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                  itemActive && "bg-surface-2 text-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-3">
          <Button asChild className="hidden xl:inline-flex">
            <Link
              href={buildLeadHref("capacity-audit", "header")}
              data-gn-event="header-capacity-audit"
            >
              Request Capacity Audit
            </Link>
          </Button>
          <NavDrawer />
        </div>
      </div>
    </header>
  )
}
