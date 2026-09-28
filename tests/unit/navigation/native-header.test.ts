import { afterEach, describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { enhanceHeader } from "../../../public/header-controls.mjs"
import { SiteHeader } from "@/components/layout/site-header"
import { testMatchMedia } from "../../support/match-media"

function mount() {
  document.body.innerHTML = `<div><header id="site-header"><a aria-label="GridNinja home" href="/">Home</a><details data-mobile-menu><summary>Open navigation</summary><div aria-hidden="true"></div><div role="dialog"><button hidden data-mobile-nav-close>Close navigation</button><a href="#main-content">Sample brief</a></div></details></header><main id="main-content">Decision</main><footer inert>Footer</footer></div>`
  const header = document.querySelector<HTMLElement>("header")!
  const menu = document.querySelector<HTMLDetailsElement>("details")!
  enhanceHeader(header)
  menu.open = true
  menu.dispatchEvent(new Event("toggle"))
  return { header, menu, main: document.querySelector<HTMLElement>("main")!, panel: document.querySelector<HTMLElement>('[role="dialog"]')!, close: document.querySelector<HTMLButtonElement>("button")! }
}
afterEach(() => { window.dispatchEvent(new Event("pagehide")); document.body.innerHTML = ""; document.body.style.overflow = "" })

describe("native header modal cleanup", () => {
  it("keeps mobile accordion choices open through outer-menu presses and focus changes while desktop dismissal still works", () => {
    document.body.innerHTML = renderToStaticMarkup(createElement(SiteHeader, { logo: "GridNinja" }))
    const header = document.querySelector<HTMLElement>("header")!
    const mobileMenu = header.querySelector<HTMLDetailsElement>("[data-mobile-menu]")!
    const mobileGroup = mobileMenu.querySelector<HTMLDetailsElement>("[data-header-group]")!
    const desktopGroup = header.querySelector<HTMLDetailsElement>("[data-desktop-navigation] > details")!
    mobileGroup.open = true
    desktopGroup.open = true
    enhanceHeader(header)
    // Enhancement may resolve on pointerover, before the outer press bubbles
    // to document. Desktop outside-press handlers must not own mobile groups.
    mobileMenu.querySelector(":scope > summary")!.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))
    expect(desktopGroup.open).toBe(false)
    expect(mobileGroup.open).toBe(true)
    mobileMenu.open = true
    mobileMenu.dispatchEvent(new Event("toggle"))
    const close = header.querySelector<HTMLButtonElement>("[data-mobile-nav-close]")!
    expect(close).toHaveFocus()
    expect(mobileGroup.open).toBe(true)
    const child = mobileGroup.querySelector<HTMLAnchorElement>("a")!
    child.focus()
    close.focus()
    expect(mobileGroup.open).toBe(true)
    const pointerLeave = new MouseEvent("pointerleave")
    Object.defineProperty(pointerLeave, "pointerType", { value: "mouse" })
    mobileGroup.dispatchEvent(pointerLeave)
    expect(mobileGroup.open).toBe(true)
    mobileGroup.open = false
    const pointerEnter = new MouseEvent("pointerenter")
    Object.defineProperty(pointerEnter, "pointerType", { value: "mouse" })
    mobileGroup.dispatchEvent(pointerEnter)
    expect(mobileGroup.open).toBe(false)
  })

  it("preserves an explicit accordion choice on same-path history updates and refreshes active groups on a real route change", () => {
    // Execute the actual server bootstrap in an isolated DOM. No resource
    // loader is enabled, and no summary event requests optional enhancement.
    const dom = new JSDOM(renderToStaticMarkup(createElement(SiteHeader, { logo: "GridNinja" })), { url: "https://gridninja.test/platform/dispatch-envelope", runScripts: "dangerously" })
    try {
      const { document, history } = dom.window
      const menu = document.querySelector<HTMLDetailsElement>("[data-mobile-menu]")!
      const groups = [...menu.querySelectorAll<HTMLDetailsElement>("[data-header-group]")]
      const platform = groups[0], solutions = groups[1]
      expect(platform.open).toBe(true)
      expect(menu.querySelector('a[href="/platform/dispatch-envelope"]')).toHaveAttribute("aria-current", "page")
      platform.open = false
      solutions.open = true
      history.replaceState({}, "", "/platform/dispatch-envelope?topic=cooling")
      history.pushState({}, "", "/platform/dispatch-envelope?topic=power#evidence")
      dom.window.dispatchEvent(new dom.window.PopStateEvent("popstate"))
      expect(platform.open).toBe(false)
      expect(solutions.open).toBe(true)
      expect(menu.querySelector('a[href="/platform/dispatch-envelope"]')).toHaveAttribute("aria-current", "page")
      history.pushState({}, "", "/evidence")
      expect(solutions.open).toBe(false)
      expect(menu.querySelector('a[href="/platform/dispatch-envelope"]')).not.toHaveAttribute("aria-current")
      expect(menu.querySelector('a[href="/evidence"]')).toHaveAttribute("aria-current", "page")
      expect(groups[2].open).toBe(true)
      history.replaceState({}, "", "/platform/dispatch-envelope")
      expect(platform.open).toBe(true)
      expect(groups[2].open).toBe(false)
    } finally { dom.window.close() }
  })

  it("focuses a visible close action, isolates the page, and restores original inertness on Escape", () => {
    const { menu, main, panel, close } = mount()
    expect(panel).toHaveAttribute("aria-modal", "true")
    expect(close).toHaveFocus()
    expect(main).toHaveAttribute("inert")
    expect(document.body.style.overflow).toBe("hidden")
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    expect(menu.open).toBe(false)
    expect(main).not.toHaveAttribute("inert")
    expect(document.querySelector("footer")).toHaveAttribute("inert")
    expect(document.body.style.overflow).toBe("")
    expect(menu.querySelector("summary")).toHaveFocus()
  })
  it("cleans up the hidden drawer when crossing the desktop breakpoint", () => {
    const { menu, main, header } = mount()
    // Real browsers clear focus as CSS hides the drawer before matchMedia fires.
    ;(document.activeElement as HTMLElement).blur()
    testMatchMedia.setMatches("(min-width: 1120px)", true)
    expect(menu.open).toBe(false)
    expect(main).not.toHaveAttribute("inert")
    expect(document.body.style.overflow).toBe("")
    expect(header.querySelector("a")).toHaveFocus()
  })
  it("releases the modal synchronously for native or client link navigation while preserving modified clicks", () => {
    const { menu, main, panel } = mount()
    const link = panel.querySelector("a")!
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }))
    expect(menu.open).toBe(true)
    link.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(menu.open).toBe(false)
    expect(main).not.toHaveAttribute("inert")
    expect(document.body.style.overflow).toBe("")
  })
})
