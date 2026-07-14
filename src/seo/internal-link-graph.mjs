const DEFAULT_EXCLUDED_PATH_PREFIXES = [
  "/_next/",
  "/api/",
  "/downloads/",
  "/evidence/releases/",
]

export const DEFAULT_DESTINATION_PATHS = [
  "/contact",
  "/roi",
  "/proof",
  "/demo",
]

export const MAX_CONTEXTUAL_DEPTH_BY_TIER = {
  0: 2,
  1: 3,
  2: 4,
}

export function normalizeRoutePath(pathname) {
  const normalized = pathname.replace(/\/{2,}/g, "/")
  if (normalized === "/") return normalized
  return normalized.replace(/\/+$/, "") || "/"
}

export function classifyInternalHref(
  href,
  {
    sourcePath,
    deploymentOrigin,
    productionOrigin,
    knownPaths,
    excludedPathPrefixes = DEFAULT_EXCLUDED_PATH_PREFIXES,
  }
) {
  if (typeof href !== "string" || href.trim().length === 0) {
    return { kind: "malformed", href, reason: "empty href" }
  }

  const trimmed = href.trim()
  if (trimmed.startsWith("#")) {
    return { kind: "same-page-fragment", href: trimmed }
  }

  let resolved
  try {
    const base = new URL(sourcePath, `${deploymentOrigin}/`)
    resolved = new URL(trimmed, base)
  } catch (error) {
    return { kind: "malformed", href: trimmed, reason: String(error) }
  }

  if (!['http:', 'https:'].includes(resolved.protocol)) {
    return { kind: "external", href: trimmed, url: resolved.toString() }
  }

  const acceptedOrigins = new Set([
    new URL(deploymentOrigin).origin,
    new URL(productionOrigin).origin,
  ])
  if (!acceptedOrigins.has(resolved.origin)) {
    return { kind: "external", href: trimmed, url: resolved.toString() }
  }

  const path = normalizeRoutePath(resolved.pathname)
  if (excludedPathPrefixes.some((prefix) => path.startsWith(prefix))) {
    return {
      kind: "excluded",
      href: trimmed,
      path,
      search: resolved.search,
      hash: resolved.hash,
    }
  }

  if (knownPaths && !knownPaths.has(path)) {
    return {
      kind: "unknown",
      href: trimmed,
      path,
      search: resolved.search,
      hash: resolved.hash,
    }
  }

  return {
    kind: "internal",
    href: trimmed,
    path,
    search: resolved.search,
    hash: resolved.hash,
  }
}

export function buildLinkGraph(nodes, edges) {
  const sortedNodes = [...new Set(nodes.map(normalizeRoutePath))].sort()
  const nodeSet = new Set(sortedNodes)
  const adjacency = new Map(sortedNodes.map((path) => [path, new Set()]))
  const duplicateEdges = []
  const selfEdges = []
  const unknownTargets = []
  const edgeKeys = new Set()

  for (const edge of [...edges].sort(compareEdges)) {
    const source = normalizeRoutePath(edge.source)
    const target = normalizeRoutePath(edge.target)
    const key = `${source}\0${target}`

    if (!nodeSet.has(source) || !nodeSet.has(target)) {
      unknownTargets.push({ source, target })
      continue
    }
    if (source === target) {
      selfEdges.push({ source, target })
      continue
    }
    if (edgeKeys.has(key)) {
      duplicateEdges.push({ source, target })
      continue
    }

    edgeKeys.add(key)
    adjacency.get(source).add(target)
  }

  for (const [path, targets] of adjacency) {
    adjacency.set(path, new Set([...targets].sort()))
  }

  return {
    nodes: sortedNodes,
    adjacency,
    duplicateEdges,
    selfEdges,
    unknownTargets,
  }
}

export function breadthFirstSearch(adjacency, starts) {
  const distance = new Map([...adjacency.keys()].map((path) => [path, null]))
  const predecessor = new Map([...adjacency.keys()].map((path) => [path, null]))
  const queue = []

  for (const start of starts) {
    if (!adjacency.has(start) || distance.get(start) !== null) continue
    distance.set(start, 0)
    queue.push(start)
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]
    const nextDistance = distance.get(current) + 1
    for (const target of adjacency.get(current) ?? []) {
      if (distance.get(target) !== null) continue
      distance.set(target, nextDistance)
      predecessor.set(target, current)
      queue.push(target)
    }
  }

  return { distance, predecessor }
}

export function reverseAdjacency(adjacency) {
  const reversed = new Map([...adjacency.keys()].map((path) => [path, new Set()]))
  for (const [source, targets] of adjacency) {
    for (const target of targets) reversed.get(target)?.add(source)
  }
  for (const [path, sources] of reversed) {
    reversed.set(path, new Set([...sources].sort()))
  }
  return reversed
}

export function reverseMultiSourceSearch(adjacency, destinationPaths) {
  const reversed = reverseAdjacency(adjacency)
  const { distance, predecessor: nextHop } = breadthFirstSearch(
    reversed,
    destinationPaths
  )
  return { distance, nextHop }
}

export function reconstructPredecessorPath(predecessor, target) {
  if (!predecessor.has(target)) return []
  const path = []
  const seen = new Set()
  let current = target

  while (current !== null && !seen.has(current)) {
    path.push(current)
    seen.add(current)
    current = predecessor.get(current) ?? null
  }

  return path.reverse()
}

export function reconstructDestinationPath(nextHop, source) {
  if (!nextHop.has(source)) return []
  const path = []
  const seen = new Set()
  let current = source

  while (current !== null && !seen.has(current)) {
    path.push(current)
    seen.add(current)
    current = nextHop.get(current) ?? null
  }

  return path
}

export function analyzeLinkGraph({
  graph,
  routes,
  root = "/",
  destinationPaths = DEFAULT_DESTINATION_PATHS,
  missingDeclaredEdges = [],
}) {
  const routeByPath = new Map(
    routes.map((route) => [normalizeRoutePath(route.path), route])
  )
  const forward = breadthFirstSearch(graph.adjacency, [root])
  const destination = reverseMultiSourceSearch(
    graph.adjacency,
    destinationPaths
  )
  const inboundDegree = new Map(graph.nodes.map((path) => [path, 0]))
  const outboundDegree = new Map(graph.nodes.map((path) => [path, 0]))
  const violations = []

  for (const [source, targets] of graph.adjacency) {
    outboundDegree.set(source, targets.size)
    for (const target of targets) {
      inboundDegree.set(target, (inboundDegree.get(target) ?? 0) + 1)
    }
  }

  for (const path of graph.nodes) {
    const route = routeByPath.get(path)
    const tier = route?.tier ?? 2
    const maximumDepth = MAX_CONTEXTUAL_DEPTH_BY_TIER[tier]
    const forwardDistance = forward.distance.get(path)
    const destinationDistance = destination.distance.get(path)

    if (forwardDistance === null) {
      violations.push(violation("unreachable-from-root", path, null, `${path} is not reachable from ${root}; no predecessor was discovered.`))
    } else if (forwardDistance > maximumDepth) {
      const trace = reconstructPredecessorPath(forward.predecessor, path)
      violations.push(violation("root-depth-exceeded", path, null, `${path} is ${forwardDistance} contextual clicks from ${root}; Tier ${tier} allows ${maximumDepth}. Path: ${trace.join(" -> ")}`, trace))
    }

    if (destinationDistance === null) {
      violations.push(violation("unreachable-destination", path, null, `${path} cannot reach a proof or conversion destination; no next hop was discovered.`))
    } else if (destinationDistance > maximumDepth) {
      const trace = reconstructDestinationPath(destination.nextHop, path)
      violations.push(violation("destination-depth-exceeded", path, null, `${path} is ${destinationDistance} contextual clicks from a proof or conversion destination; Tier ${tier} allows ${maximumDepth}. Path: ${trace.join(" -> ")}`, trace))
    }

    if (path !== root && inboundDegree.get(path) === 0) {
      violations.push(violation("orphan", path, null, `${path} has no contextual inbound links.`))
    }
    if (outboundDegree.get(path) === 0) {
      violations.push(violation("dead-end", path, null, `${path} has no contextual outbound links.`))
    }
  }

  for (const edge of graph.selfEdges) {
    violations.push(violation("self-link", edge.source, edge.target, `${edge.source} declares a contextual self-link.`))
  }
  for (const edge of graph.duplicateEdges) {
    violations.push(violation("duplicate-edge", edge.source, edge.target, `${edge.source} links to ${edge.target} more than once in the graph input.`))
  }
  for (const edge of graph.unknownTargets) {
    violations.push(violation("unknown-target", edge.source, edge.target, `${edge.source} links to unknown graph target ${edge.target}.`))
  }
  for (const edge of missingDeclaredEdges) {
    violations.push(violation("missing-declared-edge", edge.source, edge.target, `${edge.source} declares ${edge.target}, but the link is missing from the initial main DOM.`))
  }

  return {
    forwardDistance: forward.distance,
    forwardPredecessor: forward.predecessor,
    destinationDistance: destination.distance,
    nextHopToDestination: destination.nextHop,
    inboundDegree,
    outboundDegree,
    violations: violations.sort(compareViolations),
  }
}

function violation(code, path, target, message, pathTrace = []) {
  return { code, path, target, message, pathTrace }
}

function compareEdges(a, b) {
  return a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
}

function compareViolations(a, b) {
  return a.path.localeCompare(b.path) || a.code.localeCompare(b.code) || (a.target ?? "").localeCompare(b.target ?? "")
}
