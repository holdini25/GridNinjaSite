import type { ComponentProps } from "react"
import { NativeSelectControl } from "./native-select-control"
import "./form-primitives.css"

// The inquiry uses native controls only. Keep its small client boundary free of
// polymorphic slots and runtime class merging; defaults live below utilities.
const fieldState = "border border-input bg-surface-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

export function FormInput({ className = "", ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={`gn-form-input w-full min-w-0 px-3 py-2 placeholder:text-muted-foreground disabled:pointer-events-none ${fieldState} ${className}`} {...props} />
}

export function FormTextarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={`gn-form-textarea flex field-sizing-content w-full min-w-0 px-3 py-3 placeholder:text-muted-foreground ${fieldState} ${className}`} {...props} />
}

export function FormSelect({ className = "", ...props }: ComponentProps<"select">) {
  return <NativeSelectControl data-slot="native-select" className={`gn-form-input w-full min-w-0 px-3 py-2 text-foreground ${fieldState} ${className}`} {...props} />
}

export function FormButton({ className = "", variant = "default", size = "default", ...props }: ComponentProps<"button"> & { variant?: "default" | "outline"; size?: "default" | "lg" }) {
  const colors = variant === "outline"
    ? "border-border bg-surface hover:bg-surface-hover hover:text-foreground aria-expanded:bg-surface-hover aria-expanded:text-foreground"
    : "border-transparent bg-primary text-primary-foreground [a]:hover:bg-primary/80"
  return <button data-slot="button" data-variant={variant} data-size={size} className={`gn-form-button group/button inline-flex shrink-0 items-center justify-center border bg-clip-padding text-center text-base font-medium whitespace-normal transition-[color,background-color,border-color,box-shadow,transform] duration-160 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 sm:whitespace-nowrap dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 ${colors} ${className}`} {...props} />
}
