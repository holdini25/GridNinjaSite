import type { ComponentProps } from "react"

/** Keep native selection and keyboard behavior with a consistent Safari target. */
export function NativeSelectControl({ className = "", ...props }: ComponentProps<"select">) {
  return <span className="relative block min-w-0">
    <select {...props} className={`min-h-11 w-full appearance-none ${className} pr-10`} />
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"><path d="m4 6 4 4 4-4" /></svg>
  </span>
}
