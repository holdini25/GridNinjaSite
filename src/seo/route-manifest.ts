import { seoResources } from "@/content/seo-resources"
import { PRODUCTION_ORIGIN } from "@/seo/policy"

export type IsoDate = `${number}-${number}-${number}`
export type SchemaType =
  | "WebPage"
  | "Service"
  | "TechArticle"
  | "BreadcrumbList"

export type SearchIntent =
  | "definition"
  | "problem"
  | "comparison"
  | "evidence"
  | "commercial"
  | "brand"

export type Breadcrumb = {
  name: string
  path: string
}

export type SeoRoute = {
  key: string
  path: `/${string}` | "/"
  tier: 0 | 1 | 2
  indexable: boolean
  title: string
  description: string
  h1: string
  topicCluster: string
  searchIntent: SearchIntent
  schemaTypes: readonly SchemaType[]
  socialImageKey: string
  contentUpdatedAt: IsoDate
  breadcrumbs: readonly Breadcrumb[]
  targetQuestions: readonly string[]
  relatedPaths: readonly string[]
}

const updated = "2026-07-13" as const

export const seoRoutes = [
  {
    key: "home",
    path: "/",
    tier: 0,
    indexable: true,
    title: "AI Data Center Virtual Capacity Control Plane | GridNinja",
    description: "GridNinja is the AI Data Center Virtual Capacity Control Plane that converts constrained infrastructure into safe, usable, auditable capacity with proof before autonomy.",
    h1: "Claimed headroom is not proven capacity.",
    topicCluster: "virtual-capacity-control-plane",
    searchIntent: "brand",
    schemaTypes: ["WebPage"],
    socialImageKey: "home",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["What is an AI Data Center Virtual Capacity Control Plane?"],
    relatedPaths: ["/platform", "/proof", "/roi"],
  },
  {
    key: "platform",
    path: "/platform",
    tier: 0,
    indexable: true,
    title: "Virtual Capacity Control Plane Platform | GridNinja",
    description: "See how GridNinja coordinates workloads, cooling, storage, and bridge power inside a runtime-assured dispatch envelope.",
    h1: "The platform for runtime-assured virtual capacity",
    topicCluster: "platform",
    searchIntent: "definition",
    schemaTypes: ["WebPage"],
    socialImageKey: "platform",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["How does virtual capacity orchestration work inside the fence?"],
    relatedPaths: ["/platform/dispatch-envelope", "/proof", "/demo"],
  },
  {
    key: "dispatch-envelope",
    path: "/platform/dispatch-envelope",
    tier: 0,
    indexable: true,
    title: "Data Center Dispatch Envelopes & Runtime Assurance | GridNinja",
    description: "Learn how a dispatch envelope constrains data center actions by electrical, thermal, reserve, workload, water, and SLA limits before execution.",
    h1: "How much virtual capacity is safe, for how long, and under which evidence?",
    topicCluster: "runtime-assurance",
    searchIntent: "definition",
    schemaTypes: ["WebPage", "BreadcrumbList"],
    socialImageKey: "dispatch-envelope",
    contentUpdatedAt: updated,
    breadcrumbs: [{ name: "Platform", path: "/platform" }],
    targetQuestions: ["What is a data center dispatch envelope?"],
    relatedPaths: ["/platform", "/proof", "/methodology/claims-and-evidence"],
  },
  {
    key: "ai-cloud",
    path: "/solutions/ai-cloud",
    tier: 0,
    indexable: true,
    title: "AI Cloud Time-to-Power & Virtual Capacity | GridNinja",
    description: "Accelerate AI cloud time-to-power by proving virtual capacity across power, cooling, workloads, reserves, and bridge power.",
    h1: "For AI Clouds Racing Against the Grid",
    topicCluster: "ai-cloud",
    searchIntent: "commercial",
    schemaTypes: ["WebPage", "BreadcrumbList"],
    socialImageKey: "ai-cloud",
    contentUpdatedAt: updated,
    breadcrumbs: [{ name: "Solutions", path: "/#solutions" }],
    targetQuestions: ["How can AI clouds accelerate time-to-power safely?"],
    relatedPaths: ["/roi", "/solutions/bridge-power", "/proof"],
  },
  {
    key: "colocation",
    path: "/solutions/colocation",
    tier: 0,
    indexable: true,
    title: "Proof-Backed Sellable Capacity for Colocation | GridNinja",
    description: "Convert constrained colocation infrastructure into proof-adjusted sellable capacity while protecting tenant SLAs and reserve posture.",
    h1: "For Operators Selling Capacity in Constrained Markets",
    topicCluster: "colocation",
    searchIntent: "commercial",
    schemaTypes: ["WebPage", "BreadcrumbList"],
    socialImageKey: "colocation",
    contentUpdatedAt: updated,
    breadcrumbs: [{ name: "Solutions", path: "/#solutions" }],
    targetQuestions: ["How can colocation operators sell more capacity safely?"],
    relatedPaths: ["/roi", "/proof/proof-pack", "/proof"],
  },
  {
    key: "bridge-power",
    path: "/solutions/bridge-power",
    tier: 0,
    indexable: true,
    title: "Bridge Power & DER for AI Data Centers | GridNinja",
    description: "Coordinate bridge power, storage, generation, cooling, and AI workloads inside a visible, runtime-assured dispatch envelope.",
    h1: "Make bridge power provably useful",
    topicCluster: "bridge-power",
    searchIntent: "commercial",
    schemaTypes: ["WebPage", "BreadcrumbList"],
    socialImageKey: "bridge-power",
    contentUpdatedAt: updated,
    breadcrumbs: [{ name: "Solutions", path: "/#solutions" }],
    targetQuestions: ["How should bridge power be coordinated for AI data centers?"],
    relatedPaths: ["/platform", "/solutions/ai-cloud", "/contact"],
  },
  {
    key: "proof",
    path: "/proof",
    tier: 0,
    indexable: true,
    title: "Proof Before Autonomy for AI Data Centers | GridNinja",
    description: "See how Shadow Mode, replay, allow / repair / reject decisions, audit logs, and proof packs establish evidence before bounded autonomy.",
    h1: "Trust starts with boundaries",
    topicCluster: "proof-before-autonomy",
    searchIntent: "evidence",
    schemaTypes: ["WebPage"],
    socialImageKey: "proof",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["What does proof before autonomy mean for AI data centers?"],
    relatedPaths: ["/proof/proof-pack", "/demo", "/evidence"],
  },
  {
    key: "why-gridninja",
    path: "/why-gridninja",
    tier: 0,
    indexable: true,
    title: "Capacity Acceptance vs DCIM & Digital Twins | GridNinja",
    description: "Compare GridNinja's inside-the-fence capacity-acceptance role with DCIM, digital twins, AIOps, and grid flexibility platforms using scoped public sources.",
    h1: "Before you trust another megawatt, ask what proves it.",
    topicCluster: "comparison",
    searchIntent: "comparison",
    schemaTypes: ["WebPage"],
    socialImageKey: "why-gridninja",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["How is capacity acceptance different from DCIM or a digital twin?"],
    relatedPaths: ["/platform", "/proof", "/methodology/comparison-policy"],
  },
  {
    key: "proof-pack",
    path: "/proof/proof-pack",
    tier: 0,
    indexable: true,
    title: "AI Data Center Virtual Capacity Proof Pack | GridNinja",
    description: "Inspect the proof artifacts that make virtual capacity reviewable: constraints, decisions, accepted headroom, provenance, replay, and rollback evidence.",
    h1: "Review the proof objects before a live review",
    topicCluster: "proof-before-autonomy",
    searchIntent: "evidence",
    schemaTypes: ["WebPage", "BreadcrumbList"],
    socialImageKey: "proof-pack",
    contentUpdatedAt: updated,
    breadcrumbs: [{ name: "Proof", path: "/proof" }],
    targetQuestions: ["What is in a virtual capacity proof pack?"],
    relatedPaths: ["/proof", "/evidence", "/demo"],
  },
  {
    key: "demo",
    path: "/demo",
    tier: 1,
    indexable: true,
    title: "Virtual Capacity Proof Demo | GridNinja",
    description: "Walk through a synthetic virtual capacity request as runtime assurance allows, repairs, or rejects actions and records the evidence.",
    h1: "Inspect how claimed headroom becomes proof-adjusted capacity",
    topicCluster: "proof-demo",
    searchIntent: "evidence",
    schemaTypes: ["WebPage"],
    socialImageKey: "demo",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["How does GridNinja verify a capacity action?"],
    relatedPaths: ["/proof", "/platform/dispatch-envelope", "/contact"],
  },
  {
    key: "dcii",
    path: "/dcii",
    tier: 1,
    indexable: true,
    title: "GridNinja DCII Project | Proof-Backed AI Capacity",
    description: "Explore GridNinja's proof-backed AI capacity project framing for infrastructure partners, operators, and technical evaluators.",
    h1: "Read-only validation for proof-backed AI data center capacity",
    topicCluster: "dcii",
    searchIntent: "commercial",
    schemaTypes: ["WebPage"],
    socialImageKey: "dcii",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["What is the GridNinja DCII project?"],
    relatedPaths: ["/platform", "/proof", "/contact"],
  },
  {
    key: "roi",
    path: "/roi",
    tier: 0,
    indexable: true,
    title: "AI Data Center Capacity Audit & ROI | GridNinja",
    description: "Request a Capacity Audit to quantify proof-adjusted safe MW, time-to-power, constraints, evidence gaps, and potential commercial value.",
    h1: "Quantify proof-adjusted capacity before you promise flexible MW",
    topicCluster: "capacity-audit",
    searchIntent: "commercial",
    schemaTypes: ["WebPage", "Service"],
    socialImageKey: "capacity-audit",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["What does an AI data center Capacity Audit measure?"],
    relatedPaths: ["/contact", "/platform", "/methodology/capacity-audit"],
  },
  {
    key: "about",
    path: "/about",
    tier: 1,
    indexable: true,
    title: "About GridNinja | Proof-First AI Infrastructure",
    description: "GridNinja builds proof-first infrastructure software for safe, usable, auditable AI data center capacity.",
    h1: "Built for the constraint era of AI infrastructure",
    topicCluster: "brand",
    searchIntent: "brand",
    schemaTypes: ["WebPage"],
    socialImageKey: "about",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["What is GridNinja building?"],
    relatedPaths: ["/platform", "/proof", "/contact"],
  },
  {
    key: "contact",
    path: "/contact",
    tier: 0,
    indexable: true,
    title: "Request an AI Data Center Capacity Audit | GridNinja",
    description: "Talk with GridNinja about a Capacity Audit, Shadow Mode evaluation, virtual capacity pilot, or bridge-power partnership.",
    h1: "Start with a site, a constraint, or a proof gap",
    topicCluster: "conversion",
    searchIntent: "commercial",
    schemaTypes: ["WebPage"],
    socialImageKey: "contact",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["How do I request a GridNinja Capacity Audit?"],
    relatedPaths: ["/roi", "/proof", "/platform"],
  },
  ...makeHubRoutes(),
  ...makeResourceRoutes(),
] as const satisfies readonly SeoRoute[]

function makeHubRoutes(): SeoRoute[] {
  return [
    hub("insights", "/insights", "Virtual Capacity Insights for AI Data Centers | GridNinja", "Technical explainers for virtual capacity, runtime assurance, Shadow Mode, time-to-power, and cross-domain constraints.", "Virtual capacity insights for constrained AI infrastructure", "definition"),
    hub("evidence", "/evidence", "Virtual Capacity Evidence Library | GridNinja", "Publication-gated methods, synthetic traces, ledgers, specifications, and proof artifacts for evaluating virtual capacity claims.", "Evidence for safe, usable, auditable capacity", "evidence"),
    hub("methodology", "/methodology", "GridNinja Claims, Evidence & Capacity Methods", "How GridNinja governs claims, comparisons, corrections, evidence maturity, and Capacity Audit methods.", "Methods for claims that operators can defend", "evidence"),
  ]
}

function hub(key: string, path: `/${string}`, title: string, description: string, h1: string, searchIntent: SearchIntent): SeoRoute {
  return {
    key,
    path,
    tier: 1,
    indexable: true,
    title,
    description,
    h1,
    topicCluster: key,
    searchIntent,
    schemaTypes: ["WebPage"],
    socialImageKey: key,
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: [`What does GridNinja publish about ${key}?`],
    relatedPaths: ["/platform", "/proof", "/roi"],
  }
}

function makeResourceRoutes(): SeoRoute[] {
  return seoResources.map((resource) => ({
    key: resource.slug,
    path: resource.path,
    tier: 2,
    indexable: false,
    title: resource.title,
    description: resource.description,
    h1: resource.h1,
    topicCluster: resource.kind,
    searchIntent: resource.kind === "evidence" ? "evidence" : "definition",
    schemaTypes: ["WebPage", "BreadcrumbList"],
    socialImageKey: resource.slug,
    contentUpdatedAt: updated,
    breadcrumbs: [{ name: titleForHub(resource.path), path: hubPathFor(resource.kind) }],
    targetQuestions: [resource.h1],
    relatedPaths: resource.relatedPaths,
  }))
}

function titleForHub(path: string): string {
  if (path.startsWith("/evidence")) return "Evidence"
  if (path.startsWith("/methodology")) return "Methodology"
  return "Insights"
}

function hubPathFor(kind: "insight" | "evidence" | "methodology"): string {
  if (kind === "evidence") return "/evidence"
  if (kind === "methodology") return "/methodology"
  return "/insights"
}

export type PublicPath = (typeof seoRoutes)[number]["path"]

const routeMap = new Map<string, SeoRoute>(seoRoutes.map((route) => [route.path, route]))

export const indexableSeoRoutes = seoRoutes.filter((route) => route.indexable)

export function getSeoRoute(path: string): SeoRoute {
  const route = routeMap.get(path)
  if (!route) throw new Error(`Unknown SEO route: ${path}`)
  return route
}

export function getRelatedSeoRoutes(path: string): SeoRoute[] {
  return getSeoRoute(path).relatedPaths.map((relatedPath) => getSeoRoute(relatedPath))
}

export function collectSeoCopyReviewWarnings(): string[] {
  const warnings: string[] = []
  for (const route of seoRoutes) {
    if (route.title.length < 30 || route.title.length > 65) {
      warnings.push(`Review title length (${route.title.length}) for ${route.path}`)
    }
    if (route.description.length < 120 || route.description.length > 170) {
      warnings.push(`Review description length (${route.description.length}) for ${route.path}`)
    }
  }
  return warnings
}

export function validateSeoRouteManifest(): string[] {
  const errors: string[] = []
  const keys = new Set<string>()
  const paths = new Set<string>()

  for (const route of seoRoutes) {
    if (keys.has(route.key)) errors.push(`Duplicate route key: ${route.key}`)
    if (paths.has(route.path)) errors.push(`Duplicate route path: ${route.path}`)
    keys.add(route.key)
    paths.add(route.path)

    if (!route.title.trim() || !route.description.trim() || !route.h1.trim()) {
      errors.push(`Missing visible SEO copy: ${route.path}`)
    }
    if (/placeholder|example\.com|vercel\.app/i.test(`${route.title} ${route.description}`)) {
      errors.push(`Placeholder or foreign host in route: ${route.path}`)
    }
    for (const related of route.relatedPaths) {
      if (/^https?:/i.test(related) && !related.startsWith(PRODUCTION_ORIGIN)) {
        errors.push(`Foreign related URL on ${route.path}: ${related}`)
      }
      const relatedPath = related.split("#")[0] || "/"
      if (!seoRoutes.some((candidate) => candidate.path === relatedPath)) {
        errors.push(`Unknown related path on ${route.path}: ${related}`)
      }
    }
    for (const crumb of route.breadcrumbs) {
      const crumbPath = crumb.path.split("#")[0] || "/"
      if (!seoRoutes.some((candidate) => candidate.path === crumbPath)) {
        errors.push(`Unknown breadcrumb path on ${route.path}: ${crumb.path}`)
      }
    }
  }

  return errors
}
