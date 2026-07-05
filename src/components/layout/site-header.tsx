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
  const [openMenu, setOpenMenu] = useState<string | null>(null)
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
        "sticky top-0 z-50 border-b border-border/55 px-4 py-3 transition-all duration-300 sm:px-6 lg:px-8",
        scrolled
          ? "bg-background/92 backdrop-blur-xl"
          : "bg-background/86 backdrop-blur-md"
      )}
    >
      <div
        className="mx-auto flex max-w-7xl items-center justify-between gap-6"
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
                onMouseEnter={() => setOpenMenu(item.label)}
                onMouseLeave={() => setOpenMenu(null)}
                onBlur={(event) => {
                  if (
                    !event.currentTarget.contains(
                      event.relatedTarget as Node | null
                    )
                  ) {
                    setOpenMenu(null)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpenMenu(null)
                  }
                }}
              >
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1.5 text-base text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                    itemActive && "text-foreground"
                  )}
                  aria-current={itemActive ? "page" : undefined}
                  aria-expanded={openMenu === item.label}
                  aria-haspopup="menu"
                  onClick={() => setOpenMenu(item.label)}
                  onFocus={() => setOpenMenu(item.label)}
                >
                  {item.label}
                  <ChevronDownIcon
                    className={cn(
                      "size-4 transition-transform",
                      openMenu === item.label && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "absolute top-full left-1/2 w-60 -translate-x-1/2 pt-3 transition-all duration-200",
                    openMenu === item.label
                      ? "pointer-events-auto translate-y-0 opacity-100"
                      : "pointer-events-none -translate-y-2 opacity-0"
                  )}
                  aria-hidden={openMenu !== item.label}
                  role="menu"
                >
                  <div className="space-y-1 rounded-3xl border border-border/80 bg-surface/95 p-3 shadow-[0_32px_120px_-48px_rgba(7,17,26,0.82)]">
                    {item.children.map((child) => {
                      const childActive = isPathActive(child.href)

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          role="menuitem"
                          tabIndex={openMenu === item.label ? undefined : -1}
                          className={cn(
                            "block rounded-xl border border-transparent px-4 py-3 text-base text-muted-foreground transition-all hover:border-border/80 hover:bg-surface-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                            childActive &&
                              "border-border/80 bg-surface-2 text-foreground"
                          )}
                          onClick={() => setOpenMenu(null)}
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
                onFocus={() => setOpenMenu(null)}
                className={cn(
                  "rounded-full px-2.5 py-1.5 text-base text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                  itemActive && "text-foreground"
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
