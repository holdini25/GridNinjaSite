"use client"

import { useState } from "react"

import { productBoundaryStatements } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"

type BoundaryTab = "does" | "doesNot"

const tabs: Array<{ id: BoundaryTab; label: string }> = [
  { id: "does", label: "Does" },
  { id: "doesNot", label: "Does not" },
]

export function ProductBoundaryToggle() {
  const [active, setActive] = useState<BoundaryTab>("does")

  return (
    <div className="gn-panel px-6 py-7">
      <p className="gn-eyebrow">Product boundary</p>
      <h3 className="mt-3 text-[2rem] font-medium text-foreground">
        What the virtual capacity control plane does and does not do
      </h3>
      <div
        className="mt-6 inline-grid rounded-full border border-border/80 bg-background/45 p-1 sm:grid-cols-2"
        role="tablist"
        aria-label="Product boundary"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
              active === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {productBoundaryStatements[active].map((item) => (
          <li key={item} className="gn-proof-row text-base leading-7 text-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
