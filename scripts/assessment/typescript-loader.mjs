// Build tooling only. Uses the repository's existing TypeScript dependency.
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import ts from "typescript"

export async function resolve(specifier, context, nextResolve) {
  const candidate = specifier.startsWith("@/")
    ? new URL(`../../src/${specifier.slice(2)}`, import.meta.url)
    : specifier.startsWith(".") && context.parentURL
      ? new URL(specifier, context.parentURL)
      : null
  if (candidate?.protocol === "file:") {
    for (const suffix of ["", ".ts", ".tsx", "/index.ts"]) {
      const url = `${candidate.href}${suffix}`
      if (/\.(?:[cm]?[jt]sx?|json)$/.test(url) && existsSync(fileURLToPath(url))) {
        return { url, shortCircuit: true }
      }
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (/\.tsx?$/.test(url)) {
    const source = await readFile(new URL(url), "utf8")
    return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
        fileName: fileURLToPath(url),
      }).outputText,
    }
  }
  return nextLoad(url, context)
}
