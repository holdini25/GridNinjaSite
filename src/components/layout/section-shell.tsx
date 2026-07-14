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
        "px-4 sm:px-6 lg:px-8",
        deferRendering && "gn-content-auto",
        className
      )}
      {...props}
    >
      <div className={cn("mx-auto w-full max-w-6xl", containerClassName)}>
        {children}
      </div>
    </section>
  )
}
