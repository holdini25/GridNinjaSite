import type { FacilityInspectionTarget, FacilitySystem } from "@/types/facility"

export type FacilityToken = { generation: number; release: string }
type Preview = { owner: string; system: FacilitySystem; target?: FacilityInspectionTarget }
export type FacilityPresentation = {
  selected: FacilitySystem | null
  target: FacilityInspectionTarget | null
  pointerPreview: Preview | null
  focusPreview: Preview | null
  media: FacilityToken & { phase: "poster" | "loading" | "staging" | "ready" | "failed"; reason: string | null }
  preferencesReady: boolean
  reducedMotion: boolean
  desktop: boolean
  inViewport: boolean
  documentVisible: boolean
  paused: boolean
  equipmentEnabled: boolean
  equipmentTouched: boolean
  automaticAttempted: boolean
  pageLoaded: boolean
  posterDecoded: boolean
  posterPainted: boolean
  posterFailed: boolean
}
type Origin = { token?: FacilityToken }
export type FacilityEvent =
  | ({ type: "select"; system: FacilitySystem; target?: FacilityInspectionTarget } & Origin)
  | ({ type: "preview"; channel: "pointer" | "focus"; owner: string; system: FacilitySystem; target?: FacilityInspectionTarget } & Origin)
  | { type: "preview-end"; channel: "pointer" | "focus"; owner: string }
  | { type: "clear" }
  | { type: "activate" }
  | { type: "close" }
  | { type: "staged" | "presented"; token: FacilityToken }
  | { type: "failed"; token: FacilityToken; reason: string }
  | { type: "preferences"; reducedMotion: boolean; desktop: boolean; adaptive?: boolean }
  | { type: "restore-preferences"; paused?: boolean; equipmentEnabled?: boolean; closed: boolean }
  | { type: "visibility"; inViewport: boolean; documentVisible: boolean }
  | { type: "pause"; paused: boolean }
  | { type: "equipment"; enabled: boolean }
  | { type: "page-loaded" | "poster-pending" | "poster-decoded" | "poster-painted" | "poster-failed" }

export function initialFacilityPresentation(release: string): FacilityPresentation {
  return {
    selected: null, target: null, pointerPreview: null, focusPreview: null,
    media: { release, generation: 0, phase: "poster", reason: null },
    preferencesReady: false, reducedMotion: true, desktop: false,
    inViewport: false, documentVisible: false,
    paused: false, equipmentEnabled: false, equipmentTouched: false, automaticAttempted: false,
    pageLoaded: false, posterDecoded: false, posterPainted: false, posterFailed: false,
  }
}

function matches(state: FacilityPresentation, token: FacilityToken) {
  return token.generation === state.media.generation && token.release === state.media.release
}

function accepts(state: FacilityPresentation, token?: FacilityToken) {
  return !token || (matches(state, token) && state.media.phase === "ready" && state.inViewport && state.documentVisible)
}

/** Presentation only: assessment records and quantities never enter this reducer. */
export function facilityReducer(state: FacilityPresentation, event: FacilityEvent): FacilityPresentation {
  switch (event.type) {
    case "select":
      return accepts(state, event.token) ? { ...state, selected: event.system, target: event.target ?? { system: event.system }, pointerPreview: null, focusPreview: null } : state
    case "preview": {
      if (!accepts(state, event.token)) return state
      const channel = event.channel === "focus" ? "focusPreview" : "pointerPreview"
      if (state[channel]?.owner === event.owner && state[channel]?.system === event.system && equalTarget(state[channel]?.target, event.target)) return state
      return { ...state, [channel]: { owner: event.owner, system: event.system, target: event.target } }
    }
    case "preview-end": {
      const channel = event.channel === "focus" ? "focusPreview" : "pointerPreview"
      return state[channel]?.owner === event.owner ? { ...state, [channel]: null } : state
    }
    case "clear":
      return { ...state, selected: null, target: null, pointerPreview: null, focusPreview: null }
    case "activate":
      if (state.media.phase !== "poster" && state.media.phase !== "failed") return state
      return { ...state, automaticAttempted: true, media: { ...state.media, generation: state.media.generation + 1, phase: "loading", reason: null } }
    case "close":
      return { ...state, automaticAttempted: true, pointerPreview: null, focusPreview: null, media: { ...state.media, generation: state.media.generation + 1, phase: "poster", reason: null } }
    case "staged":
      return matches(state, event.token) && state.media.phase === "loading" ? { ...state, media: { ...state.media, phase: "staging" } } : state
    case "presented":
      return matches(state, event.token) && state.media.phase === "staging" ? { ...state, media: { ...state.media, phase: "ready" } } : state
    case "failed":
      if (!matches(state, event.token) || state.media.phase === "poster" || state.media.phase === "failed") return state
      return { ...state, automaticAttempted: true, pointerPreview: null, focusPreview: null, media: { ...state.media, generation: state.media.generation + 1, phase: "failed", reason: event.reason } }
    case "preferences":
      return { ...state, preferencesReady: true, reducedMotion: event.reducedMotion, desktop: event.desktop, equipmentEnabled: state.preferencesReady || state.equipmentTouched ? state.equipmentEnabled : (event.adaptive || event.desktop) }
    case "restore-preferences":
      return { ...state, paused: event.paused ?? state.paused, equipmentEnabled: event.equipmentEnabled ?? state.equipmentEnabled, equipmentTouched: event.equipmentEnabled !== undefined || state.equipmentTouched, automaticAttempted: event.closed || state.automaticAttempted }
    case "visibility":
      if (state.inViewport === event.inViewport && state.documentVisible === event.documentVisible) return state
      return { ...state, inViewport: event.inViewport, documentVisible: event.documentVisible, pointerPreview: null, focusPreview: null }
    case "pause":
      return { ...state, paused: event.paused }
    case "equipment":
      return { ...state, equipmentEnabled: event.enabled, equipmentTouched: true }
    case "page-loaded":
      return { ...state, pageLoaded: true }
    case "poster-pending":
      return { ...state, posterDecoded: false, posterPainted: false, posterFailed: false }
    case "poster-painted":
      return state.posterDecoded ? { ...state, posterPainted: true } : state
    case "poster-decoded":
      return { ...state, posterDecoded: true, posterFailed: false }
    case "poster-failed":
      return { ...state, posterDecoded: false, posterPainted: false, posterFailed: true }
  }
}

export function facilityPreview(state: FacilityPresentation) {
  const preview = state.focusPreview?.system ?? state.pointerPreview?.system ?? null
  return preview === state.selected ? null : preview
}

function equalTarget(a?: FacilityInspectionTarget | null, b?: FacilityInspectionTarget | null) {
  return a?.system === b?.system && a?.equipmentId === b?.equipmentId && a?.routeId === b?.routeId && a?.partId === b?.partId
}
export function facilityPreviewTarget(state: FacilityPresentation): FacilityInspectionTarget | null {
  const preview = state.focusPreview ?? state.pointerPreview
  if (!preview) return null
  const target = preview.target ?? { system: preview.system }
  return equalTarget(target, state.target) ? null : target
}
