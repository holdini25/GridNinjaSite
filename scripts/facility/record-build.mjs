import { writeFile } from "node:fs/promises"
import { currentBuildIdentity } from "./performance-contract.mjs"

const identity = await currentBuildIdentity()
await writeFile(".next/facility-build.json", `${JSON.stringify({ recordedAt: new Date().toISOString(), identity }, null, 2)}\n`)
console.log(`Facility production build attested: ${identity.buildId}, source ${identity.sourceRevision.slice(0, 12)}`)
