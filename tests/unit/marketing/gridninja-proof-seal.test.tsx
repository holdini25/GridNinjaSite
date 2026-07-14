import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  GRIDNINJA_PROOF_SEAL_LABEL,
  GridNinjaProofSeal,
} from "@/components/brand/gridninja-proof-seal"
import { CapacityWaterfall } from "@/components/marketing/capacity-waterfall"
import { DispatchProofTrace } from "@/components/marketing/dispatch-envelope/dispatch-proof-trace"
import { LoadPassportHD } from "@/components/marketing/load-passport-hd"
import { LoadPassportPreview } from "@/components/marketing/load-passport-preview"
import { ProofArtifactGrid } from "@/components/marketing/proof-artifact-grid"
import { dispatchScenarios } from "@/content/copy/dispatch-envelope"
import {
  artifactFiles,
  getLoadPassportEvidenceChainStatus,
  loadPassportSections,
  proofArtifacts,
  type WaterfallStep,
} from "@/content/proof-artifacts"

afterEach(cleanup)

describe("GridNinjaProofSeal", () => {
  it("renders the copper proof-core and visible illustrative label only for complete evidence", () => {
    const { container } = render(<GridNinjaProofSeal status="complete" />)

    expect(screen.getByText(GRIDNINJA_PROOF_SEAL_LABEL)).toBeVisible()
    expect(
      container.querySelector(
        'img[src*="gridninja-proof-star.svg"]'
      )
    ).toBeInTheDocument()
    expect(
      container.querySelector('[data-evidence-chain-status="complete"]')
    ).toBeInTheDocument()
  })

  it.each(["incomplete", "no-proof"] as const)(
    "suppresses the seal for %s evidence",
    (status) => {
      render(<GridNinjaProofSeal status={status} />)

      expect(
        screen.queryByText(GRIDNINJA_PROOF_SEAL_LABEL)
      ).not.toBeInTheDocument()
    }
  )

  it("suppresses the seal for a withheld record even when its wider chain is complete", () => {
    render(<GridNinjaProofSeal status="complete" withheld />)

    expect(
      screen.queryByText(GRIDNINJA_PROOF_SEAL_LABEL)
    ).not.toBeInTheDocument()
  })
})

describe("proof-seal presentation semantics", () => {
  it("selects Load Passport evidence without starting a root view transition", () => {
    const transitionDocument = document as Document & {
      startViewTransition?: () => unknown
    }
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      transitionDocument,
      "startViewTransition"
    )
    const startViewTransition = vi.fn()
    Object.defineProperty(transitionDocument, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    })

    try {
      render(<LoadPassportHD />)
      const target = screen.getByRole("button", {
        name: /Telemetry Trust Score/i,
      })

      fireEvent.focus(target)
      fireEvent.click(target)

      expect(target).toHaveAttribute("aria-pressed", "true")
      expect(
        screen.getByRole("heading", {
          level: 4,
          name: "Telemetry Trust Score",
        })
      ).toBeVisible()
      expect(startViewTransition).not.toHaveBeenCalled()
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(
          transitionDocument,
          "startViewTransition",
          originalDescriptor
        )
      } else {
        Reflect.deleteProperty(transitionDocument, "startViewTransition")
      }
    }
  })

  it("computes Load Passport completion from every required section", () => {
    expect(getLoadPassportEvidenceChainStatus(loadPassportSections)).toBe(
      "complete"
    )
    expect(
      getLoadPassportEvidenceChainStatus(
        loadPassportSections.map((section, index) => ({
          ...section,
          verified: index !== 0,
        }))
      )
    ).toBe("incomplete")
    expect(
      getLoadPassportEvidenceChainStatus(
        loadPassportSections.map((section) => ({
          ...section,
          verified: false,
        }))
      )
    ).toBe("no-proof")
  })

  it("shows the seal in both complete Load Passport presentations", () => {
    render(
      <>
        <LoadPassportHD />
        <LoadPassportPreview />
      </>
    )

    expect(screen.getAllByText(GRIDNINJA_PROOF_SEAL_LABEL)).toHaveLength(2)
  })

  it("suppresses both Load Passport seals when one required section is unverified", () => {
    const incompleteSections = loadPassportSections.map((section, index) => ({
      ...section,
      verified: index !== loadPassportSections.length - 1,
    }))

    render(
      <>
        <LoadPassportHD sections={incompleteSections} />
        <LoadPassportPreview sections={incompleteSections} />
      </>
    )

    expect(
      screen.queryByText(GRIDNINJA_PROOF_SEAL_LABEL)
    ).not.toBeInTheDocument()
  })

  it("uses neutral no-proof indicators for active unverified sections in both Load Passport presentations", () => {
    const incompleteSections = loadPassportSections.map((section, index) => ({
      ...section,
      verified: index !== 0,
    }))

    const { container } = render(
      <>
        <LoadPassportHD sections={incompleteSections} />
        <LoadPassportPreview sections={incompleteSections} />
      </>
    )

    const unverifiedDetails = container.querySelectorAll(
      '[data-load-passport-detail-status="no-proof"]'
    )

    expect(unverifiedDetails).toHaveLength(2)
    for (const detail of unverifiedDetails) {
      expect(
        within(detail as HTMLElement).getByText("NO-PROOF")
      ).toBeInTheDocument()
      expect(
        detail.querySelector('[data-load-passport-verification="verified"]')
      ).not.toBeInTheDocument()
      expect(detail.querySelector(".text-signal")).not.toBeInTheDocument()
      expect(
        within(detail as HTMLElement).getByText(incompleteSections[0].evidence)
      ).toBeInTheDocument()
    }
  })

  it("renders all-no-proof Load Passports without a proof seal or verified indicator", () => {
    const noProofSections = loadPassportSections.map((section) => ({
      ...section,
      verified: false,
    }))

    const { container } = render(
      <>
        <LoadPassportHD sections={noProofSections} />
        <LoadPassportPreview sections={noProofSections} />
      </>
    )

    expect(
      screen.queryByText(GRIDNINJA_PROOF_SEAL_LABEL)
    ).not.toBeInTheDocument()
    expect(
      container.querySelector('[data-load-passport-verification="verified"]')
    ).not.toBeInTheDocument()
    expect(
      container.querySelectorAll('[data-load-passport-verification="no-proof"]')
    ).toHaveLength(noProofSections.length * 2 + 2)
  })

  it("uses the same verified indicator in both Load Passport presentations", () => {
    const { container } = render(
      <>
        <LoadPassportHD sections={loadPassportSections.slice(0, 1)} />
        <LoadPassportPreview sections={loadPassportSections.slice(0, 1)} />
      </>
    )

    const verifiedDetails = container.querySelectorAll(
      '[data-load-passport-detail-status="verified"]'
    )

    expect(verifiedDetails).toHaveLength(2)
    for (const detail of verifiedDetails) {
      expect(
        detail.querySelector('[data-load-passport-verification="verified"]')
      ).toBeInTheDocument()
      expect(within(detail as HTMLElement).getByText("Verified")).toHaveClass(
        "sr-only"
      )
    }
  })

  it("derives both artifact views from status-identical definitions", () => {
    expect(artifactFiles).toHaveLength(proofArtifacts.length)
    expect(
      artifactFiles.map((artifact) => ({
        title: artifact.artifactTitle,
        audience: artifact.whoCares,
        evidenceChainStatus: artifact.evidenceChainStatus,
      }))
    ).toEqual(
      proofArtifacts.map((artifact) => ({
        title: artifact.title,
        audience: artifact.audience,
        evidenceChainStatus: artifact.evidenceChainStatus,
      }))
    )
  })

  it("uses the final proof row for waterfall summary state", () => {
    const multipleProofRows: WaterfallStep[] = [
      {
        label: "Earlier proof row",
        value: 5.1,
        capacityAfter: 5.1,
        detail: "Superseded illustrative proof row.",
        tone: "proof",
        decision: "allow",
        evidenceChainStatus: "complete",
      },
      {
        label: "Intervening constraint",
        value: -0.9,
        capacityAfter: 4.2,
        detail: "Later constraint in the illustrative sequence.",
        tone: "constraint",
        decision: "repair",
      },
      {
        label: "Final proof row",
        value: 4.2,
        capacityAfter: 4.2,
        detail: "Final illustrative proof row.",
        tone: "proof",
        decision: "repair",
        evidenceChainStatus: "complete",
      },
    ]

    render(<CapacityWaterfall steps={multipleProofRows} />)

    const acceptedHeadroom = screen.getByText("accepted headroom").parentElement
    expect(acceptedHeadroom).not.toBeNull()
    expect(within(acceptedHeadroom!).getByText("4.2 MW")).toBeVisible()
    expect(
      within(acceptedHeadroom!).queryByText("5.1 MW")
    ).not.toBeInTheDocument()
  })

  it("renders an empty waterfall without inventing accepted headroom", () => {
    render(<CapacityWaterfall steps={[]} />)

    expect(screen.queryByText("accepted headroom")).not.toBeInTheDocument()
    expect(screen.getByText("illustrative")).toBeVisible()
  })

  it("uses explicit waterfall and artifact evidence state rather than decision color", () => {
    const repairedComplete: WaterfallStep[] = [
      {
        label: "Proof-adjusted capacity",
        value: 2.8,
        capacityAfter: 2.8,
        detail: "Illustrative repaired capacity with a complete evidence chain.",
        tone: "proof",
        decision: "repair",
        evidenceChainStatus: "complete",
      },
    ]

    render(
      <>
        <CapacityWaterfall steps={repairedComplete} />
        <ProofArtifactGrid
          artifacts={[
            {
              title: "Accepted-Headroom Ledger",
              body: "Complete illustrative ledger.",
              audience: "Operators",
              evidenceChainStatus: "complete",
            },
            {
              title: "Withheld Ledger",
              body: "No accepted evidence row.",
              audience: "Operators",
              evidenceChainStatus: "no-proof",
            },
          ]}
        />
      </>
    )

    expect(screen.getAllByText(GRIDNINJA_PROOF_SEAL_LABEL)).toHaveLength(2)
    expect(screen.getByText("Withheld Ledger")).toBeVisible()
  })

  it.each(["grid-stress", "cooling-contingency"])(
    "shows a complete dispatch trace for %s without treating repair or reject as seal colors",
    (scenarioId) => {
      const scenario = dispatchScenarios.find(
        (candidate) => candidate.id === scenarioId
      )!

      render(
        <DispatchProofTrace
          drawerId="dispatch-evidence-drawer"
          evidenceOpen={false}
          scenario={scenario}
          onOpenEvidence={vi.fn()}
        />
      )

      expect(screen.getByText(GRIDNINJA_PROOF_SEAL_LABEL)).toBeVisible()
    }
  )

  it("suppresses the dispatch trace seal when the evidence path is no-proof", () => {
    const scenario = dispatchScenarios.find(
      (candidate) => candidate.id === "telemetry-loss"
    )!

    render(
      <DispatchProofTrace
        drawerId="dispatch-evidence-drawer"
        evidenceOpen={false}
        scenario={scenario}
        onOpenEvidence={vi.fn()}
      />
    )

    expect(
      screen.queryByText(GRIDNINJA_PROOF_SEAL_LABEL)
    ).not.toBeInTheDocument()
  })
})
