import { beforeEach, describe, expect, it, vi } from "vitest"
import { lighthouseArtifactFailure, preserveLighthouseArtifacts } from "../../../scripts/facility/lighthouse-artifacts.mjs"
import { captureValidLighthouseReport } from "../../../scripts/facility/lighthouse-capture.mjs"

const io = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn() }))
vi.mock("node:fs/promises", () => ({ ...io, default: io }))

const paths = { report: "/capture/report/raw.json", trace: "/capture/trace/raw.json", network: "/capture/network/raw.json" }
const valid = () => ({ lhr: { audits: { "largest-contentful-paint": { numericValue: 100 } } }, artifacts: { Trace: { traceEvents: [] }, DevtoolsLog: [] } })
const invalid = () => ({ ...valid(), lhr: { runtimeError: { code: "NO_NAVSTART", message: "Missing navigation" }, audits: {} } })

beforeEach(() => {
  io.mkdir.mockReset().mockResolvedValue(undefined)
  io.writeFile.mockReset().mockResolvedValue(undefined)
})

describe("independent raw Lighthouse evidence preservation", () => {
  it("writes the untouched raw report, trace and network exactly once with exclusive creation", async () => {
    const result = valid()
    const before = JSON.stringify(result)
    const receipt = await preserveLighthouseArtifacts(result, paths)
    expect(receipt.complete).toBe(true)
    expect(lighthouseArtifactFailure(receipt)).toBeNull()
    expect(io.writeFile).toHaveBeenCalledTimes(3)
    for (const [name, path] of Object.entries(paths)) {
      expect(receipt.files[name]).toEqual({ path, status: "written", present: true })
      expect(io.writeFile).toHaveBeenCalledWith(path, expect.any(String), { flag: "wx" })
    }
    expect(JSON.parse(io.writeFile.mock.calls.find(([path]) => path === paths.report)![1])).toEqual(result.lhr)
    expect(JSON.stringify(result)).toBe(before)
  })

  it.each(["report", "trace", "network"] as const)("settles the other writes when the %s write fails", async name => {
    io.writeFile.mockImplementation(async path => { if (path === paths[name]) throw new Error(`${name} disk failure`) })
    const receipt = await preserveLighthouseArtifacts(valid(), paths)
    expect(io.writeFile).toHaveBeenCalledTimes(3)
    expect(receipt.complete).toBe(false)
    expect(receipt.files[name]).toEqual({ path: paths[name], status: "failed", present: true, error: `${name} disk failure` })
    expect(Object.values(receipt.files).filter(file => file.status === "written")).toHaveLength(2)
    expect(lighthouseArtifactFailure(receipt)?.message).toContain(`${name}: ${name} disk failure`)
  })

  it("waits for pending sibling writes before returning failure outcomes", async () => {
    let finishNetwork!: () => void
    const networkPending = new Promise<void>(resolve => { finishNetwork = resolve })
    io.writeFile.mockImplementation(async path => {
      if (path === paths.report) throw new Error("report failed")
      if (path === paths.network) await networkPending
    })
    let returned = false
    const pending = preserveLighthouseArtifacts(valid(), paths).then(receipt => { returned = true; return receipt })
    await vi.waitFor(() => expect(io.writeFile).toHaveBeenCalledTimes(3))
    expect(returned).toBe(false)
    finishNetwork()
    expect((await pending).files.network.status).toBe("written")
  })

  it("isolates directory creation and serialization failures from the other artifacts", async () => {
    const result = valid()
    io.mkdir.mockImplementation(async path => { if (path === "/capture/network") throw "network directory failed" })
    const receipt = await preserveLighthouseArtifacts(result, paths, value => {
      if (value === result.lhr) throw new Error("report serialization failed")
      return JSON.stringify(value)
    })
    expect(receipt.files.report.error).toBe("report serialization failed")
    expect(receipt.files.network.error).toBe("network directory failed")
    expect(receipt.files.trace.status).toBe("written")
    expect(io.writeFile).toHaveBeenCalledTimes(1)
    expect(lighthouseArtifactFailure(receipt)?.message).toContain("report: report serialization failed; network: network directory failed")
  })

  it("records absent raw inputs explicitly without claiming the placeholders are original evidence", async () => {
    const receipt = await preserveLighthouseArtifacts(undefined, paths)
    expect(receipt.complete).toBe(true)
    for (const file of Object.values(receipt.files)) expect(file.present).toBe(false)
    expect(io.writeFile).toHaveBeenCalledWith(paths.report, '{\n  "missingReport": true\n}\n', { flag: "wx" })
    expect(io.writeFile).toHaveBeenCalledWith(paths.trace, "null\n", { flag: "wx" })
  })

  it("rejects serializers returning no JSON while preserving serializable siblings", async () => {
    const result = valid()
    const receipt = await preserveLighthouseArtifacts(result, paths, value => value === result.lhr ? undefined : JSON.stringify(value))
    expect(receipt.files.report.error).toBe("Cannot serialize Lighthouse report")
    expect(receipt.files.trace.status).toBe("written")
    expect(receipt.files.network.status).toBe("written")
  })

  it("does not overwrite earlier evidence on a repeated save", async () => {
    const saved = new Map<string, string>()
    io.writeFile.mockImplementation(async (path, contents, options) => {
      expect(options.flag).toBe("wx")
      if (saved.has(path)) throw new Error("EEXIST")
      saved.set(path, contents)
    })
    expect((await preserveLighthouseArtifacts(invalid(), paths)).complete).toBe(true)
    const original = new Map(saved)
    const second = await preserveLighthouseArtifacts(valid(), paths)
    expect(second.complete).toBe(false)
    expect(saved).toEqual(original)
    expect(Object.values(second.files).every(file => file.error === "EEXIST")).toBe(true)
  })

  it("stops the existing bounded capture policy when preservation fails, without a retry", async () => {
    io.writeFile.mockRejectedValue(new Error("disk full"))
    const capture = vi.fn(async () => {
      const result = invalid()
      const receipt = await preserveLighthouseArtifacts(result, paths)
      const failure = lighthouseArtifactFailure(receipt)
      if (failure) throw failure
      return result
    })
    const preserveInvalid = vi.fn()
    await expect(captureValidLighthouseReport(capture, preserveInvalid)).rejects.toThrow("raw evidence preservation failed")
    expect(capture).toHaveBeenCalledTimes(1)
    expect(preserveInvalid).not.toHaveBeenCalled()
    expect(io.writeFile).toHaveBeenCalledTimes(3)
  })

  it("retains both attempts using distinct raw paths under the unchanged NO_NAVSTART policy", async () => {
    const receipts: Awaited<ReturnType<typeof preserveLighthouseArtifacts>>[] = []
    const capture = vi.fn(async (number: number) => {
      const result = number === 1 ? invalid() : valid()
      receipts.push(await preserveLighthouseArtifacts(result, Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, `${path}-attempt-${number}`])) as typeof paths))
      return result
    })
    const preserveInvalid = vi.fn()
    await expect(captureValidLighthouseReport(capture, preserveInvalid)).resolves.toEqual(valid())
    expect(capture).toHaveBeenCalledTimes(2)
    expect(preserveInvalid).toHaveBeenCalledTimes(1)
    expect(io.writeFile).toHaveBeenCalledTimes(6)
    expect(new Set(io.writeFile.mock.calls.map(([path]) => path)).size).toBe(6)
    expect(receipts.every(receipt => receipt.complete)).toBe(true)
  })

  it("saves a valid raw report before a policy rejection and keeps the original policy error", async () => {
    const policyError = new Error("native LCP required")
    let receipt: Awaited<ReturnType<typeof preserveLighthouseArtifacts>> | undefined
    const capture = vi.fn(async () => {
      const result = valid()
      receipt = await preserveLighthouseArtifacts(result, paths)
      return result
    })
    const preserveInvalid = vi.fn()
    await expect(captureValidLighthouseReport(capture, preserveInvalid, () => {
      expect(receipt?.complete).toBe(true)
      throw policyError
    })).rejects.toBe(policyError)
    expect(preserveInvalid).toHaveBeenCalledWith(expect.anything(), 1, { policyFailure: policyError.message })
    expect(capture).toHaveBeenCalledTimes(1)
    expect(io.writeFile).toHaveBeenCalledTimes(3)
  })
})
