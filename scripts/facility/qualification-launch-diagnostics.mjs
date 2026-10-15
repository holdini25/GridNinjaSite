import { constants } from "node:fs"
import { lstat, open } from "node:fs/promises"
import { join } from "node:path"
import { isNativeError } from "node:util/types"

const ERROR_DEPTH = 3, ERROR_NODES = 8, AGGREGATE_ENTRIES = 4
const MESSAGE_BYTES = 2048, STACK_BYTES = 4096, LOG_BYTES = 8192
const nativeStackGetter = Object.getOwnPropertyDescriptor(new Error(), "stack")?.get
const secretName = /token|secret|password|passwd|credential|(?:private|api|access)[_-]?key|authorization|cookie/i

/** @typedef {{env?: Record<string, string|undefined>, paths?: {binary?: string, profile?: string, workspace?: string, home?: string}}} DiagnosticContext */
/** @typedef {{name?: string, message?: string, messageTruncated?: boolean, stack?: string, stackTruncated?: boolean, code?: string|number, errno?: string|number, syscall?: string|number, cause?: SerializedLaunchError, errors?: SerializedLaunchError[], omittedErrors?: number, truncated?: string}} SerializedLaunchError */

/** Sanitize before truncating. Never serialize an environment or arbitrary error properties.
 * @param {string} text @param {DiagnosticContext} context
 */
export function sanitizeLaunchText(text, context = {}) {
  let result = String(text).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
  const secrets = Object.entries(context.env ?? process.env)
    .filter(([key, value]) => secretName.test(key) && typeof value === "string" && value.length > 0)
    .flatMap(([, value]) => {
      let encoded = value
      try { encoded = encodeURIComponent(value) } catch { /* Keep a malformed string redacted literally. */ }
      return [value, encoded, ...value.split(/\r?\n/).filter(line => line.length >= 6)]
    })
    .sort((a, b) => b.length - a.length)
  for (const secret of new Set(secrets)) result = result.replaceAll(secret, "[REDACTED]")
  result = result.replace(/\b(?:authorization|proxy-authorization|cookie|set-cookie|x-vercel-protection-bypass)["']?\s*[:=]\s*[^\r\n]*/gi, "[REDACTED HEADER]")
    .replace(/\bBearer\s+[^\s,;"']+/gi, "Bearer [REDACTED]")
    .replace(/\b([\w-]*(?:token|secret|password|passwd|credential|(?:private|api|access)[_-]?key)[\w-]*["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, "$1[REDACTED]")
    .replace(/\b(?:https?|wss?):\/\/[^\s<>"']+/gi, match => {
      try {
        const url = new URL(match)
        const authority = `${url.username || url.password ? "[REDACTED]@" : ""}${url.host}`
        const path = url.pathname.replace(/(\/devtools\/browser\/)[^/]+/i, "$1[REDACTED]")
        return `${url.protocol}//${authority}${path}${url.search ? "?[REDACTED]" : ""}${url.hash ? "#[REDACTED]" : ""}`
      } catch { return "[REDACTED URL]" }
    })
  const names = { binary: "<pinned-chrome>", profile: "<fresh-profile>", workspace: "<workspace>", home: "<home>" }
  const paths = Object.entries(context.paths ?? {}).filter(([, path]) => typeof path === "string" && path.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
  for (const [key, path] of paths) result = result.replaceAll(path, names[key] ?? "<path>")
  return result
}

export function boundedLaunchText(text, bytes, context) {
  const sanitized = sanitizeLaunchText(text, context)
  if (Buffer.byteLength(sanitized) <= bytes) return { value: sanitized, truncated: false }
  const suffix = "…[truncated]", limit = bytes - Buffer.byteLength(suffix)
  let value = "", length = 0
  for (const character of sanitized) {
    const size = Buffer.byteLength(character)
    if (length + size > limit) break
    value += character; length += size
  }
  return { value: value + suffix, truncated: true }
}

// Node 22 exposes Error.stack through its native lazy accessor. Permit that
// accessor only; never invoke a custom error/object getter.
function property(value, key) {
  try {
    for (let target = value, level = 0; target && level < 4; target = Object.getPrototypeOf(target), level++) {
      const descriptor = Object.getOwnPropertyDescriptor(target, key)
      if (descriptor) {
        if ("value" in descriptor) return descriptor.value
        if (key === "stack" && isNativeError(value) && nativeStackGetter && descriptor.get === nativeStackGetter) return descriptor.get.call(value)
        return undefined
      }
    }
  } catch { /* An opaque thrown object is represented without inspecting it. */ }
  return undefined
}

/** Bounded cause/aggregate serialization; it never mutates the original error.
 * @param {unknown} error @param {DiagnosticContext} context @returns {SerializedLaunchError}
 */
export function serializeLaunchError(error, context = {}) {
  const seen = new Set()
  let nodes = 0
  /** @returns {SerializedLaunchError} */
  function visit(value, depth) {
    if (depth > ERROR_DEPTH) return { truncated: "depth-limit" }
    if (nodes++ >= ERROR_NODES) return { truncated: "node-limit" }
    if (value && typeof value === "object") {
      if (seen.has(value)) return { truncated: "cycle" }
      seen.add(value)
    }
    const scalar = typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value == null
    const name = property(value, "name"), message = property(value, "message"), stack = property(value, "stack")
    /** @type {SerializedLaunchError} */
    const result = { name: boundedLaunchText(typeof name === "string" ? name : "NonErrorThrown", 128, context).value }
    const detail = boundedLaunchText(typeof message === "string" ? message : scalar ? String(value) : "[non-Error thrown value]", MESSAGE_BYTES, context)
    result.message = detail.value
    if (detail.truncated) result.messageTruncated = true
    if (typeof stack === "string") {
      const trace = boundedLaunchText(stack, STACK_BYTES, context)
      result.stack = trace.value
      if (trace.truncated) result.stackTruncated = true
    }
    for (const key of ["code", "errno", "syscall"]) {
      const field = property(value, key)
      if (typeof field === "string") result[key] = boundedLaunchText(field, 128, context).value
      else if (typeof field === "number" && Number.isFinite(field)) result[key] = field
    }
    const cause = property(value, "cause"), errors = property(value, "errors")
    if (cause !== undefined) result.cause = visit(cause, depth + 1)
    if (Array.isArray(errors)) {
      result.errors = Array.from({ length: Math.min(errors.length, AGGREGATE_ENTRIES) }, (_, index) => visit(property(errors, String(index)), depth + 1))
      if (errors.length > AGGREGATE_ENTRIES) result.omittedErrors = errors.length - AGGREGATE_ENTRIES
    }
    return result
  }
  return visit(error, 0)
}

function completeLines(bytes, cutStart, cutEnd) {
  let start = 0, end = bytes.length
  if (cutStart) {
    const boundary = bytes.indexOf(10)
    start = boundary < 0 ? end : boundary + 1
  }
  if (cutEnd) {
    const boundary = bytes.lastIndexOf(10)
    end = boundary < start ? start : boundary + 1
  }
  return { text: bytes.subarray(start, end).toString("utf8"), omittedBytes: start + bytes.length - end }
}

function boundedLines(text, context, limit) {
  const sanitized = sanitizeLaunchText(text, context)
  let value = "", omitted = false
  for (const line of sanitized.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    if (Buffer.byteLength(value) + Buffer.byteLength(line) > limit) { omitted = true; break }
    value += line
  }
  return { value, omitted }
}

async function readLog(profile, file, context) {
  let handle, result
  try {
    const path = join(profile, file), entry = await lstat(path)
    if (entry.isSymbolicLink() || !entry.isFile() || constants.O_NOFOLLOW === undefined) return result = { file, status: "unsafe-file" }
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const info = await handle.stat()
    if (!info.isFile() || info.dev !== entry.dev || info.ino !== entry.ino) return result = { file, status: "unsafe-file" }
    const size = info.size, truncated = size > LOG_BYTES
    const headSize = Math.min(size, truncated ? LOG_BYTES / 2 : LOG_BYTES)
    const head = Buffer.alloc(headSize), headRead = await handle.read(head, 0, headSize, 0)
    const headLines = completeLines(head.subarray(0, headRead.bytesRead), false, truncated || headRead.bytesRead < size)
    const tail = truncated ? Buffer.alloc(LOG_BYTES / 2) : Buffer.alloc(0)
    const tailRead = truncated ? await handle.read(tail, 0, tail.length, Math.max(0, size - tail.length)) : { bytesRead: 0 }
    const tailLines = completeLines(tail.subarray(0, tailRead.bytesRead), truncated, false)
    const headText = boundedLines(headLines.text, context, truncated ? LOG_BYTES / 2 : LOG_BYTES)
    const tailText = boundedLines(tailLines.text, context, LOG_BYTES / 2)
    return result = { file, status: "read", originalBytes: size, bytesRead: headRead.bytesRead + tailRead.bytesRead,
      truncated: truncated || headText.omitted || tailText.omitted || headRead.bytesRead < headSize || tailRead.bytesRead < tail.length,
      omittedBoundaryBytes: headLines.omittedBytes + tailLines.omittedBytes,
      head: headText.value, tail: tailText.value }
  } catch (error) {
    return result = { file, status: property(error, "code") === "ENOENT" ? "missing" : "io-error", error: serializeLaunchError(error, context) }
  } finally {
    if (handle) {
      try { await handle.close() }
      catch (error) { if (result) result.closeError = serializeLaunchError(error, context) }
    }
  }
}

/** Read only the launcher's two known regular files; never launch, signal or remove anything.
 * @param {string} profile @param {DiagnosticContext} context
 */
export async function readLaunchLogs(profile, context = {}) {
  const safeContext = { ...context, paths: { ...context.paths, profile } }
  const [stdout, stderr] = await Promise.all([
    readLog(profile, "chrome-out.log", safeContext), readLog(profile, "chrome-err.log", safeContext),
  ])
  return { stdout, stderr }
}
