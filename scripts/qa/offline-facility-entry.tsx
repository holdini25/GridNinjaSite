/** Bundled into the private loopback QA server only; never imported by a page. */
import { createRoot, type Root } from "react-dom/client"
import FacilityCanvas from "@/components/facility/facility-canvas"
import { createOfflineCapturePort, offlineCaptureProfile, type OfflineCaptureProfileId } from "@/lib/facility/offline-capture"
import type { FacilityCanvasProps, FacilityInspectionTarget, FacilitySystem, FacilityView, FacilityVisualRelease } from "@/types/facility"

let root: Root | null = null, props: FacilityCanvasProps | null = null
let bridge: ReturnType<typeof createOfflineCapturePort> | null = null, controller: AbortController | null = null
let failure: string | null = null, assetPhase = "initial", requestNumber = 0
const draw = () => { if (root && props) root.render(<FacilityCanvas {...props} />) }
const visibility = () => { if (props) { props = { ...props, visible: document.visibilityState === "visible" }; draw() } }
const dispose = () => {
  controller?.abort(new Error("offline_entry_disposed")); controller = null
  document.removeEventListener("visibilitychange", visibility)
  root?.unmount(); root = null; bridge = null; props = null
}

const api = {
  mount(release: FacilityVisualRelease, profileId: OfflineCaptureProfileId) {
    if (root) throw new Error("offline_entry_already_mounted")
    if (!release.profile.engineering) throw new Error("offline_entry_requires_engineering_session")
    const profile = offlineCaptureProfile(profileId), element = document.getElementById("stage")!
    element.style.width = `${profile.cssSize[0]}px`; element.style.height = `${profile.cssSize[1]}px`
    failure = null; assetPhase = "initial"; requestNumber = 0
    bridge = createOfflineCapturePort(); root = createRoot(element)
    props = {
      release, generation: 1, view: { kind: "overview" }, selected: null, target: null, preview: null, previewTarget: null,
      visible: document.visibilityState === "visible", paused: true, reducedMotion: true, equipmentEnabled: false,
      offlineCapturePort: bridge.port,
      onStaged() {}, onPresented() {}, onSelect() {}, onPreview() {},
      onFailure(reason) { failure = reason },
      onAssetState(state) { assetPhase = state.phase; if (state.phase === "failed") failure = state.reason ?? "asset_failed" },
    }
    document.addEventListener("visibilitychange", visibility); draw()
  },
  present(view: FacilityView, selected: FacilitySystem | null, target: FacilityInspectionTarget | null) {
    if (!props) throw new Error("offline_entry_not_mounted")
    failure = null; props = { ...props, view, selected, target }; draw()
  },
  status() { return { failure, assetPhase, capture: bridge?.status() ?? null } },
  async capture(profile: OfflineCaptureProfileId) {
    if (!props || !bridge) throw new Error("offline_entry_not_mounted")
    if (controller) throw new Error("offline_entry_capture_busy")
    const view = props.view ?? { kind: "overview" }, model = view.kind === "overview" ? props.release.model : props.release.specimens?.[view.specimen]?.model
    if (!model) throw new Error("offline_entry_missing_asset")
    const ownedController = new AbortController(); controller = ownedController
    try {
      return await bridge.capture({ requestId: `frame-${++requestNumber}`, profile, expectedRelease: props.release.release, expectedGeneration: props.generation, expectedModelSha256: model.sha256, expectedView: view, expectedSelected: props.selected, expectedTarget: props.target ?? null, signal: ownedController.signal })
    } finally { if (controller === ownedController) controller = null }
  },
  abort() { controller?.abort(new Error("offline_entry_explicit_abort")) },
  dispose,
}
declare global { interface Window { __gnOfflineFacility: typeof api } }
window.__gnOfflineFacility = api
window.addEventListener("pagehide", dispose, { once: true })
