/** Progressive enhancement for server-rendered navigation. Loaded after menu use. */
export function enhanceHeader(header) {
  if (header.dataset.enhanced === "true") return
  header.dataset.enhanced = "true"
  const desktopMenus = [...header.querySelectorAll('[data-desktop-navigation] > details')]
  const mobileMenu = header.querySelector("[data-mobile-menu]")
  const mobileTrigger = mobileMenu?.querySelector(":scope > summary")
  const mobilePanel = mobileMenu?.querySelector('[role="dialog"]')

  for (const menu of desktopMenus) {
    const trigger = menu.querySelector(":scope > summary")
    let openedByClick = false

    menu.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" || openedByClick) return
      menu.open = true
    })
    menu.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse" && !openedByClick) menu.open = false
    })
    if (menu.matches(":hover") && matchMedia("(hover: hover) and (pointer: fine)").matches) {
      menu.open = true
    }
    trigger?.addEventListener("click", (event) => {
      if (menu.open && !openedByClick) {
        event.preventDefault()
        openedByClick = true
      } else {
        openedByClick = !menu.open
      }
    })
    menu.addEventListener("focusout", (event) => {
      if (!menu.contains(event.relatedTarget)) {
        menu.open = false
        openedByClick = false
      }
    })
    menu.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !menu.open) return
      event.preventDefault()
      event.stopPropagation()
      menu.open = false
      openedByClick = false
      trigger?.focus()
    })
    menu.addEventListener("toggle", () => {
      if (!menu.open) openedByClick = false
    })
    document.addEventListener("pointerdown", (event) => {
      if (menu.contains(event.target)) return
      menu.open = false
      openedByClick = false
    })
  }

  if (!mobileMenu || !mobilePanel) return

  const desktop = matchMedia("(min-width: 1120px)")
  const closeButton = mobilePanel.querySelector("[data-mobile-nav-close]")
  if (closeButton) closeButton.hidden = false
  const inertState = new Map()
  let locked = false
  let previousOverflow = ""
  const restoreFocus = () => {
    const destination = desktop.matches ? header.querySelector("a[aria-label='GridNinja home']") : mobileTrigger
    destination?.focus({ preventScroll: true })
  }
  const isolate = () => {
    for (let node = mobilePanel; node && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement?.children ?? []) {
        if (sibling === node || sibling.tagName === "SCRIPT" || sibling.tagName === "STYLE" || sibling.matches('[aria-hidden="true"]')) continue
        inertState.set(sibling, sibling.hasAttribute("inert"))
        sibling.setAttribute("inert", "")
      }
    }
  }
  const syncMobile = () => {
    const open = mobileMenu.open && !desktop.matches
    mobilePanel.setAttribute("aria-modal", open ? "true" : "false")
    mobileTrigger?.setAttribute("aria-label", open ? "Close navigation" : "Open navigation")
    if (open && !locked) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      isolate()
      locked = true
      ;(closeButton ?? mobilePanel.querySelector('a[href]'))?.focus({ preventScroll: true })
    } else if (!open && locked) {
      document.body.style.overflow = previousOverflow
      for (const [node, value] of inertState) node.toggleAttribute("inert", value)
      inertState.clear()
      locked = false
    }
  }
  mobileMenu.addEventListener("toggle", () => {
    const wasLocked = locked
    syncMobile()
    if (!mobileMenu.open && wasLocked) restoreFocus()
  })
  mobileMenu.querySelector(':scope > [aria-hidden="true"]')?.addEventListener("click", () => {
    mobileMenu.open = false
  })
  closeButton?.addEventListener("click", () => { mobileMenu.open = false })
  mobilePanel.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = event.target.closest("a[href]")
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return
    // Client navigation may preserve the header; release its modal state before routing.
    mobileMenu.open = false
    syncMobile()
  })
  desktop.addEventListener("change", () => {
    // Layout can hide the drawer and clear activeElement before this callback.
    // Its live modal lock proves focus still needs a visible return destination.
    const hadFocus = locked || mobileMenu.contains(document.activeElement)
    if (desktop.matches) mobileMenu.open = false
    syncMobile()
    if (hadFocus) restoreFocus()
  })
  addEventListener("pagehide", () => { mobileMenu.open = false; syncMobile() })
  mobileMenu.addEventListener("keydown", (event) => {
    if (!mobileMenu.open) return
    if (event.key === "Escape") {
      event.preventDefault()
      mobileMenu.open = false
      syncMobile()
      restoreFocus()
      return
    }
    if (event.key !== "Tab") return
    const focusable = [...mobilePanel.querySelectorAll('a[href], summary, button:not([disabled])')]
      .filter((element) => element.getClientRects().length > 0)
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!mobilePanel.contains(document.activeElement)) {
      event.preventDefault()
      const destination = event.shiftKey ? last : first
      destination.focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
  syncMobile()
}
