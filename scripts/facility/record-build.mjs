import { writeFile } from "node:fs/promises"
import { currentBuildIdentity, harnessRevision } from "./performance-contract.mjs"
import { createHostedAttestation, hostedAttestationLogLines } from "./hosted-attestation.mjs"

const identity = await currentBuildIdentity()
await writeFile(".next/facility-build.json", `${JSON.stringify({ recordedAt: new Date().toISOString(), identity }, null, 2)}\n`)
console.log(`Facility production build attested: ${identity.buildId}, source ${identity.sourceRevision.slice(0, 12)}`)
if (process.env.FACILITY_HOSTED_ATTESTATION === "1") {
  const attestation = await createHostedAttestation(identity, await harnessRevision())
  await writeFile(".next/hosted-build-attestation.json", `${JSON.stringify(attestation, null, 2)}\n`)
  for (const line of hostedAttestationLogLines(attestation)) console.log(line)
}
