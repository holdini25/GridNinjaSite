"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useEffectEvent, useRef, useState } from "react"

import { ChevronDownIcon } from "lucide-react"

import { headerCapacityAuditHref, navItems } from "@/content/nav"
import {
  getMostSpecificActiveHref,
  isNavPathActive,
} from "@/lib/navigation"
import { cn } from "@/lib/utils"

import { GridNinjaLogo } from "@/components/brand/gridninja-logo"
import { NavDrawer } from "@/components/layout/nav-drawer"
import { Button } from "@/components/ui/button"

const getSubmenuId = (label: string) =>
  `primary-nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

const getDescriptionId = (group: string, label: string) =>
  `${getSubmenuId(group)}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-description`

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
        "sticky top-0 z-50 h-[70px] border-b border-border/55 px-3 transition-colors duration-150 sm:px-5 lg:px-6",
        scrolled
          ? "bg-background/94 backdrop-blur-xl"
          : "bg-background/90 backdrop-blur-md"
      )}
    >
      <div
        className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3"
      >
        <Link
          href="/"
          prefetch={false}
          aria-label="GridNinja home"
          data-gn-logo-trigger
          className="flex min-h-11 shrink-0 items-center"
        >
          <GridNinjaLogo
            variant="micro"
            motion="micro-response"
            className="gap-2 sm:gap-2.5"
            markClassName="size-[34px]"
            textClassName="max-[379px]:hidden text-[0.76rem] tracking-[0.16em] sm:text-[0.92rem]"
          />
        </Link>
        <nav
          ref={navRef}
          aria-label="Primary"
          className="hidden items-center gap-1 min-[1120px]:flex"
        >
          {navItems.map((item) => {
            const hasChildren = "children" in item
            const activeChildHref = hasChildren
              ? getMostSpecificActiveHref(
                  pathname,
                  item.children.map((child) => child.href)
                )
              : undefined
            const itemActive = hasChildren
              ? activeChildHref !== undefined
              : isNavPathActive(pathname, item.href)

            return hasChildren ? (
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
                  data-nav-active={itemActive ? "true" : "false"}
                  className={cn(
                    "relative flex h-10 items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-white/[0.035] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
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
                  {itemActive ? (
                    <span
                      data-nav-active-indicator
                      aria-hidden="true"
                      className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"
                    />
                  ) : null}
                </button>
                {openMenuLabel === item.label ? (
                  <div className="absolute top-full left-1/2 w-[360px] -translate-x-1/2 pt-[15px]">
                    <ul
                      id={getSubmenuId(item.label)}
                      className="max-h-[calc(100dvh-5.5rem)] space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-border/80 bg-surface/98 p-2 shadow-[0_22px_64px_-34px_rgba(7,17,26,0.78)]"
                    >
                      {item.children.map((child) => {
                        const childActive = child.href === activeChildHref
                        const descriptionId = getDescriptionId(
                          item.label,
                          child.label
                        )

                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              prefetch={false}
                              aria-current={childActive ? "page" : undefined}
                              aria-label={child.label}
                              aria-describedby={descriptionId}
                              className={cn(
                                "block rounded-lg border border-transparent px-4 py-3 text-muted-foreground transition-colors duration-150 hover:border-border/70 hover:bg-white/[0.035] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                                childActive &&
                                  "border-border/80 bg-surface-2 text-foreground"
                              )}
                              onClick={() => setOpenMenu(null)}
                            >
                              <span className="flex items-center gap-2 text-[15px] font-medium text-foreground">
                                {childActive ? (
                                  <span
                                    aria-hidden="true"
                                    className="size-1.5 rounded-full bg-primary"
                                  />
                                ) : null}
                                {child.label}
                              </span>
                              <span
                                id={descriptionId}
                                className="mt-1 block text-sm leading-5 text-muted-foreground"
                              >
                                {child.description}
                              </span>
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
                prefetch={false}
                aria-current={itemActive ? "page" : undefined}
                data-nav-active={itemActive ? "true" : "false"}
                onFocus={() => setOpenMenu(null)}
                className={cn(
                  "relative flex h-10 items-center whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-white/[0.035] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45",
                  itemActive && "text-foreground"
                )}
              >
                {item.label}
                {itemActive ? (
                  <span
                    data-nav-active-indicator
                    aria-hidden="true"
                    className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"
                  />
                ) : null}
              </Link>
            )
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            asChild
            className="h-11 whitespace-nowrap rounded-[9px] px-4 text-sm shadow-none max-[1119px]:px-3 min-[1120px]:hidden"
          >
            <Link
              href={headerCapacityAuditHref}
              prefetch={false}
              data-gn-event="header-capacity-audit"
            >
              Request Audit
            </Link>
          </Button>
          <Button
            asChild
            className="hidden h-11 whitespace-nowrap rounded-[9px] px-4 text-sm shadow-none min-[1120px]:inline-flex"
          >
            <Link
              href={headerCapacityAuditHref}
              prefetch={false}
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
