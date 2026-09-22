import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const releaseDirectory = resolve(process.argv[2] ?? ".")

async function readJson(fileName) {
  return JSON.parse(await readFile(resolve(releaseDirectory, fileName), "utf8"))
}

function requireFields(value, fields, context) {
  for (const field of fields) {
    if (!(field in value)) {
      throw new Error(`${context} is missing required field: ${field}`)
    }
  }
}

const manifest = await readJson("manifest.json")
const proofPack = await readJson("proof-pack.example.json")
const proofTest = await readJson("virtual-capacity-proof-test.json")

if (manifest.releaseStatus !== "publication-gated") {
  throw new Error("Publication candidate must remain publication-gated")
}

if (manifest.signature.status !== "unsigned") {
  throw new Error("Unexpected signing state; verify the signing policy and identity")
}

requireFields(
  proofPack,
  [
    "schemaVersion",
    "artifactId",
    "classification",
    "environment",
    "illustrativeNotice",
    "decisionTrace",
    "acceptedHeadroomLedger",
    "loadPassport",
    "provenance",
  ],
  "proof-pack.example.json",
)

if (proofPack.classification !== "public-synthetic" || proofPack.environment !== "synthetic") {
  throw new Error("Proof-pack example must remain public-synthetic")
}

if (!Array.isArray(proofTest.cases) || proofTest.cases.length !== 7) {
  throw new Error("Proof Test candidate must contain exactly seven declared case families")
}

for (const artifact of manifest.artifacts) {
  const bytes = await readFile(resolve(releaseDirectory, artifact.file))
  const digest = createHash("sha256").update(bytes).digest("hex")
  if (digest !== artifact.sha256) {
    throw new Error(`SHA-256 mismatch for ${artifact.file}`)
  }
}

console.log(
  JSON.stringify({
    status: "valid-publication-candidate",
    release: manifest.version,
    artifactsChecked: manifest.artifacts.length,
    signingStatus: manifest.signature.status,
  }),
)
