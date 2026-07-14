import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, readdir } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)))
const publicRoot = join(root, "public")
const releasesRoot = join(publicRoot, "evidence/releases")
const failures = []

async function findManifests(directory) {
  if (!existsSync(directory)) return []
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return findManifests(path)
      return entry.name === "manifest.json" ? [path] : []
    })
  )
  return nested.flat()
}

const manifests = await findManifests(releasesRoot)
if (manifests.length === 0) {
  failures.push("No versioned evidence release manifest exists under public/evidence/releases")
}

for (const manifestPath of manifests) {
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  } catch (error) {
    failures.push(`${relative(root, manifestPath)} is not valid JSON: ${error}`)
    continue
  }

  for (const field of ["releaseId", "version", "releaseStatus", "artifacts"]) {
    if (!(field in manifest)) {
      failures.push(`${relative(root, manifestPath)} is missing ${field}`)
    }
  }
  if (![
    "publication-gated",
    "published",
  ].includes(manifest.releaseStatus)) {
    failures.push(
      `${relative(root, manifestPath)} has unsupported releaseStatus ${String(manifest.releaseStatus)}`
    )
  }
  if (manifest.releaseStatus === "published" && !("publishedAt" in manifest)) {
    failures.push(
      `${relative(root, manifestPath)} must include publishedAt when releaseStatus is published`
    )
  }
  if (manifest.releaseStatus !== "published" && "publishedAt" in manifest) {
    failures.push(
      `${relative(root, manifestPath)} must not include publishedAt before publication`
    )
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    failures.push(`${relative(root, manifestPath)} must list at least one artifact`)
    continue
  }

  for (const artifact of manifest.artifacts) {
    const declaredPath = artifact.path ?? artifact.file ?? artifact.url
    const declaredHash = String(artifact.sha256 ?? artifact.hash ?? "").replace(
      /^sha256[:-]/i,
      ""
    )
    if (!declaredPath || !/^[a-f0-9]{64}$/i.test(declaredHash)) {
      failures.push(
        `${relative(root, manifestPath)} has an artifact without a path and 64-character SHA-256`
      )
      continue
    }

    const artifactPath = String(declaredPath).startsWith("/")
      ? resolve(publicRoot, String(declaredPath).slice(1))
      : resolve(dirname(manifestPath), String(declaredPath))
    if (
      artifactPath !== publicRoot &&
      !artifactPath.startsWith(`${publicRoot}${sep}`)
    ) {
      failures.push(`${declaredPath} escapes the public evidence directory`)
      continue
    }
    if (!existsSync(artifactPath)) {
      failures.push(`${relative(root, manifestPath)} references missing ${declaredPath}`)
      continue
    }

    const actualHash = createHash("sha256")
      .update(await readFile(artifactPath))
      .digest("hex")
    if (actualHash !== declaredHash.toLowerCase()) {
      failures.push(
        `${relative(root, artifactPath)} hash ${actualHash} does not match ${declaredHash}`
      )
    }
  }
}

if (failures.length > 0) {
  console.error("Evidence release validation failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`Evidence release manifests passed (${manifests.length} checked).`)
}
