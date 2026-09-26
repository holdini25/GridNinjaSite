import { beforeEach, describe, expect, it, vi } from "vitest"
import { Texture, type WebGLRenderer } from "three"
import type { FacilityVisualRelease } from "@/types/facility"
import type { FacilityModel } from "@/lib/facility/asset-runtime"
import { stageFacility, stageReplacement } from "@/lib/facility/render-session"

const dependencies = vi.hoisted(() => ({ load: vi.fn(), environment: vi.fn() }))
vi.mock("@/lib/facility/asset-runtime", () => ({ loadFacilityModel: dependencies.load }))
vi.mock("@/lib/facility/render-environment", () => ({ createStudioEnvironment: dependencies.environment }))

const profile = { preset: "industrial-softbox-v1", resolution: 128, intensity: 0.65, rotationY: 0 } as const
const release = (withEnvironment: boolean) => ({ profile: { lighting: { ...(withEnvironment ? { environment: profile } : {}) } } }) as FacilityVisualRelease
const gl = {} as WebGLRenderer
let model: FacilityModel
let environment: { texture: Texture; retainedBytes: number; peakBytes: number; dispose: ReturnType<typeof vi.fn<() => void>> }
beforeEach(() => {
  dependencies.load.mockReset(); dependencies.environment.mockReset()
  model = { statistics: { materials: 10, estimatedBytes: 2_000_000, peakEstimatedBytes: 2_000_000, environmentBytes: 0 }, dispose: vi.fn() } as unknown as FacilityModel
  environment = { texture: new Texture(), retainedBytes: 2_359_296, peakBytes: 3_997_696, dispose: vi.fn() }
  dependencies.load.mockResolvedValue(model)
  dependencies.environment.mockReturnValue(environment)
})

describe("atomic model and release lighting staging", () => {
  it("stages a specimen against the existing environment and includes both models in peak allocation", async () => {
    const previous = { statistics: { estimatedBytes: 4_359_296, environmentBytes: 2_359_296 }, dispose: vi.fn() } as unknown as FacilityModel
    const next = await stageReplacement(release(true), "rack", previous, environment, new AbortController().signal)
    expect(dependencies.load).toHaveBeenCalledWith(expect.anything(), expect.any(AbortSignal), "rack")
    expect(dependencies.environment).not.toHaveBeenCalled()
    expect(next.statistics).toMatchObject({ estimatedBytes: 4_359_296, peakEstimatedBytes: 6_359_296 })
    expect(previous.dispose).not.toHaveBeenCalled(); expect(environment.dispose).not.toHaveBeenCalled()
  })
  it("a rejected replacement disposes only the candidate, leaving the current scene and shared environment owned", async () => {
    const previous = { statistics: { estimatedBytes: 31 * 1024 * 1024, environmentBytes: 2_359_296 }, dispose: vi.fn() } as unknown as FacilityModel
    await expect(stageReplacement(release(true), "cooling", previous, environment, new AbortController().signal)).rejects.toThrow("replacement_resource_budget")
    expect(model.dispose).toHaveBeenCalledOnce(); expect(previous.dispose).not.toHaveBeenCalled(); expect(environment.dispose).not.toHaveBeenCalled()
  })
  it("does not create environment resources for unchanged v1/v2 profiles", async () => {
    const staged = await stageFacility(release(false), gl, new AbortController().signal)
    expect(dependencies.environment).not.toHaveBeenCalled()
    expect(staged.environment).toBeNull()
    expect(model.statistics.estimatedBytes).toBe(2_000_000)
    staged.dispose(); staged.dispose()
    expect(model.dispose).toHaveBeenCalledOnce()
  })

  it("resolves only after the model and environment are ready, and disposes both once", async () => {
    let finishModel!: (model: FacilityModel) => void
    dependencies.load.mockReturnValue(new Promise<FacilityModel>(resolve => { finishModel = resolve }))
    const presented = vi.fn()
    const promise = stageFacility(release(true), gl, new AbortController().signal).then(staged => { presented(); return staged })
    await Promise.resolve()
    expect(presented).not.toHaveBeenCalled()
    expect(dependencies.environment).not.toHaveBeenCalled()
    finishModel(model)
    const staged = await promise
    expect(dependencies.environment).toHaveBeenCalledWith(gl, profile)
    expect(model.statistics).toMatchObject({ estimatedBytes: 4_359_296, peakEstimatedBytes: 5_997_696, environmentBytes: 2_359_296 })
    staged.dispose(); staged.dispose()
    expect(environment.dispose).toHaveBeenCalledOnce()
    expect(model.dispose).toHaveBeenCalledOnce()
  })

  it("disposes the loaded model without staging when environment generation fails", async () => {
    dependencies.environment.mockImplementation(() => { throw new Error("environment failed") })
    await expect(stageFacility(release(true), gl, new AbortController().signal)).rejects.toThrow("environment failed")
    expect(model.dispose).toHaveBeenCalledOnce()
  })

  it("disposes both resources when cancellation or the combined allocation gate rejects staging", async () => {
    const controller = new AbortController()
    dependencies.environment.mockImplementation(() => { controller.abort(); return environment })
    await expect(stageFacility(release(true), gl, controller.signal)).rejects.toMatchObject({ name: "AbortError" })
    expect(environment.dispose).toHaveBeenCalledOnce()
    expect(model.dispose).toHaveBeenCalledOnce()
    dependencies.environment.mockReturnValue(environment)
    model.statistics.estimatedBytes = 31 * 1024 * 1024
    await expect(stageFacility(release(true), gl, new AbortController().signal)).rejects.toThrow("model_resource_budget")
  })
})
