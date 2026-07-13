import { CheckCircle2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

export function LoadPassportVerificationStatus({
  verified,
  className,
}: {
  verified: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 font-mono text-[0.65rem]",
        verified ? "text-signal" : "text-muted-foreground",
        className
      )}
      data-load-passport-verification={verified ? "verified" : "no-proof"}
    >
      {verified ? (
        <>
          <CheckCircle2Icon className="size-4" aria-hidden="true" />
          <span className="sr-only">Verified</span>
        </>
      ) : (
        <span>NO-PROOF</span>
      )}
    </span>
  )
}
