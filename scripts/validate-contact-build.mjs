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
const PAGES_OBSERVABILITY_ENTRY = "pages/_app.tsx -> @/components/analytics/vercel-observability"

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
      const loadableManifest = JSON.parse(await readFile(resolve(nextDirectory, "react-loadable-manifest.json"), "utf8").catch(error => {
        if (error.code === "ENOENT") return "{}"
        throw error
      }))
      chunks = collectPagesInitialJavaScriptChunks(buildManifest, route, html, loadableManifest)
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

export function collectPagesInitialJavaScriptChunks(buildManifest, route, html, loadableManifest = {}) {
  for (const page of ["/_app", route]) {
    if (!Array.isArray(buildManifest.pages?.[page]) || !buildManifest.pages[page].some(chunk => chunk.endsWith(".js"))) throw new Error(`${route}: Pages build manifest is missing ${page} JavaScript`)
  }
  if (!Array.isArray(buildManifest.lowPriorityFiles)) throw new Error(`${route}: Pages lowPriorityFiles are missing`)
  const dom = new JSDOM(html)
  let emitted, clientOnly = []
  try {
    emitted = [...dom.window.document.querySelectorAll("script[src]")].map(script => {
      const src = script.getAttribute("src")
      // Next's production renderer appends its deployment/client asset token.
      // It selects the same emitted bytes; no other query or remote script is
      // silently omitted from this local-file budget.
      if (!/^\/_next\/static\/[A-Za-z0-9_./()@-]+\.js(?:\?dpl=[A-Za-z0-9_-]+)?$/.test(src) || src.includes("..")) throw new Error(`${route}: unsupported initial script ${src}`)
      return src.split("?")[0].slice("/_next/".length)
    })
    if (!emitted.length) throw new Error(`${route}: static HTML contains no initial JavaScript`)
    const dataScripts = dom.window.document.querySelectorAll("script#__NEXT_DATA__")
    if (dataScripts.length !== 1 || dataScripts[0].getAttribute("type") !== "application/json") throw new Error(`${route}: missing or ambiguous Pages __NEXT_DATA__`)
    let pageData
    try { pageData = JSON.parse(dataScripts[0].textContent) }
    catch { throw new Error(`${route}: invalid Pages __NEXT_DATA__ JSON`) }
    const observability = pageData?.props?.pageProps?.observability
    if (typeof observability !== "boolean") throw new Error(`${route}: Pages observability setting must be an explicit boolean`)
    if (observability) {
      const files = loadableManifest?.[PAGES_OBSERVABILITY_ENTRY]?.files
      if (!Array.isArray(files) || !files.length || files.some(file => typeof file !== "string" || !/^static\/[A-Za-z0-9_./()@-]+\.(?:js|css)$/.test(file) || file.includes(".."))) throw new Error(`${route}: required Pages observability loadable files are missing or invalid`)
      clientOnly = files.filter(file => file.endsWith(".js"))
      if (!clientOnly.length) throw new Error(`${route}: required Pages observability loadable entry has no JavaScript`)
    }
  } finally { dom.window.close() }
  // Next's Pages /_app and route entries include framework/main/webpack.
  // lowPriorityFiles are also emitted by NextScript, and dynamic imports can
  // appear only in HTML. ssr:false observability starts at hydration when the
  // built page enables it, so charge its complete loadable entry as well.
  return [...new Set([...buildManifest.pages["/_app"], ...buildManifest.pages[route], ...buildManifest.lowPriorityFiles, ...emitted, ...clientOnly].filter(chunk => chunk.endsWith(".js")))]
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
