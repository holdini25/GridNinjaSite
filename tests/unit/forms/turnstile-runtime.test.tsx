import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { TurnstileField, type TurnstileFieldHandle } from "@/components/forms/turnstile-runtime"

afterEach(() => { cleanup(); delete window.turnstile; document.getElementById("gridninja-cloudflare-turnstile")?.remove(); vi.useRealTimers(); vi.unstubAllEnvs() })

it("times out a stalled verification script and retries with a new request", async () => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "local-test-key")
  vi.useFakeTimers()
  const token = vi.fn()
  render(<TurnstileField action="contact" onTokenChange={token} />)
  const first = document.querySelector<HTMLScriptElement>("#gridninja-cloudflare-turnstile")!
  expect(first.src).toContain("challenges.cloudflare.com")
  await act(async () => { await vi.advanceTimersByTimeAsync(10_001) })
  expect(screen.getByRole("alert").textContent).toContain("could not load")
  expect(token).toHaveBeenLastCalledWith("")
  expect(first.isConnected).toBe(false)
  fireEvent.click(screen.getByRole("button", { name: "Retry verification" }))
  const second = document.querySelector<HTMLScriptElement>("#gridninja-cloudflare-turnstile")!
  expect(second).not.toBe(first)
  window.turnstile = { render: vi.fn(() => "widget"), reset: vi.fn(), remove: vi.fn() }
  await act(async () => { second.dispatchEvent(new Event("load")) })
  expect(window.turnstile.render).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("button", { name: "Retry verification" })).toBeNull()
})

it("invalidates old widget callbacks across action changes and clears failed tokens", async () => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "local-test-key")
  const renderWidget = vi.fn(() => "widget"), token = vi.fn()
  window.turnstile = { render: renderWidget, reset: vi.fn(), remove: vi.fn() }
  const { rerender } = render(<TurnstileField action="contact" onTokenChange={token} />)
  await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1))
  type Callbacks = { callback: (token: string) => void; "error-callback": () => void }
  const old = (renderWidget.mock.calls[0] as unknown as [HTMLElement, Callbacks])[1]
  act(() => old.callback("old-token"))
  expect(token).toHaveBeenLastCalledWith("old-token")
  rerender(<TurnstileField action="capacity_audit" onTokenChange={token} />)
  expect(token).toHaveBeenLastCalledWith("")
  act(() => old.callback("stale-token"))
  expect(token).toHaveBeenLastCalledWith("")
  const current = (renderWidget.mock.calls[1] as unknown as [HTMLElement, Callbacks])[1]
  act(() => { current.callback("new-token"); current["error-callback"]() })
  expect(token).toHaveBeenLastCalledWith("")
  expect(screen.getByRole("button", { name: "Retry verification" })).toBeTruthy()
})

it("contains a failed render, retains the inquiry draft, and retries with fresh callbacks", async () => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "local-test-key")
  type Callbacks = { callback: (token: string) => void }
  let failedCallbacks!: Callbacks
  const token = vi.fn()
  const renderWidget = vi.fn((container: HTMLElement, options: Callbacks): string => {
    container.append(document.createElement("iframe"))
    failedCallbacks = options
    options.callback("token-before-render-failure")
    throw new Error("Provider render rejected configuration")
  })
  window.turnstile = { render: renderWidget, reset: vi.fn(), remove: vi.fn() }
  render(<><input aria-label="Inquiry draft" defaultValue="Keep this decision context" /><TurnstileField action="contact" onTokenChange={token} /></>)
  await screen.findByRole("button", { name: "Retry verification" })
  expect(screen.getByRole("textbox", { name: "Inquiry draft" })).toHaveValue("Keep this decision context")
  expect(token).toHaveBeenLastCalledWith("")
  expect(document.querySelector("[data-turnstile-container]")!.childElementCount).toBe(0)
  const calls = token.mock.calls.length
  act(() => failedCallbacks.callback("late-failed-render-token"))
  expect(token).toHaveBeenCalledTimes(calls)
  renderWidget.mockImplementation(() => "replacement-widget")
  fireEvent.click(screen.getByRole("button", { name: "Retry verification" }))
  await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole("button", { name: "Retry verification" })).toBeNull()
  expect(screen.getByRole("textbox", { name: "Inquiry draft" })).toHaveValue("Keep this decision context")
})

it("contains reset and removal exceptions while retiring stale callbacks", async () => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "local-test-key")
  type Callbacks = { callback: (token: string) => void }
  let callbacks!: Callbacks
  const token = vi.fn(), ref = createRef<TurnstileFieldHandle>()
  const renderWidget = vi.fn((container: HTMLElement, options: Callbacks) => {
    expect(container.childElementCount).toBe(0)
    container.append(document.createElement("iframe"))
    callbacks = options
    return "widget"
  })
  window.turnstile = { render: renderWidget, reset: vi.fn(() => { callbacks.callback("token-before-reset-failure"); throw new Error("Reset failed") }), remove: vi.fn(() => { throw new Error("Remove failed") }) }
  const view = render(<TurnstileField ref={ref} action="contact" onTokenChange={token} />)
  const widgetContainer = document.querySelector("[data-turnstile-container]")!
  await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce())
  const old = callbacks
  act(() => callbacks.callback("initial-token"))
  expect(() => act(() => ref.current!.reset())).not.toThrow()
  expect(token).toHaveBeenLastCalledWith("")
  expect(screen.getByRole("button", { name: "Retry verification" })).toBeVisible()
  expect(widgetContainer.childElementCount).toBe(0)
  const calls = token.mock.calls.length
  act(() => old.callback("late-reset-token"))
  expect(token).toHaveBeenCalledTimes(calls)
  fireEvent.click(screen.getByRole("button", { name: "Retry verification" }))
  await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2))
  expect(() => view.unmount()).not.toThrow()
  expect(widgetContainer.childElementCount).toBe(0)
  const afterUnmount = token.mock.calls.length
  act(() => callbacks.callback("late-unmounted-token"))
  expect(token).toHaveBeenCalledTimes(afterUnmount)
})
