import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { WhyGridNinjaCompetitorProfiles } from "@/components/marketing/why-gridninja-competitor-profiles"
import {
  type WhyGridNinjaCompetitorProfile,
  validateWhyGridNinjaCompetitorProfiles,
  whyGridNinjaCompetitorProfiles,
  whyGridNinjaSourceRecords,
} from "@/content/copy/why-gridninja"

const profiles = whyGridNinjaCompetitorProfiles
const sources = whyGridNinjaSourceRecords

describe("WhyGridNinjaCompetitorProfiles", () => {
  it("accepts the published source-backed profile data", () => {
    expect(() => validateWhyGridNinjaCompetitorProfiles()).not.toThrow()
  })

  it("rejects empty, unsourced, duplicate, and over-limit profile data", () => {
    const firstProfile = profiles[0]!
    const emptyClaim: WhyGridNinjaCompetitorProfile = {
      ...firstProfile,
      claims: {
        ...firstProfile.claims,
        publicMaterials: {
          ...firstProfile.claims.publicMaterials,
          body: "",
        },
      },
    }
    const unknownSource: WhyGridNinjaCompetitorProfile = {
      ...firstProfile,
      claims: {
        ...firstProfile.claims,
        proofThreshold: {
          ...firstProfile.claims.proofThreshold,
          sourceIds: ["unknown-source"],
        },
      },
    }

    expect(() =>
      validateWhyGridNinjaCompetitorProfiles([emptyClaim], sources)
    ).toThrow(/claim body cannot be empty/)
    expect(() =>
      validateWhyGridNinjaCompetitorProfiles([unknownSource], sources)
    ).toThrow(/unknown source id unknown-source/)
    expect(() =>
      validateWhyGridNinjaCompetitorProfiles([firstProfile, firstProfile], sources)
    ).toThrow(/Duplicate competitor profile id/)
    expect(() =>
      validateWhyGridNinjaCompetitorProfiles(
        Array.from({ length: 7 }, (_, index) => ({
          ...firstProfile,
          id: `profile-${index}`,
        })),
        sources
      )
    ).toThrow(/between one and six entries/)
  })

  it("renders six tabs and one complete detail panel", () => {
    render(
      <WhyGridNinjaCompetitorProfiles profiles={profiles} sources={sources} />
    )

    expect(screen.getAllByRole("tab")).toHaveLength(6)
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Emerald AI")
    expect(screen.getByText("What public materials show")).toBeVisible()
    expect(screen.getByText("Shared terrain")).toBeVisible()
    expect(screen.getByText("GridNinja responsibility")).toBeVisible()
    expect(screen.getByText("Proof GridNinja must produce")).toBeVisible()
  })

  it("changes profiles without rendering a blank peer card", () => {
    render(
      <WhyGridNinjaCompetitorProfiles profiles={profiles} sources={sources} />
    )

    fireEvent.click(screen.getByRole("tab", { name: /Phaidra/i }))

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Phaidra")
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      /Virtual capacity rather than PUE/i
    )
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1)
  })

  it("supports roving tab navigation with arrows, Home, and End", () => {
    render(
      <WhyGridNinjaCompetitorProfiles profiles={profiles} sources={sources} />
    )

    const emerald = screen.getByRole("tab", { name: /Emerald AI/i })
    emerald.focus()
    fireEvent.keyDown(emerald, { key: "ArrowDown" })

    const phaidra = screen.getByRole("tab", { name: /Phaidra/i })
    expect(phaidra).toHaveAttribute("aria-selected", "true")
    expect(phaidra).toHaveFocus()

    fireEvent.keyDown(phaidra, { key: "End" })
    expect(
      screen.getByRole("tab", { name: /Hardware & infrastructure suites/i })
    ).toHaveAttribute("aria-selected", "true")

    fireEvent.keyDown(document.activeElement!, { key: "Home" })
    expect(emerald).toHaveAttribute("aria-selected", "true")
  })

  it("discloses active-profile sources inline with dates and links", () => {
    render(
      <WhyGridNinjaCompetitorProfiles profiles={profiles} sources={sources} />
    )

    const sourceButton = screen.getByRole("button", { name: /3 sources/i })
    fireEvent.click(sourceButton)

    expect(sourceButton).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByLabelText(/Emerald AI source notes/i)).toBeVisible()
    expect(screen.getAllByText(/Reviewed July 11, 2026/i)).not.toHaveLength(0)
    expect(
      screen.getByRole("link", { name: /Proof Before Autonomy standard/i })
    ).toHaveAttribute("href", "/proof")
  })
})
