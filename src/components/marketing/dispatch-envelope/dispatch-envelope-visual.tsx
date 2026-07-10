"use client"

import type { KeyboardEvent } from "react"
import { useEffect, useMemo, useState } from "react"

import {
  DownloadIcon,
  EyeIcon,
  RotateCcwIcon,
  TablePropertiesIcon,
} from "lucide-react"

import {
  buildDispatchArtifactList,
  buildDispatchEvidenceRecord,
  buildDispatchExport,
  decisionLabel,
  dispatchDomainMeta,
  dispatchScenarios,
  getConstraint,
  getDispatchDimensions,
  getOrderedConstraints,
  getScenarioProofEligible,
  isBindingStatus,
  statusLabel,
  type DispatchDecision,
} from "@/content/copy/dispatch-envelope"
import { Button } from "@/components/ui/button"
import { buildEnvelopeSamples } from "@/lib/dispatch-envelope/normalize"
import { sanitizeDispatchExportFilename, serializeDispatchEnvelopeExport } from "@/lib/dispatch-envelope/export"
import { cn } from "@/lib/utils"

import { DispatchConstraintRail } from "./dispatch-constraint-rail"
import { DispatchDecisionRibbon } from "./dispatch-decision-ribbon"
import { DispatchDimensionAuditPanel } from "./dispatch-dimension-audit-panel"
import { DispatchEnvelopeChart } from "./dispatch-envelope-chart"
import { DispatchEquivalentDataTable } from "./dispatch-equivalent-data-table"
import { DispatchEvidenceDrawer } from "./dispatch-evidence-drawer"
import { DispatchProofTrace } from "./dispatch-proof-trace"
import {
  dispatchViewModes,
  useDispatchEnvelopeState,
} from "./use-dispatch-envelope-state"

export function DispatchEnvelopeVisual({
  initialScenarioId,
}: {
  initialScenarioId?: string
}) {
  const {
    activeScenario,
    animationPhase,
    copyProofRoot,
    hideLens,
    lens,
    mode,
    openEvidence,
    proofOpen,
    replayKey,
    replayTrace,
    recordJsonExport,
    selectConstraint,
    selectScenario,
    selectedDomainId,
    setEvidenceOpen,
    setLens,
    setMode,
    setShowAllConstraints,
    setTableExpanded,
    showAllConstraints,
    tableExpanded,
  } = useDispatchEnvelopeState({ initialScenarioId })
  const [exportStatus, setExportStatus] = useState("")

  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setTableExpanded(true)
  }, [setTableExpanded])

  const orderedConstraints = useMemo(
    () => getOrderedConstraints(activeScenario),
    [activeScenario]
  )
  const activeConstraint = getConstraint(activeScenario, selectedDomainId)
  const dimensions = useMemo(
    () => getDispatchDimensions(activeScenario),
    [activeScenario]
  )
  const samples = useMemo(
    () => buildEnvelopeSamples(activeScenario.dto),
    [activeScenario]
  )
  const evidenceRecord = useMemo(
    () => buildDispatchEvidenceRecord(activeScenario),
    [activeScenario]
  )
  const artifacts = useMemo(
    () => buildDispatchArtifactList(activeScenario),
    [activeScenario]
  )
  const bindingCount = orderedConstraints.filter(({ constraint }) =>
    isBindingStatus(constraint.state)
  ).length
  const scenarioProofEligible = getScenarioProofEligible(activeScenario)
  const inspectorTitle =
    mode === "evidence"
      ? "Evidence quality"
      : mode === "constraints"
        ? `${dispatchDomainMeta[selectedDomainId].label} constraint`
        : `Why GridNinja ${decisionVerb(activeScenario.dto.decision)}`

  function exportJson() {
    try {
      const json = serializeDispatchEnvelopeExport(buildDispatchExport(activeScenario))
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `gridninja-${sanitizeDispatchExportFilename(activeScenario.id)}-dispatch-envelope.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      recordJsonExport()
      setExportStatus("Evidence JSON exported.")
    } catch {
      setExportStatus("Evidence JSON export failed. The data did not pass validation.")
    }
  }

  function handleScenarioKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(event.key)) {
      return
    }

    event.preventDefault()

    if (event.key === "Enter" || event.key === " ") {
      selectScenario(dispatchScenarios[index].id)
      return
    }

    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? dispatchScenarios.length - 1
          : event.key === "ArrowLeft"
            ? (index - 1 + dispatchScenarios.length) % dispatchScenarios.length
            : (index + 1) % dispatchScenarios.length
    const nextScenario = dispatchScenarios[nextIndex]

    selectScenario(nextScenario.id)
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          `[data-testid="dispatch-scenario-${nextScenario.id}"]`
        )
        ?.focus()
    })
  }

  function handleModeKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Enter", " "].includes(event.key)) {
      return
    }

    event.preventDefault()

    if (event.key === "Enter" || event.key === " ") {
      setMode(dispatchViewModes[index].id)
      return
    }

    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? dispatchViewModes.length - 1
          : event.key === "ArrowLeft"
            ? (index - 1 + dispatchViewModes.length) % dispatchViewModes.length
            : (index + 1) % dispatchViewModes.length
    const nextMode = dispatchViewModes[nextIndex]

    setMode(nextMode.id)
    window.requestAnimationFrame(() => {
      document.getElementById(`dispatch-mode-tab-${nextMode.id}`)?.focus()
    })
  }

  return (
    <section
      className="gn-dispatch-shell gn-hd-panel overflow-hidden"
      aria-label="Dispatch Envelope Visual"
      data-testid="dispatch-envelope-visual"
      data-animation-phase={animationPhase}
    >
      <div className="gn-scanline" />
      <div className="border-b border-border/70 px-4 py-5 sm:px-6 lg:flex lg:min-h-24 lg:items-center lg:justify-between lg:gap-6">
        <div>
          <p className="gn-eyebrow text-proof-cyan">Dispatch Envelope</p>
          <h2 className="mt-2 text-[2rem] font-medium tracking-tight text-foreground sm:text-[2.35rem]">
            Constraint Aperture
          </h2>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 lg:mt-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-border/80 bg-background/45 text-foreground"
            onClick={replayTrace}
            data-testid="dispatch-replay-button"
          >
            <RotateCcwIcon />
            Replay trace
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-proof-cyan/40 bg-proof-cyan/10 text-proof-cyan"
            onClick={(event) => openEvidence(event.currentTarget)}
            data-testid="dispatch-proof-button"
          >
            <EyeIcon />
            Inspect proof
          </Button>
        </div>
      </div>

      <DispatchDecisionRibbon
        scenario={activeScenario}
        proofEligible={scenarioProofEligible}
        replayKey={replayKey}
      />

      <div className="grid gap-4 border-b border-border/70 bg-background/35 px-4 py-4 sm:px-6 lg:grid-cols-[9rem_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.18em] text-foreground uppercase">
            Scenario
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Illustrative data</p>
        </div>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Dispatch scenarios"
          data-testid="dispatch-scenario-tabs"
        >
          {dispatchScenarios.map((scenario, index) => (
            <button
              key={scenario.id}
              id={`dispatch-scenario-tab-${scenario.id}`}
              type="button"
              role="tab"
              aria-selected={scenario.id === activeScenario.id}
              aria-controls="dispatch-scenario-panel"
              tabIndex={scenario.id === activeScenario.id ? 0 : -1}
              onClick={() => selectScenario(scenario.id)}
              onKeyDown={(event) => handleScenarioKeyDown(event, index)}
              className={cn(
                "min-h-[3.7rem] min-w-44 rounded-[0.85rem] border px-3 py-2 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
                scenario.id === activeScenario.id
                  ? "border-primary/65 bg-primary/10"
                  : "border-border/70 bg-background/45 hover:border-primary/45"
              )}
              data-testid={`dispatch-scenario-${scenario.id}`}
            >
              <span className="block text-sm font-medium text-foreground">
                {scenario.label}
              </span>
              <span className="mt-1 block font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
                {decisionLabel(scenario.dto.decision)} / {scenario.subtitle}
              </span>
            </button>
          ))}
        </div>
      </div>

      <span
        className="sr-only"
        aria-live="polite"
        data-testid="dispatch-live-region"
      >
        {activeScenario.label}: {decisionLabel(activeScenario.dto.decision)}
      </span>

      <div
        id="dispatch-scenario-panel"
        role="tabpanel"
        aria-labelledby={`dispatch-scenario-tab-${activeScenario.id}`}
        className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-6"
      >
        <div
          className="inline-flex rounded-full border border-border/70 bg-background/55 p-1"
          role="tablist"
          aria-label="Visualization mode"
          data-testid="dispatch-mode-tabs"
        >
          {dispatchViewModes.map((item, index) => (
            <button
              key={item.id}
              id={`dispatch-mode-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={item.id === mode}
              aria-controls="dispatch-mode-panel"
              tabIndex={item.id === mode ? 0 : -1}
              onClick={() => setMode(item.id)}
              onKeyDown={(event) => handleModeKeyDown(event, index)}
              className={cn(
                "min-h-11 rounded-full px-4 py-2 font-mono text-[0.68rem] tracking-[0.14em] uppercase transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
                item.id === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`dispatch-mode-${item.id}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div
          className="inline-flex rounded-full border border-border/70 bg-background/55 p-1"
          role="group"
          aria-label="Constraint visibility"
        >
          <button
            type="button"
            aria-pressed={!showAllConstraints}
            onClick={() => setShowAllConstraints(false)}
            className={cn(
              "min-h-11 rounded-full px-4 py-2 font-mono text-[0.68rem] tracking-[0.14em] uppercase transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
              !showAllConstraints
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="dispatch-binding-only"
          >
            Binding only
          </button>
          <button
            type="button"
            aria-pressed={showAllConstraints}
            onClick={() => setShowAllConstraints(true)}
            className={cn(
              "min-h-11 rounded-full px-4 py-2 font-mono text-[0.68rem] tracking-[0.14em] uppercase transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
              showAllConstraints
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="dispatch-show-all"
          >
            Show all
          </button>
        </div>
      </div>

      <div
        id="dispatch-mode-panel"
        role="tabpanel"
        aria-labelledby={`dispatch-mode-tab-${mode}`}
        className="grid gap-0 xl:grid-cols-[20rem_minmax(0,1fr)_22rem]"
        data-testid="dispatch-mode-panel"
      >
        <DispatchConstraintRail
          bindingCount={bindingCount}
          constraints={orderedConstraints}
          selectedDomainId={selectedDomainId}
          onSelect={selectConstraint}
        />

        <section className="border-b border-border/70 p-4 sm:p-6 xl:border-r xl:border-b-0">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <PanelHeading kicker="MW over time" title="Requested vs. accepted envelope" />
            <div className="flex flex-wrap gap-3 font-mono text-[0.68rem] text-muted-foreground">
              <Legend color="bg-primary" label="Requested" dashed />
              <Legend color="bg-signal" label="Accepted" />
              <Legend color="bg-warning" label="Repair delta" hatched />
            </div>
          </div>
          <DispatchEnvelopeChart
            animationPhase={animationPhase}
            scenario={activeScenario}
            selectedDomainId={selectedDomainId}
            mode={mode}
            showAllConstraints={showAllConstraints}
            lens={lens}
            replayKey={replayKey}
            onLensChange={setLens}
            onLensHide={hideLens}
          />
        </section>

        <aside className="p-4 sm:p-6">
          <PanelHeading kicker="Decision inspector" title="Why this result?" />
          <div className="mt-5 rounded-[1rem] border border-primary/30 bg-background/55 p-5">
            <h3 className="font-medium text-foreground">{inspectorTitle}</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {mode === "decision" ? activeScenario.plainReason : activeConstraint.reason}
            </p>
          </div>
          <dl className="mt-5 divide-y divide-border/60 rounded-[1rem] border border-border/70 bg-background/35 font-mono text-xs">
            <InspectorRow label="decision" value={decisionLabel(activeScenario.dto.decision)} />
            <InspectorRow
              label="selected domain"
              value={dispatchDomainMeta[selectedDomainId].label}
            />
            <InspectorRow
              label="domain status"
              value={statusLabel(activeConstraint.state)}
            />
            <InspectorRow
              label="proof eligibility"
              value={scenarioProofEligible ? "eligible" : "withheld"}
            />
            <InspectorRow
              label="telemetry age"
              value={`${activeConstraint.telemetryAgeMs ?? "-"} ms`}
            />
            <InspectorRow
              label="confidence"
              value={`${activeConstraint.confidencePct ?? "-"}%`}
            />
            <InspectorRow label="policy" value={activeScenario.dto.policyBundleVersion} />
            <InspectorRow label="topology" value={activeScenario.dto.topologyHash} />
            <InspectorRow
              label="artifact"
              value={activeConstraint.evidenceArtifact}
            />
          </dl>
          <div className="mt-5 grid gap-2" data-testid="dispatch-pinned-artifact">
            {orderedConstraints
              .filter(({ constraint }) => isBindingStatus(constraint.state))
              .map(({ id, constraint, meta }) => (
                <button
                  key={`${id}-${constraint.evidenceArtifact}`}
                  type="button"
                  onClick={(event) => openEvidence(event.currentTarget)}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-[0.7rem] border border-proof-cyan/25 bg-proof-cyan/5 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45"
                >
                  <span>
                    {meta.short}: {constraint.evidenceArtifact}
                  </span>
                  <span aria-hidden="true">-&gt;</span>
                </button>
              ))}
          </div>
        </aside>
      </div>

      <DispatchDimensionAuditPanel
        dimensions={dimensions}
        scenarioId={activeScenario.id}
      />

      <DispatchProofTrace scenario={activeScenario} onOpenEvidence={openEvidence} />

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-border/80 bg-background/45 text-foreground"
            onClick={() => setTableExpanded(!tableExpanded)}
            aria-expanded={tableExpanded}
            aria-controls="dispatch-equivalent-table"
            data-testid="dispatch-table-toggle"
          >
            <TablePropertiesIcon />
            {tableExpanded ? "Hide equivalent data table" : "View equivalent data table"}
          </Button>
          <span
            className="rounded-full border border-border/70 bg-background/45 px-3 py-1 font-mono text-xs text-muted-foreground"
            data-testid="dispatch-proof-root"
          >
            proof_root: {activeScenario.dto.proofRoot}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 border-primary/45 bg-primary/5 text-primary"
          onClick={exportJson}
          data-testid="dispatch-export-json"
        >
          <DownloadIcon />
          Export evidence JSON
        </Button>
        <span className="sr-only" aria-live="polite" data-testid="dispatch-export-status">{exportStatus}</span>
      </footer>

      {tableExpanded ? (
        <DispatchEquivalentDataTable
          artifacts={artifacts}
          dimensions={dimensions}
          samples={samples}
          scenario={activeScenario}
        />
      ) : null}

      <DispatchEvidenceDrawer
        artifacts={artifacts}
        onCopyProofRoot={copyProofRoot}
        onOpenChange={setEvidenceOpen}
        onShowTable={() => setTableExpanded(true)}
        open={proofOpen}
        record={evidenceRecord}
        scenario={activeScenario}
      />
    </section>
  )
}

function PanelHeading({
  kicker,
  title,
}: {
  kicker: string
  title: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="gn-eyebrow text-[0.68rem]">{kicker}</p>
        <h3 className="mt-2 text-xl font-medium text-foreground">{title}</h3>
      </div>
    </div>
  )
}

function Legend({
  color,
  label,
  dashed = false,
  hatched = false,
}: {
  color: string
  label: string
  dashed?: boolean
  hatched?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "h-0.5 w-4",
          color,
          dashed && "border-t border-dashed border-primary bg-transparent",
          hatched && "gn-dispatch-hatch"
        )}
      />
      {label}
    </span>
  )
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 px-3 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words text-right text-foreground">{value}</dd>
    </div>
  )
}

function decisionVerb(decision: DispatchDecision) {
  if (decision === "repair") {
    return "repaired"
  }

  if (decision === "allow") {
    return "allowed"
  }

  if (decision === "reject") {
    return "rejected"
  }

  return "returned no-proof"
}
