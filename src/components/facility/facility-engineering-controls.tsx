import { useId, useMemo, useRef, useState } from "react"
import { AssessmentAttribution } from "@/components/assessment/assessment-attribution"
import { facilityWalkthrough } from "@/lib/facility/content"
import type { AssessmentRecord } from "@/types/assessment"
import { FACILITY_SYSTEMS, type FacilityInspectionTarget, type FacilitySceneMetadata, type FacilitySpecimenKind, type FacilitySystem, type FacilityView, type FacilityVisualRelease } from "@/types/facility"
import { FACILITY_LABELS } from "@/lib/facility/content"
import { ECOSYSTEM_DEFAULT_RACK } from "@/lib/facility/ecosystem-narrative"
import type { EcosystemDiagramPresentation } from "@/lib/facility/ecosystem-narrative"
import { isRackServiceDetail } from "@/lib/facility/rack-service-view"

type Props = {
  release: FacilityVisualRelease
  record: AssessmentRecord
  ready: boolean
  activeView: FacilityView
  requestedView: FacilityView
  assetPhase: "loading" | "ready" | "failed"
  metadata: FacilitySceneMetadata
  target: FacilityInspectionTarget | null
  previewTarget: FacilityInspectionTarget | null
  presentation?: EcosystemDiagramPresentation | null
  expanded: boolean
  walkthroughStep: number | null
  onView: (view: FacilityView) => void
  onReturn?: () => void
  onTarget: (target: FacilityInspectionTarget) => void
  onPreview: (target: FacilityInspectionTarget | null, owner: string, channel: "pointer" | "focus") => void
  onExpand: () => void
  onWalkthrough: (step: number | null) => void
  onWalkthroughSystem: (system: FacilitySystem) => void
  onRetry: () => void
}

export function FacilityEngineeringControls(props: Props) {
  const { ready, activeView, requestedView, assetPhase, metadata, target, previewTarget, onView, onTarget, onPreview } = props
  const [diagramOpen, setDiagramOpen] = useState(false)
  const overviewButton = useRef<HTMLButtonElement>(null), walkthroughButton = useRef<HTMLButtonElement>(null)
  const steps = useMemo(() => facilityWalkthrough(props.record), [props.record])
  const step = props.walkthroughStep === null ? null : steps[props.walkthroughStep]
  const busy = assetPhase === "loading"
  const activeSpecimen = activeView.kind === "specimen" ? activeView.specimen : null
  const parts = metadata.specimen?.kind === activeSpecimen ? metadata.specimen.parts : []
  const rackMotion = activeSpecimen === "rack" && Boolean(metadata.specimen?.rackMotion)
  const rackView = requestedView.kind === "specimen" && requestedView.specimen === "rack" ? requestedView : activeView.kind === "specimen" && activeView.specimen === "rack" ? activeView : null
  const rack = rackView?.rack ?? { door: rackView?.pose === "service" ? "open" as const : "closed" as const, tray: rackView?.pose === "service" ? "extended" as const : "retracted" as const, cutaway: rackView?.pose === "cutaway" }
  const serviceDetail = metadata.specimen?.rackMotion?.serviceDetail
  const detailActive = isRackServiceDetail(activeView) || isRackServiceDetail(requestedView)
  const activeRack = activeView.kind === "specimen" && activeView.specimen === "rack" ? activeView.rack : null
  const serviceReady = ready && assetPhase === "ready" && activeRack?.door === "open" && activeRack.tray === "extended" && rack.door === "open" && rack.tray === "extended"
  const setRack = (update: Partial<typeof rack>) => {
    if (detailActive) return
    const next = { ...rack, ...update }
    onView({ kind: "specimen", specimen: "rack", pose: next.tray === "extended" ? "service" : next.cutaway ? "cutaway" : "closed", rack: next })
  }
  return <div className="facility-engineering" data-testid="facility-engineering">
    {activeSpecimen && !rackMotion && <fieldset className="facility-views" disabled={!ready || busy}>
      <legend>Assembly position</legend>
      {(["closed", "cutaway", "service"] as const).map(pose => <button type="button" key={pose} aria-pressed={activeView.kind === "specimen" && activeView.pose === pose} onClick={() => onView({ kind: "specimen", specimen: activeSpecimen, pose })}>{pose === "service" ? activeSpecimen === "rack" ? "Extend server tray" : "Inspect coil and manifold" : pose === "cutaway" ? "Reveal interior" : "Restore closed assembly"}</button>)}
    </fieldset>}
    {rackMotion && <>
      <div className="facility-rack-actions" aria-label="Rack actions">
        <button type="button" className="facility-action" disabled={detailActive} aria-pressed={rack.door === "open"} onClick={() => setRack(rack.door === "open" ? { door: "closed", tray: "retracted" } : { door: "open" })}>{rack.door === "open" ? "Close rack" : "Open door"}</button>
        <button type="button" className="facility-action" disabled={detailActive} aria-pressed={rack.tray === "extended"} onClick={() => setRack(rack.tray === "extended" ? { tray: "retracted" } : { door: "open", tray: "extended" })}>{rack.tray === "extended" ? "Retract server tray" : "Extend server tray"}</button>
        <button type="button" className="facility-action" disabled={detailActive} aria-pressed={rack.cutaway} onClick={() => setRack({ cutaway: !rack.cutaway })}>{rack.cutaway ? "Restore side panel" : "Cutaway view"}</button>
        {serviceDetail && <button type="button" className="facility-action" disabled={detailActive ? busy : !serviceReady} onClick={() => {
          if (!rackView || busy || (!detailActive && !serviceReady)) return
          onView({ kind: "specimen", specimen: "rack", pose: "service", rack: { door: "open", tray: "extended", cutaway: true }, ...(detailActive ? {} : { detail: "service-connection" }) })
        }}>{detailActive ? "Return to whole assembly" : "Inspect service connection (cutaway)"}</button>}
      </div>
      <p className="facility-assembly-scope">The tray travels 180 mm on its rails. Its service connection is disconnected during extension. The cutaway removes the side panel for inspection.</p>
      {serviceDetail && <p className="facility-assembly-scope" role={detailActive ? "status" : undefined}>{detailActive ? `Service connection cutaway: ${parts.filter(part => serviceDetail.partIds.includes(part.id)).map(part => part.label).join(", ")}. The side panel is removed. Return to the whole assembly before moving parts.` : "Extend the tray to inspect its disconnected service connection up close."}</p>}
      {detailActive && <p className="facility-assembly-scope">The fixed plug stays on the rear rail; the tray inlet moves forward with the server tray. The gap shows the disconnected service connection.</p>}
    </>}
    <div className="facility-engineering-tools">
      {activeSpecimen && <button type="button" className="facility-action" onClick={() => props.onReturn ? props.onReturn() : onView({ kind: "overview" })}>Return to facility</button>}
      <button type="button" className="facility-action" aria-expanded={props.expanded} onClick={props.onExpand}>{props.expanded ? "Compact model" : "Expand model"}</button>
      {!props.release.profile.ecosystem && <button ref={walkthroughButton} type="button" className="facility-action" aria-pressed={props.walkthroughStep !== null} onClick={() => props.onWalkthrough(props.walkthroughStep === null ? 0 : null)}>{props.walkthroughStep === null ? "Explain this assessment" : "Exit walkthrough"}</button>}
      {!props.release.profile.inspection && <button type="button" className="facility-action" disabled={!ready || !target} aria-hidden={!target || undefined} style={{ visibility: target ? undefined : "hidden" }} onClick={() => { if (target) onView({ kind: "overview", system: target.system }) }}>Inspect closer</button>}
      {!props.release.profile.inspection && <button type="button" className="facility-action" disabled={!ready || (activeView.kind === "overview" && !activeView.system)} aria-hidden={activeView.kind === "overview" && !activeView.system || undefined} style={{ visibility: activeView.kind === "overview" && !activeView.system ? "hidden" : undefined }} onClick={() => { onView({ kind: "overview" }); overviewButton.current?.focus({ preventScroll: true }) }}>Return to overview</button>}
      <button type="button" className="facility-action" aria-expanded={diagramOpen} disabled={!metadata.topology} onClick={() => setDiagramOpen(value => !value)}>Authored equipment connections</button>
    </div>
    {!props.release.profile.inspection && <fieldset className="facility-views" disabled={!ready}>
      <legend>Facility viewpoints</legend>
      <button ref={overviewButton} type="button" aria-pressed={activeView.kind === "overview" && !activeView.system} onClick={() => onView({ kind: "overview" })}>Overview</button>
      {FACILITY_SYSTEMS.map(system => <button type="button" key={system} aria-pressed={activeView.kind === "overview" && activeView.system === system} onClick={() => onView({ kind: "overview", system })}>{FACILITY_LABELS[system]} view</button>)}
    </fieldset>}
    <fieldset className="facility-views" disabled={!ready}>
      <legend>{activeSpecimen ? "Inspect another assembly" : "Inspect an assembly"}</legend>
      {(["rack", "cooling"] as FacilitySpecimenKind[]).filter(kind => props.release.specimens?.[kind] && kind !== activeSpecimen).map(kind => <button type="button" key={kind} aria-pressed={activeSpecimen === kind} onClick={() => onView({ kind: "specimen", specimen: kind, pose: "closed" })}>{kind === "rack" ? "Inspect rack construction" : "Inspect cooling construction"}</button>)}
    </fieldset>
    {activeSpecimen && <p className="facility-assembly-scope">Representative illustrative {activeSpecimen === "rack" ? "rack" : "cooling"} assembly · Construction detail does not establish equipment ratings or site capacity.</p>}
    {busy && <p className="facility-asset-status" role="status">Preparing {requestedView.kind === "specimen" ? `${requestedView.specimen === "rack" ? "server rack" : "cooling assembly"} ${requestedView.pose} view` : "facility viewpoint"}… The current view remains available.</p>}
    {assetPhase === "failed" && <p className="facility-asset-status" role="status">The requested assembly or viewpoint could not be displayed. The current view remains available. <button type="button" className="facility-action" onClick={props.onRetry}>Retry assembly</button></p>}
    {parts.length > 0 && <details className="facility-parts-disclosure"><summary>Inspect assembly parts</summary><fieldset className="facility-part-callouts"><legend>Authored assembly parts</legend>{parts.map((part, index) => {
      const partTarget = { system: metadata.specimen!.system, partId: part.id }
      return <button key={part.id} data-part-id={part.id} type="button" aria-pressed={target?.partId === part.id} data-preview={previewTarget?.partId === part.id || undefined} onClick={() => onTarget(partTarget)}
        onPointerEnter={event => { if (event.pointerType !== "touch" && event.buttons === 0) onPreview(partTarget, `part-${part.id}`, "pointer") }} onPointerLeave={() => onPreview(null, `part-${part.id}`, "pointer")}
        onFocus={event => { if (event.currentTarget.matches(":focus-visible")) onPreview(partTarget, `part-${part.id}`, "focus") }} onBlur={() => onPreview(null, `part-${part.id}`, "focus")}>
        <span className="facility-callout-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{part.label}</strong><small>{part.role.replaceAll("_", " ")}</small></span>
      </button>
    })}</fieldset></details>}
    {step && <section className="facility-walkthrough" aria-label="Assessment walkthrough" data-testid="facility-walkthrough">
      <p className="facility-walkthrough-index">Step {props.walkthroughStep! + 1} of {steps.length} · Fixture {props.record.scenario.toUpperCase()}</p><h3>{step.title}</h3><p>{step.body}</p>
      {step.id === "conditions" && <>
        <div className="facility-walkthrough-conditions">{step.evidence.map(evidence => <section key={evidence.system} aria-label={evidence.label}>
          <h4>{evidence.label}</h4><p>{evidence.body}</p>
          <button type="button" className="facility-action" aria-pressed={target?.system === evidence.system} onClick={() => props.onWalkthroughSystem(evidence.system)}
            onPointerEnter={event => { if (event.pointerType !== "touch" && !event.buttons) onPreview({ system: evidence.system }, `walkthrough-${evidence.system}`, "pointer") }} onPointerLeave={() => onPreview(null, `walkthrough-${evidence.system}`, "pointer")}
            onFocus={event => { if (event.currentTarget.matches(":focus-visible")) onPreview({ system: evidence.system }, `walkthrough-${evidence.system}`, "focus") }} onBlur={() => onPreview(null, `walkthrough-${evidence.system}`, "focus")}>Highlight {evidence.system === "power" ? "electrical" : "cooling"} equipment</button>
        </section>)}</div>
        <div className="facility-walkthrough-attribution"><AssessmentAttribution record={props.record} /></div>
      </>}
      {step.id === "evidence" && <nav className="facility-walkthrough-evidence" aria-label="Walkthrough publication files">
        <a className="facility-evidence-link" href={step.links.brief}>Read the versioned brief</a>
        <a className="facility-evidence-link" href={step.links.pdf}>Download this PDF</a>
        <a className="facility-evidence-link" href={step.links.json}>Download this technical record</a>
      </nav>}
      <div><button type="button" className="facility-action" disabled={props.walkthroughStep === 0} onClick={() => props.onWalkthrough(props.walkthroughStep! - 1)}>Previous step</button><button type="button" className="facility-action" onClick={() => { const finished = props.walkthroughStep === steps.length - 1; props.onWalkthrough(finished ? null : props.walkthroughStep! + 1); if (finished) walkthroughButton.current?.focus({ preventScroll: true }) }}>{props.walkthroughStep === steps.length - 1 ? "Finish walkthrough" : "Next step"}</button></div>
      <p className="facility-walkthrough-note">Steps advance only when selected. Equipment activity does not compute the assessment.</p>
    </section>}
    {diagramOpen && metadata.topology && <FacilityConnectionDiagram metadata={metadata} target={target} previewTarget={previewTarget} presentation={props.presentation} onTarget={onTarget} onPreview={onPreview} />}
  </div>
}

function FacilityConnectionDiagram({ metadata, target, previewTarget, presentation, onTarget, onPreview }: Pick<Props, "metadata" | "target" | "previewTarget" | "presentation" | "onTarget" | "onPreview">) {
  const topology = metadata.topology!
  const maskPrefix = useId()
  const [fullTopology, setFullTopology] = useState(false)
  const presentationRoutes = useMemo(() => new Map(presentation?.routes.map(route => [route.routeId, route]) ?? []), [presentation])
  const diagram = useMemo(() => {
    const equipment = new Map(topology.equipment.map(item => [item.id, item]))
    const ports = new Map(topology.ports.map(port => [port.id, port.equipmentId]))
    const xs = topology.equipment.map(item => item.diagram[0]), ys = topology.equipment.map(item => item.diagram[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const point = (id: string) => { const item = equipment.get(id); return item ? [35 + (item.diagram[0] - minX) / Math.max(1, maxX - minX) * 570, 30 + (item.diagram[1] - minY) / Math.max(1, maxY - minY) * 240] : null }
    return { point, equipment, routes: topology.routes.flatMap(route => { const from = point(ports.get(route.from) ?? ""), to = point(ports.get(route.to) ?? ""); return from && to ? [{ ...route, fromEquipment: ports.get(route.from), toEquipment: ports.get(route.to), d: `M ${from[0]} ${from[1]} H ${(from[0] + to[0]) / 2} V ${to[1]} H ${to[0]}` }] : [] }) }
  }, [topology])
  const neighborhood = useMemo(() => {
    const nodes = new Set<string>()
    const focusEquipment = target?.equipmentId ?? presentation?.equipmentId ?? (!target ? ECOSYSTEM_DEFAULT_RACK : undefined)
    if (fullTopology) topology.equipment.forEach(item => nodes.add(item.id))
    else if (focusEquipment) {
      nodes.add(focusEquipment)
      for (const route of diagram.routes) if (route.fromEquipment === focusEquipment || route.toEquipment === focusEquipment) { if (route.fromEquipment) nodes.add(route.fromEquipment); if (route.toEquipment) nodes.add(route.toEquipment) }
    } else if (target?.routeId) {
      const route = diagram.routes.find(item => item.id === target.routeId)
      if (route?.fromEquipment) nodes.add(route.fromEquipment)
      if (route?.toEquipment) nodes.add(route.toEquipment)
    } else topology.equipment.filter(item => item.system === (target?.system ?? "workloads")).forEach(item => nodes.add(item.id))
    for (const route of diagram.routes) if (presentationRoutes.has(route.id)) { if (route.fromEquipment) nodes.add(route.fromEquipment); if (route.toEquipment) nodes.add(route.toEquipment) }
    return { equipment: topology.equipment.filter(item => nodes.has(item.id)), routes: diagram.routes.filter(item => nodes.has(item.fromEquipment ?? "") && nodes.has(item.toEquipment ?? "")) }
  }, [diagram, topology, target, fullTopology, presentation, presentationRoutes])
  const routeActive = (route: typeof diagram.routes[number], selected: FacilityInspectionTarget | null) => selected?.routeId ? selected.routeId === route.id : selected?.equipmentId ? route.fromEquipment === selected.equipmentId || route.toEquipment === selected.equipmentId : selected?.system === route.system
  return <section className="facility-diagram" aria-label="Authored connection diagram">
    <h3>Equipment connections</h3><button type="button" className="facility-action" aria-pressed={fullTopology} onClick={() => setFullTopology(value => !value)}>{fullTopology ? "Show selected connections" : "Show full topology"}</button><p>Derived from this model’s authored equipment and ports. Connections illustrate physical relationships, not available capacity.</p>
    {topology.ecosystem && <ul className="facility-diagram-legend" aria-label="Connection media"><li><span data-medium="electrical" aria-hidden="true" />Electrical · solid</li><li><span data-medium="air" aria-hidden="true" />Air · dashed</li><li><span data-medium="water" aria-hidden="true" />Water · dotted</li><li><span data-medium="reserve-illustrative" aria-hidden="true" />Reserve · unassessed</li></ul>}
    {presentation && <p className="facility-diagram-story-label">Workload story anchor: {diagram.equipment.get(presentation.equipmentId)?.label}. Highlighted route segments follow the same authored itinerary as the model.</p>}
    {topology.ecosystem && <details className="facility-diagram-relationships"><summary>Air and water relationships</summary><ul>{topology.ecosystem.openAirDomains.map(domain => <li key={domain.id}><strong>{domain.label}</strong>: shared open-room air between authored outlets and rack inlets. This is an open air domain, not a duct connection or validated airflow simulation.</li>)}{topology.ecosystem.thermalCouplings.map(coupling => <li key={coupling.id}><strong>{diagram.equipment.get(coupling.equipmentId)?.label ?? coupling.equipmentId}</strong>: heat transfers across the coil between separate air and water passages. This association does not join the fluid circuits.</li>)}</ul><p>The facility water boundary identifies supply and return connections; it does not establish an upstream plant or its capacity.</p></details>}
    <div className="facility-diagram-groups">{FACILITY_SYSTEMS.map(system => {
      const equipment = neighborhood.equipment.filter(item => item.system === system)
      const routes = neighborhood.routes.filter(route => route.system === system)
      if (!equipment.length && !routes.length) return null
      return <details key={system} open={!fullTopology || target?.system === system || presentation?.systems.includes(system)}>
        <summary>{FACILITY_LABELS[system]} · {equipment.length} equipment · {routes.length} connections</summary>
        <div className="facility-diagram-items">{equipment.map(item => {
          const equipmentTarget = { system: item.system, equipmentId: item.id }
          return <button key={item.id} data-equipment-id={item.id} data-story-active={presentation?.equipmentId === item.id || undefined} type="button" aria-pressed={target?.equipmentId === item.id} onClick={() => onTarget(equipmentTarget)} onPointerEnter={event => { if (event.pointerType !== "touch" && !event.buttons) onPreview(equipmentTarget, item.id, "pointer") }} onPointerLeave={() => onPreview(null, item.id, "pointer")} onFocus={event => { if (event.currentTarget.matches(":focus-visible")) onPreview(equipmentTarget, item.id, "focus") }} onBlur={() => onPreview(null, item.id, "focus")}>{item.index + 1}. {item.label}{presentation?.equipmentId === item.id && <span className="sr-only"> · Workload story anchor</span>}</button>
        })}</div>
        <div className="facility-diagram-items">{routes.map(route => <button type="button" key={route.id} data-route-id={route.id} data-story-active={presentationRoutes.has(route.id) || undefined} aria-pressed={target?.routeId === route.id} onClick={() => onTarget({ system: route.system, routeId: route.id })}>{diagram.equipment.get(route.fromEquipment ?? "")?.label ?? "Boundary"} → {diagram.equipment.get(route.toEquipment ?? "")?.label ?? "Boundary"} · {route.service.replaceAll("_", " ")}{presentationRoutes.has(route.id) && <span className="sr-only"> · Story connection segment</span>}</button>)}</div>
      </details>
    })}</div>
    <details className="facility-diagram-visual"><summary>View connection diagram</summary><p className="facility-assembly-scope">Numbered equipment matches the list above. Scroll the diagram horizontally on smaller screens.</p><div className="facility-diagram-scroll" tabIndex={0} role="region" aria-label="Scrollable authored connection diagram">
    <svg viewBox="0 0 640 300" role="img" aria-label="Equipment and connection topology; choose an equipment item or route in the list above.">
      <defs>{neighborhood.routes.flatMap(route => { const segment = presentationRoutes.get(route.id); return segment ? [<mask key={route.id} id={`${maskPrefix}-${route.index}`} maskUnits="userSpaceOnUse" x={0} y={0} width={640} height={300}><path d={route.d} fill="none" pathLength={1} strokeDasharray={`${segment.toS - segment.fromS} 1`} strokeDashoffset={-segment.fromS} /></mask>] : [] })}</defs>
      {neighborhood.routes.map(route => <path key={route.id} d={route.d} fill="none" data-medium={route.medium} data-active={routeActive(route, target) || undefined} data-preview={routeActive(route, previewTarget) || undefined} />)}
      {neighborhood.routes.flatMap(route => { const segment = presentationRoutes.get(route.id); return segment ? [<path key={`story-${route.id}`} d={route.d} fill="none" mask={`url(#${maskPrefix}-${route.index})`} data-medium={route.medium} data-story-route={route.id} data-from-s={segment.fromS} data-to-s={segment.toS} />] : [] })}
      {neighborhood.equipment.map(item => { const point = diagram.point(item.id)!; return <g key={item.id} data-story-equipment={presentation?.equipmentId === item.id ? item.id : undefined} data-active={target?.equipmentId ? target.equipmentId === item.id || undefined : !target?.routeId && target?.system === item.system || undefined}><rect x={point[0] - 12} y={point[1] - 9} width={24} height={18} rx={2} /><text x={point[0]} y={point[1] + 3} textAnchor="middle">{item.index + 1}</text></g> })}
    </svg>
    </div></details>
  </section>
}
