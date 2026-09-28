import { seoResources } from "@/content/seo-resources"
import { PRODUCTION_ORIGIN } from "@/seo/policy"
import { isPublicationPromotable } from "@/seo/publication-eligibility"
import assessmentRegistry from "@/content/assessment-publications/registry.json"

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
  presentation?: "page" | "publication"
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

const updated = "2026-09-22" as const

export const seoRoutes = [
  {
    key: "home",
    path: "/",
    tier: 0,
    indexable: true,
    title: "GridNinja | Capacity Decisions with Confidence",
    description: "Make your next capacity decision with confidence. Scope a bounded assessment with authorized historical inputs, explicit constraints, and a decision brief.",
    h1: "Make your next capacity decision with confidence.",
    topicCluster: "virtual-capacity-control-plane",
    searchIntent: "brand",
    schemaTypes: ["WebPage"],
    socialImageKey: "home",
    contentUpdatedAt: "2026-07-14",
    breadcrumbs: [],
    targetQuestions: ["What is an AI Data Center Virtual Capacity Control Plane?"],
    relatedPaths: ["/platform", "/proof", "/assessment"],
  },
  {
    key: "platform",
    path: "/platform",
    tier: 0,
    indexable: true,
    title: "Virtual Capacity Control Plane Platform | GridNinja",
    description: "Explore the intended virtual capacity control-plane architecture, its evidence and authority boundaries, and the current bounded assessment offer.",
    h1: "A control-plane direction, with evidence before authority.",
    topicCluster: "platform",
    searchIntent: "definition",
    schemaTypes: ["WebPage"],
    socialImageKey: "platform",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["How does virtual capacity orchestration work inside the fence?"],
    relatedPaths: ["/platform/dispatch-envelope", "/proof", "/demo", "/dcii"],
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
    description: "Assess a proposed AI workload increment using historical inputs and declared constraints before service, time-to-power, or commercial commitments.",
    h1: "Evaluate the next workload before committing capacity.",
    topicCluster: "ai-cloud",
    searchIntent: "commercial",
    schemaTypes: ["WebPage", "BreadcrumbList"],
    socialImageKey: "ai-cloud",
    contentUpdatedAt: updated,
    breadcrumbs: [{ name: "Solutions", path: "/#solutions" }],
    targetQuestions: ["How can AI clouds accelerate time-to-power safely?"],
    relatedPaths: ["/assessment", "/solutions/bridge-power", "/proof"],
  },
  {
    key: "colocation",
    path: "/solutions/colocation",
    tier: 0,
    indexable: true,
    title: "Proof-Backed Sellable Capacity for Colocation | GridNinja",
    description: "Review a proposed tenant increment against declared facility conditions, evidence gaps, reserve policy, and the unresolved commercial decision.",
    h1: "Review the evidence before the next tenant commitment.",
    topicCluster: "colocation",
    searchIntent: "commercial",
    schemaTypes: ["WebPage", "BreadcrumbList"],
    socialImageKey: "colocation",
    contentUpdatedAt: updated,
    breadcrumbs: [{ name: "Solutions", path: "/#solutions" }],
    targetQuestions: ["How can colocation operators sell more capacity safely?"],
    relatedPaths: ["/assessment", "/proof/proof-pack", "/proof"],
  },
  {
    key: "bridge-power",
    path: "/solutions/bridge-power",
    tier: 0,
    indexable: true,
    title: "Bridge Power & DER for AI Data Centers | GridNinja",
    description: "Scope the evidence needed to investigate bridge power and DER for constrained AI infrastructure, with explicit site and commercial boundaries.",
    h1: "Define the capacity question before selecting the asset.",
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
    h1: "Evidence informs a decision. Authority stays explicit.",
    topicCluster: "proof-before-autonomy",
    searchIntent: "evidence",
    schemaTypes: ["WebPage"],
    socialImageKey: "proof",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["What does proof before autonomy mean for AI data centers?"],
    relatedPaths: ["/proof/proof-pack", "/demo", "/evidence", "/why-gridninja"],
  },
  {
    key: "why-gridninja",
    path: "/why-gridninja",
    tier: 0,
    indexable: true,
    title: "Capacity Acceptance vs DCIM & Digital Twins | GridNinja",
    description: "Understand the proposed GridNinja assessment role alongside existing monitoring, models, controls, and commercial planning, with explicit evidence limits.",
    h1: "Connect a capacity question to its evidence.",
    topicCluster: "comparison",
    searchIntent: "comparison",
    schemaTypes: ["WebPage"],
    socialImageKey: "why-gridninja",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["How is capacity acceptance different from DCIM or a digital twin?"],
    relatedPaths: ["/platform", "/proof", "/methodology/comparison-policy", "/about"],
  },
  {
    key: "proof-pack",
    path: "/proof/proof-pack",
    tier: 0,
    indexable: true,
    title: "AI Data Center Virtual Capacity Proof Pack | GridNinja",
    description: "Review the contents of a capacity decision package: profiles, conditions, model records, unknowns, review responsibilities, and publication versions.",
    h1: "A concise brief, with a traceable supporting record.",
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
    title: "Synthetic Capacity Decision Brief and Scenarios | GridNinja",
    description: "Inspect a synthetic capacity decision brief. Compare requested and revised profiles, model screening, unknowns, and the unresolved business decision.",
    h1: "See the decision, the conditions, and the unanswered question.",
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
    h1: "A research direction for proof-backed AI capacity.",
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
    key: "assessment",
    path: "/assessment",
    tier: 0,
    indexable: true,
    title: "Capacity Decision Assessment for AI Infrastructure | GridNinja",
    description: "Scope a paid, bounded capacity decision assessment using authorized historical inputs, explicit conditions, model comparisons, and a reviewable brief.",
    h1: "Scope your next capacity decision.",
    topicCluster: "capacity-audit",
    searchIntent: "commercial",
    schemaTypes: ["WebPage", "Service"],
    socialImageKey: "capacity-audit",
    contentUpdatedAt: updated,
    breadcrumbs: [],
    targetQuestions: ["What does an AI data center Capacity Audit measure?"],
    relatedPaths: ["/contact", "/data-handling", "/methodology/capacity-audit"],
  },
  {
    key: "about",
    path: "/about",
    tier: 1,
    indexable: true,
    title: "About GridNinja | Proof-First AI Infrastructure",
    description: "Understand GridNinja’s current historical-data assessment offer, demonstrated synthetic work, delivery responsibilities, and conditional platform direction.",
    h1: "Building a defensible basis for capacity decisions.",
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
    title: "Scope a Capacity Assessment | Contact GridNinja",
    description: "Start a scoping conversation about a bounded capacity assessment, input readiness, deliverables, decision responsibilities, or a partner investigation.",
    h1: "Tell us where capacity is constrained.",
    topicCluster: "conversion",
    searchIntent: "commercial",
    schemaTypes: ["WebPage"],
    socialImageKey: "contact",
    contentUpdatedAt: "2026-07-15",
    breadcrumbs: [],
    targetQuestions: ["How do I request a GridNinja Capacity Audit?"],
    relatedPaths: ["/proof"],
  },
  {
    key: "contact-thanks",
    path: "/contact/thanks",
    tier: 2,
    indexable: false,
    title: "Check Your Inquiry Receipt | GridNinja",
    description: "Check a confirmed GridNinja inquiry receipt or return to the contact form. Visiting this page alone does not establish that an inquiry was received.",
    h1: "Check your inquiry receipt.",
    topicCluster: "conversion",
    searchIntent: "commercial",
    schemaTypes: ["WebPage", "BreadcrumbList"],
    socialImageKey: "contact",
    contentUpdatedAt: "2026-07-15",
    breadcrumbs: [{ name: "Contact", path: "/contact" }],
    targetQuestions: ["What happens after a GridNinja capacity assessment request?"],
    relatedPaths: ["/proof"],
  },
  {
    key: "data-handling", path: "/data-handling", tier: 1, indexable: true,
    title: "Assessment Data Handling and Permissions | GridNinja",
    description: "Understand inquiry handling, historical input permissions, separate operational-data exchange, and the responsibilities to agree before sharing site data.",
    h1: "Agree the data boundary before sharing operational inputs.", topicCluster: "assessment", searchIntent: "commercial",
    schemaTypes: ["WebPage"], socialImageKey: "data-handling", contentUpdatedAt: updated, breadcrumbs: [],
    targetQuestions: ["How are assessment inputs and inquiry details handled?"], relatedPaths: ["/assessment", "/contact", "/methodology"],
  },
  ...makeAssessmentPublicationRoutes(),
  ...makeHubRoutes(),
  ...makeResourceRoutes(),
] as const satisfies readonly SeoRoute[]

function makeAssessmentPublicationRoutes(): SeoRoute[] {
  return [
    ["a", "Request fits the modeled conditions"],
    ["b", "A smaller commitment needs review"],
    ["c", "No admissible revision under the stated minimum"],
    ["d", "Missing evidence prevents assessment"],
  ].map(([scenario, h1]) => ({
    presentation: "publication", key: `assessment-publication-${scenario}`, path: `/evidence/assessments/demo-01-${scenario}/v1.0.0`, tier: 2, indexable: false,
    title: `GridNinja decision brief — scenario ${scenario.toUpperCase()} v1.0.0`,
    description: `Synthetic DEMO-01 scenario ${scenario.toUpperCase()} decision brief, publication v1.0.0. Model screening does not establish operating permission or a customer outcome.`,
    h1, topicCluster: "assessment-evidence", searchIntent: "evidence", schemaTypes: ["WebPage"], socialImageKey: "assessment", contentUpdatedAt: updated,
    breadcrumbs: [], targetQuestions: ["What does this synthetic capacity assessment conclude?"], relatedPaths: ["/demo", "/assessment", "/evidence"],
  }))
}

function makeHubRoutes(): SeoRoute[] {
  return [
    hub("insights", "/insights", "Virtual Capacity Insights for AI Data Centers | GridNinja", "Technical explainers for virtual capacity, runtime assurance, Shadow Mode, time-to-power, and cross-domain constraints.", "Virtual capacity insights for constrained AI infrastructure", "definition", ["/platform", "/evidence", "/assessment"]),
    hub("evidence", "/evidence", "Virtual Capacity Evidence Library | GridNinja", "Publication-gated methods, synthetic traces, ledgers, specifications, and proof artifacts for evaluating virtual capacity claims.", "Evidence for safe, usable, auditable capacity", "evidence", ["/proof", "/insights", "/methodology"]),
    hub("methodology", "/methodology", "GridNinja Claims, Evidence & Capacity Methods", "How GridNinja governs claims, comparisons, corrections, evidence maturity, and Capacity Audit methods.", "Methods for claims that operators can defend", "evidence", ["/proof", "/evidence", "/assessment"]),
  ]
}

function hub(key: string, path: `/${string}`, title: string, description: string, h1: string, searchIntent: SearchIntent, relatedPaths: readonly string[]): SeoRoute {
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
    relatedPaths,
  }
}

function makeResourceRoutes(): SeoRoute[] {
  return seoResources.map((resource) => ({
    key: resource.slug,
    path: resource.path,
    tier: 2,
    indexable: false,
    title: resource.title,
    description: resource.publicationStatus === "published" ? resource.description : `This GridNinja resource is not yet published. Read the available synthetic decision briefs and inspect their assumptions, results, and limitations.`,
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
const resourceMap = new Map<string, (typeof seoResources)[number]>(seoResources.map(resource => [resource.path, resource]))
const publishedAssessmentPaths = new Set(assessmentRegistry.filter(entry => entry.status === "available").map(entry => `/evidence/assessments/${entry.publicationId}/${entry.version}`))

export const indexableSeoRoutes = seoRoutes.filter((route) => route.indexable)

export function getSeoRoute(path: string): SeoRoute {
  const route = routeMap.get(path)
  if (!route) throw new Error(`Unknown SEO route: ${path}`)
  return route
}

export function getRelatedSeoRoutes(path: string): SeoRoute[] {
  return getSeoRoute(path).relatedPaths.filter(relatedPath => {
    const resource = resourceMap.get(relatedPath)
    if (getSeoRoute(relatedPath).presentation === "publication") return publishedAssessmentPaths.has(relatedPath)
    return !resource || isPublicationPromotable(resource.publicationStatus)
  }).map((relatedPath) => getSeoRoute(relatedPath))
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
    const relatedPaths = new Set<string>()
    for (const related of route.relatedPaths) {
      if (relatedPaths.has(related)) {
        errors.push(`Duplicate related path on ${route.path}: ${related}`)
      }
      if (related === route.path) {
        errors.push(`Self-related path on ${route.path}: ${related}`)
      }
      relatedPaths.add(related)
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
