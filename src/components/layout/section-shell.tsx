import type { ComponentPropsWithoutRef, ReactNode } from "react"

type SectionShellProps = ComponentPropsWithoutRef<"section"> & {
  containerClassName?: string
  deferRendering?: boolean
  children: ReactNode
}

export function SectionShell({
  className = "",
  containerClassName = "",
  deferRendering = true,
  children,
  ...props
}: SectionShellProps) {
  return (
    <section
      className={`gn-section-shell ${deferRendering ? "gn-content-auto" : ""} ${className}`}
      {...props}
    >
      <div className={`gn-section-container ${containerClassName}`}>
        {children}
      </div>
    </section>
  )
}
