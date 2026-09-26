/** Stop a child within a bounded interval, including an unresponsive validator. */
async function stopWorker(worker, terminateGraceMs, killGraceMs) {
  if (worker.exitCode !== null || worker.signalCode !== null) return
  await new Promise((resolve, reject) => {
    let finished = false, escalation, deadline
    const finish = error => {
      if (finished) return
      finished = true
      clearTimeout(escalation); clearTimeout(deadline)
      worker.removeListener("exit", onExit)
      if (error) reject(error)
      else resolve()
    }
    const onExit = () => finish()
    worker.once("exit", onExit)
    escalation = setTimeout(() => {
      try { worker.kill("SIGKILL") } catch { /* The final deadline reports failure. */ }
    }, terminateGraceMs)
    deadline = setTimeout(() => finish(new Error(`Calibration worker ${worker.pid ?? "unknown"} did not exit after SIGKILL`)), terminateGraceMs + killGraceMs)
    try { worker.kill("SIGTERM") } catch { /* Escalation remains scheduled. */ }
  })
}

/**
 * Own all worker lifetimes. The factory is injected for bounded fault tests;
 * production passes a real fork of cpu-calibration.mjs --worker.
 */
export async function runCalibrationWorkers(jobs, count, {
  createWorker,
  deadlineMs = 120_000,
  terminateGraceMs = 2_000,
  killGraceMs = 2_000,
}) {
  if (!Number.isInteger(count) || count < 1 || jobs.length < count) throw new Error("Invalid calibration worker count")
  for (const value of [deadlineMs, terminateGraceMs, killGraceMs]) {
    if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid calibration deadline")
  }
  const workers = [], bindings = [], results = [], peaks = new Array(count).fill(0)
  let next = 0, settled = false, deadline, failure
  try {
    await new Promise((resolve, reject) => {
      const fail = error => {
        if (settled) return
        settled = true; clearTimeout(deadline); reject(error)
      }
      deadline = setTimeout(() => fail(new Error("Calibration deadline")), deadlineMs)
      // Construct inside the protected lifetime: a partial fork failure still
      // tears down every child that was already created.
      try {
        for (let workerIndex = 0; workerIndex < count; workerIndex++) {
          const worker = createWorker(workerIndex)
          workers.push(worker)
          let assignedIndex
          const sendNext = () => {
            if (settled || next >= jobs.length) return
            const job = jobs[next++]
            assignedIndex = job.index
            try { worker.send(job, error => { if (error) fail(error) }) } catch (error) { fail(error) }
          }
          const onExit = code => fail(new Error(`Worker exited early (${code})`))
          const onMessage = result => {
            if (settled) return
            if (result?.failed) return fail(new Error("Asset work failed"))
            if (!result || result.index !== assignedIndex || !Number.isFinite(result.maxRssKiB) || result.maxRssKiB < 0) return fail(new Error("Invalid calibration worker result"))
            assignedIndex = undefined
            results.push(result); peaks[workerIndex] = Math.max(peaks[workerIndex], result.maxRssKiB)
            if (results.length === jobs.length) { settled = true; clearTimeout(deadline); resolve() }
            else sendNext()
          }
          worker.on("error", fail); worker.on("exit", onExit); worker.on("message", onMessage)
          bindings.push({ worker, fail, onExit, onMessage, sendNext })
        }
        for (const binding of bindings) binding.sendNext()
      } catch (error) { fail(error) }
    })
  } catch (error) { failure = error }
  finally {
    settled = true; clearTimeout(deadline)
    const cleanup = await Promise.allSettled(workers.map(worker => stopWorker(worker, terminateGraceMs, killGraceMs)))
    for (const { worker, fail, onExit, onMessage } of bindings) {
      worker.removeListener("message", onMessage); worker.removeListener("exit", onExit)
      if (worker.exitCode !== null || worker.signalCode !== null) worker.removeListener("error", fail)
    }
    const errors = cleanup.filter(result => result.status === "rejected").map(result => result.reason)
    if (errors.length) throw new AggregateError([...(failure ? [failure] : []), ...errors], "Calibration failed to stop all workers")
  }
  if (failure) throw failure
  return { results: results.sort((a, b) => a.index - b.index), peaks }
}
