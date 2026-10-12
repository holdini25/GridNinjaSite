import { writeFile } from "node:fs/promises"
import { currentBuildIdentity } from "./performance-contract.mjs"

const identity = await currentBuildIdentity()
await writeFile(".next/facility-build.json", `${JSON.stringify({ recordedAt: new Date().toISOString(), identity }, null, 2)}\n`)
console.log(`Facility production build attested: ${identity.buildId}, source ${identity.sourceRevision.slice(0, 12)}`)

// Temporary diagnostic branch only. Normal attestation above is unchanged.
if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview") {
  try {
    const { diagnosePreviewSource } = await import("../../.source-diagnostic/source-diagnostic.mjs")
    await diagnosePreviewSource(identity.sourceRevision)
  } catch {
    console.log(JSON.stringify({ sourceInputDiagnostic: "one-off-preview-v1", status: "unavailable", reason: "diagnostic-load-failed" }))
  }
}
