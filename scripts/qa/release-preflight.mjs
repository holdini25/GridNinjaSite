import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { inspectReleaseEnvironment, productionQualificationIssues } from "./release-preflight-contract.mjs"

const args = process.argv.slice(2)
const index = args.indexOf("--out")
const output = index === -1 ? null : args[index + 1]
if (index !== -1 && (!output || output.startsWith("--"))) throw new Error("--out requires a new evidence filename")
const exists = async path => Boolean(await stat(path).catch(() => null))
const configuration = inspectReleaseEnvironment(process.env)
const bytes = await readFile(".next/facility-build.json").catch(() => null)
let attestation = { present: false, settingsVerified: false }
if (bytes) {
  try {
    const data = JSON.parse(bytes)
    // This is a saved-file inventory, not source/settings revalidation. Do not
    // include raw configuration or reinterpret an old attestation as current.
    attestation = { present: true, settingsVerified: false, sha256: createHash("sha256").update(bytes).digest("hex"), productionSettingsIssues: productionQualificationIssues(data.identity?.buildSettings) }
  } catch { attestation = { present: true, settingsVerified: false, issue: "unreadable-attestation" } }
}
const report = {
  schemaVersion: "gridninja-release-prerequisites.v1",
  recordedAt: new Date().toISOString(),
  purpose: "Read-only local capability inventory; not production or staging qualification.",
  process: { node: process.version, platform: process.platform, arch: process.arch },
  environmentFiles: (await readdir(".")).filter(name => /^\.env(?:\.[a-zA-Z0-9_-]+)?$/.test(name)).sort(),
  vercelProjectFilePresent: await exists(".vercel/project.json"),
  ...configuration,
  productionBuildPrerequisiteIssues: productionQualificationIssues(configuration.effectiveBuildConfiguration),
  attestation,
  externalEvidence: {
    status: "not-verified",
    required: ["isolated-staging-origin-and-accounts", "authorized-controlled-recipients", "named-primary-backup-and-independent-reviewer", "actual-https-analytics-and-live-verification-measurements", "observed-minute-scheduler-and-alert-recovery", "all-trigger-worker-hold-and-drain", "recipient-delivery-and-operator-acknowledgement", "restore-retention-and-safe-rollback", "physical-devices-manual-accessibility-and-participant-research"],
  },
  releaseApproved: false,
}
const encoded = `${JSON.stringify(report, null, 2)}\n`
if (output) {
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, encoded, { flag: "wx" })
  console.log(`Recorded redacted prerequisite inventory: ${output}; no release gate passed.`)
} else process.stdout.write(encoded)
