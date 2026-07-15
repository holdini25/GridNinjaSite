import { readFile, readdir } from "node:fs/promises"
import { brotliCompressSync } from "node:zlib"
import { resolve } from "node:path"
import { createContext, runInContext } from "node:vm"

const CONTACT_ROUTE = "/contact"
const REVIEW_BYTES = 150 * 1024
const MAX_BYTES = 180 * 1024

async function main() {
  const nextDirectory = resolve(".next")
  const prerender = JSON.parse(
    await readFile(resolve(nextDirectory, "prerender-manifest.json"), "utf8")
  )

  if (!prerender.routes?.[CONTACT_ROUTE]) {
    throw new Error(`${CONTACT_ROUTE} is not present in Next's prerender manifest`)
  }

  const clientManifestPath = await findContactClientManifest(
    resolve(nextDirectory, "server", "app")
  )
  const manifest = await readClientManifest(clientManifestPath)
  const routeManifest = Object.entries(manifest).find(([key]) =>
    key.endsWith("/contact/page")
  )?.[1]

  if (!routeManifest) {
    throw new Error("Contact client-reference manifest is missing its route entry")
  }

  const chunks = [
    ...new Set(
      Object.values(routeManifest.clientModules ?? {})
        .flatMap((module) => module.chunks ?? [])
        .filter((chunk) => chunk.endsWith(".js"))
    ),
  ]

  if (chunks.length === 0) {
    throw new Error("Contact client-reference manifest has no JavaScript chunks")
  }

  let compressedBytes = 0
  for (const chunk of chunks) {
    const path = resolve(nextDirectory, chunk.replace(/^\/_next\//, ""))
    compressedBytes += brotliCompressSync(await readFile(path)).byteLength
  }

  const compressedKiB = compressedBytes / 1024
  if (compressedBytes > MAX_BYTES) {
    throw new Error(
      `Contact first-load JavaScript is ${compressedKiB.toFixed(1)} KiB Brotli; maximum is 180 KiB`
    )
  }
  if (compressedBytes > REVIEW_BYTES) {
    console.warn(
      `Review contact first-load JavaScript: ${compressedKiB.toFixed(1)} KiB Brotli exceeds the 150 KiB warning threshold`
    )
  }

  console.log(
    `Contact build contract passed: prerendered with ${compressedKiB.toFixed(1)} KiB Brotli JavaScript.`
  )
}

async function findContactClientManifest(directory) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      const nested = await findContactClientManifest(path).catch(() => null)
      if (nested) return nested
    } else if (
      entry.isFile() &&
      entry.name === "page_client-reference-manifest.js" &&
      path.includes(`${resolve(".next", "server", "app")}`) &&
      path.includes(`${process.platform === "win32" ? "\\" : "/"}contact${process.platform === "win32" ? "\\" : "/"}`)
    ) {
      return path
    }
  }

  throw new Error("Contact client-reference manifest was not produced")
}

async function readClientManifest(path) {
  const context = { globalThis: {} }
  createContext(context)
  runInContext(await readFile(path, "utf8"), context)
  return context.globalThis.__RSC_MANIFEST ?? {}
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
