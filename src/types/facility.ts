import type { PublicTopic } from "@/lib/public-topic"
import type { AssessmentRecord } from "@/types/assessment"

export const FACILITY_SYSTEMS = ["power", "cooling", "storage", "workloads"] as const
export type FacilitySystem = (typeof FACILITY_SYSTEMS)[number]
export type FacilityMode = "poster" | "manual" | "auto-desktop" | "auto-adaptive"
export type FacilityFile = { url: string; bytes: number; sha256: string }
export type FacilityVector = [number, number, number]
export type FacilityBounds = { min: FacilityVector; max: FacilityVector }
export type FacilityCamera = { camera: FacilityVector; target: FacilityVector; padding: number; projection?: "orthographic" | "perspective"; fov?: number }
export type FacilityInspectionProfile = {
  version: 1
  /** Authored construction bounds include moving extents and exclude decorative context. */
  fitSubjects: { overview: FacilityBounds; "air-path": FacilityBounds }
  mobile?: FacilityCamera
  /** Taller mobile assembly stage; overview retains its approved composition. */
  mobileRackAspect?: number
  details: { rack: FacilityCamera; "air-path": FacilityCamera }
}
export type FacilityEquipmentIndex = {
  schemaVersion: "facility-equipment-index.v1"
  equipment: { id: string; label: string; system: FacilitySystem; role: string; bounds: FacilityBounds }[]
}
export type FacilitySpecimenKind = "rack" | "cooling"
export type FacilityPose = "closed" | "cutaway" | "service"
export type FacilityRackTarget = { door: "closed" | "open"; tray: "retracted" | "extended"; cutaway: boolean }
export type FacilityRackAnchor = { action: "door" | "tray"; x: number; y: number; visible: boolean }
export type FacilityInspectionTarget = { system: FacilitySystem; equipmentId?: string; routeId?: string; partId?: string }
export type FacilityView = { kind: "overview"; system?: FacilitySystem; section?: "air-path"; detail?: "rack" | "air-path"; equipmentId?: string } | { kind: "specimen"; specimen: FacilitySpecimenKind; pose: FacilityPose; rack?: FacilityRackTarget; detail?: "service-connection" }
export type FacilityMedium = "electrical" | "air" | "water" | "reserve-illustrative"
export type FacilityTraceSegment = { routeId: string; fromS: number; toS: number }
export type FacilityEcosystemTopology = {
  branches: { portId: string; routeId: string; s: number }[]
  passages: { id: string; equipmentId: string; medium: FacilityMedium; from: string; to: string; path: FacilityVector[]; lengthMetres: number }[]
  openAirDomains: { id: string; label: string; outlets: string[]; inlets: string[] }[]
  thermalCouplings: { id: string; equipmentId: string; airPassage: string; waterPassage: string }[]
  racks: { equipmentId: string; ledIndices: number[]; fanIndices: number[]; electrical: FacilityTraceSegment[]; exhaust: FacilityTraceSegment[]; coolingSupply: FacilityTraceSegment[]; coolingReturn: FacilityTraceSegment[] }[]
  sections: { id: "air-path"; coverIds: string[] }[]
}
export type FacilityTopology = {
  schemaVersion: "facility-topology.v1" | "facility-topology.v2"
  equipment: { id: string; index: number; label: string; system: FacilitySystem; role: string; bounds: FacilityBounds; diagram: [number, number] }[]
  ports: { id: string; equipmentId: string; service: string; position: FacilityVector; medium?: FacilityMedium; role?: string }[]
  routes: { id: string; index: number; system: FacilitySystem; service: string; from: string; to: string; path: FacilityVector[]; lengthMetres: number; medium?: FacilityMedium; direction?: "forward" | "reverse" | "none" }[]
  internalLinks: { from: string; to: string }[]
  ecosystem?: FacilityEcosystemTopology
}
export type FacilityEcosystemProfile = {
  version: 1
  seed: number
  ambientIntervalSeconds: [number, number]
  sequenceSeconds: number
  chapterSeconds: [4, 4, 5, 4, 4, 3]
  colors: { electrical: string; cooling: string; heat: string }
  fanModulation: number
  maxEquipment: 96
  maxRoutes: 128
  maxTraces: 2
}
export type FacilityPresentationCommand = {
  revision: number
  /** Changes only for chapter jumps/replay; play/pause preserves the cursor. */
  seekRevision: number
  chapter: number | null
  playing: boolean
  rackId: string
  coolingEvidence: "available" | "missing"
}
export type FacilityPresentationCheckpoint = {
  revision: number
  chapter: number
  playing: boolean
  reason?: "complete" | "cooling-missing" | "motion-disabled"
}
export type FacilitySpecimenMetadata = {
  schemaVersion: "facility-specimen.v1"
  kind: FacilitySpecimenKind
  system: FacilitySystem
  parts: { id: string; index: number; label: string; role: string; objectId: string; bounds: FacilityBounds; connections: string[] }[]
  poses: Record<FacilityPose, { camera: FacilityCamera; transforms: { id: string; position: FacilityVector; visible: boolean }[] }>
  rackMotion?: {
    version: 1
    door: { objectId: string; closed: [number, number, number, number]; open: [number, number, number, number] }
    tray: { objectId: string; retracted: FacilityVector; extended: FacilityVector }
    cutawayObjectIds: string[]
    camera: FacilityCamera
    fitBounds: FacilityBounds
    /** Explicit close-up of already extended construction; never a mechanical pose. */
    serviceDetail?: { version: 1; camera: FacilityCamera; fitBounds: FacilityBounds; partIds: string[]; requiresCutaway: true }
    anchors: { id: "door" | "tray"; objectId: string; position: FacilityVector }[]
  }
}
export type FacilitySceneMetadata = { topology?: FacilityTopology; specimen?: FacilitySpecimenMetadata }
export type FacilityQuality = "still" | "economy" | "balanced" | "high"
export type FacilitySurfaceProfile = {
  version: 1
  pipeline: "pbr-semantic-v2"
  uvSet: 0
  maxTextureBytes: 3145728
  /** Optional opt-in preserves the appearance of frozen releases. */
  equipmentEdge?: { version: 1; viewDirection: "projection-correct"; exponent: number; intensity: number }
}
export type FacilityRenderProfile = {
  camera: [number, number, number]
  target: [number, number, number]
  padding: number
  inspection?: FacilityInspectionProfile
  framing?: "projected-geometry"
  background: string
  exposure: number
  colorSpace: "srgb"
  toneMapping: "aces-filmic"
  surfaces?: FacilitySurfaceProfile
  ecosystem?: FacilityEcosystemProfile
  lighting: {
    hemisphere: { sky: string; ground: string; intensity: number }
    directional: { position: [number, number, number]; color: string; intensity: number }[]
    /** Optional single, shadowless local source; absent releases remain unchanged. */
    finite?: { version: 1; type: "point"; position: [number, number, number]; color: string; intensity: number; decay: 2; distance: 0 }
    environment?: { preset: "industrial-softbox-v1" | "industrial-softbox-v2" | "industrial-night-v1" | "industrial-night-v2" | "industrial-night-v3"; resolution: 128; intensity: number; rotationY: number }
  }
  motion?: {
    fanRadiansPerSecond: number
    fanPhaseOffsets: [number, number, number, number]
    ledPulseRadiansPerSecond: number
    ledPulseAmplitude: number
  }
  led?: { color: string; steadyIntensity: number; size: [number, number, number] }
  engineering?: {
    version: 1
    seed: number
    accent: { resting: string; hover: string; selected: string; previewWeight: number; baseEmission: number; activeEmission: number; transitionMs: number }
    activity: { resting: number; peak: number; steady: number; pulseMs: [number, number]; eventMs: [number, number]; maxPulses: number; ambientTraceSeconds: [number, number]; selectedTraceQuietSeconds: number }
    cameraTransitionMs: number
    poseTransitionMs: number
    rendering: { ambientFps: 30; interactionFps: 60; mobilePixels: number; desktopPixels: number; probeSeconds: number }
  }
}
export type FacilitySpecimenRelease = {
  kind: FacilitySpecimenKind
  label: string
  system: FacilitySystem
  model: FacilityFile
  posters: { closed: FacilityFile; cutaway: FacilityFile }
  profile: FacilityRenderProfile
  requiredIds: string[]
}
export type FacilityVisualRelease = {
  schemaVersion: "facility.v1"
  release: string
  environment: "synthetic"
  model: FacilityFile
  posters: { desktop: FacilityFile; mobile: FacilityFile }
  profile: FacilityRenderProfile
  systems: Record<FacilitySystem, { root: string; accent: string; pick: string }>
  equipment: { rotors: { id: string; axis: [number, number, number] }[]; leds: string[] }
  equipmentIndex?: FacilityEquipmentIndex
  specimens?: Partial<Record<FacilitySpecimenKind, FacilitySpecimenRelease>>
}
export type FacilityInspectionProps = {
  /** Transient explicit reading state, independent of saved motion preferences. */
  readingHold?: boolean
  activateOnMount?: boolean
  showAssessmentCaption?: boolean
  record: AssessmentRecord
  release: FacilityVisualRelease
  variant: "hero" | "demo"
  loadingPolicy: "auto-desktop" | "auto-adaptive" | "manual"
  mode?: FacilityMode
  resetRevision?: number
  onExpandedChange?: (expanded: boolean) => void
  topic?: PublicTopic
  initialTarget?: FacilityInspectionTarget | null
  onCommittedTarget?: (target: FacilityInspectionTarget | null) => void
}
export type FacilityCanvasProps = {
  readingHold?: boolean
  release: FacilityVisualRelease
  generation: number
  selected: FacilitySystem | null
  preview: FacilitySystem | null
  visible: boolean
  paused: boolean
  reducedMotion: boolean
  equipmentEnabled: boolean
  onStaged: () => void
  onPresented: () => void
  onFailure: (reason: string) => void
  onSelect: (system: FacilitySystem) => void
  onPreview: (system: FacilitySystem | null) => void
  target?: FacilityInspectionTarget | null
  previewTarget?: FacilityInspectionTarget | null
  view?: FacilityView
  onTarget?: (target: FacilityInspectionTarget) => void
  onTargetPreview?: (target: FacilityInspectionTarget | null) => void
  onMetadata?: (metadata: FacilitySceneMetadata) => void
  onAssetState?: (state: { phase: "loading" | "ready" | "failed"; view: FacilityView; reason?: string }) => void
  onQuality?: (quality: FacilityQuality, reason?: string) => void
  motionRetry?: number
  assetRetry?: number
  presentation?: FacilityPresentationCommand
  onPresentationCheckpoint?: (checkpoint: FacilityPresentationCheckpoint) => void
  /** Stable mutable projection buffer; update HTML refs directly, never React per frame. */
  onRackAnchors?: (anchors: readonly FacilityRackAnchor[]) => void
}
