import type { PublicPath } from "./route-manifest"

export type LinkEdge = { source: string; target: string }

export type LinkGraphViolation = {
  code:
    | "unreachable-from-root"
    | "root-depth-exceeded"
    | "unreachable-destination"
    | "destination-depth-exceeded"
    | "orphan"
    | "dead-end"
    | "self-link"
    | "duplicate-edge"
    | "unknown-target"
    | "missing-declared-edge"
  path: string
  target: string | null
  message: string
  pathTrace: readonly string[]
}

export type LinkGraph = {
  nodes: readonly string[]
  adjacency: ReadonlyMap<string, ReadonlySet<string>>
  duplicateEdges: readonly LinkEdge[]
  selfEdges: readonly LinkEdge[]
  unknownTargets: readonly LinkEdge[]
}

export type LinkGraphAnalysis = {
  forwardDistance: ReadonlyMap<string, number | null>
  forwardPredecessor: ReadonlyMap<string, string | null>
  destinationDistance: ReadonlyMap<string, number | null>
  nextHopToDestination: ReadonlyMap<string, string | null>
  inboundDegree: ReadonlyMap<string, number>
  outboundDegree: ReadonlyMap<string, number>
  violations: readonly LinkGraphViolation[]
}

export const DEFAULT_DESTINATION_PATHS: readonly PublicPath[]
export const MAX_CONTEXTUAL_DEPTH_BY_TIER: Readonly<Record<0 | 1 | 2, number>>

export function normalizeRoutePath(pathname: string): string
export function classifyInternalHref(
  href: unknown,
  options: {
    sourcePath: string
    deploymentOrigin: string
    productionOrigin: string
    knownPaths?: ReadonlySet<string>
    excludedPathPrefixes?: readonly string[]
  }
):
  | { kind: "malformed"; href: unknown; reason: string }
  | { kind: "external"; href: string; url: string }
  | { kind: "same-page-fragment"; href: string }
  | {
      kind: "excluded" | "unknown" | "internal"
      href: string
      path: string
      search: string
      hash: string
    }

export function buildLinkGraph(
  nodes: readonly string[],
  edges: readonly LinkEdge[]
): LinkGraph
export function breadthFirstSearch(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  starts: readonly string[]
): {
  distance: Map<string, number | null>
  predecessor: Map<string, string | null>
}
export function reverseAdjacency(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>
): Map<string, Set<string>>
export function reverseMultiSourceSearch(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  destinationPaths: readonly string[]
): {
  distance: Map<string, number | null>
  nextHop: Map<string, string | null>
}
export function reconstructPredecessorPath(
  predecessor: ReadonlyMap<string, string | null>,
  target: string
): string[]
export function reconstructDestinationPath(
  nextHop: ReadonlyMap<string, string | null>,
  source: string
): string[]
export function analyzeLinkGraph(options: {
  graph: LinkGraph
  routes: readonly { path: string; tier: 0 | 1 | 2 }[]
  root?: string
  destinationPaths?: readonly string[]
  missingDeclaredEdges?: readonly LinkEdge[]
}): LinkGraphAnalysis
