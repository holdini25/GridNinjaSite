import type { DomainId } from "@/types/dispatch-envelope"

export const DISPATCH_DOMAIN_IDS: DomainId[] = [
  "electrical",
  "storage",
  "cooling-water",
  "bridge-power",
  "workload-sla",
  "telemetry-policy",
]

export const DISPATCH_DOMAIN_META: Record<
  DomainId,
  { label: string; short: string }
> = {
  electrical: { label: "Electrical margin", short: "Electrical" },
  storage: { label: "UPS / BESS reserve", short: "Storage" },
  "cooling-water": { label: "Cooling / water", short: "Cooling" },
  "bridge-power": { label: "Bridge power", short: "Bridge" },
  "workload-sla": { label: "Workload / SLA", short: "Workload" },
  "telemetry-policy": { label: "Telemetry / policy", short: "Trust" },
}
