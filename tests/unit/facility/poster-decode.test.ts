import { describe, expect, it, vi } from "vitest"
import { createPosterDecoder } from "@/lib/facility/poster-decode"

function deferred() {
  let resolve!: () => void, reject!: (reason?: unknown) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function image(source = "https://gridninja.ai/desktop.webp") {
  return { currentSrc: source, src: source, complete: true, naturalWidth: 1360, decode: vi.fn() } as unknown as HTMLImageElement
}

describe("poster decoding belongs to the current element, source and attempt", () => {
  it("ignores a late rejection after a newer decode of the same element succeeded", async () => {
    const old = deferred(), latest = deferred(), poster = image(), state = vi.fn()
    vi.mocked(poster.decode).mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
    const decoder = createPosterDecoder(() => poster, () => poster.src, state)
    decoder.decode(); decoder.decode()
    latest.resolve(); await latest.promise
    expect(decoder.isDecoded()).toBe(true)
    old.reject(new Error("superseded decode")); await Promise.resolve()
    expect(state.mock.calls.map(([value]) => value)).toEqual(["pending", "pending", "decoded"])
    expect(decoder.isDecoded()).toBe(true)
  })

  it("invalidates responsive source changes and ignores either success or failure from the previous source", async () => {
    for (const failOld of [false, true]) {
      const old = deferred(), mobile = deferred(), poster = image(), state = vi.fn()
      let expected = poster.src
      vi.mocked(poster.decode).mockReturnValueOnce(old.promise).mockReturnValueOnce(mobile.promise)
      const decoder = createPosterDecoder(() => poster, () => expected, state)
      decoder.decode()
      expected = "https://gridninja.ai/mobile.webp"
      decoder.invalidate()
      // The media query can change before the browser updates currentSrc.
      decoder.decode()
      expect(poster.decode).toHaveBeenCalledTimes(1)
      Object.defineProperty(poster, "currentSrc", { configurable: true, value: expected })
      decoder.decode()
      mobile.resolve(); await mobile.promise
      if (failOld) old.reject(new Error("old source aborted")); else old.resolve()
      await Promise.resolve()
      expect(state.mock.calls.at(-1)).toEqual(["decoded"])
      expect(state.mock.calls.filter(([value]) => value === "decoded")).toHaveLength(1)
      expect(state.mock.calls.some(([value]) => value === "failed")).toBe(false)
      expect(decoder.isDecoded()).toBe(true)
    }
  })

  it("checks the actual selected source again before allowing automatic activation", async () => {
    const poster = image(), state = vi.fn()
    vi.mocked(poster.decode).mockResolvedValue(undefined)
    const decoder = createPosterDecoder(() => poster, () => poster.src, state)
    decoder.decode(); await Promise.resolve()
    expect(decoder.isDecoded()).toBe(true)
    Object.defineProperty(poster, "currentSrc", { value: "https://gridninja.ai/other.webp" })
    expect(decoder.isDecoded()).toBe(false)
  })

  it("never publishes a completion after unmount, including queued decode requests", async () => {
    for (const failure of [false, true]) {
      const pending = deferred(), poster = image(), state = vi.fn()
      vi.mocked(poster.decode).mockReturnValue(pending.promise)
      const decoder = createPosterDecoder(() => poster, () => poster.src, state)
      decoder.decode(); decoder.dispose(); decoder.decode(); decoder.invalidate()
      if (failure) pending.reject(new Error("after unmount")); else pending.resolve()
      await Promise.resolve()
      expect(state).toHaveBeenCalledTimes(1)
      expect(poster.decode).toHaveBeenCalledTimes(1)
      expect(decoder.isDecoded()).toBe(false)
    }
  })

  it("does not accept the old element even if its replacement uses the same URL", async () => {
    const pending = deferred(), first = image(), state = vi.fn()
    let current = first
    vi.mocked(first.decode).mockReturnValue(pending.promise)
    const decoder = createPosterDecoder(() => current, () => current.src, state)
    decoder.decode()
    current = image()
    pending.resolve(); await pending.promise
    expect(state.mock.calls).toEqual([["pending"]])
    expect(decoder.isDecoded()).toBe(false)
  })
})
