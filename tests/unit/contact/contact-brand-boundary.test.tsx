import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// Importing the animated module also imports its render-blocking stylesheet,
// even when a route only selects a static mark from the composition module.
vi.mock("@/components/brand/animated-gridninja-mark", () => {
  throw new Error("Static contact pages must not import animated logo resources")
})
vi.mock("@/components/forms/contact-form", () => ({ ContactForm: () => null }))
vi.mock("@/components/forms/contact-confirmation", () => ({ ContactConfirmation: () => null }))

describe("contact page static brand boundary", () => {
  it.each([
    { path: "/contact", size: "size-7", load: () => import("@/components/marketing/contact-page").then(module => ({ default: module.ContactPageContent })) },
    { path: "/contact/thanks", size: "size-8", load: () => import("@/app/(marketing)/contact/thanks/page") },
  ])("keeps the eager decorative mark on $path without importing animation", async ({ load, size }) => {
    const { default: Page } = await load()
    const container = document.createElement("div")
    container.innerHTML = renderToStaticMarkup(<Page />)
    const marks = container.querySelectorAll('img[src="/brand/gridninja-favicon-proof-core.svg"]')

    expect(marks).toHaveLength(1)
    const mark = marks[0]
    expect(mark).toHaveAttribute("alt", "")
    expect(mark).toHaveAttribute("width", "64")
    expect(mark).toHaveAttribute("height", "64")
    expect(mark).toHaveClass("gn-static-mark", size)
    expect(mark).toHaveAttribute("loading", "eager")
    expect(mark).toHaveAttribute("fetchpriority", "high")
    expect(mark).toHaveAttribute("decoding", "async")
  })
})
