import { existsSync } from "node:fs"
import { readFile, readdir } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)))
const requiredFiles = [
  "src/seo/policy.ts",
  "src/seo/route-manifest.ts",
  "src/seo/query-registry.ts",
  "src/seo/claim-registry.ts",
  "src/seo/schema.ts",
  "src/components/seo/json-ld.tsx",
]
const failures = []

async function filesBelow(directory) {
  if (!existsSync(directory)) return []
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? filesBelow(path) : [path]
    })
  )
  return nested.flat()
}

for (const path of requiredFiles) {
  if (!existsSync(join(root, path))) {
    failures.push(`Missing required SEO contract: ${path}`)
  }
}

const seoFiles = await filesBelow(join(root, "src/seo"))
const componentPath = join(root, "src/components/seo/json-ld.tsx")
if (existsSync(componentPath)) seoFiles.push(componentPath)

for (const file of seoFiles) {
  const source = await readFile(file, "utf8")
  const path = relative(root, file)

  if (path !== "src/seo/policy.ts" && /NEXT_PUBLIC_[A-Z0-9_]+/.test(source)) {
    failures.push(`${path} derives search identity from a public runtime variable`)
  }
  if (/https?:\/\/www\.gridninja\.ai/i.test(source)) {
    failures.push(`${path} contains the disallowed www canonical host`)
  }
  if (/https?:\/\/[^\s"'`]*vercel\.app/i.test(source)) {
    failures.push(`${path} contains a Vercel preview host`)
  }
  if (/\bkeywords\s*:/.test(source)) {
    failures.push(`${path} adds unsupported meta keywords`)
  }
}

const policyPath = join(root, "src/seo/policy.ts")
if (existsSync(policyPath)) {
  const policy = await readFile(policyPath, "utf8")
  if (!/["']https:\/\/gridninja\.ai["']/.test(policy)) {
    failures.push("src/seo/policy.ts does not declare the immutable apex origin")
  }
  if (/PRODUCTION_ORIGIN\s*=\s*process\.env/.test(policy)) {
    failures.push("src/seo/policy.ts derives PRODUCTION_ORIGIN from the environment")
  }
}

if (existsSync(join(root, "public/llms.txt"))) {
  failures.push("public/llms.txt is outside the approved publishing strategy")
}

if (failures.length > 0) {
  console.error("SEO source contract validation failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`SEO source contracts passed (${seoFiles.length} files checked).`)
}
