import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import postcss from "postcss"
import ts from "typescript"

const sourceExtension = /\.(?:[cm]?[jt]sx?|json)$/
const literal = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null
function inside(directory, file) {
  const path = relative(directory, file)
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

/** The exclusions in globals.css are authoritative. A retained component must
 * recover its utility styles before any source entry starts importing it. */
export function validateCssSources(projectRoot = process.cwd()) {
  const root = realpathSync(resolve(projectRoot))
  const src = join(root, "src")
  const components = join(src, "components")
  const cssFile = join(src, "app/globals.css")
  const excluded = new Set()
  const display = file => relative(root, file).split(sep).join("/")
  const fail = message => { throw new Error(`CSS source validation: ${message}`) }

  postcss.parse(readFileSync(cssFile, "utf8"), { from: cssFile }).walkAtRules("source", rule => {
    if (!/^not\b/.test(rule.params)) return
    const match = /^not\s+(["'])([^"']+)\1$/.exec(rule.params)
    if (!match || /[?*\[\]{}!\\]/.test(match[2])) fail("@source not must name one exact component file; patterns and inline exclusions are unsupported")
    const file = resolve(dirname(cssFile), match[2])
    if (!inside(components, file) || !sourceExtension.test(file) || file.endsWith(".json")) fail(`exclusion is not a component source file: ${match[2]}`)
    if (!existsSync(file) || !lstatSync(file).isFile() || realpathSync(file) !== file) fail(`excluded component must exist as a regular, non-symlinked file: ${match[2]}`)
    if (excluded.has(file)) fail(`duplicate exclusion: ${match[2]}`)
    excluded.add(file)
  })

  const configFile = join(root, "tsconfig.json")
  const config = ts.readConfigFile(configFile, ts.sys.readFile)
  if (config.error) fail(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  if (parsed.errors.length) fail(parsed.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"))
  const options = parsed.options
  const aliases = Object.entries(options.paths ?? {}).map(([key, targets]) => ({
    pattern: new RegExp(`^${key.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.*)")}$`),
    targets,
  }))
  const sourceFiles = []
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(directory, entry.name)
      if (entry.isSymbolicLink()) fail(`source symlink needs explicit review: ${display(file)}`)
      if (entry.isDirectory()) walk(file)
      else if (sourceExtension.test(file)) sourceFiles.push(file)
    }
  }
  walk(src)

  // Wider than current Next entry conventions: includes future middleware,
  // metadata, route handlers, and content/config-to-component imports.
  const roots = sourceFiles.filter(file => !inside(components, file))
  const reached = new Set()
  function visit(file, importer) {
    if (excluded.has(file)) fail(`${display(file)} is reachable${importer ? ` from ${display(importer)}` : ""}; remove its @source not directive`)
    if (reached.has(file)) return
    reached.add(file)
    if (file.endsWith(".json")) return
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true)
    if (source.parseDiagnostics.length) fail(`cannot parse ${display(file)}`)
    const requests = []
    function inspect(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) requests.push(literal(node.moduleSpecifier))
      if (ts.isImportDeclaration(node) && ["node:module", "module"].includes(literal(node.moduleSpecifier)) && node.importClause) fail(`unsupported module-loader factory in ${display(file)}`)
      if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) requests.push(literal(node.moduleReference.expression))
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) requests.push(literal(node.argument.literal))
      if (ts.isElementAccessExpression(node) && ["require", "module", "import.meta"].includes(node.expression.getText(source))) fail(`unsupported computed loader in ${display(file)}`)
      if (ts.isPropertyAccessExpression(node) && node.expression.getText(source) === "import.meta" && /^glob(?:Eager)?$/.test(node.name.text)) fail(`unsupported source discovery in ${display(file)}: ${node.getText(source)}`)
      if (ts.isIdentifier(node) && node.text === "require") {
        const parent = node.parent
        const direct = ts.isCallExpression(parent) && parent.expression === node
        const property = ts.isPropertyAccessExpression(parent) && ts.isCallExpression(parent.parent) && parent.parent.expression === parent && ["require.resolve", "require.context", "module.require"].includes(parent.getText(source).replace(/\s+/g, ""))
        if (!direct && !property) fail(`unsupported require alias in ${display(file)}`)
      }
      if (ts.isCallExpression(node)) {
        const expression = node.expression.getText(source).replace(/\s+/g, "")
        if (expression === "require.context" || /^import\.meta\.glob(?:Eager)?$/.test(expression)) fail(`unsupported source discovery in ${display(file)}: ${expression}`)
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword || ["require", "module.require", "require.resolve"].includes(expression)) {
          const request = literal(node.arguments[0])
          if (request === null) fail(`nonliteral module loader in ${display(file)}: ${node.getText(source)}`)
          requests.push(request)
        }
      }
      ts.forEachChild(node, inspect)
    }
    inspect(source)
    for (const request of new Set(requests)) {
      if (request === null) fail(`unsupported module reference in ${display(file)}`)
      const resolved = ts.resolveModuleName(request, file, options, ts.sys).resolvedModule
      if (resolved) {
        const dependency = resolve(resolved.resolvedFileName)
        if (!resolved.isExternalLibraryImport && !dependency.split(sep).includes("node_modules")) {
          if (!inside(root, dependency)) fail(`local dependency outside the inspected project: ${request} in ${display(file)}`)
          visit(dependency, file)
        }
        continue
      }
      const alias = aliases.find(entry => entry.pattern.test(request))
      const local = request.startsWith(".") || request.startsWith("/") || alias
      if (!local) continue
      // CSS and static imports are leaves. A missing local file is never ignored.
      const assets = alias ? alias.targets.map(target => resolve(options.baseUrl ?? options.pathsBasePath ?? root, target.replace("*", request.match(alias.pattern)[1] ?? "")))
        : [request.startsWith("/") ? join(root, "public", request) : resolve(dirname(file), request)]
      if (assets.some(asset => existsSync(asset) && lstatSync(asset).isFile() && !sourceExtension.test(asset))) continue
      fail(`unresolved local import ${JSON.stringify(request)} in ${display(file)}`)
    }
  }
  roots.forEach(file => visit(file))
  return { roots: roots.map(display), reachable: [...reached].map(display).sort(), excluded: [...excluded].map(display).sort() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = validateCssSources()
    console.log(`CSS source validation passed: ${result.excluded.length} excluded components remain unreachable from ${result.roots.length} conservative source roots.`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
