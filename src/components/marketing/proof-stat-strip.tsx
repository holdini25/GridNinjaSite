import type { StatItem } from "@/types/site"
import { PublicClaimValue } from "@/components/seo/public-claim"

export function ProofStatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-[1.6rem] border border-border/70 bg-border/70 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-6 py-6">
          <p className="text-base text-muted-foreground">{item.label}</p>
          {item.value ? (
            <p className="mt-3 font-mono text-[2.2rem] tracking-tight text-foreground">
              <PublicClaimValue claimId={item.claimId} value={item.value} />
            </p>
          ) : null}
          <p className="mt-3 max-w-xs text-base leading-8 text-muted-foreground">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  )
}
