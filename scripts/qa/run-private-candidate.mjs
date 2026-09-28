import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { privateCandidateEnvironment, verifyPrivateCandidate } from "./private-candidate-contract.mjs"

export async function runPrivateCandidate({ root, action, port = 3005, env = process.env }) {
  assert(["build", "serve"].includes(action), "Private candidate action must be build or serve")
  assert(Number.isInteger(port) && port >= 1024 && port <= 65535, "Invalid private loopback port")
  const marker = await verifyPrivateCandidate(resolve(root))
  const environment = privateCandidateEnvironment(marker, env, action)
  const args = action === "build"
    ? [join(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"), "run", "build", "--", "--webpack"]
    : [join(marker.candidateRoot, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)]
  console.log(`Private candidate ${action}: ${marker.facility.release} + ${marker.cinematic.release}; release approval: false${action === "serve" ? `; http://127.0.0.1:${port}` : ""}`)
  const child = spawn(process.execPath, args, { cwd: marker.candidateRoot, env: environment, stdio: "inherit" })
  const forward = signal => child.kill(signal)
  const interrupt = () => forward("SIGINT"), terminate = () => forward("SIGTERM")
  process.on("SIGINT", interrupt); process.on("SIGTERM", terminate)
  try {
    return await new Promise((accept, reject) => {
      child.on("error", reject)
      child.on("exit", (code, signal) => code === 0 || signal === "SIGINT" || signal === "SIGTERM" ? accept(0) : reject(new Error(`Private candidate ${action} failed: ${code ?? signal}`)))
    })
  } finally { process.off("SIGINT", interrupt); process.off("SIGTERM", terminate) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, root, port, ...extra] = process.argv.slice(2)
  assert(root && !extra.length, "Usage: run-private-candidate.mjs build|serve /candidate [port]")
  await runPrivateCandidate({ root, action, port: port === undefined ? 3005 : Number(port) })
}
