import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { PublicClaimValue } from "@/components/seo/public-claim"

afterEach(cleanup)

describe("claim presentation enforcement", () => {
  it("renders the registered value and adjacent synthetic limitation", () => {
    render(<PublicClaimValue claimId="assessment-b-model-limit" surface="/demo" />)
    expect(screen.getByText("5.8 MW")).toHaveAttribute("data-nosnippet")
    expect(screen.getByText("Synthetic illustrative scenario—not a customer or production result.")).toBeVisible()
  })

  it("refuses arbitrary values even with a valid record ID", () => {
    expect(() => render(<PublicClaimValue claimId="assessment-b-model-limit" surface="/demo" value="18.4 MW" />)).toThrow(/Unapproved display value/)
  })

  it("refuses a registered value on an unapproved surface", () => {
    expect(() => render(<PublicClaimValue claimId="assessment-b-model-limit" surface="/about" />)).toThrow(/not active and approved/)
  })
})
