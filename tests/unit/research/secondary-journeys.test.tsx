import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { SeoResourceHub } from "@/app/(marketing)/_components/seo-resource-hub"
import { PublishedAssessmentLibrary } from "@/components/assessment/published-assessment-library"
import { DecisionPage } from "@/components/marketing/decision-page"
import { ResearchBibliography } from "@/components/research/research-bibliography"
import { decisionPages } from "@/content/copy/decision-pages"
import { evidenceResources } from "@/content/seo-resources"
import { assessmentScopeHref, sampleBriefHref } from "@/lib/marketing-journeys"

function render(element: React.ReactNode) {
  const root = document.createElement("div")
  root.innerHTML = renderToStaticMarkup(element)
  return root
}

describe("secondary journey boundaries", () => {
  it("keeps the present offer beside all three solution heroes without losing inquiry context", () => {
    const cases = [
      { path: "/solutions/ai-cloud", content: decisionPages.aiCloud, source: "ai-cloud-page", topic: "ai-cloud" },
      { path: "/solutions/colocation", content: decisionPages.colocation, source: "colocation-page", topic: "colocation" },
      { path: "/solutions/bridge-power", content: decisionPages.bridgePower, source: "bridge-power-page", topic: "power" },
    ] as const
    for (const item of cases) {
      const root = render(<DecisionPage path={item.path} content={item.content} />)
      const hero = root.querySelector('[role="region"]')!
      expect(hero).toHaveTextContent("Paid, bounded assessment of authorized historical inputs. No live connection or equipment control.")
      expect(hero.querySelector('[data-gn-event="hero-primary-cta"]')).toHaveAttribute("href", assessmentScopeHref(item.source, item.topic))
      expect(hero.querySelector('[data-gn-event="hero-secondary-cta"]')).toHaveAttribute("href", sampleBriefHref(item.topic))
    }
  })

  it("places About's civic ambition after the current offer and keeps public-benefit limits", () => {
    const root = render(<DecisionPage path="/about" content={decisionPages.about} />)
    const headings = [...root.querySelectorAll("h2")].map(node => node.textContent)
    const civic = root.querySelector("#shared-infrastructure")!
    expect(headings.indexOf("The offer today")).toBeLessThan(headings.indexOf(civic.querySelector("h2")!.textContent))
    expect(civic).toHaveTextContent("paid, bounded capacity assessment of authorized historical inputs")
    expect(root.querySelector(".gn-civic-local-boundary")).toHaveTextContent("does not establish community acceptance or public benefit")
  })

  it("keeps intended platform context and proof separate from operating permission", () => {
    const proof = render(<DecisionPage path="/proof" content={decisionPages.proof} />)
    expect(proof.querySelector(".gn-proof-authority")).toHaveTextContent("Separate authorization gate")
    expect(proof.querySelector(".gn-proof-authority figcaption")).toHaveTextContent("The current assessment has no live connection or equipment control.")
    const platform = render(<DecisionPage path="/platform" content={decisionPages.platform} />)
    const context = platform.querySelector(".gn-platform-context")!
    expect(context).toHaveTextContent("Any future grid-facing service would require separately validated capability, agreements and operating authority.")
    expect(context).toHaveTextContent("No live connection or equipment control.")
    expect(context.querySelector("figure")).not.toBeNull()
  })

  it("keeps research ungated after GridNinja's exact synthetic publications, with an early sample action", async () => {
    const introduction = await PublishedAssessmentLibrary()
    const root = render(<SeoResourceHub path="/evidence" eyebrow="GridNinja evidence" title="Evidence" answer="Inspect scope." boundary="Synthetic examples are not customer results." resources={evidenceResources} introduction={introduction} research={<ResearchBibliography />} />)
    const headings = [...root.querySelectorAll("h2")].map(node => node.textContent)
    expect(headings.indexOf("Published synthetic decision briefs")).toBeLessThan(headings.indexOf("Research informing the direction"))
    expect(root.querySelector("#research")!.closest("details")).toBeNull()
    expect(root.querySelector("header .gn-evidence-sample-action a")).toHaveAttribute("href", sampleBriefHref())
    for (const scenario of ["a", "b", "c", "d"]) {
      expect(root.querySelector(`a[href="/evidence/assessments/demo-01-${scenario}/v1.0.0"]`)).not.toBeNull()
    }
    expect(root.querySelector("#research [data-claim-id]")).toBeNull()
    expect(root.querySelector("details summary")).toHaveTextContent("Resources awaiting publication")
    for (const path of ["/insights", "/methodology"] as const) {
      const other = render(<SeoResourceHub path={path} eyebrow="Resources" title="Resources" answer="Inspect scope." boundary="Check publication status." resources={[]} />)
      expect(other.querySelector("header .gn-evidence-sample-action")).toBeNull()
    }
  })
})
