// @vitest-environment node
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { readLaunchLogs, sanitizeLaunchText, serializeLaunchError } from "../../../scripts/facility/qualification-launch-diagnostics.mjs"

const directories: string[] = []
async function freshProfile() {
  const profile = await mkdtemp(join(tmpdir(), "qualification-diagnostics-test-"))
  directories.push(profile)
  return profile
}
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const context = { env: { VERCEL_AUTOMATION_BYPASS_SECRET: "known-preauth-secret", TOKEN: "token/value" },
  paths: { binary: "/private/browser/chrome", profile: "/private/fresh-profile", workspace: "/work/project", home: "/Users/person" } }

describe("bounded launch error diagnostics", () => {
  it("retains the original cause, stack and whitelisted OS fields", () => {
    const cause = Object.assign(new Error("dynamic debugging port unavailable"), { code: "ENOENT", errno: -2, syscall: "open", unrelated: "do not serialize" })
    const error = new Error("Chrome launch rejected", { cause })
    const serialized = serializeLaunchError(error, { env: {} })
    expect(serialized.message).toBe("Chrome launch rejected")
    expect(serialized.cause).toMatchObject({ name: "Error", message: cause.message, code: "ENOENT", errno: -2, syscall: "open" })
    expect(serialized.cause!.stack).toContain("dynamic debugging port unavailable")
    expect(JSON.stringify(serialized)).not.toContain("do not serialize")
    expect(error.cause).toBe(cause)
  })
  it("redacts preauthentication secrets, headers, URLs and paths without dumping the environment", () => {
    const text = ["known-preauth-secret token/value token%2Fvalue", "Authorization: Bearer unknown-header-secret", "Cookie: unknown-cookie-secret",
      "https://name:password@example.test/path?api_key=unknown-query-secret#unknown-fragment", "ws://localhost:9222/devtools/browser/private-id",
      "api_token=unknown-assignment-secret", "/private/browser/chrome /private/fresh-profile /work/project/script.mjs /Users/person/config"].join("\n")
    const error = new Error(text, { cause: new Error(text) })
    const output = JSON.stringify(serializeLaunchError(error, context))
    for (const secret of ["known-preauth-secret", "token/value", "token%2Fvalue", "unknown-header-secret", "unknown-cookie-secret", "name:password", "unknown-query-secret", "unknown-fragment", "private-id", "unknown-assignment-secret", "/private/", "/work/project", "/Users/person"]) expect(output).not.toContain(secret)
    expect(output).not.toContain("VERCEL_AUTOMATION_BYPASS_SECRET")
    expect(output).toContain("<fresh-profile>")
    expect(output).toContain("[REDACTED]")
  })
  it("handles cycles, aggregate limits, depth and a fixed total node budget", () => {
    const cyclic = new Error("cycle")
    Object.defineProperty(cyclic, "cause", { value: cyclic })
    expect(serializeLaunchError(cyclic, { env: {} }).cause).toEqual({ truncated: "cycle" })
    let deep: Error = new Error("leaf")
    for (let index = 0; index < 8; index++) deep = new Error(`depth${index}`, { cause: deep })
    expect(JSON.stringify(serializeLaunchError(deep, { env: {} }))).toContain("depth-limit")
    const errors = Array.from({ length: 10 }, () => new AggregateError(Array.from({ length: 4 }, () => new Error("x".repeat(20000))), "aggregate"))
    const result = serializeLaunchError(new AggregateError(errors, "root"), { env: {} })
    expect(result.errors).toHaveLength(4)
    expect(result.omittedErrors).toBe(6)
    const text = JSON.stringify(result)
    expect(text).toContain("node-limit")
    expect(Buffer.byteLength(text)).toBeLessThan(65536)
  })
  it("bounds UTF-8 message/stack fields after redaction without broken characters", () => {
    const error = new Error("🧪".repeat(5000))
    error.stack = "🧪".repeat(5000)
    const result = serializeLaunchError(error, { env: {} })
    expect(Buffer.byteLength(result.message!)).toBeLessThanOrEqual(2048)
    expect(Buffer.byteLength(result.stack!)).toBeLessThanOrEqual(4096)
    expect(result).toMatchObject({ messageTruncated: true, stackTruncated: true })
    expect(JSON.stringify(result)).not.toContain("�")
  })
  it("never invokes getters or serializes arbitrary objects", () => {
    const object = Object.defineProperty({}, "message", { get: () => { throw new Error("getter must not run") } })
    expect(serializeLaunchError(object, { env: {} })).toEqual({ name: "NonErrorThrown", message: "[non-Error thrown value]" })
    expect(serializeLaunchError("plain throw", { env: {} }).message).toBe("plain throw")
    expect(() => JSON.stringify(serializeLaunchError(BigInt(1), { env: {} }))).not.toThrow()
    const errors = [new Error("first")]
    Object.defineProperty(errors, "0", { get: () => { throw new Error("aggregate getter must not run") } })
    expect(() => serializeLaunchError(new AggregateError([], "aggregate", { cause: object }), { env: {} })).not.toThrow()
    const aggregate = new AggregateError([], "aggregate")
    Object.defineProperty(aggregate, "errors", { value: errors })
    expect(() => serializeLaunchError(aggregate, { env: {} })).not.toThrow()
  })
  it("does not mistake a bound custom stack getter for Node's native getter", () => {
    let invoked = false
    const getter = function () { invoked = true; return "must-not-read-custom-stack" }.bind(null)
    const error = new Error("safe message")
    Object.defineProperty(error, "stack", { get: getter })
    const result = serializeLaunchError(error, { env: {} })
    expect(invoked).toBe(false)
    expect(result.message).toBe("safe message")
    expect(result.stack).toBeUndefined()
  })
  it("redacts bare API/access keys and standalone bearer credentials", () => {
    const output = sanitizeLaunchText('bare-api-value bare-access-value Bearer unregistered-bearer\napi_key=unregistered-api\n{"Cookie":"unregistered-cookie"}\nprivate-key-line', { env: { API_KEY: "bare-api-value", ACCESS_KEY: "bare-access-value", PRIVATE_KEY: "first-private-line\nprivate-key-line\nlast-private-line" } })
    for (const secret of ["bare-api-value", "bare-access-value", "unregistered-bearer", "unregistered-api", "unregistered-cookie", "private-key-line"]) expect(output).not.toContain(secret)
  })
  it("redacts sensitive environment values when the caller does not provide an environment", () => {
    const key = "QUALIFICATION_TEST_SECRET", previous = process.env[key]
    try {
      process.env[key] = "ambient-preauth-value"
      expect(sanitizeLaunchText("ambient-preauth-value")).toBe("[REDACTED]")
    } finally { if (previous === undefined) delete process.env[key]; else process.env[key] = previous }
  })
})

describe("bounded launcher log snapshots", () => {
  it("reads fixed files, redacts content and leaves original logs untouched", async () => {
    const profile = await freshProfile(), original = "Chrome failed: known-preauth-secret\nAuthorization: Bearer private-header\n"
    await writeFile(join(profile, "chrome-err.log"), original)
    await writeFile(join(profile, "unrelated.log"), "unrelated private content")
    const result = await readLaunchLogs(profile, context)
    expect(result.stderr).toMatchObject({ file: "chrome-err.log", status: "read", originalBytes: Buffer.byteLength(original), truncated: false })
    expect(result.stdout.status).toBe("missing")
    expect(JSON.stringify(result)).not.toContain("known-preauth-secret")
    expect(JSON.stringify(result)).not.toContain("private-header")
    expect(JSON.stringify(result)).not.toContain("unrelated private content")
    expect(await readFile(join(profile, "chrome-err.log"), "utf8")).toBe(original)
  })
  it("does not follow a log symlink or read a directory as a log", async () => {
    const profile = await freshProfile(), outside = join(await freshProfile(), "outside.log")
    await writeFile(outside, "must-not-be-read")
    await symlink(outside, join(profile, "chrome-err.log"))
    await mkdir(join(profile, "chrome-out.log"))
    const result = await readLaunchLogs(profile, { env: {} })
    expect(result.stderr.status).toBe("unsafe-file")
    expect(result.stdout.status).toBe("unsafe-file")
    expect(JSON.stringify(result)).not.toContain("must-not-be-read")
  })
  it("limits total input to 16 KiB and keeps useful complete head/tail lines", async () => {
    const profile = await freshProfile(), text = `first useful line\n${"middle line\n".repeat(3000)}last useful line\n`
    for (const file of ["chrome-out.log", "chrome-err.log"]) await writeFile(join(profile, file), text)
    const result = await readLaunchLogs(profile, { env: {} })
    expect(result.stdout.bytesRead! + result.stderr.bytesRead!).toBeLessThanOrEqual(16384)
    for (const log of [result.stdout, result.stderr]) {
      expect(log.originalBytes).toBe(Buffer.byteLength(text))
      expect(log.truncated).toBe(true)
      expect(log.head).toContain("first useful line\n")
      expect(log.tail).toContain("last useful line\n")
      expect(Buffer.byteLength(log.head!) + Buffer.byteLength(log.tail!)).toBeLessThanOrEqual(8192)
    }
  })
  it("omits oversized partial lines instead of exposing partial credential values", async () => {
    const profile = await freshProfile()
    const text = `safe first\nBearer ${"private-token-fragment".repeat(1000)}\nsafe last\n`
    await writeFile(join(profile, "chrome-err.log"), text)
    const result = await readLaunchLogs(profile, { env: {} })
    expect(result.stderr.head).toBe("safe first\n")
    expect(result.stderr.tail).toBe("safe last\n")
    expect(result.stderr.omittedBoundaryBytes).toBeGreaterThan(0)
    expect(JSON.stringify(result)).not.toContain("private-token")
  })
  it("omits a file consisting entirely of one oversized line", async () => {
    const profile = await freshProfile()
    await writeFile(join(profile, "chrome-err.log"), "secret-fragment".repeat(2000))
    const result = await readLaunchLogs(profile, { env: {} })
    expect(result.stderr).toMatchObject({ status: "read", truncated: true, head: "", tail: "" })
    expect(JSON.stringify(result)).not.toContain("secret-fragment")
  })
  it("represents missing logs without leaking the profile path", async () => {
    const profile = await freshProfile()
    const result = await readLaunchLogs(profile, { env: {} })
    expect(result.stdout.status).toBe("missing")
    expect(result.stderr.status).toBe("missing")
    expect(JSON.stringify(result)).not.toContain(profile)
    expect(JSON.stringify(result)).toContain("<fresh-profile>")
  })
  it("retains an I/O failure as redacted evidence", async () => {
    const profile = join(await freshProfile(), "not-a-directory")
    await writeFile(profile, "not a profile")
    const result = await readLaunchLogs(profile, { env: {} })
    expect(result.stderr).toMatchObject({ status: "io-error", error: { code: "ENOTDIR" } })
    expect(JSON.stringify(result)).not.toContain(profile)
  })
})
