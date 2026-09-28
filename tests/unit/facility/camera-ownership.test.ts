import { act } from "react"
import { createRoot, _roots } from "@react-three/fiber"
import { expect, it, vi } from "vitest"
import { OrthographicCamera, Vector3, type WebGLRenderer } from "three"
import { applyCameraFrame, refitCameraFrame } from "@/lib/facility/inspection-camera"
import { waitForRenderViewport } from "@/lib/facility/render-viewport"

it("fits a staged scene against final DOM dimensions before a delayed R3F resize observer", async () => {
  const canvas = document.createElement("canvas")
  const renderer = {
    domElement: canvas, render: vi.fn(), setPixelRatio: vi.fn(), setSize: vi.fn(),
    xr: { enabled: false, isPresenting: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), setAnimationLoop: vi.fn() },
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn(),
  }
  const root = createRoot(canvas)
  await root.configure({ gl: renderer as unknown as WebGLRenderer, orthographic: true, frameloop: "never", size: { width: 356, height: 267, top: 331, left: 17 }, dpr: 1 })
  const store = _roots.get(canvas)!.store
  const container = { getBoundingClientRect: vi.fn(() => ({ width: 356, height: 356 / .85, top: 389, left: 17 }) as DOMRect) }
  try {
    const controller = new AbortController(), presented = vi.fn()
    const pending = waitForRenderViewport(container, () => store.getState().size, store.subscribe, controller.signal).then(size => { presented(); return size })
    await Promise.resolve()
    expect(presented).not.toHaveBeenCalled()
    expect(store.getState().size.height).toBe(267)
    // Only R3F's actual owner changes size. An older queued configure does not
    // allow readiness; the measured destination must arrive before the camera.
    store.getState().setSize(356, 267, 331, 17)
    await Promise.resolve()
    expect(presented).not.toHaveBeenCalled()
    store.getState().setSize(356, 356 / .85, 389, 17)
    const size = await pending
    expect(store.getState().size).toEqual(size)
    expect(renderer.setSize).toHaveBeenLastCalledWith(356, 356 / .85, true)
    const camera = store.getState().camera as OrthographicCamera
    applyCameraFrame(camera, refitCameraFrame({ position: new Vector3(3, 2, 5), target: new Vector3(0, 1, 0), left: -1, right: 1, top: 2, bottom: -2, fitWidth: 2, fitHeight: 4 }, size.width, size.height))
    expect((camera.right - camera.left) / (camera.top - camera.bottom)).toBeCloseTo(.85)
    const calls = renderer.setSize.mock.calls.length
    expect(await waitForRenderViewport(container, () => store.getState().size, store.subscribe, controller.signal)).toBe(store.getState().size)
    expect(renderer.setSize).toHaveBeenCalledTimes(calls)
    // The observer may subsequently deliver the same box: it must not clear the
    // already presented drawing buffer or introduce another camera composition.
    store.getState().setSize(size.width, size.height, size.top, size.left)
    expect(renderer.setSize).toHaveBeenCalledTimes(calls)
  } finally { await act(async () => root.unmount()) }
})

it("rejects an unavailable staging box without subscribing or touching the renderer", async () => {
  const subscribe = vi.fn(), current = { width: 356, height: 267, top: 0, left: 0 }
  for (const width of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await expect(waitForRenderViewport({ getBoundingClientRect: () => ({ ...current, width }) as DOMRect }, () => current, subscribe, new AbortController().signal)).rejects.toThrow("facility_viewport_unavailable")
  }
  expect(subscribe).not.toHaveBeenCalled()
})

it("aborts a pending resize with the asset deadline and detaches its listener", async () => {
  const current = { width: 356, height: 267, top: 0, left: 0 }, unsubscribe = vi.fn()
  const subscribe = vi.fn(() => unsubscribe), controller = new AbortController()
  const pending = waitForRenderViewport({ getBoundingClientRect: () => ({ ...current, height: 356 / .85 }) as DOMRect }, () => current, subscribe, controller.signal)
  controller.abort(new Error("asset deadline"))
  await expect(pending).rejects.toThrow("asset deadline")
  expect(subscribe).toHaveBeenCalledTimes(1)
  expect(unsubscribe).toHaveBeenCalledTimes(1)
})

it("follows rotation during staging, ignores unrelated store updates, and never accepts NaN dimensions", async () => {
  let size = { width: 356, height: 267, top: 0, left: 0 }, notify = () => {}
  const unsubscribe = vi.fn(), presented = vi.fn()
  const container = { getBoundingClientRect: vi.fn(() => ({ width: 356, height: 356 / .85 }) as DOMRect) }
  const pending = waitForRenderViewport(container, () => size, changed => { notify = changed; return unsubscribe }, new AbortController().signal).then(value => { presented(); return value })
  notify(); notify()
  expect(container.getBoundingClientRect).toHaveBeenCalledTimes(1)
  size = { ...size, width: Number.NaN }; notify(); notify()
  await Promise.resolve()
  expect(presented).not.toHaveBeenCalled()
  expect(container.getBoundingClientRect).toHaveBeenCalledTimes(1)
  container.getBoundingClientRect.mockReturnValue({ width: 844, height: 390 } as DOMRect)
  size = { ...size, width: 844, height: 390 }; notify()
  expect(await pending).toEqual(size)
  expect(container.getBoundingClientRect).toHaveBeenCalledTimes(2)
  expect(unsubscribe).toHaveBeenCalledTimes(1)
})

it("preserves authored orthographic framing through R3F DPR promotion and demotion", async () => {
  const canvas = document.createElement("canvas")
  const renderer = {
    domElement: canvas, render: vi.fn(), setPixelRatio: vi.fn(), setSize: vi.fn(),
    xr: { enabled: false, isPresenting: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), setAnimationLoop: vi.fn() },
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn(),
  }
  const root = createRoot(canvas)
  await root.configure({ gl: renderer as unknown as WebGLRenderer, orthographic: true, frameloop: "never", size: { width: 704, height: 414, top: 0, left: 0 }, dpr: 1 })
  const store = _roots.get(canvas)!.store
  const camera = store.getState().camera as OrthographicCamera
  const frame = refitCameraFrame({ position: new Vector3(12, 10, 15), target: new Vector3(0, 1, 0), left: -6, right: 6, top: 4, bottom: -4, fitWidth: 12, fitHeight: 8 }, 704, 414)
  const frustum = () => [camera.left, camera.right, camera.top, camera.bottom]
  try {
    applyCameraFrame(camera, frame)
    const authored = frustum()
    for (const dpr of [1.25, 1.5, 1]) {
      // Exercise the real R3F store subscriber, which also invokes updateCamera.
      store.getState().setDpr(dpr)
      expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(dpr)
      expect(frustum()).toEqual(authored)
    }
    store.getState().setSize(414, 704)
    expect(frustum()).toEqual(authored)
    applyCameraFrame(camera, refitCameraFrame(frame, 414, 704))
    expect((camera.right - camera.left) / (camera.top - camera.bottom)).toBeCloseTo(414 / 704)
    const portrait = frustum()
    store.getState().setDpr(1.25)
    expect(frustum()).toEqual(portrait)
  } finally { await act(async () => root.unmount()) }
})
