import { PointLight, type Scene } from "three"
import type { FacilityRenderProfile } from "@/types/facility"

type FiniteLightProfile = NonNullable<FacilityRenderProfile["lighting"]["finite"]>

/** One shadowless local source. Its count stays stable through staging so shader
 * prewarming sees the final light topology while the current scene stays usable.
 * Profile changes happen with the scene commit, never in the animation loop. */
export function createFiniteLight(scene: Scene, initial: FiniteLightProfile) {
  const light = new PointLight()
  light.name = "GN_FINITE_SERVICE_LIGHT"
  light.castShadow = false
  let disposed = false
  const bind = (profile: FiniteLightProfile | undefined) => {
    if (disposed) throw new Error("finite_light_disposed")
    // Keep the one light present at zero intensity when an older specimen has
    // no local-source profile. This preserves compiled light counts on return.
    light.intensity = profile?.intensity ?? 0
    light.decay = 2
    light.distance = 0
    if (profile) {
      light.position.fromArray(profile.position)
      light.color.set(profile.color)
    }
    light.updateMatrixWorld()
  }
  bind(initial)
  scene.add(light)
  return {
    light,
    // Conservative CPU object/uniform allowance. No shadow map, image, visible
    // mesh or render target is created; staging shares this same light.
    retainedBytes: 4096,
    bind,
    dispose() {
      if (disposed) return
      disposed = true
      light.removeFromParent()
      light.dispose()
    },
  }
}
