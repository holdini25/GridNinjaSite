import { readFile } from "node:fs/promises"
import { brotliCompressSync } from "node:zlib"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { createContext, runInContext } from "node:vm"
import { JSDOM } from "jsdom"
import { hostedPrerenderPath } from "./facility/hosted-attestation.mjs"

const CORE_ROUTES = ["/", "/assessment", "/demo", "/contact"]
const STATIC_ROUTES = new Set(["/", "/assessment", "/contact"])
const REVIEW_BYTES = 150 * 1024
const MAX_BYTES = 180 * 1024

async function main() {
  const nextDirectory = resolve(".next")
  const prerender = JSON.parse(
    await readFile(resolve(nextDirectory, "prerender-manifest.json"), "utf8")
  )

  const buildManifest = JSON.parse(await readFile(resolve(nextDirectory, "build-manifest.json"), "utf8"))
  for (const route of CORE_ROUTES) {
    const pagesRoute = Array.isArray(buildManifest.pages?.[route])
    if (STATIC_ROUTES.has(route) && !pagesRoute && !prerender.routes?.[route]) {
      throw new Error(`${route} is not present in Next's prerender manifest`)
    }
    let chunks
    if (pagesRoute) {
      // Resolve the actual static producer before reading its emitted scripts.
      // ASO pages use pages-manifest HTML; getStaticProps pages additionally
      // require a complete, non-revalidating JSON prerender entry.
      const html = await readFile(await hostedPrerenderPath(route, nextDirectory), "utf8")
      chunks = collectPagesInitialJavaScriptChunks(buildManifest, route, html)
    } else {
      if (!Array.isArray(buildManifest.rootMainFiles) || !buildManifest.rootMainFiles.length) throw new Error("Shared framework rootMainFiles are missing from the build manifest")
      const suffix = route === "/" ? "" : route
      const manifest = await readClientManifest(resolve(nextDirectory, "server", "app", "(marketing)", `.${suffix}`, "page_client-reference-manifest.js"))
      const routeManifest = manifest[`/(marketing)${suffix}/page`]
      if (!routeManifest) throw new Error(`${route}: client-reference manifest is missing its route entry`)
      chunks = collectInitialJavaScriptChunks(buildManifest, routeManifest)
    }
    if (!chunks.length) throw new Error(`${route}: client-reference manifest has no JavaScript chunks`)
    let compressedBytes = 0
    for (const chunk of chunks) {
      const path = resolve(nextDirectory, chunk.replace(/^\/_next\//, ""))
      compressedBytes += brotliCompressSync(await readFile(path)).byteLength
    }
    const compressedKiB = compressedBytes / 1024
    if (compressedBytes > MAX_BYTES) throw new Error(`${route}: first-load JavaScript is ${compressedKiB.toFixed(1)} KiB Brotli; maximum is 180 KiB`)
    if (compressedBytes > REVIEW_BYTES) console.warn(`${route}: review first-load JavaScript ${compressedKiB.toFixed(1)} KiB Brotli above the 150 KiB warning threshold`)
    console.log(`${route}: ${STATIC_ROUTES.has(route) ? "prerendered; " : "dynamic selection; "}${compressedKiB.toFixed(1)} KiB Brotli initial JavaScript including shared framework (180 KiB maximum).`)
  }
}

export function collectInitialJavaScriptChunks(buildManifest, routeManifest) {
  return [...new Set([...(buildManifest.rootMainFiles ?? []), ...Object.values(routeManifest.clientModules ?? {})
    .flatMap(module => module.chunks ?? [])].filter(chunk => chunk.endsWith(".js")))]
}

export function collectPagesInitialJavaScriptChunks(buildManifest, route, html) {
  for (const page of ["/_app", route]) {
    if (!Array.isArray(buildManifest.pages?.[page]) || !buildManifest.pages[page].some(chunk => chunk.endsWith(".js"))) throw new Error(`${route}: Pages build manifest is missing ${page} JavaScript`)
  }
  if (!Array.isArray(buildManifest.lowPriorityFiles)) throw new Error(`${route}: Pages lowPriorityFiles are missing`)
  const dom = new JSDOM(html)
  let emitted
  try {
    emitted = [...dom.window.document.querySelectorAll("script[src]")].map(script => {
      const src = script.getAttribute("src")
      // Next's production renderer appends its deployment/client asset token.
      // It selects the same emitted bytes; no other query or remote script is
      // silently omitted from this local-file budget.
      if (!/^\/_next\/static\/[A-Za-z0-9_./()@-]+\.js(?:\?dpl=[A-Za-z0-9_-]+)?$/.test(src) || src.includes("..")) throw new Error(`${route}: unsupported initial script ${src}`)
      return src.split("?")[0].slice("/_next/".length)
    })
  } finally { dom.window.close() }
  if (!emitted.length) throw new Error(`${route}: static HTML contains no initial JavaScript`)
  // Next's Pages /_app and route entries include framework/main/webpack.
  // lowPriorityFiles are also emitted by NextScript, and dynamic imports can
  // appear only in HTML. Charge the complete union once, never just page code.
  return [...new Set([...buildManifest.pages["/_app"], ...buildManifest.pages[route], ...buildManifest.lowPriorityFiles, ...emitted].filter(chunk => chunk.endsWith(".js")))]
}

async function readClientManifest(path) {
  const context = { globalThis: {} }
  createContext(context)
  runInContext(await readFile(path, "utf8"), context)
  return context.globalThis.__RSC_MANIFEST ?? {}
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
