import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ResearchBibliography } from "@/components/research/research-bibliography"
import { ResearchNotes } from "@/components/research/research-notes"
import { homepageResearch, researchCatalog, researchPresentation } from "@/content/research"

const approvedNotes = [
  {
    id: "colangelo-grid-assets-2026",
    finding: "A 256-GPU field trial demonstrated bounded power reduction while preserving the tested service requirements.",
    limit: "External research on one cluster; not a GridNinja result or a whole-site guarantee.",
  },
  {
    id: "senga-flexibility-tradeoffs-2026",
    finding: "Power-system modeling finds that flexibility can lower system costs while emissions depend on the regional generation mix.",
    limit: "Emissions increased in some modeled settings. Household bill savings and GridNinja economics are not established.",
  },
  {
    id: "siddik-water-footprint-2021",
    finding: "U.S. research links data-center water impacts to cooling, electricity generation, and local water stress.",
    limit: "Historical spatial modeling; not a current inventory or a site-specific water assessment.",
  },
]

function render(element: React.ReactNode) {
  const root = document.createElement("div")
  root.innerHTML = renderToStaticMarkup(element)
  return root
}

describe("external research publication contract", () => {
  it("keeps seven uniquely identified studies outside GridNinja outcome evidence", () => {
    expect(researchCatalog).toHaveLength(7)
    expect(new Set(researchCatalog.map(source => source.id)).size).toBe(7)
    expect(new Set(researchCatalog.map(source => source.doi.toLowerCase())).size).toBe(7)
    for (const source of researchCatalog) {
      expect(source.publicationStatus).toBe("published-peer-reviewed-journal-article")
      expect(source.publicReleaseStatus).toBe("reviewed-for-publication")
      expect(source.permittedRole).toBe("external-research-context")
      expect(source.gridNinjaOutcomeEvidence).toBe(false)
      expect(source.figureReuseApproved).toBe(false)
      expect(source.bibliographyHref).toBe("/evidence#research")
      expect(source.authors.length).toBeGreaterThan(0)
      expect(source.limitations.length).toBeGreaterThan(0)
      expect(source.verification.contentReviewed).not.toBe("")
      expect(source.verification.accessLimitations).not.toBe("")
      expect(new URL(source.primaryUrl).protocol).toBe("https:")
    }
  })

  it("preserves publication-date distinctions and incomplete update-check coverage", () => {
    const grid = researchCatalog.find(source => source.id === "colangelo-grid-assets-2026")!
    expect(grid.citationYear).toBe(2026)
    expect(grid.onlinePublicationDate).toBe("2025-12-05")
    const publicSupport = researchCatalog.find(source => source.id === "heering-public-support-2026")!
    expect(publicSupport.onlinePublicationDate).toBe("2026-08-10")
    expect(publicSupport.versionOfRecordDate).toBe("2026-09-08")
    expect(researchCatalog.find(source => source.id === "senga-flexibility-tradeoffs-2026")!.onlinePublicationDate).toBeNull()
    expect(researchCatalog.find(source => source.id === "wabersich-safety-filter-2021")!.onlinePublicationDate).toBeNull()
    expect(researchCatalog.filter(source => source.updateReview.crossmarkStatus === "current")).toHaveLength(6)
    expect(researchCatalog.find(source => source.id === "radovanovic-carbon-aware-2023")!.updateReview.crossmarkStatus).toBe("unavailable")
    for (const source of researchCatalog) {
      expect(source.reviewedOn).toBe("2026-10-10")
      expect(source.updateReview.checkedOn).toBe("2026-10-10")
      expect(source.updateReview.scope).toContain("do not establish that no correction or retraction exists")
    }
  })

  it("pairs each exact homepage finding with its visible limitation and source", () => {
    expect(homepageResearch.map(source => source.id)).toEqual(approvedNotes.map(note => note.id))
    const root = render(<ResearchNotes />)
    expect(root.querySelectorAll("[data-research-id]")).toHaveLength(3)
    for (const note of approvedNotes) {
      const item = root.querySelector(`[data-research-id="${note.id}"]`)!
      expect(item.querySelector(".gn-research-finding")).toHaveTextContent(note.finding)
      const limit = item.querySelector(".gn-research-limitation")!
      expect(limit).toHaveTextContent(note.limit)
      expect(limit.closest("details, [hidden], [aria-hidden='true']")).toBeNull()
      expect(item.querySelector("h3 a")).toHaveAttribute("href", researchCatalog.find(source => source.id === note.id)!.primaryUrl)
    }
    expect(root.querySelector('a[href="/evidence#research"]')).toHaveTextContent("Read the research and its limits")
    expect(root).toHaveTextContent("External research informs the direction. GridNinja currently offers bounded assessments using authorized historical inputs.")
  })

  it("renders all seven complete references and their study-specific limits as HTML", () => {
    const root = render(<ResearchBibliography />)
    expect(root.querySelector("section#research")).toHaveAttribute("aria-labelledby", "research-heading")
    expect(root.querySelectorAll("article")).toHaveLength(7)
    for (const source of researchCatalog) {
      const item = root.querySelector(`[data-research-id="${source.id}"]`)!
      expect(item.querySelector("h3 a")).toHaveTextContent(source.title)
      expect(item.querySelector(`a[href="https://doi.org/${source.doi}"]`)).not.toBeNull()
      expect(item).toHaveTextContent(source.authors.join("; "))
      expect(item).toHaveTextContent(source.supportedMarketingSentence)
      expect(item).toHaveTextContent(source.setting.geography)
      expect(item).toHaveTextContent(source.conflictsOrInterests)
      expect(item).toHaveTextContent(source.verification.accessLimitations)
      for (const limit of source.limitations) expect(item.querySelector(".gn-research-limits")).toHaveTextContent(limit)
      expect(item.querySelector("time")).toHaveAttribute("dateTime", source.reviewedOn)
    }
    expect(root).toHaveTextContent("not a guarantee that no update exists")
    expect(root).toHaveTextContent("Crossmark status record was unavailable")
  })

  it("does not render research as GridNinja proof, copied media or hidden disclosures", () => {
    for (const component of [<ResearchNotes key="notes" />, <ResearchBibliography key="bibliography" />]) {
      const root = render(component)
      expect(root.querySelectorAll("[data-claim-id], img, canvas, svg, script, iframe, details, [hidden]")).toHaveLength(0)
      expect(root).toHaveTextContent(researchPresentation.introduction)
      const ids = [...root.querySelectorAll("[id]")].map(element => element.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
