import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PublicClaimValue } from "@/components/seo/public-claim"

describe("claim presentation enforcement", () => {
  it("renders the registered value and adjacent synthetic limitation", () => {
    const root = document.createElement("div")
    root.innerHTML = renderToStaticMarkup(<PublicClaimValue claimId="assessment-b-model-limit" surface="/demo" />)
    const value = root.querySelector('[data-claim-id="assessment-b-model-limit"]')
    expect(value).toHaveTextContent("5.8 MW")
    expect(value).toHaveAttribute("data-nosnippet", "")
    expect(value?.nextElementSibling).toHaveTextContent("Synthetic illustrative scenario—not a customer or production result.")
  })

  it("refuses arbitrary values even with a valid record ID", () => {
    expect(() => renderToStaticMarkup(<PublicClaimValue claimId="assessment-b-model-limit" surface="/demo" value="18.4 MW" />)).toThrow(/Unapproved display value/)
  })

  it("refuses a registered value on an unapproved surface", () => {
    expect(() => renderToStaticMarkup(<PublicClaimValue claimId="assessment-b-model-limit" surface="/about" />)).toThrow(/not active and approved/)
  })
})
