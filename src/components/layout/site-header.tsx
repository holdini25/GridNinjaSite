/* eslint-disable @next/next/no-html-link-for-pages -- Native links keep header navigation available without client hydration. */
import type { ReactNode } from "react"

import { ChevronDownIcon, MenuIcon } from "lucide-react"

import { MicroMark } from "@/components/brand/micro-gridninja-mark"
import { headerCapacityAuditHref, navItems } from "@/content/nav"

const menuId = (label: string, prefix: string) =>
  `${prefix}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

// Native disclosures keep every destination usable before any client JavaScript runs.
// The optional enhancement is fetched only after a menu is used.
// Native code owns active/open attributes before hydration; suppression is local
// to those nodes so React still validates their content and the rest of the header.
const headerBootstrap = `(() => {
  const header = document.getElementById("site-header")
  if (!header) return

  const matches = (pathname, href) => {
    const path = href.split(/[?#]/, 1)[0]
    return path === "/" ? pathname === path : pathname === path || pathname.startsWith(path + "/")
  }

  let markedPathname = null
  const markActive = () => {
    const pathname = location.pathname
    // Query, hash and hydration history writes do not change the active route.
    // Preserve the visitor's current disclosure instead of reopening its group.
    if (pathname === markedPathname) return
    markedPathname = pathname
    for (const node of header.querySelectorAll("[data-nav-active]")) {
      node.dataset.navActive = "false"
      node.querySelector("[data-nav-active-indicator]")?.setAttribute("hidden", "")
      node.removeAttribute("aria-current")
    }
    for (const group of header.querySelectorAll("[data-header-group]")) group.open = false

    for (const link of header.querySelectorAll("[data-nav-direct]")) {
      if (!matches(pathname, link.getAttribute("href"))) continue
      link.dataset.navActive = "true"
      link.setAttribute("aria-current", "page")
      link.querySelector("[data-nav-active-indicator]")?.removeAttribute("hidden")
    }
    for (const group of header.querySelectorAll("[data-header-group]")) {
      const activeChildren = [...group.querySelectorAll("[data-nav-child]")]
        .filter((link) => matches(pathname, link.getAttribute("href")))
        .sort((left, right) => right.getAttribute("href").length - left.getAttribute("href").length)
      if (!activeChildren.length) continue
      const summary = group.querySelector("summary")
      summary.dataset.navActive = "true"
      summary.querySelector("[data-nav-active-indicator]")?.removeAttribute("hidden")
      activeChildren[0].dataset.navActive = "true"
      activeChildren[0].setAttribute("aria-current", "page")
      if (group.closest("[data-mobile-menu]")) group.open = true
    }
  }

  markActive()
  addEventListener("popstate", markActive)
  addEventListener("gn:locationchange", markActive)
  if (!history.__gnHeaderPatched) {
    for (const method of ["pushState", "replaceState"]) {
      const original = history[method]
      history[method] = function (...args) {
        const result = original.apply(this, args)
        dispatchEvent(new Event("gn:locationchange"))
        return result
      }
    }
    history.__gnHeaderPatched = true
  }

  let loaded = false, pending = false, failed = false, attempt = 0
  const feedback = header.querySelector("[data-header-enhancement-status]")
  const load = (event) => {
    const retry = event.target.closest("[data-header-retry]")
    if (loaded || pending || (failed && !retry) || (retry && event.type !== "click") || !event.target.closest("summary, [data-header-retry]")) return
    failed = false
    pending = true
    const current = ++attempt
    const fail = () => {
      if (current !== attempt) return
      ++attempt
      pending = false
      failed = true
      if (feedback) feedback.hidden = false
    }
    const deadline = setTimeout(fail, 8000)
    import("/header-controls.mjs").then((module) => {
      if (current !== attempt) return
      clearTimeout(deadline)
      module.enhanceHeader(header)
      loaded = true
      pending = false
      if (feedback) feedback.hidden = true
    }).catch(() => { clearTimeout(deadline); fail() })
  }
  header.addEventListener("pointerover", load)
  header.addEventListener("focusin", load)
  header.addEventListener("click", load)
  header.querySelector("[data-header-fallback]")?.addEventListener("click", () => {
    const menu = header.querySelector("[data-mobile-menu]")
    if (menu) menu.open = false
    document.getElementById("footer-navigation")?.focus()
  })
})()`

function ActiveIndicator({ mobile = false }: { mobile?: boolean }) {
  return (
    <span
      data-nav-active-indicator
      suppressHydrationWarning
      hidden
      aria-hidden="true"
      className={
        mobile
          ? "size-1.5 rounded-full bg-primary"
          : "absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"
      }
    />
  )
}

function DesktopNavigation() {
  return (
    <nav data-desktop-navigation aria-label="Primary" className="hidden items-center gap-1 min-[1120px]:flex">
      {navItems.map((item) => {
        if (!("children" in item)) {
          return (
            <a
              key={item.href}
              href={item.href}
              data-nav-direct
              data-nav-active="false"
              suppressHydrationWarning
              className="relative flex h-11 items-center whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[nav-active=true]:text-foreground"
            >
              {item.label}
              <ActiveIndicator />
            </a>
          )
        }

        const id = menuId(item.label, "primary-nav")
        return (
          <details key={item.label} name="primary-navigation" data-header-group suppressHydrationWarning className="group relative">
            <summary
              aria-controls={id}
              data-nav-active="false"
              suppressHydrationWarning
              className="relative flex h-11 cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-open:bg-surface-hover group-open:text-foreground data-[nav-active=true]:text-foreground [&::-webkit-details-marker]:hidden"
            >
              {item.label}
              <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              <ActiveIndicator />
            </summary>
            <div className="absolute top-full left-1/2 w-[360px] -translate-x-1/2 pt-[15px]">
              <ul
                id={id}
                className="max-h-[calc(100dvh-5.5rem)] space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-2 p-2 shadow-[0_22px_64px_-34px_rgba(8,8,8,0.78)]"
              >
                {item.children.map((child) => (
                  <li key={child.href}>
                    <a
                      href={child.href}
                      data-nav-child
                      data-nav-active="false"
              suppressHydrationWarning
                      aria-label={child.label}
                      aria-describedby={menuId(`${item.label}-${child.label}-description`, "primary-nav")}
                      className="block rounded-lg border border-transparent px-4 py-3 text-muted-foreground transition-colors duration-150 hover:border-border hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[nav-active=true]:border-border data-[nav-active=true]:bg-surface-hover data-[nav-active=true]:text-foreground"
                    >
                      <span className="flex items-center gap-2 text-[15px] font-medium text-foreground">{child.label}</span>
                      <span
                        id={menuId(`${item.label}-${child.label}-description`, "primary-nav")}
                        className="mt-1 block text-sm leading-5 text-muted-foreground"
                      >
                        {child.description}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )
      })}
    </nav>
  )
}

function MobileNavigation() {
  return (
    <details data-mobile-menu className="relative min-[1120px]:hidden">
      <summary
        aria-label="Open navigation"
        aria-controls="mobile-site-navigation"
        className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
      >
        <MenuIcon className="size-4" aria-hidden="true" />
      </summary>
      <div aria-hidden="true" className="fixed inset-x-0 top-[70px] bottom-0 z-0 bg-black/65" />
      <div
        id="mobile-site-navigation"
        role="dialog"
        aria-label="Site navigation"
        className="fixed top-[70px] right-0 bottom-0 z-10 flex w-[min(100vw,420px)] flex-col overflow-hidden border-l border-border bg-surface-2 text-foreground shadow-2xl"
      >
        <div className="shrink-0 border-b border-divider p-4">
          <button type="button" hidden data-mobile-nav-close className="float-right min-h-11 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">Close navigation</button>
          <a href="/" aria-label="GridNinja home" data-gn-logo-trigger className="inline-flex min-h-11 items-center">
            <span className="inline-flex items-center gap-2.5">
              <span className={`gn-header-root size-[36px] shrink-0`} data-logo-motion="micro-response" data-logo-reveal="none" data-logo-revealed="true" data-logo-reveal-stage="settled">
                <MicroMark ids={{ copper: "mobile-header-mark-copper", guardian: "mobile-header-mark-guardian" }} className={"gn-header-mark"} />
              </span>
              <span className="text-sm font-medium tracking-[0.18em] uppercase">GridNinja</span>
            </span>
          </a>
          <p className="mt-1 text-sm text-muted-foreground">Capacity decisions supported by explicit evidence.</p>
        </div>
        <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-4">
          {navItems.map((item) => {
            if (!("children" in item)) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  data-nav-direct
                  data-nav-active="false"
              suppressHydrationWarning
                  className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[nav-active=true]:bg-surface-hover data-[nav-active=true]:text-primary"
                >
                  {item.label}
                </a>
              )
            }

            const id = menuId(item.label, "mobile-nav")
            return (
              <details key={item.label} name="mobile-navigation" data-header-group suppressHydrationWarning className="group flex flex-col">
                <summary
                  aria-controls={id}
                  data-nav-active="false"
              suppressHydrationWarning
                  className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-left text-base font-medium text-foreground transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[nav-active=true]:text-primary [&::-webkit-details-marker]:hidden"
                >
                  <span className="flex items-center gap-2">
                    {item.label}
                    <ActiveIndicator mobile />
                  </span>
                  <ChevronDownIcon className="size-4 transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div id={id} className="mt-1 flex flex-col gap-1 border-l border-divider py-1 pl-3">
                  {item.children.map((child) => (
                    <a
                      key={child.href}
                      href={child.href}
                      data-nav-child
                      data-nav-active="false"
              suppressHydrationWarning
                      className="flex min-h-11 items-center rounded-lg px-3 text-base text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[nav-active=true]:bg-surface-hover data-[nav-active=true]:text-foreground"
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              </details>
            )
          })}
        </nav>
        <div data-mobile-nav-footer className="shrink-0 border-t border-divider bg-surface-2 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <a
            href={headerCapacityAuditHref}
            data-gn-event="mobile-nav-capacity-audit"
            data-analytics-event="assessment_cta_selected"
            data-analytics-source="header"
            className="inline-flex h-11 w-full items-center justify-center rounded-[9px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Contact Us
          </a>
        </div>
      </div>
    </details>
  )
}

export function SiteHeader({ logo }: { logo: ReactNode }) {
  return (
    <header id="site-header" className="sticky top-0 z-50 h-[70px] border-b border-divider bg-background/98 px-3 sm:px-5 lg:px-6">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3">
        <a href="/" aria-label="GridNinja home" data-gn-logo-trigger className="flex min-h-11 w-40 min-w-11 shrink items-center [container-name:header-brand] [container-type:inline-size]">{logo}</a>
        <DesktopNavigation />
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={headerCapacityAuditHref}
            data-gn-event="header-capacity-audit"
            data-analytics-event="assessment_cta_selected"
            data-analytics-source="header"
            className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-[9px] bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-[1120px]:hidden"
          >
            Contact Us
          </a>
          <a
            href={headerCapacityAuditHref}
            data-gn-event="header-capacity-audit"
            data-analytics-event="assessment_cta_selected"
            data-analytics-source="header"
            className="hidden h-11 items-center justify-center whitespace-nowrap rounded-[9px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-[1120px]:inline-flex"
          >
            Contact Us
          </a>
          <MobileNavigation />
        </div>
      </div>
      <div hidden data-header-enhancement-status role="status" className="absolute inset-x-3 top-[70px] z-50 rounded-xl border border-input bg-surface-2 p-4 text-sm leading-6"><p>Navigation enhancements could not load. The menu links still work.</p><button type="button" data-header-retry className="mr-5 inline-flex min-h-11 items-center text-primary underline">Retry navigation</button><a href="#footer-navigation" data-header-fallback className="inline-flex min-h-11 items-center text-primary underline">Use footer navigation</a></div>
      <script dangerouslySetInnerHTML={{ __html: headerBootstrap }} />
    </header>
  )
}
