import { readFile, writeFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { parseHostedAttestationLogs, hostedBinding } from "../facility/hosted-attestation.mjs"

const [input, output, ...extra] = process.argv.slice(2)
assert(input && output && !extra.length && input !== output, "Usage: node scripts/qa/hosted-attestation-from-log.mjs PRIVATE_BUILD_LOG NEW_ATTESTATION_JSON")
const attestation = parseHostedAttestationLogs(await readFile(input, "utf8"))
await writeFile(output, `${JSON.stringify(attestation, null, 2)}\n`, { flag: "wx", mode: 0o600 })
console.log(JSON.stringify({ result: "extracted", ...hostedBinding(attestation), buildId: attestation.identity.buildId }))
