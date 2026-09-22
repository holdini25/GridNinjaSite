import { assertClaimApprovedForSurface } from "@/seo/claim-registry"
import type { PublicPath } from "@/seo/route-manifest"

export function PublicClaimValue({ claimId, value, surface }: { claimId: string; value?: string; surface: PublicPath }) {
  const claim = assertClaimApprovedForSurface(claimId, surface)
  if (value !== undefined && value !== claim.displayValue) throw new Error(`Unapproved display value for claim ${claimId}`)
  return <span data-claim-record={claimId} title={claim.exactText}><span data-nosnippet={claim.snippetPolicy === "exclude-value" ? "" : undefined} data-claim-id={claimId}>{claim.displayValue}</span><span className="mt-2 block font-sans text-sm leading-6 font-normal tracking-normal text-muted-foreground normal-case">{claim.caveat}</span></span>
}
export function PublicClaimCaveat({ claimId, className, surface }: { claimId: string; className?: string; surface: PublicPath }) {
  const claim = assertClaimApprovedForSurface(claimId, surface)
  return <span className={className}>{claim.caveat}</span>
}
