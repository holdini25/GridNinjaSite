import "server-only"

/** External research context, kept separate from GridNinja outcome claims. */
export type ResearchId =
  | "colangelo-grid-assets-2026"
  | "senga-flexibility-tradeoffs-2026"
  | "siddik-water-footprint-2021"
  | "radovanovic-carbon-aware-2023"
  | "heering-public-support-2026"
  | "wahlroos-heat-reuse-2017"
  | "wabersich-safety-filter-2021"

export type ResearchStudyType =
  | "field-demonstration"
  | "power-system-modeling"
  | "spatial-footprint-modeling"
  | "production-system-evaluation"
  | "survey-experiment"
  | "district-heating-modeling"
  | "control-theory-and-simulation"

export interface ResearchSource {
  id: ResearchId
  title: string
  authors: readonly string[]
  venue: string
  volume: string
  issue: string | null
  pagesOrArticleNumber: string
  citationYear: number
  issueDate: string // ISO year, month or day; retain source precision.
  onlinePublicationDate: string | null // Verified primary date only, ISO day.
  versionOfRecordDate: string | null
  dateNote: string
  doi: string
  primaryUrl: string
  supportingPrimaryUrls: readonly string[]
  publicationStatus: "published-peer-reviewed-journal-article"
  publicationStatusBasis: string
  studyType: ResearchStudyType
  setting: {
    geography: string
    systemOrPopulation: string
    observationPeriod: string | null
  }
  supportedMarketingSentence: string
  limitations: readonly string[]
  bibliographyHref: "/evidence#research"
  contextualPlacements: readonly string[]
  reviewedOn: "2026-10-10"
  verification: {
    contentReviewed: string
    accessLimitations: string
    metadataSources: readonly string[]
    notAudited: readonly string[]
  }
  updateReview: ResearchUpdateReview
  conflictsOrInterests: string
  homepageNote: {
    topic: string
    order: 1 | 2 | 3
    text: string
    adjacentLimitation: string
    linkLabel: string
  } | null
  permittedRole: "external-research-context"
  gridNinjaOutcomeEvidence: false
  figureReuseApproved: false
  publicReleaseStatus: "reviewed-for-publication"
}

export interface ResearchUpdateReview {
  checkedOn: "2026-10-10"
  crossmarkUrl: string
  crossmarkStatus: "current" | "unavailable"
  noticeSearchResult: "no-notice-found-in-checked-sources"
  scope: string
}

function updateReview(doi: string, crossmarkStatus: ResearchUpdateReview["crossmarkStatus"]): ResearchUpdateReview {
  return {
    checkedOn: "2026-10-10",
    crossmarkUrl: `https://crossmark.crossref.org/dialog-content?doi=${encodeURIComponent(doi)}&domain=pdf`,
    crossmarkStatus,
    noticeSearchResult: "no-notice-found-in-checked-sources",
    scope: "Publisher-deposited Crossref metadata, Crossmark status and targeted notice searches were checked. These checks do not establish that no correction or retraction exists outside the accessed records.",
  }
}

const common = {
  publicationStatus: "published-peer-reviewed-journal-article",
  reviewedOn: "2026-10-10",
  permittedRole: "external-research-context",
  gridNinjaOutcomeEvidence: false,
  figureReuseApproved: false,
  bibliographyHref: "/evidence#research",
  publicReleaseStatus: "reviewed-for-publication",
} as const

export const researchCatalog = [
  {
    ...common,
    id: "colangelo-grid-assets-2026",
    title: "AI data centres as grid-interactive assets",
    authors: ["Philip Colangelo", "Ayse K. Coskun", "Jack Megrue", "Ciaran Roberts", "Shayan Sengupta", "Varun Sivaram", "Ethan Tiao", "Aroon Vijaykar", "Chris Williams", "Daniel C. Wilson", "Brandon Records", "Zack MacFarland", "Daniel Dreiling", "Nathan Morey", "Anuja Ratnayake", "Baskar Vairamohan"],
    venue: "Nature Energy",
    volume: "11",
    issue: "2",
    pagesOrArticleNumber: "254–261",
    citationYear: 2026,
    issueDate: "2026-02",
    onlinePublicationDate: "2025-12-05",
    versionOfRecordDate: "2025-12-05",
    dateNote: "Cite the 2026 volume; the online version and DOI carry 2025.",
    doi: "10.1038/s41560-025-01927-1",
    updateReview: updateReview("10.1038/s41560-025-01927-1", "current"),
    primaryUrl: "https://www.nature.com/articles/s41560-025-01927-1",
    supportingPrimaryUrls: [],
    publicationStatusBasis: "Publisher version of record with explicit peer-review acknowledgement.",
    studyType: "field-demonstration",
    setting: { geography: "Phoenix, Arizona, United States", systemOrPopulation: "One 256-GPU cluster with representative AI workloads", observationPeriod: "Three-hour peak-demand demonstration" },
    supportedMarketingSentence: "An external field trial shows that eligible AI workloads can provide bounded power flexibility while meeting the tested service requirements.",
    limitations: ["Selected cluster and workloads, not a campus-wide guarantee.", "No GridNinja result or measured community benefit.", "The external 25% result must not be attached to a GridNinja capacity metric."],
    contextualPlacements: ["/", "/evidence#research", "/why-gridninja"],
    verification: {
      contentReviewed: "Publisher abstract, metadata, affiliations and competing-interest statement.",
      accessLimitations: "Public publisher material reviewed; unrestricted full-method access and commercial figure rights not established.",
      metadataSources: ["https://www.nature.com/articles/s41560-025-01927-1", "https://api.crossref.org/works/10.1038/s41560-025-01927-1"],
      notAudited: ["Complete methods", "Supplements", "Raw data", "Code"],
    },
    conflictsOrInterests: "Emerald AI-led work; disclosed employment, equity and pending-patent interests. No GridNinja endorsement is implied.",
    homepageNote: { topic: "Bounded flexibility", order: 1, text: "A 256-GPU field trial demonstrated bounded power reduction while preserving the tested service requirements.", adjacentLimitation: "External research on one cluster; not a GridNinja result or a whole-site guarantee.", linkLabel: "Nature Energy · 2026" },
  },
  {
    ...common,
    id: "senga-flexibility-tradeoffs-2026",
    title: "Flexible data centers reduce power system costs but can increase emissions",
    authors: ["Juan Ramon L. Senga", "Shen Wang", "Christopher R. Knittel"],
    venue: "iScience",
    volume: "29",
    issue: "7",
    pagesOrArticleNumber: "116497",
    citationYear: 2026,
    issueDate: "2026-07",
    onlinePublicationDate: null,
    versionOfRecordDate: null,
    dateNote: "PubMed indexes 2026-06-26 online and 2026-07-17 collection; exact online day not independently confirmed in accessible primary metadata.",
    doi: "10.1016/j.isci.2026.116497",
    updateReview: updateReview("10.1016/j.isci.2026.116497", "current"),
    primaryUrl: "https://www.sciencedirect.com/science/article/pii/S2589004226018729",
    supportingPrimaryUrls: ["https://mitsloan.mit.edu/centers-initiatives/climate-policy-center/improving-electric-grid"],
    publicationStatusBasis: "Published iScience research article; publisher, MIT research listing and Crossref identify the journal version.",
    studyType: "power-system-modeling",
    setting: { geography: "Texas, Mid-Atlantic and Western Interconnection, United States", systemOrPopulation: "Regional investment and dispatch scenarios with varying temporal flexibility", observationPeriod: "Modeled 2030 scenarios" },
    supportedMarketingSentence: "In modeled U.S. power systems, temporal flexibility lowered system costs, while emissions outcomes depended on regional conditions.",
    limitations: ["Scenario modeling, not observed household bills or site economics.", "Flexibility is treated as cost-free in the model.", "Emissions increased in some modeled regional settings."],
    contextualPlacements: ["/", "/evidence#research", "/methodology"],
    verification: {
      contentReviewed: "Publicly indexed publisher summary, results, discussion and model-assumption text.",
      accessLimitations: "Direct ScienceDirect/Cell retrieval returned 403; indexed publisher sections were accessible. Exact primary online date remains unverified.",
      metadataSources: ["https://www.sciencedirect.com/science/article/pii/S2589004226018729", "https://api.crossref.org/works/10.1016/j.isci.2026.116497"],
      notAudited: ["Supplements", "Model files", "Reproduction of scenarios"],
    },
    conflictsOrInterests: "No independence claim made; competing-interest details were not specifically audited.",
    homepageNote: { topic: "Emissions tradeoffs", order: 2, text: "Power-system modeling finds that flexibility can lower system costs while emissions depend on the regional generation mix.", adjacentLimitation: "Emissions increased in some modeled settings. Household bill savings and GridNinja economics are not established.", linkLabel: "iScience · 2026" },
  },
  {
    ...common,
    id: "siddik-water-footprint-2021",
    title: "The environmental footprint of data centers in the United States",
    authors: ["Md Abu Bakar Siddik", "Arman Shehabi", "Landon Marston"],
    venue: "Environmental Research Letters",
    volume: "16",
    issue: "6",
    pagesOrArticleNumber: "064017",
    citationYear: 2021,
    issueDate: "2021-06",
    onlinePublicationDate: "2021-05-21",
    versionOfRecordDate: null,
    dateNote: "Online May 2021; June issue. Institution-hosted journal PDF supplies article history.",
    doi: "10.1088/1748-9326/abfba1",
    updateReview: updateReview("10.1088/1748-9326/abfba1", "current"),
    primaryUrl: "https://escholarship.org/uc/item/3xw3z2qp",
    supportingPrimaryUrls: ["https://escholarship.org/content/qt3xw3z2qp/qt3xw3z2qp.pdf", "https://iopscience.iop.org/article/10.1088/1748-9326/abfba1"],
    publicationStatusBasis: "Published journal PDF records revision, acceptance and publication; Crossref corroborates citation.",
    studyType: "spatial-footprint-modeling",
    setting: { geography: "United States", systemOrPopulation: "Data-center cooling, electricity supply and watershed-level water stress", observationPeriod: null },
    supportedMarketingSentence: "Water responsibility requires considering both site cooling and the electricity supply in their local resource context.",
    limitations: ["Historical modeled estimates, not a 2026 inventory.", "No site-specific hydrological conclusion or GridNinja water savings.", "Do not reuse historical national percentages as current facts."],
    contextualPlacements: ["/", "/methodology", "/about"],
    verification: {
      contentReviewed: "Journal abstract/header and institutional publication record.",
      accessLimitations: "Public institutional PDF available; complete geospatial inputs and calculations not reproduced.",
      metadataSources: ["https://escholarship.org/uc/item/3xw3z2qp", "https://api.crossref.org/works/10.1088/1748-9326/abfba1"],
      notAudited: ["Complete input-data vintages", "Geospatial calculations"],
    },
    conflictsOrInterests: "No independence claim made; competing-interest details were not specifically audited.",
    homepageNote: { topic: "Local water", order: 3, text: "U.S. research links data-center water impacts to cooling, electricity generation, and local water stress.", adjacentLimitation: "Historical spatial modeling; not a current inventory or a site-specific water assessment.", linkLabel: "Environmental Research Letters · 2021" },
  },
  {
    ...common,
    id: "radovanovic-carbon-aware-2023",
    title: "Carbon-Aware Computing for Datacenters",
    authors: ["Ana Radovanović", "Ross Koningstein", "Ian Schneider", "Bokan Chen", "Alexandre Duarte", "Binz Roy", "Diyue Xiao", "Maya Haridasan", "Patrick Hung", "Nick Care", "Saurav Talukdar", "Eric Mullen", "Kendal Smith", "MariEllen Cottman", "Walfredo Cirne"],
    venue: "IEEE Transactions on Power Systems",
    volume: "38",
    issue: "2",
    pagesOrArticleNumber: "1270–1280",
    citationYear: 2023,
    issueDate: "2023-03",
    onlinePublicationDate: "2022-05-06",
    versionOfRecordDate: null,
    dateNote: "IEEE online date is 2022; issue citation is 2023. Do not substitute the 2021 arXiv date.",
    doi: "10.1109/TPWRS.2022.3173250",
    updateReview: updateReview("10.1109/TPWRS.2022.3173250", "unavailable"),
    primaryUrl: "https://ieeexplore.ieee.org/abstract/document/9770383",
    supportingPrimaryUrls: [],
    publicationStatusBasis: "IEEE Transactions journal record, corroborated by Crossref; not the earlier preprint.",
    studyType: "production-system-evaluation",
    setting: { geography: "Google's distributed data-center fleet", systemOrPopulation: "Eligible temporally flexible workloads under forecast-informed hourly capacity limits", observationPeriod: null },
    supportedMarketingSentence: "Production research shows that temporally flexible computing can be scheduled around carbon signals while preserving a daily completion objective.",
    limitations: ["Completion requirement is probabilistic and limited to eligible workloads.", "No general SLA guarantee, congestion relief or water benefit follows.", "No evidence that GridNinja has implemented this system."],
    contextualPlacements: ["/solutions/ai-cloud", "/platform", "/methodology"],
    verification: {
      contentReviewed: "IEEE abstract and bibliographic metadata.",
      accessLimitations: "University-hosted PDF indexed but direct retrieval failed; full methods and implementation not reviewed.",
      metadataSources: ["https://ieeexplore.ieee.org/abstract/document/9770383", "https://api.crossref.org/works/10.1109/TPWRS.2022.3173250"],
      notAudited: ["Full methods", "Fleet-level results", "Implementation"],
    },
    conflictsOrInterests: "Authors report on Google's production system; do not describe this as independent validation of GridNinja.",
    homepageNote: null,
  },
  {
    ...common,
    id: "heering-public-support-2026",
    title: "How sovereign control, decarbonization and energy costs shape public support for data centers",
    authors: ["Jonas Heering", "Erik Voeten"],
    venue: "Nature Communications",
    volume: "17",
    issue: "1",
    pagesOrArticleNumber: "9576",
    citationYear: 2026,
    issueDate: "2026",
    onlinePublicationDate: "2026-08-10",
    versionOfRecordDate: "2026-09-08",
    dateNote: "First published 10 August 2026; the current publisher page dates the version of record 8 September 2026.",
    doi: "10.1038/s41467-026-76500-9",
    updateReview: updateReview("10.1038/s41467-026-76500-9", "current"),
    primaryUrl: "https://www.nature.com/articles/s41467-026-76500-9",
    supportingPrimaryUrls: [],
    publicationStatusBasis: "Publisher article acknowledges peer reviewers and links peer-review material.",
    studyType: "survey-experiment",
    setting: { geography: "Germany", systemOrPopulation: "Public vignette and conjoint survey experiments concerning data-center proposals", observationPeriod: "July 2025 survey" },
    supportedMarketingSentence: "In a German survey experiment, power prices, water strain, energy sources and operator ownership influenced preferences over data-center proposals.",
    limitations: ["Stated preferences in Germany, not U.S. community consent or permitting outcomes.", "Ownership was especially influential; do not omit it when interpreting the findings.", "Does not test GridNinja's message or establish conversion uplift."],
    contextualPlacements: ["/about", "/insights"],
    verification: {
      contentReviewed: "Publisher abstract, results, discussion, methods, metadata and interest declaration.",
      accessLimitations: "Public full-text sections available; microdata, code and peer-review correspondence not reanalyzed.",
      metadataSources: ["https://www.nature.com/articles/s41467-026-76500-9", "https://api.crossref.org/works/10.1038/s41467-026-76500-9"],
      notAudited: ["Survey microdata", "Code", "Peer-review correspondence"],
    },
    conflictsOrInterests: "Publisher states that the authors declare no competing interests.",
    homepageNote: null,
  },
  {
    ...common,
    id: "wahlroos-heat-reuse-2017",
    title: "Utilizing data center waste heat in district heating – Impacts on energy efficiency and prospects for low-temperature district heating networks",
    authors: ["Mikko Wahlroos", "Matti Pärssinen", "Jukka Manner", "Sanna Syri"],
    venue: "Energy",
    volume: "140",
    issue: null,
    pagesOrArticleNumber: "1228–1238",
    citationYear: 2017,
    issueDate: "2017-12-01",
    onlinePublicationDate: "2017-08-29",
    versionOfRecordDate: null,
    dateNote: "Journal PDF gives online 29 August; Aalto's publication date is 1 December 2017.",
    doi: "10.1016/j.energy.2017.08.078",
    updateReview: updateReview("10.1016/j.energy.2017.08.078", "current"),
    primaryUrl: "https://aaltodoc.aalto.fi/items/12e423b5-3275-4713-a068-ef3813225666",
    supportingPrimaryUrls: ["https://acris.aalto.fi/ws/portalfiles/portal/17305461/1_s2.0_S0360544217314548_main.pdf"],
    publicationStatusBasis: "Institution-hosted version-of-record journal PDF includes revision/acceptance history; Crossref corroborates citation.",
    studyType: "district-heating-modeling",
    setting: { geography: "Espoo, Finland", systemOrPopulation: "District-heating production model with actual plant/heat-demand data and an existing data-center load profile", observationPeriod: "2013 and 2015 heat-system data" },
    supportedMarketingSentence: "A Finnish case study shows how data-center waste heat can contribute to district heating when the local system and commercial conditions fit.",
    limitations: ["Local demand, temperatures, equipment, network and counterparties determine applicability.", "Do not transfer the study's economics into GridNinja examples.", "Heat reuse is a conditional ecosystem opportunity, not a shipped capability or default assessment deliverable."],
    contextualPlacements: ["/about", "/insights"],
    verification: {
      contentReviewed: "Journal title page, abstract and introductory methodological sections; Aalto article record.",
      accessLimitations: "Institution-hosted full PDF available; simulation not reproduced. CC BY-NC-ND does not authorize commercial figure adaptation.",
      metadataSources: ["https://aaltodoc.aalto.fi/items/12e423b5-3275-4713-a068-ef3813225666", "https://api.crossref.org/works/10.1016/j.energy.2017.08.078"],
      notAudited: ["Simulation reproduction", "Current project economics"],
    },
    conflictsOrInterests: "Four authors confirmed by article PDF, Aalto record and Crossref; disregard a separate dissertation listing that adds Rinne. Competing interests not specifically audited.",
    homepageNote: null,
  },
  {
    ...common,
    id: "wabersich-safety-filter-2021",
    title: "A predictive safety filter for learning-based control of constrained nonlinear dynamical systems",
    authors: ["Kim Peter Wabersich", "Melanie N. Zeilinger"],
    venue: "Automatica",
    volume: "129",
    issue: null,
    pagesOrArticleNumber: "109597",
    citationYear: 2021,
    issueDate: "2021-07",
    onlinePublicationDate: null,
    versionOfRecordDate: null,
    dateNote: "Exact initial online day not verified. Use July 2021 journal citation, not the 2018 preprint date.",
    doi: "10.1016/j.automatica.2021.109597",
    updateReview: updateReview("10.1016/j.automatica.2021.109597", "current"),
    primaryUrl: "https://www.sciencedirect.com/science/article/pii/S0005109821001175",
    supportingPrimaryUrls: [],
    publicationStatusBasis: "Published Automatica journal article; publisher record and Crossref distinguish it from the 2018 preprint.",
    studyType: "control-theory-and-simulation",
    setting: { geography: "Not applicable: theoretical work and simulations", systemOrPopulation: "Constrained nonlinear control with pendulum and quadrotor simulation examples", observationPeriod: null },
    supportedMarketingSentence: "Safety-filter research separates proposed actions from constraint checks that can modify an action before execution.",
    limitations: ["Guarantees depend on model and uncertainty assumptions.", "Not data-center field validation or GridNinja certification.", "Supports the runtime-assurance development direction, not a claim of shipped autonomous control."],
    contextualPlacements: ["/proof", "/methodology", "/platform/dispatch-envelope"],
    verification: {
      contentReviewed: "Publisher abstract, introduction and conclusion preview.",
      accessLimitations: "Some full content requires subscription access; full proof details and experiment files not reviewed.",
      metadataSources: ["https://www.sciencedirect.com/science/article/pii/S0005109821001175", "https://api.crossref.org/works/10.1016/j.automatica.2021.109597"],
      notAudited: ["Full mathematical proofs", "Experiment files"],
    },
    conflictsOrInterests: "No independence claim made; competing-interest details were not specifically audited.",
    homepageNote: null,
  },
] as const satisfies readonly ResearchSource[]

export const researchStripFooter =
  "External research informs the direction. GridNinja currently offers bounded assessments using authorized historical inputs."

/** Visible limitations travel with their exact sentence in both renderers. */
export const researchPresentation = {
  sectionHeading: "Research informing the direction",
  introduction: "Peer-reviewed research helps frame the questions. It does not validate GridNinja's models, demonstrate customer outcomes, or confer operating authority.",
  fullBibliographyHref: "/evidence#research",
  fullBibliographyLinkLabel: "Read the research and its limits",
  bibliographySectionRole: "External research, separate from GridNinja publication evidence",
  supplementaryMethodologyHref: "/methodology",
  fullBibliographyRequiresGate: false,
  contextualPlacementsMustAlreadyBePublic: true,
  gatedPagePromotionAuthorized: false,
  externalClaimMapping: "Exact external sentence to stable research-catalog ID, setting and limitation",
  gridNinjaClaimMapping: "Existing PublicClaim registry for actual GridNinja claims only",
  homepageOrder: ["colangelo-grid-assets-2026", "senga-flexibility-tradeoffs-2026", "siddik-water-footprint-2021"],
  requireVisibleLimitations: true,
  serverRenderedCitations: true,
  publisherLogos: false,
  figuresCopiedFromPapers: false,
  primaryCta: "Scope an assessment",
  secondaryCta: "See a sample decision brief",
  publicReleaseRequires: ["External sentence-to-research-catalog mapping", "Existing PublicClaim registry mapping for any actual GridNinja claims", "Editorial review of surrounding copy", "Link/version/correction and public-availability check"],
} as const

export const researchStudyLabels: Record<ResearchStudyType, string> = {
  "field-demonstration": "Field demonstration",
  "power-system-modeling": "Power-system modeling",
  "spatial-footprint-modeling": "Spatial footprint modeling",
  "production-system-evaluation": "Production-system evaluation",
  "survey-experiment": "Survey experiment",
  "district-heating-modeling": "District-heating modeling",
  "control-theory-and-simulation": "Control theory and simulation",
}

export function formatResearchCitation(source: ResearchSource) {
  const issue = source.issue ? `(${source.issue})` : ""
  return `${source.venue} ${source.volume}${issue}, ${source.pagesOrArticleNumber} (${source.citationYear}).`
}

export const homepageResearch = researchPresentation.homepageOrder.map(id => {
  const source = researchCatalog.find(entry => entry.id === id)
  if (!source?.homepageNote) throw new Error(`Missing homepage research note: ${id}`)
  return source
})
