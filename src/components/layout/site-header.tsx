"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useEffectEvent, useRef, useState } from "react"

import { ChevronDownIcon } from "lucide-react"

import { navItems } from "@/content/nav"
import { buildLeadHref } from "@/lib/lead"
import { cn } from "@/lib/utils"

import { GridNinjaLogo } from "@/components/brand/gridninja-logo"
import { NavDrawer } from "@/components/layout/nav-drawer"
import { Button } from "@/components/ui/button"

const getSubmenuId = (label: string) =>
  `primary-nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

export function SiteHeader() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [openMenu, setOpenMenu] = useState<{
    label: string
    pathname: string
    source: "click" | "hover"
  } | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const menuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const openMenuLabel =
    openMenu?.pathname === pathname ? openMenu.label : null
  const isPathActive = (href: string) =>
    href === "/"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  const handleScroll = useEffectEvent(() => {
    setScrolled(window.scrollY > 24)
  })
  const closeMenusForPathChange = useEffectEvent(() => {
    setOpenMenu(null)
  })

  useEffect(() => {
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  useEffect(() => {
    closeMenusForPathChange()
  }, [pathname])

  useEffect(() => {
    if (!openMenuLabel) {
      return
    }

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown)

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown)
    }
  }, [openMenuLabel])

  const openMenuOnHover = (label: string) => {
    setOpenMenu((currentMenu) =>
      currentMenu?.label === label &&
      currentMenu.pathname === pathname &&
      currentMenu.source === "click"
        ? currentMenu
        : { label, pathname, source: "hover" }
    )
  }

  const toggleMenu = (label: string) => {
    setOpenMenu((currentMenu) => {
      const isCurrentMenu =
        currentMenu?.label === label && currentMenu.pathname === pathname

      if (isCurrentMenu && currentMenu.source === "click") {
        return null
      }

      return { label, pathname, source: "click" }
    })
  }

  const closeMenuAndRestoreFocus = (label: string) => {
    setOpenMenu(null)
    menuTriggerRefs.current[label]?.focus()
  }

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
        <Link
          href="/"
          aria-label="GridNinja home"
          data-gn-logo-trigger
        >
          <GridNinjaLogo
            variant="micro"
            motion="micro-response"
            className="gap-2 sm:gap-2.5"
            markClassName="size-[30px] sm:size-[34px]"
            textClassName="max-[379px]:hidden text-[0.76rem] tracking-[0.16em] sm:text-[0.92rem]"
          />
        </Link>
        <nav
          ref={navRef}
          aria-label="Primary"
          className="hidden items-center gap-7 xl:flex"
        >
          {navItems.map((item) => {
            const itemActive = item.children
              ? item.children.some((child) => isPathActive(child.href))
              : isPathActive(item.href)

            return item.children ? (
              <div
                key={item.label}
                className="relative"
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") {
                    openMenuOnHover(item.label)
                  }
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === "mouse") {
                    setOpenMenu((currentMenu) =>
                      currentMenu?.label === item.label &&
                      currentMenu.pathname === pathname &&
                      currentMenu.source === "hover"
                        ? null
                        : currentMenu
                    )
                  }
                }}
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
                    event.preventDefault()
                    event.stopPropagation()
                    closeMenuAndRestoreFocus(item.label)
                  }
                }}
              >
                <button
                  ref={(node) => {
                    menuTriggerRefs.current[item.label] = node
                  }}
                  type="button"
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1.5 text-base text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                    itemActive && "text-foreground"
                  )}
                  aria-controls={getSubmenuId(item.label)}
                  aria-expanded={openMenuLabel === item.label}
                  onClick={() => toggleMenu(item.label)}
                >
                  {item.label}
                  <ChevronDownIcon
                    className={cn(
                      "size-4 transition-transform",
                      openMenuLabel === item.label && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </button>
                {openMenuLabel === item.label ? (
                  <div className="absolute top-full left-1/2 w-60 -translate-x-1/2 pt-3">
                    <ul
                      id={getSubmenuId(item.label)}
                      className="space-y-1 rounded-3xl border border-border/80 bg-surface/95 p-3 shadow-[0_32px_120px_-48px_rgba(7,17,26,0.82)]"
                    >
                      {item.children.map((child) => {
                        const childActive = isPathActive(child.href)

                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                "block rounded-xl border border-transparent px-4 py-3 text-base text-muted-foreground transition-all hover:border-border/80 hover:bg-surface-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                                childActive &&
                                  "border-border/80 bg-surface-2 text-foreground"
                              )}
                              onClick={() => setOpenMenu(null)}
                            >
                              {child.label}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}
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
