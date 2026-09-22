import { webcrypto } from "node:crypto"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { track, verification } = vi.hoisted(() => ({
  track: vi.fn(),
  verification: { refreshImmediately: true, onTokenChange: null as ((token: string) => void) | null },
}))
vi.mock("@/lib/analytics", () => ({ trackGridNinjaEvent: track }))
vi.mock("@/components/forms/turnstile-field", async () => {
  const React = await import("react")
  return { TurnstileField: function Stub({ onTokenChange, ref }: { onTokenChange: (token: string) => void; ref: React.Ref<unknown> }) {
    React.useEffect(() => {
      verification.onTokenChange = onTokenChange
      onTokenChange("valid-token")
      return () => { verification.onTokenChange = null }
    }, [onTokenChange])
    React.useImperativeHandle(ref, () => ({ reset: () => onTokenChange(verification.refreshImmediately ? "fresh-token" : "") }))
    return null
  } }
})

import * as validationLoader from "@/components/forms/contact-validation-loader"

import { ContactForm } from "@/components/forms/contact-form"
import { ContactConfirmation } from "@/components/forms/contact-confirmation"
import { contactAttemptStorageKey } from "@/components/forms/contact-receipt"

const submissionId = "0a40bf9f-3e46-4d0c-b550-89e992ed5eef"
const response = (status = 202, body: unknown = { ok: true, submissionId, status: "queued" }) => ({ status, json: async () => body })

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto)
  window.sessionStorage.clear()
  window.history.replaceState({}, "", "/contact")
  track.mockClear()
  verification.refreshImmediately = true
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

function fill() {
  fireEvent.input(screen.getByLabelText("Name", { exact: true }), { target: { value: "Alex Operator" } })
  fireEvent.input(screen.getByLabelText("Work email", { exact: true }), { target: { value: "alex@example.com" } })
  fireEvent.input(screen.getByLabelText("Company", { exact: true }), { target: { value: "Example Compute" } })
}
function submit() { fireEvent.click(screen.getByRole("button", { name: "Scope an assessment" })) }

describe("truthful contact intake", () => {
  it("renders disabled controls and explicit POST transport before hydration", () => {
    const html = renderToString(<ContactForm />)
    expect(html).toContain('method="post"')
    expect(html).toContain('action="/api/contact"')
    expect(html).toContain('<fieldset disabled=""')
    expect(html).toContain("Enable JavaScript and reload")
  })
  it("shows durable receipt inline even with blocked tab storage and no message", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    const fetchMock = vi.fn().mockResolvedValue(response())
    vi.stubGlobal("fetch", fetchMock)
    render(<ContactForm />)
    fill(); submit()
    await screen.findByRole("heading", { name: "Inquiry received" })
    expect(screen.getByText(submissionId)).toBeVisible()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("message")
    expect(track.mock.calls.filter(([name]) => name === "capacity_audit_request_success")).toHaveLength(1)
  })
  it("retries a lost response with the original reference and payload", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(response(200, { ok: true, submissionId, status: "already_received" }))
    vi.stubGlobal("fetch", fetchMock)
    render(<ContactForm />)
    fill(); submit()
    await screen.findByText(/The connection ended or timed out/)
    expect(screen.getByLabelText("Name", { exact: true })).toBeDisabled()
    const stored = window.sessionStorage.getItem(contactAttemptStorageKey)
    expect(stored).toContain("fingerprint")
    expect(stored).not.toContain("alex@example.com")
    expect(stored).not.toContain("valid-token")
    fireEvent.click(screen.getByRole("button", { name: "Retry original inquiry" }))
    await screen.findByRole("heading", { name: "Inquiry received" })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(JSON.parse(fetchMock.mock.calls[1][1].body))
    expect(window.sessionStorage.getItem(contactAttemptStorageKey)).toBeNull()
  })
  it("requires an explicit new inquiry after uncertainty before editing", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(response())
    vi.stubGlobal("fetch", fetchMock)
    render(<ContactForm />)
    fill(); submit()
    await screen.findByText(/The connection ended or timed out/)
    fireEvent.click(screen.getByRole("button", { name: "Start another inquiry" }))
    expect(screen.getByLabelText("Name", { exact: true })).not.toBeDisabled()
    fireEvent.input(screen.getByLabelText("Company", { exact: true }), { target: { value: "Changed company" } })
    submit()
    await screen.findByRole("heading", { name: "Inquiry received" })
    const bodies = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body))
    expect(bodies[1].clientSubmissionId).not.toBe(bodies[0].clientSubmissionId)
  })
  it("waits for refreshed verification after an uncertain failure while retaining the original inquiry", async () => {
    verification.refreshImmediately = false
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(500, { ok: false, message: "Persistence temporarily unavailable." }))
      .mockResolvedValueOnce(response(400, { ok: false, fieldErrors: { turnstileToken: "Complete verification again." }, message: "Verification token was already consumed." }))
      .mockResolvedValueOnce(response())
    vi.stubGlobal("fetch", fetchMock)
    render(<ContactForm />)
    fill(); submit()
    await screen.findByText(/Receipt is unconfirmed/)
    fireEvent.click(screen.getByRole("button", { name: "Retry original inquiry" }))
    await screen.findByText("Verification token was already consumed.")
    const retry = screen.getByRole("button", { name: "Retry original inquiry" })
    expect(retry).toBeDisabled()
    expect(screen.getByLabelText("Company", { exact: true })).toBeDisabled()
    fireEvent.click(retry)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    act(() => { verification.onTokenChange?.("fresh-token") })
    expect(retry).toBeEnabled()
    fireEvent.click(retry)
    await screen.findByRole("heading", { name: "Inquiry received" })
    const bodies = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body))
    expect(bodies.map(body => body.turnstileToken)).toEqual(["valid-token", "valid-token", "fresh-token"])
    const businessPayloads = bodies.map(({ turnstileToken, ...body }) => { void turnstileToken; return body })
    expect(businessPayloads[1]).toEqual(businessPayloads[0])
    expect(businessPayloads[2]).toEqual(businessPayloads[0])
    expect(new Set(bodies.map(body => body.clientSubmissionId)).size).toBe(1)
    expect(new Set(bodies.map(body => body.startedAt)).size).toBe(1)
    expect(window.sessionStorage.getItem(contactAttemptStorageKey)).toBeNull()
    expect(track.mock.calls.filter(([name]) => name === "capacity_audit_request_success")).toHaveLength(1)
  })
  it("rejects changed re-entered details after reload without sending a second inquiry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network"))
    vi.stubGlobal("fetch", fetchMock)
    const initial = render(<ContactForm />)
    fill(); submit()
    await screen.findByText(/The connection ended or timed out/)
    initial.unmount()
    render(<ContactForm />)
    fill()
    fireEvent.input(screen.getByLabelText("Company", { exact: true }), { target: { value: "Changed company" } })
    fireEvent.click(screen.getByRole("button", { name: "Retry original details" }))
    await screen.findByText(/These details differ/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it("does not treat an arbitrary successful body as a receipt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(202, { ok: true, submissionId, status: "sent" })))
    render(<ContactForm />)
    fill(); submit()
    await screen.findByText(/Receipt is unconfirmed/)
    expect(screen.queryByRole("heading", { name: "Inquiry received" })).not.toBeInTheDocument()
    expect(track.mock.calls.filter(([name]) => name === "capacity_audit_request_success")).toHaveLength(0)
  })
  it("does not claim receipt for a direct confirmation visit", async () => {
    render(<ContactConfirmation />)
    await waitFor(() => expect(screen.getByText(/No current receipt is available/)).toBeVisible())
    expect(screen.queryByRole("heading", { name: "Inquiry received" })).not.toBeInTheDocument()
  })
  it("locks duplicate submissions while the validator loads and preserves captured autofill values", async () => {
    const validator = await import("@/lib/validators")
    let resolveValidation!: (module: typeof validator) => void
    vi.spyOn(validationLoader, "loadContactValidation").mockImplementation(() => new Promise(resolve => { resolveValidation = resolve }))
    const fetchMock = vi.fn().mockResolvedValue(response())
    vi.stubGlobal("fetch", fetchMock)
    const { container } = render(<ContactForm />)
    fill()
    const form = container.querySelector("form")!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(screen.getByRole("button", { name: "Checking details…" })).toBeDisabled()
    expect(screen.getByLabelText("Name", { exact: true })).toBeDisabled()
    expect(validationLoader.loadContactValidation).toHaveBeenCalledTimes(1)
    await act(async () => { resolveValidation(validator) })
    await screen.findByRole("heading", { name: "Inquiry received" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).name).toBe("Alex Operator")
  })

  it("preserves input and reports no new request when validation cannot load", async () => {
    vi.spyOn(validationLoader, "loadContactValidation").mockRejectedValueOnce(new Error("chunk unavailable"))
    const fetchMock = vi.fn().mockResolvedValue(response())
    vi.stubGlobal("fetch", fetchMock)
    render(<ContactForm />)
    fill(); submit()
    await screen.findByText(/Form validation could not load/)
    expect(screen.getByLabelText("Name", { exact: true })).toHaveValue("Alex Operator")
    expect(screen.getByLabelText("Name", { exact: true })).toBeEnabled()
    expect(fetchMock).not.toHaveBeenCalled()
    submit()
    await screen.findByRole("heading", { name: "Inquiry received" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("discards an old async blur result when the field changes", async () => {
    const validator = await import("@/lib/validators")
    let resolveValidation!: (module: typeof validator) => void
    vi.spyOn(validationLoader, "loadContactValidation").mockImplementation(() => new Promise(resolve => { resolveValidation = resolve }))
    render(<ContactForm />)
    const name = screen.getByLabelText("Name", { exact: true })
    fireEvent.input(name, { target: { value: "A" } })
    fireEvent.blur(name)
    fireEvent.input(name, { target: { value: "Alex Operator" } })
    await act(async () => { resolveValidation(validator) })
    expect(name).toHaveAttribute("aria-invalid", "false")
    expect(screen.queryByText("Enter your name.")).not.toBeInTheDocument()
  })

})
