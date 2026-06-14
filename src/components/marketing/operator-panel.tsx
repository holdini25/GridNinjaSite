import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function OperatorPanel({
  eyebrow,
  title,
  body,
  children,
  className,
}: {
  eyebrow?: string
  title?: string
  body?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={cn("gn-panel px-6 py-7", className)}>
      {eyebrow ? <p className="gn-eyebrow">{eyebrow}</p> : null}
      {title ? (
        <h3 className="mt-3 text-[1.8rem] font-medium text-foreground">
          {title}
        </h3>
      ) : null}
      {body ? (
        <p className="mt-4 text-base leading-8 text-muted-foreground">{body}</p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  )
}
