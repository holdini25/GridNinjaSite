import assert from "node:assert/strict"

export const COVERAGE_LIMITS = Object.freeze([
  "Diagnostic only: observer overhead and retained chunk references can affect timing/memory; these captures never qualify a release.",
  "Observes existing Lighthouse ProtocolSession instances from their first sendCommand; no second CDP connection or trace.",
  "Direct TargetManager._rootCdpSession.send calls, including root Target.setAutoAttach, bypass this wrapper and are NOT observed.",
  "Puppeteer raw-session replacement/events before the first ProtocolSession command are not comprehensively covered; absence does not prove renderer registration.",
  "CDP event timestamps are retained separately from Node observer monotonic timestamps; clocks are not assumed synchronized.",
  "dataCollected payload references are held until after Lighthouse returns, when UTF8 size is computed. No chunk serialization, file I/O or OS sampling occurs during navigation.",
])
const commands = new Set(["Tracing.start", "Tracing.end", "Page.navigate", "Target.getTargetInfo", "Target.setAutoAttach", "Runtime.runIfWaitingForDebugger"])
const events = ["Tracing.dataCollected", "Tracing.tracingComplete", "Page.frameNavigated", "Page.frameStartedNavigating", "Page.frameStartedLoading", "Page.frameStoppedLoading", "Page.frameAttached", "Page.frameDetached", "Page.lifecycleEvent", "Page.domContentEventFired", "Page.loadEventFired", "Target.attachedToTarget", "Target.detachedFromTarget", "Target.targetCreated", "Target.targetInfoChanged", "Target.targetDestroyed", "Target.targetCrashed", "Inspector.targetCrashed", "Inspector.detached"]
const primitive = value => value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)
const pick = (value, names) => Object.fromEntries(names.filter(name => value && Object.hasOwn(value, name) && primitive(value[name])).map(name => [name, value[name]]))
function safeUrl(value, origin) {
  if (value === "about:blank") return value
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    if (url.origin === origin && !url.username && !url.password) return `${url.origin}${url.pathname}`
    return "[non-loopback-or-nonpage-url]"
  } catch { return "[unparsed-url]" }
}
function target(value, origin) {
  return { ...pick(value, ["targetId", "type", "attached", "openerId", "browserContextId", "canAccessOpener"]), ...(typeof value?.url === "string" ? { url: safeUrl(value.url, origin) } : {}) }
}
function projectedEvent(method, value, origin) {
  if (method === "Tracing.tracingComplete") return Object.fromEntries(Object.entries(value ?? {}).filter(([, item]) => primitive(item)))
  if (method === "Page.frameNavigated") return { ...pick(value, ["type"]), frame: { ...pick(value?.frame, ["id", "parentId", "loaderId", "mimeType"]), url: safeUrl(value?.frame?.url, origin) } }
  if (method.startsWith("Target.")) return { ...pick(value, ["sessionId", "targetId", "waitingForDebugger", "status", "errorCode"]), ...(value?.targetInfo ? { targetInfo: target(value.targetInfo, origin) } : {}) }
  return { ...pick(value, ["frameId", "parentFrameId", "loaderId", "name", "timestamp", "reason", "type", "navigationType"]), ...(typeof value?.url === "string" ? { url: safeUrl(value.url, origin) } : {}) }
}
function projectedCommand(method, value, origin) {
  if (method === "Tracing.start") return pick(value, ["categories", "options", "transferMode", "bufferUsageReportingInterval", "streamFormat", "streamCompression"])
  if (method === "Page.navigate") return { ...pick(value, ["frameId", "transitionType"]), url: safeUrl(value?.url, origin) }
  if (method === "Target.setAutoAttach") return pick(value, ["autoAttach", "flatten", "waitForDebuggerOnStart"])
  return {}
}

/** Passive, capture-scoped observer. Never async-wrap sendCommand: its returned
 * promise object, receiver, arguments, fulfillment and rejection stay intact.
 * Call finish only after the measured Lighthouse call has settled. */
export function installProtocolObserver(ProtocolSession, { origin, now = () => Number(process.hrtime.bigint()) / 1e6, wall = () => new Date().toISOString(), maxEvents = 100000, maxChunks = 10000 } = {}) {
  assert(typeof ProtocolSession?.prototype?.sendCommand === "function", "Missing installed Lighthouse ProtocolSession")
  const prototype = ProtocolSession.prototype, original = prototype.sendCommand
  const records = [], sessions = new Map(), pendingSettlements = new Set()
  let sequence = 0, commandId = 0, closed = false, finished = false, unsettledAtStop = [], droppedEvents = 0, droppedChunks = 0, callbackErrors = 0
  const safely = callback => { try { callback() } catch { callbackErrors++ } }
  const append = (state, kind, details = {}) => {
    if (closed) return
    if (records.length >= maxEvents) { droppedEvents++; return }
    records.push({ sequence: ++sequence, monotonicMs: now(), observerWallTime: wall(), session: state.id, kind, ...details })
  }
  function attach(session) {
    let state = sessions.get(session)
    if (state) return state
    state = { id: session.id(), traceGeneration: 0, traceStartIssued: false, endIssued: false, chunkCount: 0, eventCount: 0, unknownEventCountChunks: 0, beforeEndChunks: 0, afterEndChunks: 0, completions: [], chunks: [], listeners: [] }
    sessions.set(session, state)
    append(state, "observer-attached")
    for (const method of events) {
      const listener = value => safely(() => {
        if (closed) return
        if (method === "Tracing.dataCollected") {
          const count = Array.isArray(value?.value) ? value.value.length : null
          state.chunkCount++; state.eventCount += count ?? 0
          if (count === null) state.unknownEventCountChunks++
          if (state.endIssued) state.afterEndChunks++; else state.beforeEndChunks++
          const metadata = { method, traceGeneration: state.traceGeneration, beforeTracingEnd: !state.endIssued, traceStartIssued: state.traceStartIssued, events: count, chunkNumber: state.chunkCount }
          append(state, "trace-chunk", metadata)
          if (state.chunks.length < maxChunks) state.chunks.push({ ...metadata, payload: value?.value })
          else droppedChunks++
        } else {
          if (method === "Tracing.tracingComplete") state.completions.push({ traceGeneration: state.traceGeneration, dataLossOccurredPresent: Object.hasOwn(value ?? {}, "dataLossOccurred"), dataLossOccurred: typeof value?.dataLossOccurred === "boolean" ? value.dataLossOccurred : null, dataLossOccurredType: typeof value?.dataLossOccurred })
          append(state, "event", { method, traceGeneration: state.traceGeneration, payload: projectedEvent(method, value, origin) })
        }
      })
      session.on(method, listener)
      state.listeners.push([method, listener])
    }
    return state
  }
  function wrapped(method, ...params) {
    let state, id
    safely(() => {
      state = attach(this)
      if (!commands.has(method)) return
      id = ++commandId
      if (method === "Tracing.start") { state.traceGeneration++; state.traceStartIssued = true; state.endIssued = false }
      if (method === "Tracing.end") state.endIssued = true
      append(state, "command-issued", { commandId: id, method, traceGeneration: state.traceGeneration, params: projectedCommand(method, params[0], origin) })
      pendingSettlements.add(id)
    })
    let result
    try { result = Reflect.apply(original, this, [method, ...params]) }
    catch (error) {
      safely(() => { if (id) { pendingSettlements.delete(id); append(state, "command-threw", { commandId: id, method, error: pick(error, ["name", "code"]) }) } })
      throw error
    }
    if (id) {
      // Both handlers are nonthrowing. The derived promise always fulfills; the
      // original is returned unchanged, including its rejection to Lighthouse.
      result.then(value => safely(() => {
        pendingSettlements.delete(id)
        const payload = method === "Target.getTargetInfo" ? { targetInfo: target(value?.targetInfo, origin) } : method === "Page.navigate" ? pick(value, ["frameId", "loaderId", "isDownload", "errorText"]) : {}
        append(state, "command-ack", { commandId: id, method, payload })
      }), error => safely(() => {
        pendingSettlements.delete(id)
        append(state, "command-rejected", { commandId: id, method, error: pick(error, ["name", "code"]) })
      }))
    }
    return result
  }
  prototype.sendCommand = wrapped
  function stop() {
    if (closed) return
    closed = true
    unsettledAtStop = [...pendingSettlements]
    assert.equal(prototype.sendCommand, wrapped, "Protocol observer ownership changed")
    prototype.sendCommand = original
    for (const [session, state] of sessions) for (const [method, listener] of state.listeners) session.off(method, listener)
  }
  return {
    stop,
    finish() {
      assert(!finished, "Observer already finished")
      stop(); finished = true
      const summaries = [], earlyChunks = []
      for (const state of sessions.values()) {
        const chunks = state.chunks.map(({ payload, ...metadata }) => {
          if (metadata.beforeTracingEnd) earlyChunks.push({ session: state.id, ...metadata, value: payload })
          let utf8Bytes = null, serializationError = false
          try { if (!Array.isArray(payload)) throw new Error("Invalid chunk"); utf8Bytes = Buffer.byteLength(JSON.stringify(payload)) } catch { serializationError = true }
          return { ...metadata, utf8Bytes, serializationError }
        })
        summaries.push({ session: state.id, traceGenerations: state.traceGeneration, chunks: state.chunkCount, knownTraceEvents: state.eventCount, unknownEventCountChunks: state.unknownEventCountChunks, beforeTracingEndChunks: state.beforeEndChunks, afterTracingEndChunks: state.afterEndChunks, knownSerializedValueBytes: chunks.reduce((sum, chunk) => sum + (chunk.utf8Bytes ?? 0), 0), unknownByteSizeChunks: chunks.filter(chunk => chunk.utf8Bytes === null).length, completions: state.completions, chunkSizes: chunks })
        state.chunks.length = 0
      }
      const reasons = [], traced = summaries.filter(session => session.traceGenerations > 0)
      if (callbackErrors) reasons.push("observer-callback-error")
      if (droppedEvents || droppedChunks) reasons.push("observer-capacity-drop")
      if (unsettledAtStop.length) reasons.push("unsettled-command")
      if (!traced.length) reasons.push("no-observed-tracing-start")
      if (traced.some(session => session.completions.length !== session.traceGenerations)) reasons.push("missing-or-ambiguous-tracing-complete")
      if (summaries.some(session => session.unknownEventCountChunks || session.unknownByteSizeChunks)) reasons.push("unknown-trace-chunk-count-or-size")
      if (records.some(record => /command-(?:rejected|threw)/.test(record.kind) && record.method.startsWith("Tracing."))) reasons.push("tracing-command-error")
      const completions = summaries.flatMap(session => session.completions)
      const reportedLossObserved = completions.some(item => item.dataLossOccurred === true)
      const lossClassification = reportedLossObserved ? "reported-loss" : reasons.length || completions.some(item => !item.dataLossOccurredPresent || typeof item.dataLossOccurred !== "boolean") ? "unknown" : "explicit-no-loss"
      return { schemaVersion: "gridninja-navigation-observer.v1", diagnosticOnly: true, qualification: false, coverageLimits: COVERAGE_LIMITS, observerEvidence: { complete: reasons.length === 0, reasons, lossClassification, reportedLossObserved }, callbackErrors, droppedEvents, droppedChunks, unsettledCommandIds: unsettledAtStop, records, sessions: summaries, earlyChunks }
    },
  }
}

/** Attempt all raw writes independently; a report/observer failure must not
 * prevent retaining available Trace and DevtoolsLog. No error is reclassified
 * as a valid capture. Injected writer is used by the offline unit fixture. */
export async function preserveLighthouseArtifacts(result, error, save) {
  const attempts = {}
  for (const [name, value] of [["lhr", result?.lhr ?? { missingReport: true, error }], ["trace", result?.artifacts?.Trace ?? null], ["devtoolslog", result?.artifacts?.DevtoolsLog ?? null]]) {
    try { await save(`${name}.json`, value); attempts[name] = { saved: true } }
    catch (failure) { attempts[name] = { saved: false, error: { name: failure instanceof Error ? failure.name : "UnknownError", message: failure instanceof Error ? failure.message : String(failure) } } }
  }
  return { complete: Object.values(attempts).every(attempt => attempt.saved), available: { lhr: Boolean(result?.lhr), trace: Boolean(result?.artifacts?.Trace), devtoolsLog: Boolean(result?.artifacts?.DevtoolsLog) }, attempts }
}
