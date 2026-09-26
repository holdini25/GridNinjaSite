"use client"

import { usePathname } from "next/navigation"
import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from "react"
import { MenuIcon } from "lucide-react"
import type { DrawerDialogProps } from "./nav-drawer-dialog"
import { loadNavigationDrawer } from "./nav-drawer-loader"

export function NavDrawer() {
  const pathname = usePathname()
  return <DrawerTrigger key={pathname} pathname={pathname} />
}

/** Keep the closed dialog's focus-trap and portal code off the initial route. */
function DrawerTrigger({ pathname }: { pathname: string }) {
  const [Dialog, setDialog] = useState<ComponentType<DrawerDialogProps> | null>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const mounted = useRef(false), requested = useRef(false)
  const dialogId = useId()
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; requested.current = false }
  }, [])
  const prepare = useCallback(async () => {
    try {
      const drawerModule = await loadNavigationDrawer()
      if (!mounted.current) return
      setDialog(() => drawerModule.default)
      setPending(false)
      setFailed(false)
      setOpen(requested.current)
    } catch {
      if (!mounted.current) return
      setPending(false)
      if (requested.current) setFailed(true)
      requested.current = false
    }
  }, [])
  const changeOpen = useCallback((next: boolean) => {
    requested.current = next
    setOpen(next)
    if (!next) setPending(false)
  }, [])
  useEffect(() => {
    if (!pending && !failed) return
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") { requested.current = false; setPending(false); setFailed(false); trigger.current?.focus() }
    }
    document.addEventListener("keydown", cancel)
    return () => document.removeEventListener("keydown", cancel)
  }, [pending, failed])
  return <div className="relative min-[1120px]:hidden">
    <button ref={trigger} type="button" aria-haspopup={Dialog ? "dialog" : undefined} aria-expanded={open}
      aria-controls={Dialog ? dialogId : undefined} aria-busy={pending || undefined}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-foreground transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      onPointerEnter={prepare} onFocus={prepare}
      onClick={() => {
        const next = !requested.current
        requested.current = next
        setFailed(false)
        if (!next || Dialog) changeOpen(next)
        else { setPending(true); prepare() }
      }}>
      {pending ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true" /> : <MenuIcon className="size-4" aria-hidden="true" />}
      <span className="sr-only">Open navigation</span>
    </button>
    <span role="status" className="sr-only">{pending ? "Loading navigation…" : ""}</span>
    {failed && <div className="absolute top-[calc(100%+0.75rem)] right-0 w-[min(19rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-surface-2 p-4 shadow-xl" data-testid="navigation-load-error">
      <p role="alert" className="text-sm leading-6 text-foreground">Navigation could not load. Retry, or use the links in the footer.</p>
      <div className="mt-2 flex flex-wrap gap-x-4">
        <button type="button" disabled={pending} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => { requested.current = true; setPending(true); prepare() }}>Retry navigation</button>
        <a href="#footer-navigation" className="inline-flex min-h-11 items-center text-sm text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => { requested.current = false; setPending(false); setFailed(false) }}>Use footer navigation</a>
      </div>
    </div>}
    {Dialog && <Dialog pathname={pathname} open={open} onOpenChange={changeOpen} trigger={trigger} dialogId={dialogId} />}
  </div>
}
