import assert from "node:assert/strict"
import { fork } from "node:child_process"
import { createHash } from "node:crypto"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { totalmem, cpus } from "node:os"
import { fileURLToPath } from "node:url"
import { brotliCompressSync, constants } from "node:zlib"
import { runCalibrationWorkers } from "./cpu-calibration-workers.mjs"

// Real frozen asset work: GLB validation, production-equivalent compression and
// identity hashing. No GPU, source mutation, provider call or new dependency.
if (process.argv.includes("--worker")) {
  const { default: validator } = await import("gltf-validator")
  process.on("message", async ({ path, index }) => {
    try {
      const bytes = await readFile(path)
      const report = await validator.validateBytes(new Uint8Array(bytes), { uri: path, maxIssues: 100 })
      assert.equal(report.issues.numErrors, 0)
      const encoded = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      process.send({ index, digest: createHash("sha256").update(encoded).digest("hex"), bytes: encoded.length, maxRssKiB: process.resourceUsage().maxRSS })
    } catch { process.send({ index, failed: true }) }
  })
} else {
  assert(process.argv.includes("--exclusive"), "Reserve the CPU measurement window, then pass --exclusive")
  const paths = ["facility.glb", "rack.glb", "cooling.glb"].map(name => `src/content/facility-releases/facility-v10/${name}`)
  const jobs = Array.from({ length: 12 }, (_, index) => ({ index, path: paths[index % paths.length] }))
  const runs = []
  for (const count of [2, 4, 6]) {
    let lag = 0, last = performance.now()
    const timer = setInterval(() => { const now = performance.now(); lag = Math.max(lag, now - last - 20); last = now }, 20)
    const started = performance.now()
    let batch
    try {
      batch = await runCalibrationWorkers(jobs, count, {
        createWorker: () => fork(fileURLToPath(import.meta.url), ["--worker"], { stdio: ["ignore", "ignore", "inherit", "ipc"] }),
      })
    } finally { clearInterval(timer) }
    runs.push({ workers: count, milliseconds: performance.now() - started, controllerTimerMaximumDelayMs: Math.max(0, lag), sumWorkerPeakRssBytes: batch.peaks.reduce((a, b) => a + b, 0) * 1024, results: batch.results })
  }
  for (const run of runs) assert.deepEqual(run.results.map(value => value.digest), runs[0].results.map(value => value.digest), "Concurrency changed asset outputs")
  const acceptable = runs.filter(run => run.sumWorkerPeakRssBytes < 32 * 1024 ** 3 && run.controllerTimerMaximumDelayMs < 100)
  const fastest = [...acceptable].sort((a, b) => a.milliseconds - b.milliseconds)[0]
  const report = { schemaVersion: "gridninja-cpu-calibration.v1", measuredAt: new Date().toISOString(), node: process.version, cores: cpus().length, memoryBytes: totalmem(), exclusiveWindow: true, workloads: paths, runs, recommendedCpuOnlyWorkers: fastest?.workers ?? 2, mixedGpuCpuWorkersMaximum: Math.min(4, fastest?.workers ?? 2), limitations: "Sum of individual process RSS peaks is an upper bound, not aggregate residency. Timer delay is controller responsiveness, not a human usability or thermal measure. This asset workload does not establish optimal concurrency for all tests." }
  const directory = process.env.QA_CALIBRATION_DIR ?? "build/qa/cpu-calibration"
  await mkdir(directory, { recursive: true }); await writeFile(`${directory}/report.json`, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ recommendedCpuOnlyWorkers: report.recommendedCpuOnlyWorkers, runs: runs.map(({ workers, milliseconds, sumWorkerPeakRssBytes, controllerTimerMaximumDelayMs }) => ({ workers, milliseconds, sumWorkerPeakRssBytes, controllerTimerMaximumDelayMs })) }, null, 2))
}
