/** Public, editable inquiry context. Never accept visitor prose as attribution. */
export const PUBLIC_TOPICS = ["ai-cloud", "colocation", "power", "cooling", "storage", "workloads"] as const
export type PublicTopic = typeof PUBLIC_TOPICS[number]
export const PUBLIC_TOPIC_LABELS: Record<PublicTopic, string> = {
  "ai-cloud": "AI workload admission", colocation: "Tenant capacity commitment",
  power: "Electrical boundary", cooling: "Cooling evidence", storage: "Reserve contribution and duration", workloads: "Workload request and revision",
}
export function isPublicTopic(value: unknown): value is PublicTopic {
  return typeof value === "string" && (PUBLIC_TOPICS as readonly string[]).includes(value)
}
export function resolvePublicTopic(value: string | string[] | undefined | null): PublicTopic | undefined {
  return isPublicTopic(value) ? value : undefined
}
