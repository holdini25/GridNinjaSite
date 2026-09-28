export type FacilityAutomaticGraphics = "available" | "unknown" | "software" | "unavailable"
export type FacilityGraphicsProbe = { status: FacilityAutomaticGraphics; automatic: boolean }

/** A reported software renderer is unsuitable for automatic model acquisition.
 * Masked identities remain eligible; this is a load policy, not a GPU benchmark. */
export function classifyFacilityRenderer(renderer: string | null): FacilityGraphicsProbe {
  if (renderer === null || !renderer.trim()) return { status: "unknown", automatic: true }
  if (/SwiftShader|llvmpipe|softpipe|software|Microsoft Basic Render|GDI Generic/i.test(renderer)) return { status: "software", automatic: false }
  return { status: "available", automatic: true }
}

/** One disposable native context, before importing Three or requesting the GLB.
 * Manual activation deliberately does not use this automatic-load restriction. */
export function probeAutomaticFacilityGraphics(): FacilityGraphicsProbe {
  const canvas = document.createElement("canvas")
  canvas.width = 1; canvas.height = 1
  let gl: WebGL2RenderingContext | null = null
  try {
    gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false })
    if (!gl || gl.isContextLost()) return { status: "unavailable", automatic: false }
    const debug = gl.getExtension("WEBGL_debug_renderer_info")
    const renderer: unknown = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null
    return classifyFacilityRenderer(typeof renderer === "string" ? renderer : null)
  } catch {
    // Capability acquisition can be denied by browser or device policy.
    return { status: "unavailable", automatic: false }
  } finally {
    try { gl?.getExtension("WEBGL_lose_context")?.loseContext() } catch { /* Browser already retired the context. */ }
    canvas.width = 0; canvas.height = 0
  }
}
