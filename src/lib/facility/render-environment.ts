import {
  Color, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene,
  type Texture, type WebGLRenderer, type WebGLRenderTarget,
} from "three"
import type { FacilityRenderProfile } from "@/types/facility"

type EnvironmentProfile = NonNullable<FacilityRenderProfile["lighting"]["environment"]>
export type StudioEnvironment = {
  texture: Texture
  retainedBytes: number
  peakBytes: number
  dispose: () => void
}

/** Includes RGBA16F output, its depth storage, transient filter target and a
 * conservative allowance for the small generator/source geometry buffers. */
export function studioEnvironmentAllocation(resolution: 128) {
  const pixels = 3 * Math.max(resolution, 112) * 4 * resolution
  return { retainedBytes: pixels * 12, peakBytes: pixels * 20 + 65_536 }
}

/** This frozen reflection rig is generated once; it never enters the visible scene. */
export function createStudioEnvironment(renderer: WebGLRenderer, profile: EnvironmentProfile): StudioEnvironment {
  if (!["industrial-softbox-v1", "industrial-softbox-v2", "industrial-night-v1", "industrial-night-v2", "industrial-night-v3"].includes(profile.preset) || profile.resolution !== 128) throw new Error("environment_profile")
  const studio = new Scene()
  studio.background = new Color(profile.preset.startsWith("industrial-night-") ? "#080808" : profile.preset === "industrial-softbox-v2" ? "#101010" : "#191919")
  const geometry = new PlaneGeometry(1, 1)
  const materials: MeshBasicMaterial[] = []
  const generator = new PMREMGenerator(renderer)
  const previous = {
    target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(), level: renderer.getActiveMipmapLevel(),
    autoClear: renderer.autoClear, toneMapping: renderer.toneMapping, xr: renderer.xr.enabled,
  }
  const setRenderTarget = renderer.setRenderTarget
  let output: WebGLRenderTarget | WebGLRenderTarget<Texture[]> | undefined
  let complete = false
  // Pinned Three 0.186 fromScene binds its output before its filter targets.
  // Capture that first allocation so a shader/context failure cannot orphan it
  // before fromScene returns. The override exists only during this synchronous call.
  renderer.setRenderTarget = function (target, ...args) {
    if (target && target !== previous.target && !output) output = target
    return setRenderTarget.call(this, target, ...args)
  }
  try {
    const panels = profile.preset === "industrial-night-v3" ? [
      // Broad neutral key, quieter frontal fill and a narrow side reflection
      // reveal recessed fronts and the moving tray without glazing every panel.
      { position: [-6, 8, -7], size: [9, 6], color: "#f5f5f3", radiance: .45 },
      { position: [7, 5, -7], size: [2, 10], color: "#e6edef", radiance: 2.4 },
      { position: [-6, -4, 8], size: [9, 6], color: "#f3f3f1", radiance: 1.4 },
      { position: [8, -4, -6], size: [5, 6], color: "#ededed", radiance: .6 },
    ] : profile.preset === "industrial-night-v2" ? [
      // Neutral satin reflections preserve graphite instead of tinting the
      // largest planes brown. The separated side strip reads collector seams.
      { position: [-4, 10, 5], size: [12, 7], color: "#f5f5f3", radiance: 4.1 },
      { position: [7, 5, -7], size: [2, 10], color: "#e6edef", radiance: 2.4 },
      { position: [-3, -1, 10], size: [11, 7], color: "#f3f3f1", radiance: 1.9 },
      { position: [8, 1, -5], size: [5, 6], color: "#ededed", radiance: 1.15 },
    ] : profile.preset === "industrial-night-v1" ? [
      // A broad overhead service reflection reads the large black surfaces;
      // the rear strip separates duct/flange silhouettes without glossy trim.
      { position: [-4, 10, 5], size: [12, 7], color: "#fffaf3", radiance: 4.1 },
      { position: [7, 5, -7], size: [2, 10], color: "#e6edef", radiance: 2.4 },
      // Front-facing equipment reflects the lower/front hemisphere into the
      // elevated architectural camera. This fill reveals recessed modules.
      { position: [-3, -1, 10], size: [11, 7], color: "#fff4e6", radiance: 1.9 },
      { position: [-8, 4, -3], size: [4, 6], color: "#ededed", radiance: 0.8 },
    ] : profile.preset === "industrial-softbox-v2" ? [
      // Large neutral reflections reveal paint roughness across broad black
      // panels; the narrow rear source separates silhouettes without bright trim.
      { position: [-6, 9, 7], size: [11, 8], color: "#fffaf3", radiance: 3.5 },
      { position: [8, 5, -5], size: [3, 9], color: "#f4f4f4", radiance: 3 },
      { position: [-2, 6, -9], size: [6, 4], color: "#ededed", radiance: 0.7 },
      { position: [-4, -1, 9], size: [8, 7], color: "#f6f3ee", radiance: 1.1 },
    ] : [
      { position: [-7, 10, 5], size: [10, 8], color: "#fff4e8", radiance: 3 },
      { position: [8, 6, -5], size: [6, 9], color: "#f2f2f2", radiance: 2 },
      { position: [-1, 5, -10], size: [5, 6], color: "#dfdfdf", radiance: 0.75 },
      // Vertical cabinet faces reflect the lower/front hemisphere toward the
      // elevated viewing camera. Keep this broad fill below the brighter key.
      { position: [-5, -2, 9], size: [7, 6], color: "#fff7ed", radiance: 1.3 },
    ]
    for (const panel of panels) {
      const material = new MeshBasicMaterial({ color: new Color(panel.color).multiplyScalar(panel.radiance), toneMapped: false })
      materials.push(material)
      const mesh = new Mesh(geometry, material)
      mesh.position.set(panel.position[0], panel.position[1], panel.position[2])
      mesh.scale.set(panel.size[0], panel.size[1], 1)
      mesh.lookAt(0, 0, 0)
      studio.add(mesh)
    }
    const target = generator.fromScene(studio, 0, 0.1, 50, { size: profile.resolution })
    output = target
    complete = true
    let disposed = false
    return {
      texture: target.texture,
      ...studioEnvironmentAllocation(profile.resolution),
      dispose() { if (!disposed) { disposed = true; target.dispose() } },
    }
  } finally {
    renderer.setRenderTarget = setRenderTarget
    renderer.autoClear = previous.autoClear
    renderer.toneMapping = previous.toneMapping
    renderer.xr.enabled = previous.xr
    renderer.setRenderTarget(previous.target, previous.face, previous.level)
    generator.dispose()
    for (const material of materials) material.dispose()
    geometry.dispose()
    studio.clear()
    if (!complete) output?.dispose()
  }
}
