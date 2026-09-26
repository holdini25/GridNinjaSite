import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DrawerDialogProps } from "@/components/layout/nav-drawer-dialog"

const { load } = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock("next/navigation", () => ({ usePathname: () => "/" }))
vi.mock("@/components/layout/nav-drawer-loader", () => ({ loadNavigationDrawer: load }))
import { NavDrawer } from "@/components/layout/nav-drawer"

function DrawerStub({ open, dialogId }: DrawerDialogProps) {
  return open ? <div role="dialog" id={dialogId} aria-label="Site navigation">Navigation loaded</div> : null
}
const drawerModule = { default: DrawerStub }
function deferred() {
  let resolve!: (value: typeof drawerModule) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<typeof drawerModule>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
beforeEach(() => { load.mockReset() })
afterEach(cleanup)

describe("deferred navigation recovery", () => {
  it("exposes visible recovery and a native footer destination without claiming a dialog is open", async () => {
    const first = deferred()
    load.mockReturnValue(first.promise)
    render(<NavDrawer />)
    const trigger = screen.getByRole("button", { name: "Open navigation" })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-busy", "true")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).not.toHaveAttribute("aria-haspopup")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await act(async () => first.reject(new Error("chunk unavailable")))
    const failure = screen.getByTestId("navigation-load-error")
    expect(within(failure).getByRole("alert")).toBeVisible()
    expect(within(failure).getByRole("alert")).not.toHaveClass("sr-only")
    expect(within(failure).getByRole("link", { name: "Use footer navigation" })).toHaveAttribute("href", "#footer-navigation")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    load.mockResolvedValue(drawerModule)
    fireEvent.click(within(failure).getByRole("button", { name: "Retry navigation" }))
    expect(await screen.findByRole("dialog", { name: "Site navigation" })).toBeVisible()
    expect(screen.queryByTestId("navigation-load-error")).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog")
  })

  it("cancels pending open on Escape and ignores the late completion", async () => {
    const request = deferred()
    load.mockReturnValue(request.promise)
    render(<NavDrawer />)
    const trigger = screen.getByRole("button", { name: "Open navigation" })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).not.toHaveAttribute("aria-busy")
    await act(async () => request.resolve(drawerModule))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(trigger)
    expect(screen.getByRole("dialog")).toBeVisible()
  })

  it("leaves footer navigation usable during Retry and prevents a late modal from interrupting it", async () => {
    load.mockRejectedValue(new Error("chunk unavailable"))
    render(<NavDrawer />)
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }))
    const retry = await screen.findByRole("button", { name: "Retry navigation" })
    const request = deferred()
    load.mockReturnValue(request.promise)
    fireEvent.click(retry)
    expect(retry).toBeDisabled()
    fireEvent.click(screen.getByRole("link", { name: "Use footer navigation" }))
    expect(screen.queryByTestId("navigation-load-error")).not.toBeInTheDocument()
    await act(async () => request.resolve(drawerModule))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false")
  })

  it("does not announce an unsolicited error when pointer prewarming fails", async () => {
    load.mockRejectedValue(new Error("prefetch unavailable"))
    render(<NavDrawer />)
    await act(async () => { fireEvent.pointerEnter(screen.getByRole("button", { name: "Open navigation" })) })
    expect(load).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
