import { spawn } from "node:child_process"
import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir, userInfo } from "node:os"
import { dirname, join } from "node:path"
import { Client } from "pg"

const output = process.env.QA_DATABASE_REPORT ?? "build/qa/isolated-database.json"
const report = { schemaVersion: "gridninja-isolated-database.v1", startedAt: new Date().toISOString(), result: "blocked", externalTraffic: false, database: "new temporary localhost cluster", note: "", exitCode: null }
let cluster, started = false, pgBin
function run(program, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: "inherit", env })
    child.on("error", reject); child.on("exit", (code, signal) => signal ? reject(new Error(`Child terminated: ${signal}`)) : resolve(code))
  })
}
async function available(path) { try { await access(path); return true } catch { return false } }
try {
  const candidates = [process.env.QA_POSTGRES_BIN, "/opt/homebrew/opt/postgresql@17/bin", "/opt/homebrew/opt/postgresql@16/bin", "/Applications/Postgres.app/Contents/Versions/latest/bin", ...(process.env.PATH ?? "").split(":")].filter(Boolean)
  for (const candidate of candidates) if (await available(join(candidate, "initdb")) && await available(join(candidate, "pg_ctl"))) { pgBin = candidate; break }
  if (!pgBin) throw new Error("No local initdb/pg_ctl found. Install a local PostgreSQL runtime or set QA_POSTGRES_BIN; no existing or remote database was contacted.")
  cluster = await mkdtemp(join(tmpdir(), "gridninja-qa-postgres-"))
  const port = await new Promise((resolve, reject) => { const server = createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)) }) })
  const data = join(cluster, "data")
  if (await run(join(pgBin, "initdb"), ["-D", data, "--auth=trust", "--no-locale", "--encoding=UTF8"]) !== 0) throw new Error("Temporary PostgreSQL initialization failed")
  if (await run(join(pgBin, "pg_ctl"), ["-D", data, "-l", join(cluster, "server.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${cluster}`, "-w", "start"]) !== 0) throw new Error("Temporary PostgreSQL start failed")
  started = true
  const databaseUrl = `postgresql://${encodeURIComponent(userInfo().username)}@127.0.0.1:${port}/gridninja_qa_disposable`
  const admin = new Client({ connectionString: databaseUrl.replace("/gridninja_qa_disposable", "/postgres") })
  await admin.connect(); try { await admin.query("create database gridninja_qa_disposable") } finally { await admin.end() }
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(DATABASE_URL|STAGING_|TURNSTILE_|RESEND_|LEAD_|QSTASH_|UPSTASH_)/.test(key)))
  env.TEST_DATABASE_URL = databaseUrl
  report.exitCode = await run(process.execPath, ["scripts/run-required-integration-tests.mjs"], env)
  report.result = report.exitCode === 0 ? "pass" : "fail"
  report.note = "Required schema integration suite ran against a new temporary localhost cluster. It does not establish deployed provider delivery."
} catch (error) {
  report.note = error instanceof Error ? error.message : String(error)
  if (pgBin) report.result = "fail"
} finally {
  if (started) { const code = await run(join(pgBin, "pg_ctl"), ["-D", join(cluster, "data"), "-m", "immediate", "-w", "stop"]); if (code !== 0) { report.result = "fail"; report.note += " Temporary cluster cleanup failed; manual review required." } }
  if (cluster) await rm(cluster, { recursive: true, force: true })
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, `${JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2)}\n`)
  console.log(`${report.result}: ${report.note}`)
  if (report.result !== "pass") process.exitCode = report.result === "blocked" ? 2 : 1
}
