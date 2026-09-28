import type { WebGLRenderer } from "three"
import type { FacilitySpecimenKind, FacilityVisualRelease } from "@/types/facility"
import { loadFacilityModel, type FacilityModel } from "./asset-runtime"
import { createStudioEnvironment, type StudioEnvironment } from "./render-environment"

export type StagedFacility = { model: FacilityModel; environment: StudioEnvironment | null; dispose: () => void }

/** A replacement shares the session environment. Include both models while staging;
 * the caller disposes the old one only after a valid replacement frame. */
export async function stageReplacement(release: FacilityVisualRelease, kind: FacilitySpecimenKind | undefined, current: FacilityModel, environment: StudioEnvironment | null, signal: AbortSignal): Promise<FacilityModel> {
  const model = await loadFacilityModel(release, signal, kind)
  try {
    signal.throwIfAborted()
    const environmentBytes = environment?.retainedBytes ?? 0
    const previousAllocation = current.statistics.estimatedBytes - current.statistics.environmentBytes
    model.statistics.environmentBytes = environmentBytes
    model.statistics.estimatedBytes += environmentBytes
    model.statistics.peakEstimatedBytes = Math.max(model.statistics.estimatedBytes, model.statistics.peakEstimatedBytes + environmentBytes) + previousAllocation
    if (model.statistics.peakEstimatedBytes > 32 * 1024 * 1024) throw new Error("model_replacement_resource_budget")
    return model
  } catch (error) { model.dispose(); throw error }
}

/** Staging is atomic: callers cannot present a model without its release lighting. */
export async function stageFacility(release: FacilityVisualRelease, renderer: WebGLRenderer, signal: AbortSignal): Promise<StagedFacility> {
  const model = await loadFacilityModel(release, signal)
  let environment: StudioEnvironment | null = null
  try {
    signal.throwIfAborted()
    if (release.profile.lighting.environment) environment = createStudioEnvironment(renderer, release.profile.lighting.environment)
    signal.throwIfAborted()
    const allocation = model.statistics.estimatedBytes
    model.statistics.environmentBytes = environment?.retainedBytes ?? 0
    model.statistics.estimatedBytes += environment?.retainedBytes ?? 0
    model.statistics.peakEstimatedBytes = Math.max(model.statistics.peakEstimatedBytes, allocation + (environment?.peakBytes ?? 0))
    if (model.statistics.peakEstimatedBytes > 32 * 1024 * 1024) throw new Error("model_resource_budget")
    let disposed = false
    return { model, environment, dispose() {
      if (disposed) return
      disposed = true
      environment?.dispose()
      model.dispose()
    } }
  } catch (error) {
    environment?.dispose()
    model.dispose()
    throw error
  }
}
