import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BufferGeometry, Material, Scene, WebGLRenderTarget, type WebGLRenderer } from "three"
import { createStudioEnvironment, studioEnvironmentAllocation } from "@/lib/facility/render-environment"

const generator = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn() }))
vi.mock("three", async original => ({
  ...await original<typeof import("three")>(),
  PMREMGenerator: class {
    constructor(private renderer: WebGLRenderer) {}
    fromScene(scene: Scene, _sigma: number, _near: number, _far: number, options: unknown) { return generator.render(this.renderer, scene, options) }
    dispose() { generator.dispose() }
  },
}))

const profile = { preset: "industrial-softbox-v1", resolution: 128, intensity: 0.65, rotationY: 0 } as const
function renderer() {
  let target: WebGLRenderTarget | null = null
  return {
    autoClear: true, toneMapping: 4, xr: { enabled: true },
    getRenderTarget: () => target, getActiveCubeFace: () => 2, getActiveMipmapLevel: () => 1,
    setRenderTarget: vi.fn((next: WebGLRenderTarget | null) => { target = next }),
  } as unknown as WebGLRenderer
}
beforeEach(() => { generator.render.mockReset(); generator.dispose.mockReset() })
afterEach(() => vi.restoreAllMocks())

describe("once-per-session studio environment", () => {
  it("disposes temporary rig/filter resources immediately and retains only its owned output", () => {
    const gl = renderer(), output = new WebGLRenderTarget(384, 512), dispose = vi.spyOn(output, "dispose")
    const originalTargetSetter = gl.setRenderTarget
    const materials = vi.spyOn(Material.prototype, "dispose"), geometries = vi.spyOn(BufferGeometry.prototype, "dispose")
    generator.render.mockImplementation((renderer, scene, options) => {
      expect(options).toEqual({ size: 128 })
      expect(scene.children).toHaveLength(4)
      renderer.setRenderTarget(output)
      renderer.autoClear = false; renderer.toneMapping = 0; renderer.xr.enabled = false
      return output
    })
    const environment = createStudioEnvironment(gl, profile)
    expect(environment.texture).toBe(output.texture)
    expect(generator.render).toHaveBeenCalledTimes(1)
    expect(generator.dispose).toHaveBeenCalledOnce()
    expect(materials).toHaveBeenCalledTimes(4)
    expect(geometries).toHaveBeenCalledOnce()
    expect(dispose).not.toHaveBeenCalled()
    expect(gl.setRenderTarget).toBe(originalTargetSetter)
    expect(gl.getRenderTarget()).toBeNull()
    expect([gl.autoClear, gl.toneMapping, gl.xr.enabled]).toEqual([true, 4, true])
    environment.dispose(); environment.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it("recovers an allocated output when GPU generation throws before returning it", () => {
    const gl = renderer(), output = new WebGLRenderTarget(384, 512), dispose = vi.spyOn(output, "dispose")
    const setter = gl.setRenderTarget
    const materials = vi.spyOn(Material.prototype, "dispose"), geometries = vi.spyOn(BufferGeometry.prototype, "dispose")
    generator.render.mockImplementation(renderer => {
      renderer.setRenderTarget(output); renderer.autoClear = false; renderer.xr.enabled = false
      throw new Error("injected context failure")
    })
    expect(() => createStudioEnvironment(gl, profile)).toThrow("injected context failure")
    expect(dispose).toHaveBeenCalledOnce()
    expect(generator.dispose).toHaveBeenCalledOnce()
    expect(materials).toHaveBeenCalledTimes(4)
    expect(geometries).toHaveBeenCalledOnce()
    expect(gl.setRenderTarget).toBe(setter)
    expect(gl.getRenderTarget()).toBeNull()
    expect([gl.autoClear, gl.xr.enabled]).toEqual([true, true])
  })

  it("accounts for retained color/depth and transient filtering allocations", () => {
    expect(studioEnvironmentAllocation(128)).toEqual({ retainedBytes: 2_359_296, peakBytes: 3_997_696 })
  })

  it("keeps the frozen v1 rig distinct from the neutral v2 rig with the same resource lifetime", () => {
    const rigs: { background: string; panels: number[][] }[] = []
    generator.render.mockImplementation((_renderer, scene) => {
      rigs.push({ background: scene.background.getHexString(), panels: scene.children.map((panel: { position: { toArray(): number[] }; scale: { toArray(): number[] } }) => [...panel.position.toArray(), ...panel.scale.toArray()]) })
      return new WebGLRenderTarget(384, 512)
    })
    createStudioEnvironment(renderer(), profile).dispose()
    createStudioEnvironment(renderer(), { ...profile, preset: "industrial-softbox-v2" }).dispose()
    expect(rigs[0].background).toBe("191919")
    expect(rigs[1].background).toBe("101010")
    expect(rigs[0].panels).not.toEqual(rigs[1].panels)
    expect(rigs[1].panels).toHaveLength(4)
    expect(generator.dispose).toHaveBeenCalledTimes(2)
  })

  it("uses the v7 nocturnal rig without expanding the retained environment or leaking source panels", () => {
    const gl = renderer(), output = new WebGLRenderTarget(384, 512)
    const dispose = vi.spyOn(output, "dispose")
    const materials = vi.spyOn(Material.prototype, "dispose")
    generator.render.mockImplementation((_renderer, scene, options) => {
      expect(scene.background.getHexString()).toBe("080808")
      expect(options).toEqual({ size: 128 })
      expect(scene.children).toHaveLength(4)
      expect(scene.children.map((panel: { position: { toArray(): number[] } }) => panel.position.toArray()))
        .toEqual([[-4, 10, 5], [7, 5, -7], [-3, -1, 10], [-8, 4, -3]])
      return output
    })
    const environment = createStudioEnvironment(gl, { ...profile, preset: "industrial-night-v1" })
    expect(environment.retainedBytes).toBe(2_359_296)
    expect(environment.peakBytes).toBe(3_997_696)
    expect(materials).toHaveBeenCalledTimes(4)
    environment.dispose(); environment.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it("isolates the v9 neutral satin rig from the frozen nocturnal preset at unchanged allocation", () => {
    const rigs: { background: string; positions: number[][]; colors: number[][] }[] = []
    generator.render.mockImplementation((_renderer, scene, options) => {
      expect(options).toEqual({ size: 128 })
      rigs.push({ background: scene.background.getHexString(), positions: scene.children.map((panel: { position: { toArray(): number[] } }) => panel.position.toArray()), colors: scene.children.map((panel: { material: { color: { toArray(): number[] } } }) => panel.material.color.toArray()) })
      return new WebGLRenderTarget(384, 512)
    })
    const old = createStudioEnvironment(renderer(), { ...profile, preset: "industrial-night-v1" })
    const satin = createStudioEnvironment(renderer(), { ...profile, preset: "industrial-night-v2" })
    expect(satin.retainedBytes).toBe(old.retainedBytes)
    expect(satin.peakBytes).toBe(old.peakBytes)
    expect(rigs[0].positions[3]).toEqual([-8, 4, -3])
    expect(rigs[1].positions[3]).toEqual([8, 1, -5])
    expect(rigs[1].background).toBe("080808")
    expect(rigs[1].colors[0]).not.toEqual(rigs[0].colors[0])
    expect(rigs[1].colors[1]).toEqual(rigs[0].colors[1])
    old.dispose(); satin.dispose()
    expect(generator.dispose).toHaveBeenCalledTimes(2)
  })
})
