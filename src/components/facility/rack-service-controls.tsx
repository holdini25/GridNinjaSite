import type { ReactNode } from "react"
import type { FacilityView } from "@/types/facility"
import { INITIAL_RACK_JOURNEY, nextRackServiceAction, rackPendingLabel, rackState, type RackServiceAction, type RackServiceJourney } from "@/lib/facility/rack-service-journey"
import { isRackServiceDetail } from "@/lib/facility/rack-service-view"

const LABELS: Record<RackServiceAction, string> = { open: "Open door", extend: "Extend server tray", inspect: "Inspect service connection", return: "Return to whole assembly", retract: "Retract server tray", close: "Close door" }
export function RackServiceControls({ activeView, requestedView, busy, ready, journey = INITIAL_RACK_JOURNEY, onView, children }: {
  activeView: FacilityView; requestedView: FacilityView; busy: boolean; ready: boolean; journey?: RackServiceJourney; onView: (view: FacilityView) => void; children?: ReactNode
}) {
  const current = rackState(activeView)!, requested = rackState(requestedView) ?? current
  const detail = isRackServiceDetail(activeView) || isRackServiceDetail(requestedView)
  const primary = nextRackServiceAction(activeView, journey)
  const command = (action: RackServiceAction | "panel") => {
    if (action === "inspect" || action === "return") {
      if (busy || !ready) return
      onView({ kind: "specimen", specimen: "rack", pose: "service", rack: { door: "open", tray: "extended", cutaway: true }, ...(action === "inspect" ? { detail: "service-connection" as const } : {}) })
      return
    }
    if (detail || !ready) return
    const next = { ...requested }
    if (action === "open") next.door = "open"
    if (action === "extend") { next.door = "open"; next.tray = "extended" }
    if (action === "retract") next.tray = "retracted"
    if (action === "close") { next.tray = "retracted"; next.door = "closed" }
    if (action === "panel") next.cutaway = !next.cutaway
    onView({ kind: "specimen", specimen: "rack", pose: next.tray === "extended" ? "service" : next.cutaway ? "cutaway" : "closed", rack: next })
  }
  const secondary: RackServiceAction[] = detail ? [] : [requested.door === "open" ? "close" : "open", requested.tray === "extended" ? "retract" : "extend", ...(current.tray === "extended" && !busy ? ["inspect" as const] : [])]
  return <section className="facility-rack-service" aria-label="Rack service controls">
    <p className="facility-assembly-scope">Representative illustrative rack assembly</p>
    <div className="facility-rack-actions" aria-label="Rack actions">
      <button type="button" className="facility-action facility-guided-primary" data-guided-primary data-service-inspect={primary === "inspect" && !busy ? "true" : undefined} disabled={!ready || busy} onClick={() => command(primary)}>{busy ? rackPendingLabel(activeView, requestedView) : LABELS[primary]}<span aria-hidden="true"> →</span></button>
    </div>
    <p className="facility-service-guidance">{detail ? "The side panel is removed. The fixed plug stays on the rear rail; the gap to the tray inlet shows the disconnected service connection." : current.tray === "extended" ? "The tray is extended 180 mm on its rails. Inspect its disconnected service connection, or retract it when ready." : current.door === "open" ? journey.hasExtended ? "The tray is retracted. Close the door to finish, or inspect again." : "The door is clear of the tray. Extend the tray to inspect its supports and connection." : "Open the door to begin. You can return to the facility at any time."}</p>
    <details className="facility-parts-disclosure facility-service-options"><summary>More inspection options</summary>
      {!detail && <div className="facility-rack-actions" aria-label="Additional rack actions">{secondary.filter((action, index) => (busy || action !== primary) && secondary.indexOf(action) === index).map(action => <button key={action} type="button" className="facility-action" disabled={!ready} data-service-inspect={action === "inspect" ? "true" : undefined} onClick={() => command(action)}>{action === "inspect" && journey.detailSeen ? "Inspect service connection again" : LABELS[action]}</button>)}<button type="button" className="facility-action" disabled={!ready} aria-pressed={requested.cutaway} onClick={() => command("panel")}>{requested.cutaway ? "Restore side panel" : "Cutaway view"}</button></div>}
      {children}
    </details>
  </section>
}
