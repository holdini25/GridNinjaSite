import type {
  DispatchBinding,
  DispatchEnvelopeDTO,
} from "@/types/dispatch-envelope"

export interface DimensionAuditRow {
  id: string
  label: string
  requested: string
  accepted: string
  requestedValue: number
  acceptedValue: number | null
  bindingSource: string
  status: "clear" | "repaired" | "blocked" | "no-proof"
}

export function buildDimensionAudit(dto: DispatchEnvelopeDTO): DimensionAuditRow[] {
  const accepted = dto.accepted

  return [
    row({
      id: "mw",
      label: "MW",
      requested: `${dto.request.maxMw.toFixed(1)} MW`,
      accepted: accepted ? `${accepted.maxMw.toFixed(1)} MW` : "-",
      requestedValue: dto.request.maxMw,
      acceptedValue: accepted?.maxMw ?? null,
      binding: findBinding(dto.bindings, "mw"),
      decision: dto.decision,
    }),
    row({
      id: "hold",
      label: "Hold",
      requested: `${dto.request.holdMinutes} min`,
      accepted: accepted ? `${accepted.holdMinutes} min` : "-",
      requestedValue: dto.request.holdMinutes,
      acceptedValue: accepted?.holdMinutes ?? null,
      binding: findBinding(dto.bindings, "hold"),
      decision: dto.decision,
    }),
    row({
      id: "ramp-up",
      label: "Ramp-up",
      requested: `${dto.request.rampUpMwPerMin.toFixed(2)} MW/min`,
      accepted: accepted ? `${accepted.rampUpMwPerMin.toFixed(2)} MW/min` : "-",
      requestedValue: dto.request.rampUpMwPerMin,
      acceptedValue: accepted?.rampUpMwPerMin ?? null,
      binding: findBinding(dto.bindings, "ramp-up"),
      decision: dto.decision,
    }),
    row({
      id: "start",
      label: "Start",
      requested: `T+${dto.request.startMinute}`,
      accepted: accepted ? `T+${accepted.startMinute}` : "-",
      requestedValue: dto.request.startMinute,
      acceptedValue: accepted?.startMinute ?? null,
      binding: findBinding(dto.bindings, "start"),
      decision: dto.decision,
    }),
    row({
      id: "recovery",
      label: "Recovery",
      requested: `${dto.request.recoveryMinutes} min`,
      accepted: accepted ? `${accepted.recoveryMinutes} min` : "-",
      requestedValue: dto.request.recoveryMinutes,
      acceptedValue: accepted?.recoveryMinutes ?? null,
      binding: findBinding(dto.bindings, "recovery"),
      decision: dto.decision,
    }),
    row({
      id: "rebound",
      label: "Rebound",
      requested: `${dto.request.reboundLimitMw.toFixed(1)} MW`,
      accepted: accepted ? `${accepted.reboundLimitMw.toFixed(1)} MW` : "-",
      requestedValue: dto.request.reboundLimitMw,
      acceptedValue: accepted?.reboundLimitMw ?? null,
      binding: findBinding(dto.bindings, "rebound"),
      decision: dto.decision,
    }),
  ]
}

function findBinding(bindings: DispatchBinding[], field: DispatchBinding["field"]) {
  return bindings.find((binding) => binding.field === field)
}

function row(args: {
  id: string
  label: string
  requested: string
  accepted: string
  requestedValue: number
  acceptedValue: number | null
  binding: DispatchBinding | undefined
  decision: DispatchEnvelopeDTO["decision"]
}): DimensionAuditRow {
  const status =
    args.decision === "no-proof"
      ? "no-proof"
      : args.decision === "reject"
        ? "blocked"
        : args.binding
          ? "repaired"
          : "clear"

  return {
    id: args.id,
    label: args.label,
    requested: args.requested,
    accepted: args.accepted,
    requestedValue: args.requestedValue,
    acceptedValue: args.acceptedValue,
    bindingSource: args.binding?.reasonCode ?? "No binding repair",
    status,
  }
}
