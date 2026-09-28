import { afterEach, describe, expect, it, vi } from "vitest"
import { classifyFacilityRenderer, probeAutomaticFacilityGraphics } from "@/lib/facility/graphics-capability"

afterEach(() => vi.restoreAllMocks())

describe("automatic graphics acquisition", () => {
  it.each(["ANGLE (Google, Vulkan SwiftShader Device)", "llvmpipe (LLVM 20)", "softpipe", "Microsoft Basic Render Driver", "Software Rasterizer", "GDI Generic"])("keeps %s on the poster", renderer => {
    expect(classifyFacilityRenderer(renderer)).toEqual({ status: "software", automatic: false })
  })
  it("does not mistake masked identity for unavailable graphics or claim hardware qualification", () => {
    expect(classifyFacilityRenderer(null)).toEqual({ status: "unknown", automatic: true })
    expect(classifyFacilityRenderer("")).toEqual({ status: "unknown", automatic: true })
    expect(classifyFacilityRenderer("ANGLE (Apple, Apple M5, Metal)")).toEqual({ status: "available", automatic: true })
  })
  it.each(["ANGLE (SwiftShader)", "Apple M5", null])("releases the native context for %s without requesting a model", renderer => {
    const loseContext = vi.fn()
    const gl = { isContextLost: () => false, getParameter: () => renderer, getExtension: vi.fn(name => name === "WEBGL_lose_context" ? { loseContext } : renderer === null ? null : { UNMASKED_RENDERER_WEBGL: 1 }) }
    const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(gl as unknown as WebGL2RenderingContext)
    expect(probeAutomaticFacilityGraphics()).toEqual(classifyFacilityRenderer(renderer))
    expect(context).toHaveBeenCalledTimes(1)
    expect(context).toHaveBeenCalledWith("webgl2", expect.objectContaining({ antialias: false, depth: false }))
    expect(loseContext).toHaveBeenCalledTimes(1)
  })
  it("retains the poster when WebGL2 creation is denied", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    expect(probeAutomaticFacilityGraphics()).toEqual({ status: "unavailable", automatic: false })
  })
  it("releases a context even if renderer inspection throws", () => {
    const loseContext = vi.fn()
    const gl = { isContextLost: () => false, getParameter: () => { throw Error("denied") }, getExtension: vi.fn(name => name === "WEBGL_lose_context" ? { loseContext } : { UNMASKED_RENDERER_WEBGL: 1 }) }
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(gl as unknown as WebGL2RenderingContext)
    expect(probeAutomaticFacilityGraphics()).toEqual({ status: "unavailable", automatic: false })
    expect(loseContext).toHaveBeenCalledTimes(1)
  })
})
