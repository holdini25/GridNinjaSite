"use client"

import type { ReactNode } from "react"

import {
  decisionLabel,
  dispatchDomainMeta,
  formatMin,
  formatMw,
  getOrderedConstraints,
  statusLabel,
  type DispatchScenario,
} from "@/content/copy/dispatch-envelope"
import type { EnvelopeSample } from "@/types/dispatch-envelope"
import type { getDispatchDimensions } from "@/content/copy/dispatch-envelope"

type DimensionRow = ReturnType<typeof getDispatchDimensions>[number]

export function DispatchEquivalentDataTable({
  artifacts,
  dimensions,
  samples,
  scenario,
}: {
  artifacts: string[]
  dimensions: DimensionRow[]
  samples: EnvelopeSample[]
  scenario: DispatchScenario
}) {
  const sampleRows = getRepresentativeSamples(samples)

  return (
    <div
      id="dispatch-equivalent-table"
      className="space-y-5 border-t border-border/70 px-4 py-5 sm:px-6"
      data-testid="dispatch-equivalent-table"
    >
      <section
        className="overflow-hidden rounded-[1rem] border border-border/70 bg-background/45"
        data-testid="dispatch-table-group-scenario"
      >
        <TableHeading title="Scenario summary" />
        <dl className="grid gap-px bg-border/50 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCell label="scenario" value={scenario.label} />
          <SummaryCell label="decision" value={decisionLabel(scenario.dto.decision)} />
          <SummaryCell label="requested" value={formatMw(scenario.dto.request.maxMw)} />
          <SummaryCell
            label="accepted"
            value={
              scenario.dto.accepted ? formatMw(scenario.dto.accepted.maxMw) : "withheld"
            }
          />
          <SummaryCell label="policy" value={scenario.dto.policyBundleVersion} />
          <SummaryCell label="topology" value={scenario.dto.topologyHash} />
          <SummaryCell label="evidence" value={scenario.dto.evidenceClass} />
          <SummaryCell label="proof root" value={scenario.dto.proofRoot} />
        </dl>
      </section>

      <TableShell title="Domain constraints" testId="dispatch-table-group-constraints">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="border-y border-border/70 bg-surface/60 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Max MW</th>
              <th className="px-4 py-3">Max hold</th>
              <th className="px-4 py-3">Ramp</th>
              <th className="px-4 py-3">Telemetry age</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Evidence artifact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {getOrderedConstraints(scenario).map(({ id, constraint, meta }) => (
              <tr key={id} data-testid={`dispatch-table-row-${id}`}>
                <td className="px-4 py-3 text-foreground">{meta.label}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {statusLabel(constraint.state)}
                </td>
                <td className="px-4 py-3 font-mono text-foreground">
                  {formatMw(constraint.maxMw)}
                </td>
                <td className="px-4 py-3 font-mono text-foreground">
                  {formatMin(constraint.maxHoldMinutes)}
                </td>
                <td className="px-4 py-3 font-mono text-foreground">
                  {constraint.maxRampUpMwPerMin.toFixed(2)} MW/min
                </td>
                <td className="px-4 py-3 font-mono text-foreground">
                  {constraint.telemetryAgeMs ?? "-"} ms
                </td>
                <td className="px-4 py-3 font-mono text-foreground">
                  {constraint.confidencePct ?? "-"}%
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {constraint.evidenceArtifact}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableShell title="Timeline samples" testId="dispatch-table-group-timeline">
        <table className="w-full min-w-[50rem] text-left text-sm">
          <thead className="border-y border-border/70 bg-surface/60 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Accepted</th>
              <th className="px-4 py-3">Repair delta</th>
              <th className="px-4 py-3">Binding domain</th>
              <th className="px-4 py-3">Proof</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sampleRows.map((sample) => (
              <tr
                key={`sample-${sample.minute}`}
                data-testid={`dispatch-table-sample-${sample.minute.toFixed(0)}`}
              >
                <td className="px-4 py-3 font-mono text-foreground">
                  T+{sample.minute.toFixed(1)}
                </td>
                <td className="px-4 py-3 font-mono text-primary">
                  {formatMw(sample.requestedMw)}
                </td>
                <td className="px-4 py-3 font-mono text-signal">
                  {scenario.dto.accepted ? formatMw(sample.acceptedMw) : "withheld"}
                </td>
                <td className="px-4 py-3 font-mono text-warning">
                  {formatMw(sample.repairDeltaMw)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sample.bindingDomainId
                    ? dispatchDomainMeta[sample.bindingDomainId].label
                    : "-"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sample.proofEligible ? "eligible" : "no-proof"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableShell title="Dimension audit" testId="dispatch-table-group-dimensions">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="border-y border-border/70 bg-surface/60 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Dimension</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Accepted</th>
              <th className="px-4 py-3">Binding source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {dimensions.map((dimension) => (
              <tr key={dimension.id} data-testid={`dispatch-table-dimension-${dimension.id}`}>
                <td className="px-4 py-3 text-foreground">{dimension.label}</td>
                <td className="px-4 py-3 font-mono text-primary">
                  {dimension.requested}
                </td>
                <td className="px-4 py-3 font-mono text-signal">
                  {dimension.accepted}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {dimension.bindingSource}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <section
        className="overflow-hidden rounded-[1rem] border border-border/70 bg-background/45"
        data-testid="dispatch-table-group-artifacts"
      >
        <TableHeading title="Evidence artifacts" />
        <div className="grid gap-px bg-border/50 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((artifact) => (
            <div key={artifact} className="bg-background/95 px-4 py-3">
              <p className="break-all font-mono text-xs text-foreground">{artifact}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function TableShell({
  children,
  testId,
  title,
}: {
  children: ReactNode
  testId: string
  title: string
}) {
  const headingId = `${testId}-heading`

  return (
    <section
      aria-labelledby={headingId}
      tabIndex={0}
      className="overflow-x-auto rounded-[1rem] border border-border/70 bg-background/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:ring-inset"
      data-testid={testId}
    >
      <TableHeading id={headingId} title={title} />
      {children}
    </section>
  )
}

function TableHeading({ id, title }: { id?: string; title: string }) {
  return (
    <h3
      id={id}
      className="border-b border-border/70 px-4 py-3 font-mono text-xs tracking-[0.16em] text-primary uppercase"
    >
      {title}
    </h3>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background/95 px-4 py-3">
      <dt className="font-mono text-[0.66rem] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 break-words font-mono text-sm text-foreground">{value}</dd>
    </div>
  )
}

function getRepresentativeSamples(samples: EnvelopeSample[]) {
  const indexes = new Set([
    0,
    Math.floor(samples.length * 0.25),
    Math.floor(samples.length * 0.5),
    Math.floor(samples.length * 0.75),
    samples.length - 1,
  ])

  return [...indexes]
    .map((index) => samples[index])
    .filter((sample): sample is EnvelopeSample => Boolean(sample))
}
