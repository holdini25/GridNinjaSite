import { randomUUID } from "node:crypto"
import { mkdir, open, readFile, stat, unlink } from "node:fs/promises"
import { dirname } from "node:path"

/** Shared with the editorial Blender supervisor. Never steal a stale lock:
 * verify the recorded owner/PID and recover it deliberately before retrying. */
export async function acquireComputeLock(owner, { path = "build/qa/compute.lock", task = "browser-performance" } = {}) {
  await mkdir(dirname(path), { recursive: true })
  let handle
  try { handle = await open(path, "wx", 0o600) }
  catch (error) {
    if (error.code === "EEXIST") throw new Error(`Compute slot already held at ${path}; coordinate with its owner before retrying`)
    throw error
  }
  const token = randomUUID()
  const identity = await handle.stat()
  try { await handle.writeFile(`${JSON.stringify({ owner, pid: process.pid, token, task, startedUnix: Date.now() / 1000 })}\n`) }
  catch (error) {
    try {
      const current = await stat(path)
      if (current.ino === identity.ino && current.dev === identity.dev) await unlink(path)
    } finally { await handle.close() }
    throw error
  }
  return async () => {
    try {
      const current = await stat(path)
      const record = JSON.parse(await readFile(path, "utf8"))
      if (current.ino !== identity.ino || current.dev !== identity.dev || record.token !== token) throw new Error("Compute lock ownership changed; preserving the current lock")
      await unlink(path)
    } finally { await handle.close() }
  }
}
