// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { ContactPayloadTimeoutError, readBodyLimited } from "@/lib/contact/request"

describe("bounded request bodies", () => {
  it("enforces a five-second deadline by default and cancels the retained stream", async () => {
    vi.useFakeTimers()
    try {
      const cancel = vi.fn()
      const body = new ReadableStream({ cancel })
      const request = new Request("https://gridninja.test", Object.assign({ method: "POST", body }, { duplex: "half" }))
      const result = readBodyLimited(request).then(() => null, error => error)
      await vi.advanceTimersByTimeAsync(4999)
      expect(cancel).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(2)
      expect(await result).toBeInstanceOf(ContactPayloadTimeoutError)
      expect(cancel).toHaveBeenCalledOnce()
      expect(body.locked).toBe(false)
      expect(vi.getTimerCount()).toBe(0)
    } finally { vi.useRealTimers() }
  })
})
