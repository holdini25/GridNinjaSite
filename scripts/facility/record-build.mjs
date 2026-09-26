import { writeFile } from "node:fs/promises"
import { currentBuildIdentity } from "./performance-contract.mjs"
import { traceStagingPreflightArtifacts } from "./trace-staging-preflight.mjs"

const identity = await currentBuildIdentity()
await writeFile(".next/facility-build.json", `${JSON.stringify({ recordedAt: new Date().toISOString(), identity }, null, 2)}\n`)
// The attestation is finalized after Next's initial file tracing. Amend and
// verify this one endpoint's trace now, before the host packages the artifact.
// Hosted support is still proven by the authenticated no-send preflight itself.
await traceStagingPreflightArtifacts()
console.log(`Facility production build attested: ${identity.buildId}, source ${identity.sourceRevision.slice(0, 12)}`)
