import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SeoResourceHub } from "@/app/(marketing)/_components/seo-resource-hub"
import { SectionShell } from "@/components/layout/section-shell"
import { sampleBriefHref } from "@/lib/marketing-journeys"

function renderHub(path: "/evidence" | "/insights" | "/methodology") {
  const root = document.createElement("div")
  root.innerHTML = renderToStaticMarkup(
    <SeoResourceHub
      path={path}
      eyebrow="GridNinja evidence"
      title="Inspect the evidence behind a capacity decision."
      answer="Synthetic examples explain the assessment method."
      boundary="Examples do not establish customer results or physical validation."
      resources={[]}
      introduction={<SectionShell deferRendering={false}><h2>Published synthetic decision briefs</h2></SectionShell>}
    />,
  )
  return root
}

describe("Evidence's initial resource-hub layout", () => {
  it("renders its heading, answer and sample action without a deferred ancestor above the brief library", () => {
    const root = renderHub("/evidence")
    const header = root.querySelector("header")!
    const sample = header.querySelector("a")!

    expect(header.querySelector("h1")).toHaveTextContent("Inspect the evidence behind a capacity decision.")
    expect(header).toHaveTextContent("Synthetic examples explain the assessment method.")
    expect(sample).toHaveTextContent("See a sample decision brief")
    expect(sample).toHaveAttribute("href", sampleBriefHref())
    // This prevents the deferred 960px header placeholder, not a CLS
    // measurement: JSDOM does not implement browser layout/content visibility.
    for (const node of header.querySelectorAll("h1, p, a")) {
      expect(node.closest(".gn-content-auto")).toBeNull()
    }
    const library = root.querySelector("h2")!
    expect(header.compareDocumentPosition(library) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(library.closest(".gn-content-auto")).toBeNull()
    expect(root.querySelectorAll(":scope > div > section.gn-content-auto").length).toBeGreaterThan(0)
  })

  it.each(["/insights", "/methodology"] as const)("preserves the existing header behavior on %s", path => {
    const root = renderHub(path)
    expect(root.querySelector("header h1")!.closest(".gn-content-auto")).not.toBeNull()
    expect(root.querySelector(".gn-evidence-sample-action")).toBeNull()
  })
})
