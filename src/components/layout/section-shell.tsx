import type { ComponentPropsWithoutRef, ReactNode } from "react"

import { cn } from "@/lib/utils"

type SectionShellProps = ComponentPropsWithoutRef<"section"> & {
  containerClassName?: string
  deferRendering?: boolean
  children: ReactNode
}

export function SectionShell({
  className,
  containerClassName,
  deferRendering = true,
  children,
  ...props
}: SectionShellProps) {
  return (
    <section
      className={cn(
        "gn-section-shell",
        deferRendering && "gn-content-auto",
        className
      )}
      {...props}
    >
      <div className={cn("gn-section-container mx-auto w-full max-w-7xl", containerClassName)}>
        {children}
      </div>
    </section>
  )
}
