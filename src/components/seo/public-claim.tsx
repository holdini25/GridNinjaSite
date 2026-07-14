import { getPublicClaim } from "@/seo/claim-registry"

export function PublicClaimValue({ claimId, value }: { claimId: string; value: string }) {
  const claim = getPublicClaim(claimId)

  return (
    <span data-claim-record={claimId}>
      {claim.snippetPolicy === "exclude-value" ? (
        <span data-nosnippet data-claim-id={claimId}>{value}</span>
      ) : (
        <span data-claim-id={claimId}>{value}</span>
      )}
      <span className="mt-2 block font-sans text-xs leading-5 font-normal tracking-normal text-muted-foreground normal-case">
        {claim.caveat}
      </span>
    </span>
  )
}

export function PublicClaimCaveat({ claimId, className }: { claimId: string; className?: string }) {
  const claim = getPublicClaim(claimId)
  return <span className={className}>{claim.caveat}</span>
}
