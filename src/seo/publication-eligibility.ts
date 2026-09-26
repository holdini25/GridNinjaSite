/** Approval belongs to each resource. A gated download does not gate its published explanatory page. */
export function isPublicationPromotable(status: "published" | "gated" | "available" | "withheld" | "withdrawn" | undefined): boolean {
  return status === "published" || status === "available"
}
