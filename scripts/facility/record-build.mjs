import { readFile, writeFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { currentBuildIdentity, harnessRevision, sourceSnapshot } from "./performance-contract.mjs"
import { createHostedAttestation, hostedAttestationLogLines, hostedConfigDiagnostics, hostedOutputDiagnostics } from "./hosted-attestation.mjs"

const identity = await currentBuildIdentity()
await writeFile(".next/facility-build.json", `${JSON.stringify({ recordedAt: new Date().toISOString(), identity }, null, 2)}\n`)
console.log(`Facility production build attested: ${identity.buildId}, source ${identity.sourceRevision.slice(0, 12)}`)
if (process.env.FACILITY_HOSTED_ATTESTATION === "1") {
  console.log(`GRIDNINJA_HOSTED_CONFIG_V1 ${JSON.stringify(hostedConfigDiagnostics(await readFile("vercel.json"), process.env.FACILITY_EXPECTED_VERCEL_CONFIG_SHA256))}`)
  const source = await sourceSnapshot()
  assert.equal(source.sourceRevision, identity.sourceRevision, "Source changed while recording hosted build")
  console.log(`GRIDNINJA_HOSTED_SOURCE_V1 ${source.sourceRevision} ${source.files.length}`)
  for (const file of source.files) console.log(`GRIDNINJA_HOSTED_SOURCE_FILE_V1 ${JSON.stringify(file)}`)
  console.log(`GRIDNINJA_HOSTED_OUTPUT_V1 ${JSON.stringify(await hostedOutputDiagnostics())}`)
  const attestation = await createHostedAttestation(identity, await harnessRevision())
  await writeFile(".next/hosted-build-attestation.json", `${JSON.stringify(attestation, null, 2)}\n`)
  for (const line of hostedAttestationLogLines(attestation)) console.log(line)
}
