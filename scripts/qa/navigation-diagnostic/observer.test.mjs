import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import test from "node:test"
import { installProtocolObserver, preserveLighthouseArtifacts, COVERAGE_LIMITS } from "./observer.mjs"

const origin = "http://localhost:3000"
function setup(options = {}) {
  const calls = []
  class Session extends EventEmitter {
    constructor(id = "root") { super(); this.sessionId = id }
    id() { return this.sessionId }
    sendCommand(method, ...params) {
      const promise = this.reply ?? Promise.resolve({})
      calls.push({ receiver: this, method, params, promise })
      if (this.throwError) throw this.throwError
      return promise
    }
  }
  let time = 0
  const original = Session.prototype.sendCommand
  return { Session, original, calls, observer: installProtocolObserver(Session, { origin, now: () => ++time, wall: () => "2026-10-14T00:00:00.000Z", ...options }) }
}
const settle = () => Promise.resolve()

test("exact original promise, receiver and parameter identity; no added commands; deferred chunk sizing", async () => {
  const { Session, calls, observer, original } = setup(), session = new Session()
  const params = { categories: "unchanged", options: "sampling-frequency=10000" }
  const start = session.sendCommand("Tracing.start", params)
  assert.equal(start, calls[0].promise); assert.equal(calls[0].receiver, session); assert.equal(calls[0].params[0], params)
  await start
  const navigation = { url: `${origin}/assessment` }
  await session.sendCommand("Page.navigate", navigation)
  let serializations = 0
  const early = [{ name: "navigationStart", ts: 123, toJSON() { serializations++; return { name: this.name, ts: this.ts } } }]
  session.emit("Tracing.dataCollected", { value: early })
  assert.equal(serializations, 0)
  await session.sendCommand("Tracing.end")
  session.emit("Tracing.dataCollected", { value: [{ name: "end", ts: 234 }] })
  session.emit("Tracing.tracingComplete", { dataLossOccurred: false, stream: "stream-id", traceFormat: "json", nested: { ignored: true } })
  assert.equal(serializations, 0)
  assert.equal(session.listenerCount("Tracing.dataCollected"), 1)
  const report = observer.finish()
  assert.equal(Session.prototype.sendCommand, original)
  assert.equal(session.listenerCount("Tracing.dataCollected"), 0)
  assert.equal(serializations, 1)
  assert.deepEqual(calls.map(call => call.method), ["Tracing.start", "Page.navigate", "Tracing.end"])
  assert.equal(calls[1].params[0], navigation)
  assert.deepEqual(report.observerEvidence, { complete: true, reasons: [], lossClassification: "explicit-no-loss", reportedLossObserved: false })
  assert.equal(report.sessions[0].beforeTracingEndChunks, 1); assert.equal(report.sessions[0].afterTracingEndChunks, 1)
  assert.equal(report.earlyChunks[0].value, early)
  assert.equal(report.earlyChunks.length, 1)
  assert.deepEqual(report.records.find(record => record.method === "Tracing.tracingComplete").payload, { dataLossOccurred: false, stream: "stream-id", traceFormat: "json" })
})

test("trace start issue is distinct from ACK and CDP timestamp from observer clock", async () => {
  const { Session, observer } = setup(), session = new Session()
  let resolve
  session.reply = new Promise(accept => { resolve = accept })
  const originalPromise = session.sendCommand("Tracing.start", {})
  session.emit("Tracing.dataCollected", { value: [] })
  session.emit("Page.lifecycleEvent", { name: "init", timestamp: 9999, frameId: "frame", loaderId: "loader" })
  resolve({}); await originalPromise
  session.reply = Promise.resolve({})
  await session.sendCommand("Tracing.end")
  session.emit("Tracing.tracingComplete", { dataLossOccurred: false })
  const report = observer.finish()
  const chunk = report.records.find(record => record.kind === "trace-chunk")
  const ack = report.records.find(record => record.kind === "command-ack" && record.method === "Tracing.start")
  assert.equal(chunk.traceStartIssued, true); assert(chunk.sequence < ack.sequence)
  const lifecycle = report.records.find(record => record.method === "Page.lifecycleEvent")
  assert.equal(lifecycle.payload.timestamp, 9999); assert.notEqual(lifecycle.monotonicMs, 9999)
})

test("original rejection and synchronous throw propagate unchanged", async () => {
  const { Session, calls, observer } = setup(), session = new Session(), rejected = new Error("original failure")
  session.reply = Promise.reject(rejected)
  const result = session.sendCommand("Tracing.start", {})
  assert.equal(result, calls[0].promise)
  await assert.rejects(result, error => error === rejected)
  session.throwError = rejected
  assert.throws(() => session.sendCommand("Page.navigate", {}), error => error === rejected)
  const report = observer.finish()
  assert(report.records.some(record => record.kind === "command-rejected"))
  assert(report.records.some(record => record.kind === "command-threw"))
  assert.equal(report.observerEvidence.complete, false)
})

test("callback errors cannot change the original command return or reject a derived promise", async () => {
  const { Session, calls, observer } = setup({ now: () => { throw new Error("observer-only") } }), session = new Session()
  const result = session.sendCommand("Tracing.start", {})
  assert.equal(result, calls[0].promise); await result
  const report = observer.finish()
  assert(report.callbackErrors > 0); assert.equal(report.observerEvidence.complete, false)
})

test("absence, malformed and true/false loss flags remain distinct", async () => {
  for (const [completion, expected] of [[{}, "unknown"], [{ dataLossOccurred: "false" }, "unknown"], [{ dataLossOccurred: true }, "reported-loss"], [{ dataLossOccurred: false }, "explicit-no-loss"]]) {
    const { Session, observer } = setup(), session = new Session()
    await session.sendCommand("Tracing.start", {}); await session.sendCommand("Tracing.end")
    session.emit("Tracing.tracingComplete", completion)
    const report = observer.finish()
    assert.equal(report.observerEvidence.lossClassification, expected)
    assert.equal(report.sessions[0].completions[0].dataLossOccurredPresent, Object.hasOwn(completion, "dataLossOccurred"))
  }
})

test("unknown count, serialization failure, missing completion and dropped data fail completeness", async () => {
  const { Session, observer } = setup({ maxEvents: 3, maxChunks: 2 }), session = new Session()
  await session.sendCommand("Tracing.start", {})
  session.emit("Tracing.dataCollected", { value: undefined })
  const cyclic = {}; cyclic.self = cyclic
  session.emit("Tracing.dataCollected", { value: [cyclic] })
  session.emit("Tracing.dataCollected", { value: [] })
  const report = observer.finish()
  assert.equal(report.sessions[0].unknownEventCountChunks, 1)
  assert.equal(report.sessions[0].unknownByteSizeChunks, 2)
  assert.equal(report.sessions[0].knownSerializedValueBytes, 0)
  assert(report.droppedEvents > 0); assert.equal(report.droppedChunks, 1)
  assert.equal(report.observerEvidence.complete, false); assert.equal(report.observerEvidence.lossClassification, "unknown")
})

test("unsettled commands remain incomplete; listeners attach once per session and target identity is allowlisted", async () => {
  const { Session, observer } = setup(), session = new Session("target-session")
  session.reply = Promise.resolve({ targetInfo: { targetId: "target", type: "page", url: `${origin}/demo?private=omitted`, title: "omitted" } })
  await session.sendCommand("Target.getTargetInfo")
  await session.sendCommand("Target.setAutoAttach", { autoAttach: true, flatten: true, waitForDebuggerOnStart: true })
  let finish
  session.reply = new Promise(resolve => { finish = resolve })
  const result = session.sendCommand("Tracing.start", {})
  assert.equal(session.listenerCount("Tracing.tracingComplete"), 1)
  observer.stop(); finish({}); await result; await settle()
  const report = observer.finish()
  assert.equal(report.unsettledCommandIds.length, 1)
  assert.equal(report.observerEvidence.complete, false)
  assert.deepEqual(report.records.find(record => record.kind === "command-ack" && record.method === "Target.getTargetInfo").payload, { targetInfo: { targetId: "target", type: "page", url: `${origin}/demo` } })
  assert(COVERAGE_LIMITS.some(limit => limit.includes("_rootCdpSession.send")))
})

test("positive reported loss survives dropped records and corrupt chunks without claiming causation", async () => {
  const { Session, observer } = setup({ maxEvents: 1 }), session = new Session()
  await session.sendCommand("Tracing.start", {})
  session.emit("Tracing.dataCollected", { value: undefined })
  await session.sendCommand("Tracing.end")
  session.emit("Tracing.tracingComplete", { dataLossOccurred: true })
  const report = observer.finish()
  assert.equal(report.observerEvidence.complete, false)
  assert.equal(report.observerEvidence.reportedLossObserved, true)
  assert.equal(report.observerEvidence.lossClassification, "reported-loss")
})

test("raw artifact write failures are independent and preserve original available objects", async () => {
  const result = { lhr: { runtimeError: { code: "NO_NAVSTART" } }, artifacts: { Trace: { traceEvents: [] }, DevtoolsLog: [{ method: "Page.frameNavigated" }] } }, attempts = []
  const report = await preserveLighthouseArtifacts(result, null, async (name, value) => {
    attempts.push([name, value])
    if (name === "lhr.json") throw new Error("fixture disk failure")
  })
  assert.deepEqual(attempts.map(attempt => attempt[0]), ["lhr.json", "trace.json", "devtoolslog.json"])
  assert.equal(attempts[1][1], result.artifacts.Trace); assert.equal(attempts[2][1], result.artifacts.DevtoolsLog)
  assert.equal(report.complete, false); assert.equal(report.attempts.lhr.saved, false)
  assert.equal(report.attempts.trace.saved, true); assert.equal(report.attempts.devtoolslog.saved, true)
})

test("uncertain prototype ownership throws without overwriting another wrapper", async () => {
  const { Session, observer } = setup(), session = new Session()
  await session.sendCommand("Tracing.start", {})
  const otherWrapper = function () { return Promise.resolve({}) }
  Session.prototype.sendCommand = otherWrapper
  assert.throws(() => observer.stop(), /ownership/)
  assert.equal(Session.prototype.sendCommand, otherWrapper)
  observer.finish()
  assert.throws(() => observer.finish(), /already finished/)
})
