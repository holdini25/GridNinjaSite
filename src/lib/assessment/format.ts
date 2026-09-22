import type { AssessmentQuantity } from "@/types/assessment"

export function formatKWAsMW(valueKW: number): string {
  return `${(valueKW / 1_000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} MW`
}

export function formatAssessmentQuantity(quantity: AssessmentQuantity): string {
  return quantity.status === "known" ? formatKWAsMW(quantity.valueKW) : quantity.status === "unknown" ? "Unknown" : "Not applicable"
}

export function formatAssessmentInterval(start: string, end: string): string {
  return `${start.slice(0, 10)} · ${start.slice(11, 16)}–${end.slice(11, 16)} UTC`
}
