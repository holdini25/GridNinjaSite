// @vitest-environment node
import { EventEmitter } from "node:events"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runCalibrationWorkers } from "../../../scripts/qa/cpu-calibration-workers.mjs"

type Job = { index: number; path: string }
class Worker extends EventEmitter {
  pid = 123
  exitCode: number | null = null
  signalCode: string | null = null
  sent: Job[] = []
  signals: string[] = []
  constructor(private stopsOn: "SIGTERM" | "SIGKILL" | "never" = "SIGTERM") { super() }
  send(job: Job, callback: (error?: Error) => void) { this.sent.push(job); callback() }
  kill(signal: string) {
    this.signals.push(signal)
    if (signal === this.stopsOn) { this.signalCode = signal; this.emit("exit", null, signal) }
    return true
  }
  complete(index: number) { this.emit("message", { index, maxRssKiB: 5, digest: `digest-${index}`, bytes: 10 }) }
}
const jobs = Array.from({ length: 4 }, (_, index) => ({ index, path: `asset-${index}` }))
const limits = { deadlineMs: 30, terminateGraceMs: 10, killGraceMs: 10 }
beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers() })

describe("bounded CPU calibration worker ownership", () => {
  it("cleans up already-created workers when a later fork throws", async () => {
    const worker = new Worker(), createWorker = vi.fn().mockReturnValueOnce(worker).mockImplementationOnce(() => { throw new Error("fork failed") })
    await expect(runCalibrationWorkers(jobs, 2, { ...limits, createWorker })).rejects.toThrow("fork failed")
    expect(worker.signals).toEqual(["SIGTERM"])
    expect(worker.sent).toEqual([])
    expect(worker.listenerCount("message")).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
  it("escalates an unresponsive worker after deadline and leaves no child or callback", async () => {
    const worker = new Worker("SIGKILL")
    const outcome = runCalibrationWorkers(jobs, 1, { ...limits, createWorker: () => worker }).catch(error => error)
    await vi.advanceTimersByTimeAsync(40)
    expect(await outcome).toEqual(new Error("Calibration deadline"))
    expect(worker.signals).toEqual(["SIGTERM", "SIGKILL"])
    expect(worker.signalCode).toBe("SIGKILL")
    expect(worker.listenerCount("message")).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
  it("bounds teardown even when killing a child never produces an exit event", async () => {
    const worker = new Worker("never")
    const outcome = runCalibrationWorkers(jobs, 1, { ...limits, createWorker: () => worker }).catch(error => error)
    await vi.advanceTimersByTimeAsync(50)
    const error = await outcome
    expect(error).toBeInstanceOf(AggregateError)
    expect(error.errors.map((value: Error) => value.message)).toEqual(["Calibration deadline", "Calibration worker 123 did not exit after SIGKILL"])
    expect(worker.signals).toEqual(["SIGTERM", "SIGKILL"])
    expect(vi.getTimerCount()).toBe(0)
  })
  it("stops assigning jobs after failure despite another worker completing late", async () => {
    const workers = [new Worker("SIGKILL"), new Worker("SIGKILL")]
    const outcome = runCalibrationWorkers(jobs, 2, { ...limits, createWorker: (index: number) => workers[index] }).catch(error => error)
    workers[0].emit("message", { failed: true, index: 0 })
    workers[1].complete(1)
    await vi.advanceTimersByTimeAsync(10)
    expect(await outcome).toEqual(new Error("Asset work failed"))
    expect(workers.flatMap(worker => worker.sent).map(job => job.index)).toEqual([0, 1])
    expect(workers.every(worker => worker.signalCode === "SIGKILL")).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
  it("rejects a closed IPC channel and a mismatched result without leaking a worker", async () => {
    const worker = new Worker()
    worker.send = (_job, callback) => callback(new Error("IPC channel closed"))
    await expect(runCalibrationWorkers(jobs, 1, { ...limits, createWorker: () => worker })).rejects.toThrow("IPC channel closed")
    const other = new Worker()
    const outcome = runCalibrationWorkers(jobs, 1, { ...limits, createWorker: () => other }).catch(error => error)
    other.complete(99)
    expect(await outcome).toEqual(new Error("Invalid calibration worker result"))
    expect(worker.signalCode).toBe("SIGTERM")
    expect(other.signalCode).toBe("SIGTERM")
    expect(vi.getTimerCount()).toBe(0)
  })
  it("returns ordered successful results and tears down every idle child", async () => {
    const workers = [new Worker(), new Worker()]
    const outcome = runCalibrationWorkers(jobs, 2, { ...limits, createWorker: (index: number) => workers[index] })
    workers[1].complete(1); workers[0].complete(0); workers[0].complete(3); workers[1].complete(2)
    expect(await outcome).toMatchObject({ peaks: [5, 5], results: jobs.map(({ index }) => ({ index, digest: `digest-${index}` })) })
    expect(workers.every(worker => worker.signalCode === "SIGTERM")).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
