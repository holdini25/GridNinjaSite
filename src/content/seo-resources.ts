export type SeoResourceKind = "insight" | "evidence" | "methodology"

export type SeoPrimarySource = {
  label: string
  href: string
  organization: string
}

export type SeoEvidenceRecord = {
  claim: string
  maturity: "DESIGN TARGET" | "REPLAY-VALIDATED" | "SHADOW-VALIDATED"
  environment: "synthetic" | "replay" | "shadow"
  measurementWindow: string
  sampleSize: string
  version: string
  artifactHash: string
  assumptions: readonly string[]
  method: readonly string[]
  result: string
  uncertainty: string
  negativeCases: readonly string[]
  reproduction: readonly string[]
  downloadHref: string
  interpretation: string
  technicalOwner: string
  reviewer: string
  nextReviewDate: string
}

export type SeoResource = {
  kind: SeoResourceKind
  slug: string
  path: `/insights/${string}` | `/evidence/${string}` | `/methodology/${string}`
  title: string
  description: string
  eyebrow: string
  h1: string
  shortAnswer: string
  definition: string
  notDefinition: string
  operationalSignificance: string
  mechanism: readonly string[]
  example: {
    label: string
    summary: string
    synthetic: boolean
  }
  textDiagram: string
  evidenceLinks: readonly { label: string; href: string }[]
  failureCases: readonly string[]
  limitations: readonly string[]
  primarySources: readonly SeoPrimarySource[]
  relatedPaths: readonly string[]
  publicationStatus: "gated" | "published"
  authorSlug?: string
  reviewerSlug?: string
  evidence?: SeoEvidenceRecord
}

const nistAiRmf: SeoPrimarySource = {
  label: "Artificial Intelligence Risk Management Framework",
  href: "https://www.nist.gov/itl/ai-risk-management-framework",
  organization: "NIST",
}

const nistOta: SeoPrimarySource = {
  label: "NIST SP 800-82 Rev. 3: Operational Technology Security",
  href: "https://csrc.nist.gov/pubs/sp/800/82/r3/final",
  organization: "NIST",
}

const provO: SeoPrimarySource = {
  label: "PROV-O: The PROV Ontology",
  href: "https://www.w3.org/TR/prov-o/",
  organization: "W3C",
}

const jsonCanonicalization: SeoPrimarySource = {
  label: "RFC 8785: JSON Canonicalization Scheme",
  href: "https://www.rfc-editor.org/rfc/rfc8785",
  organization: "IETF",
}

const openTelemetry: SeoPrimarySource = {
  label: "OpenTelemetry specification",
  href: "https://opentelemetry.io/docs/specs/",
  organization: "Cloud Native Computing Foundation",
}

const syntheticNotice =
  "Synthetic illustrative scenario—not a customer or production result."

export const seoResources: readonly SeoResource[] = [
  {
    kind: "insight",
    slug: "virtual-capacity-control-plane",
    path: "/insights/virtual-capacity-control-plane",
    title: "What Is a Virtual Capacity Control Plane? | GridNinja",
    description:
      "A precise definition of the AI Data Center Virtual Capacity Control Plane, its authority boundary, and how it converts constrained infrastructure into auditable capacity.",
    eyebrow: "Category definition",
    h1: "What is a virtual capacity control plane?",
    shortAnswer:
      "An AI Data Center Virtual Capacity Control Plane is an inside-the-fence capacity-acceptance layer. It coordinates workloads, cooling, storage, and on-site power, then uses runtime assurance to allow, repair, or reject proposed actions inside explicit safety and SLA envelopes. Its output is proof-backed virtual capacity—not a forecast, dashboard score, or promise of unconstrained power.",
    definition:
      "The control plane continuously evaluates whether requested capacity can be admitted and dispatched across coupled facility constraints. It binds every accepted action to a dispatch envelope, margin-to-limit record, and replayable proof artifact.",
    notDefinition:
      "It is not a DCIM replacement, generic energy management system, demand-response aggregator, or digital twin category. Those systems can supply observations or models; they do not, by themselves, accept capacity under a deterministic runtime authority boundary.",
    operationalSignificance:
      "Operators need a defensible answer to a concrete question: which additional MW can be used now, for this workload and duration, without violating facility limits or protected SLAs? A capacity control plane makes that answer inspectable before bounded autonomy expands.",
    mechanism: [
      "Observe topology, workload demand, thermal state, reserve posture, and telemetry freshness.",
      "Construct candidate actions across workloads, cooling, storage, and bridge-power assets.",
      "Evaluate candidates against the dispatch envelope and binding constraints.",
      "Allow, repair, reject, or return no-proof; record evidence and remaining margin.",
      "Replay the decision in Shadow Mode before any authority expansion.",
    ],
    example: {
      label: "Synthetic acceptance example",
      summary: `${syntheticNotice} A request for additional AI workload is repaired to a smaller, time-bounded action because the reserve floor becomes the binding constraint. The accepted action carries its constraint trace and rollback posture.`,
      synthetic: true,
    },
    textDiagram:
      "Telemetry and topology → candidate capacity request → cross-domain model → runtime assurance gate → allow / repair / reject / no-proof → accepted-headroom ledger and proof pack.",
    evidenceLinks: [
      { label: "Virtual Capacity Proof Test", href: "/evidence/virtual-capacity-proof-test" },
      { label: "Accepted-headroom ledger", href: "/evidence/accepted-headroom-ledger" },
      { label: "Dispatch Envelope platform page", href: "/platform/dispatch-envelope" },
    ],
    failureCases: [
      "Telemetry is stale or internally inconsistent.",
      "The modeled topology does not match the operating topology.",
      "A reserve, thermal, water, or SLA margin cannot be proven.",
      "The rollback path is unavailable or outside the permitted authority boundary.",
    ],
    limitations: [
      "Virtual capacity cannot substitute for physical interconnection, equipment, fuel, cooling, or maintenance capacity.",
      "An accepted action is scoped to its stated topology, operating window, policy, and evidence freshness.",
      "The control plane begins in Shadow Mode and does not imply autonomous control authority.",
    ],
    primarySources: [nistAiRmf, nistOta, provO],
    relatedPaths: ["/platform", "/proof", "/roi"],
    publicationStatus: "gated",
  },
  {
    kind: "insight",
    slug: "proof-adjusted-data-center-capacity",
    path: "/insights/proof-adjusted-data-center-capacity",
    title: "Proof-Adjusted Data Center Capacity | GridNinja",
    description:
      "How proof-adjusted capacity separates nameplate, modeled, claimed, and accepted headroom for safer sellable MW decisions.",
    eyebrow: "Capacity accounting",
    h1: "Proof-adjusted capacity starts where nominal headroom stops",
    shortAnswer:
      "Proof-adjusted data center capacity is the portion of modeled headroom that survives evidence, constraint, and authority checks for a defined operating window. It discounts capacity that depends on stale telemetry, unverified topology, missing reserves, unsupported recovery assumptions, or unapproved control authority. The result is a smaller but defensible quantity for operations, commercial planning, and SLA protection.",
    definition:
      "Proof adjustment is a capacity-accounting method: begin with a physical or modeled ceiling, subtract committed load and policy reserves, then exclude any residual headroom whose dependencies cannot be demonstrated at decision time.",
    notDefinition:
      "It is not a generic derating factor, a single utilization target, or a guaranteed commercial yield. It is a scoped acceptance result whose evidence must travel with the number.",
    operationalSignificance:
      "Commercial teams can distinguish forecastable capacity from capacity that facilities teams can actually defend. Operators gain a ledger showing what was accepted, which constraint bound it, what margin remained, and when the evidence expires.",
    mechanism: [
      "Establish the physical, contractual, and policy ceilings for the requested window.",
      "Reconcile current commitments and cross-domain reserves.",
      "Test telemetry freshness, topology agreement, recovery behavior, and authority.",
      "Record accepted headroom with its proof dependencies and expiry conditions.",
    ],
    example: {
      label: "Synthetic waterfall",
      summary: `${syntheticNotice} Modeled headroom is reduced by thermal reserve, storage state-of-charge protection, and an unproven rebound assumption. Only the surviving quantity is entered in the accepted-headroom ledger.`,
      synthetic: true,
    },
    textDiagram:
      "Physical ceiling − committed load − policy reserves = modeled headroom; modeled headroom − unproven dependencies = proof-adjusted accepted headroom.",
    evidenceLinks: [
      { label: "Accepted-headroom ledger", href: "/evidence/accepted-headroom-ledger" },
      { label: "Claims and evidence method", href: "/methodology/claims-and-evidence" },
      { label: "Sample proof pack", href: "/proof/proof-pack" },
    ],
    failureCases: [
      "The accounting mixes nameplate, contractual, and dispatchable capacity.",
      "Reserve deductions are hidden or applied after a commercial claim is made.",
      "A changing operating window is presented as persistent capacity.",
    ],
    limitations: [
      "The result is not transferable across sites or operating windows without re-evaluation.",
      "Capacity remains subject to physical asset availability and operator authority.",
      "Commercial treatment requires separate contractual and regulatory review.",
    ],
    primarySources: [provO, jsonCanonicalization, nistAiRmf],
    relatedPaths: ["/roi", "/proof/proof-pack", "/why-gridninja"],
    publicationStatus: "gated",
  },
  {
    kind: "insight",
    slug: "runtime-assurance-ai-data-centers",
    path: "/insights/runtime-assurance-ai-data-centers",
    title: "Runtime Assurance for AI Data Centers | GridNinja",
    description:
      "How a runtime assurance gate constrains AI data center actions with deterministic allow, repair, reject, and no-proof outcomes.",
    eyebrow: "Safety architecture",
    h1: "Runtime assurance keeps capacity actions inside the envelope",
    shortAnswer:
      "Runtime assurance is a deterministic safety boundary around a proposed operating action. It evaluates the action against current constraints, evidence freshness, policy, and recovery requirements before execution. For AI data centers, the gate produces an explicit allow, repair, reject, or no-proof decision, while the planning or learning system remains advisory rather than becoming the final authority.",
    definition:
      "A runtime assurance gate is the authoritative decision layer that checks candidate actions against an independently specified dispatch envelope and records the reasons for its result.",
    notDefinition:
      "It is not a confidence score from the same model that proposed the action, nor a promise that every future condition has been predicted. A no-proof result is a valid safety outcome.",
    operationalSignificance:
      "The separation lets operators use richer forecasting and optimization without making those systems the safety authority. When conditions change, the gate can repair or refuse an action and preserve a replayable explanation.",
    mechanism: [
      "Receive a candidate action and its declared assumptions.",
      "Resolve current constraints, margins, telemetry validity, and recovery requirements.",
      "Return allow, a bounded repair, reject, or no-proof.",
      "Attach the decision trace, binding constraint, and rollback posture to the action record.",
    ],
    example: {
      label: "Synthetic repair trace",
      summary: `${syntheticNotice} A workload shift is repaired because a cooling margin would fall below policy during the forecast window. The trace identifies the binding constraint and the smaller accepted action.`,
      synthetic: true,
    },
    textDiagram:
      "Planner or model → candidate action → independent dispatch-envelope check → allow | repair | reject | no-proof → operator-visible trace and rollback record.",
    evidenceLinks: [
      { label: "Sample RTA trace", href: "/evidence/sample-rta-trace" },
      { label: "Dispatch Envelope", href: "/platform/dispatch-envelope" },
      { label: "Proof Before Autonomy", href: "/proof" },
    ],
    failureCases: [
      "The checker shares an unexamined failure mode with the action generator.",
      "Constraints are incomplete, stale, or expressed in incompatible units.",
      "An action is allowed despite an unavailable rollback or recovery path.",
    ],
    limitations: [
      "Runtime assurance is bounded by the completeness of the explicit envelope and trusted inputs.",
      "It does not remove the need for protective equipment, facility procedures, or operator authority.",
      "A decision trace establishes what was checked, not universal safety outside that scope.",
    ],
    primarySources: [nistAiRmf, nistOta, provO],
    relatedPaths: ["/platform/dispatch-envelope", "/proof", "/demo"],
    publicationStatus: "gated",
  },
  {
    kind: "insight",
    slug: "data-center-shadow-mode",
    path: "/insights/data-center-shadow-mode",
    title: "Data Center Shadow Mode | GridNinja",
    description:
      "A practical definition of Shadow Mode for observing capacity decisions, counterfactual actions, and proof quality without control authority.",
    eyebrow: "Deployment posture",
    h1: "Shadow Mode proves behavior before authority expands",
    shortAnswer:
      "Shadow Mode runs the capacity-acceptance path against live or replayed operating context without issuing authoritative setpoints. It records what GridNinja would have proposed, allowed, repaired, rejected, or marked no-proof, then compares those decisions with observed conditions and operator outcomes. The purpose is evidence accumulation and integration validation—not a disguised claim of autonomous operation.",
    definition:
      "Shadow Mode is a read-only deployment posture with explicit separation between observation, counterfactual decisions, and the systems that retain control authority.",
    notDefinition:
      "It is not a production control trial, a customer performance result, or permission to infer savings from counterfactual actions that were never executed.",
    operationalSignificance:
      "Teams can test telemetry mappings, topology, constraints, refusal logic, and proof-pack quality while existing operating procedures remain authoritative. Evidence from this phase determines whether Advisory Mode is justified.",
    mechanism: [
      "Ingest read-only telemetry and declared topology through scoped adapters.",
      "Generate timestamped counterfactual actions and runtime-assurance outcomes.",
      "Compare predicted constraints with observed operating states and operator records.",
      "Review false accepts, false rejects, no-proof cases, and data-quality failures before promotion.",
    ],
    example: {
      label: "Synthetic Shadow Mode review",
      summary: `${syntheticNotice} A counterfactual workload shift is rejected after telemetry freshness crosses policy. No control command is sent; the stale-input refusal is retained for review.`,
      synthetic: true,
    },
    textDiagram:
      "Read-only telemetry → counterfactual proposal → runtime-assurance outcome → comparison with observed operation → reviewed evidence → possible Advisory Mode gate.",
    evidenceLinks: [
      { label: "Proof Before Autonomy", href: "/proof" },
      { label: "Sample RTA trace", href: "/evidence/sample-rta-trace" },
      { label: "Claims and evidence method", href: "/methodology/claims-and-evidence" },
    ],
    failureCases: [
      "Shadow outputs can influence operators even when the authority boundary is poorly labeled.",
      "Counterfactual benefits are reported as realized operational outcomes.",
      "Mappings or timestamps are wrong, making comparisons appear precise but invalid.",
    ],
    limitations: [
      "Shadow Mode cannot establish actuator behavior or closed-loop recovery that was never exercised.",
      "Observed correlation does not establish that a counterfactual action caused an outcome.",
      "Promotion requires named operational review and site-specific acceptance criteria.",
    ],
    primarySources: [nistOta, nistAiRmf, openTelemetry],
    relatedPaths: ["/proof", "/demo", "/contact"],
    publicationStatus: "gated",
  },
  {
    kind: "insight",
    slug: "cross-domain-capacity-constraints",
    path: "/insights/cross-domain-capacity-constraints",
    title: "Cross-Domain AI Data Center Capacity Constraints | GridNinja",
    description:
      "Why power, cooling, water, storage, workload, reserve, and telemetry constraints must be evaluated as one capacity-acceptance problem.",
    eyebrow: "Constraint model",
    h1: "Capacity is bound by the tightest cross-domain constraint",
    shortAnswer:
      "Usable AI data center capacity is bounded by coupled constraints, not a single electrical ceiling. Workload timing changes heat, cooling demand, storage posture, generation reserves, water exposure, network dependencies, and SLA risk. A cross-domain capacity process evaluates those interactions in the same operating window and accepts only the capacity whose binding constraint and margin can be shown.",
    definition:
      "A cross-domain constraint model represents the dependencies that can make an otherwise feasible power action unsafe, unavailable, or commercially unusable.",
    notDefinition:
      "It is not a collection of independent dashboards or a sum of best-case headroom values. Capacity cannot be counted twice across domains that depend on the same reserve or recovery path.",
    operationalSignificance:
      "Operators see which constraint actually binds a request and can evaluate repairs—such as timing, placement, or asset commitment—without hiding the cost in another facility domain.",
    mechanism: [
      "Normalize constraints into a shared time window and topology context.",
      "Propagate candidate actions across power, thermal, water, storage, workload, and SLA models.",
      "Identify the earliest binding constraint and margin to limit.",
      "Repair the action only when the changed action remains provable across every domain.",
    ],
    example: {
      label: "Synthetic coupled-constraint example",
      summary: `${syntheticNotice} Electrical headroom exists, but a proposed workload placement is rejected because the thermal recovery assumption is unsupported after a cooling-component outage.`,
      synthetic: true,
    },
    textDiagram:
      "Requested AI load ↔ workload placement ↔ heat and cooling ↔ power and storage ↔ bridge power and reserves ↔ SLA and recovery → one accepted or refused capacity result.",
    evidenceLinks: [
      { label: "Virtual Capacity Proof Test", href: "/evidence/virtual-capacity-proof-test" },
      { label: "Dispatch Envelope", href: "/platform/dispatch-envelope" },
      { label: "Load Passport specification", href: "/evidence/load-passport-specification" },
    ],
    failureCases: [
      "Models use different timestamps, topology versions, or operating windows.",
      "One reserve is credited to multiple independent capacity claims.",
      "A domain reports a scalar score without the constraints needed for runtime checking.",
    ],
    limitations: [
      "The model is only as complete as the declared dependencies and trusted telemetry.",
      "Site engineering limits and protective settings remain authoritative.",
      "Uncertain or unavailable domains should produce no-proof rather than inferred capacity.",
    ],
    primarySources: [nistOta, openTelemetry, provO],
    relatedPaths: ["/platform", "/solutions/ai-cloud", "/solutions/bridge-power"],
    publicationStatus: "gated",
  },
  {
    kind: "insight",
    slug: "safe-data-center-grid-flexibility",
    path: "/insights/safe-data-center-grid-flexibility",
    title: "Safe Data Center Grid Flexibility | GridNinja",
    description:
      "How proof-backed inside-the-fence orchestration can bound data center flexibility without subordinating safety, workload, or SLA constraints.",
    eyebrow: "Verified flexibility",
    h1: "Grid flexibility must remain subordinate to site safety",
    shortAnswer:
      "Safe data center grid flexibility is the time-bounded operating range a facility can offer after internal workload, thermal, reserve, recovery, and SLA constraints are protected. Grid or market signals can request an outcome, but inside-the-fence orchestration determines whether the action is allowable. Every accepted response needs a dispatch envelope, rollback posture, and evidence of delivered performance.",
    definition:
      "Verified flexibility is a facility-specific capability with a defined direction, magnitude, duration, response time, recovery behavior, and proof standard.",
    notDefinition:
      "It is not nameplate generator capacity, an unrestricted demand-response promise, or permission for an external party to bypass facility operating authority.",
    operationalSignificance:
      "The approach lets operators explore flexibility value while retaining local safety and SLA control. It also separates what was requested, what was accepted, and what was actually delivered.",
    mechanism: [
      "Translate an external request into a site-scoped candidate action.",
      "Evaluate workload, cooling, storage, on-site generation, reserves, and rebound.",
      "Allow, repair, or reject the request inside the dispatch envelope.",
      "Measure delivery and recovery; package the event evidence for review.",
    ],
    example: {
      label: "Synthetic flexibility event",
      summary: `${syntheticNotice} A requested reduction is repaired to a shorter interval because workload recovery would otherwise breach the protected SLA window. The accepted interval and rebound limit are recorded.`,
      synthetic: true,
    },
    textDiagram:
      "External request → site translation → inside-the-fence constraint check → accepted response → measured delivery and rebound → evidence packet.",
    evidenceLinks: [
      { label: "Load Passport specification", href: "/evidence/load-passport-specification" },
      { label: "Bridge Power solution", href: "/solutions/bridge-power" },
      { label: "Sample proof pack", href: "/proof/proof-pack" },
    ],
    failureCases: [
      "Delivery is measured without a declared baseline or counterfactual.",
      "Rebound, reserve replenishment, or emissions constraints are excluded from the event scope.",
      "External dispatch is treated as authoritative over facility protection and operator policy.",
    ],
    limitations: [
      "Market eligibility and settlement depend on local rules and separate agreements.",
      "A synthetic event does not establish field performance.",
      "Flexibility availability changes with workload, weather, maintenance, fuel, and topology.",
    ],
    primarySources: [nistOta, provO, openTelemetry],
    relatedPaths: ["/solutions/bridge-power", "/proof", "/contact"],
    publicationStatus: "gated",
  },
  {
    kind: "insight",
    slug: "ai-data-center-time-to-power",
    path: "/insights/ai-data-center-time-to-power",
    title: "AI Data Center Time-to-Power and Virtual Capacity | GridNinja",
    description:
      "How virtual capacity can complement interconnection and construction programs by making constrained infrastructure more usable and auditable.",
    eyebrow: "Commercial outcome",
    h1: "Time-to-power improves when capacity claims become defensible",
    shortAnswer:
      "AI data center time-to-power is the interval before a workload can receive safe, usable, auditable capacity—not merely the date when equipment or interconnection arrives. Virtual capacity can shorten parts of that path by coordinating existing infrastructure and bridge power inside explicit envelopes. It complements physical expansion; it does not replace construction, interconnection, or asset delivery.",
    definition:
      "A proof-backed time-to-power plan maps each proposed capacity tranche to its dependencies, operating window, authority boundary, proof requirements, and conditions for withdrawal.",
    notDefinition:
      "It is not a promise that software creates physical MW or removes utility, permitting, equipment, fuel, cooling, or commissioning constraints.",
    operationalSignificance:
      "Executives can separate capacity that is physically planned, operationally available, and presently acceptable. That distinction supports safer phasing, clearer revenue timing, and fewer surprises between commercial commitments and facility readiness.",
    mechanism: [
      "Inventory physical, contractual, operational, and evidentiary constraints by capacity tranche.",
      "Identify workloads and asset combinations that can be admitted within existing envelopes.",
      "Validate the plan in Shadow Mode and record refusal and no-proof cases.",
      "Promote only accepted tranches while physical expansion continues in parallel.",
    ],
    example: {
      label: "Synthetic phasing example",
      summary: `${syntheticNotice} A proposed capacity tranche remains unavailable until a reserve policy and bridge-power recovery sequence are validated; a smaller tranche passes Shadow Mode evidence review.`,
      synthetic: true,
    },
    textDiagram:
      "Planned capacity → dependency and constraint map → Shadow Mode evidence → accepted tranche or no-proof → workload admission → continuous revalidation.",
    evidenceLinks: [
      { label: "Capacity Audit methodology", href: "/methodology/capacity-audit" },
      { label: "AI Cloud solution", href: "/solutions/ai-cloud" },
      { label: "Proof-adjusted capacity", href: "/insights/proof-adjusted-data-center-capacity" },
    ],
    failureCases: [
      "Planned, installed, commissioned, and accepted capacity are treated as equivalent.",
      "Revenue timing assumes an untested operating or recovery sequence.",
      "A temporary bridge is represented as permanent capacity.",
    ],
    limitations: [
      "Site schedules remain subject to utility, construction, equipment, regulatory, and commercial dependencies.",
      "Virtual capacity is time- and state-dependent.",
      "Any commercial forecast needs separately approved assumptions and sensitivity analysis.",
    ],
    primarySources: [nistAiRmf, nistOta, provO],
    relatedPaths: ["/solutions/ai-cloud", "/roi", "/contact"],
    publicationStatus: "gated",
  },
  {
    kind: "evidence",
    slug: "virtual-capacity-proof-test",
    path: "/evidence/virtual-capacity-proof-test",
    title: "Virtual Capacity Proof Test v1.0 | GridNinja Evidence",
    description:
      "A publication-gated synthetic test protocol for evaluating virtual capacity acceptance, refusal logic, and proof artifacts.",
    eyebrow: "Evidence protocol",
    h1: "Virtual Capacity Proof Test v1.0",
    shortAnswer:
      "The Virtual Capacity Proof Test is a synthetic, methods-first protocol for checking whether a capacity-acceptance system refuses unprovable actions and preserves evidence. It covers stale telemetry, topology mismatch, reserve floors, thermal and water constraints, SLA limits, rebound, and connection loss. Passing a synthetic test demonstrates protocol behavior only; it is not a customer, pilot, or production result.",
    definition:
      "The protocol is a versioned set of inputs, expected decisions, required evidence fields, and negative cases for the allow / repair / reject / no-proof boundary.",
    notDefinition:
      "It is not a safety certification, independent validation, customer benchmark, or claim that the tested logic has controlled a production facility.",
    operationalSignificance:
      "A negative-case-first test makes refusal behavior reviewable before site integration. It also gives operators a reproducible way to inspect evidence completeness and decision determinism.",
    mechanism: [
      "Load a declared synthetic topology, policy, telemetry sequence, and capacity request.",
      "Run the candidate through the versioned dispatch-envelope evaluator.",
      "Compare the result and required evidence fields with the expected fixture.",
      "Canonicalize the artifact, verify hashes, and retain failures without overwriting them.",
    ],
    example: {
      label: "Synthetic test fixture",
      summary: `${syntheticNotice} A stale-telemetry fixture expects no-proof and verifies that no accepted-headroom entry is emitted.`,
      synthetic: true,
    },
    textDiagram:
      "Versioned fixture → evaluator → expected versus observed decision → evidence completeness checks → canonical artifact hash → pass or fail record.",
    evidenceLinks: [
      { label: "Download release manifest", href: "/evidence/releases/v1.0.0/manifest.json" },
      { label: "Download proof-test fixtures", href: "/evidence/releases/v1.0.0/virtual-capacity-proof-test.json" },
      { label: "Claims and evidence method", href: "/methodology/claims-and-evidence" },
    ],
    failureCases: [
      "A fixture accepts capacity when a required input is stale or absent.",
      "Repeated identical inputs produce materially different decision artifacts.",
      "An accepted action lacks a binding constraint, margin, or rollback posture.",
    ],
    limitations: [
      "Fixtures are synthetic and cannot represent every facility topology or failure interaction.",
      "The release is publication-gated until named technical ownership and independent review are recorded.",
      "A passing protocol result does not authorize field control.",
    ],
    primarySources: [jsonCanonicalization, provO, nistOta],
    relatedPaths: ["/proof", "/evidence/sample-rta-trace", "/methodology/claims-and-evidence"],
    publicationStatus: "gated",
    evidence: {
      claim: "The supplied synthetic fixtures specify deterministic acceptance and refusal expectations for seven failure families.",
      maturity: "DESIGN TARGET",
      environment: "synthetic",
      measurementWindow: "Fixture timestamps span a synthetic 15-minute operating window.",
      sampleSize: "Seven negative-case families; fixture expansion is pending review.",
      version: "1.0.0-publication-candidate",
      artifactHash: "See the versioned release manifest for per-file SHA-256 digests.",
      assumptions: [
        "All inputs are synthetic and contain no customer or facility data.",
        "Expected outcomes describe the protocol contract, not measured field performance.",
        "The evaluator and fixtures use the same declared schema version.",
      ],
      method: [
        "Validate each fixture against the release schema.",
        "Evaluate the declared capacity request against topology, policy, and telemetry state.",
        "Compare decision, reason code, binding constraint, and artifact requirements.",
        "Fail closed on missing inputs, schema drift, or non-deterministic output.",
      ],
      result: "Publication candidate: fixtures and expected outcomes are available; no reviewed performance result is asserted.",
      uncertainty: "Coverage completeness and evaluator independence have not yet received named external review.",
      negativeCases: [
        "Stale telemetry and connection loss",
        "Topology mismatch",
        "Reserve-floor violation",
        "Thermal or water constraint",
        "SLA limit and rebound breach",
      ],
      reproduction: [
        "Download the manifest, fixtures, schema, and validator from the stable release path.",
        "Verify each file digest against the manifest.",
        "Run the validator with Node 22, then compare expected decisions without modifying fixtures.",
      ],
      downloadHref: "/evidence/releases/v1.0.0/virtual-capacity-proof-test.json",
      interpretation: "Use this release to review the proposed proof contract and negative cases, not to infer production effectiveness.",
      technicalOwner: "Unassigned — publication remains gated",
      reviewer: "Unassigned — no independent review is claimed",
      nextReviewDate: "Not scheduled until named ownership is approved",
    },
  },
  {
    kind: "evidence",
    slug: "sample-rta-trace",
    path: "/evidence/sample-rta-trace",
    title: "Sample Runtime Assurance Trace | GridNinja Evidence",
    description:
      "A publication-gated synthetic runtime-assurance trace showing allow, repair, reject, and no-proof evidence fields.",
    eyebrow: "Evidence object",
    h1: "Sample runtime-assurance decision trace",
    shortAnswer:
      "A runtime assurance trace records the candidate action, evidence state, constraints checked, binding limit, decision, permitted repair, and rollback posture. This sample uses synthetic data to show the shape of an inspectable allow / repair / reject / no-proof record. It does not represent a customer site, field test, pilot, or production control event.",
    definition:
      "The trace is a decision artifact designed to explain why a candidate was accepted, changed, refused, or left unproven at a specific time.",
    notDefinition:
      "It is not a raw telemetry dump, proprietary solver disclosure, universal safety certificate, or proof that the illustrated action occurred.",
    operationalSignificance:
      "Operators and reviewers can follow the decision path without relying on a model score. The trace also provides a stable object for replay, audit, correction, and comparison.",
    mechanism: [
      "Bind the request to topology, policy, and telemetry versions.",
      "List each evaluated constraint and its margin.",
      "Record the decision and any bounded repair.",
      "Attach rollback requirements, evidence hashes, and expiry conditions.",
    ],
    example: {
      label: "Synthetic trace excerpt",
      summary: `${syntheticNotice} The example repairs a capacity request after reserve margin becomes binding and records the original request separately from the accepted action.`,
      synthetic: true,
    },
    textDiagram:
      "Requested action + evidence snapshot → constraint evaluations → binding margin → repaired action → rollback posture → immutable trace reference.",
    evidenceLinks: [
      { label: "Download proof-pack example", href: "/evidence/releases/v1.0.0/proof-pack.example.json" },
      { label: "Dispatch Envelope", href: "/platform/dispatch-envelope" },
      { label: "Virtual Capacity Proof Test", href: "/evidence/virtual-capacity-proof-test" },
    ],
    failureCases: [
      "The trace omits the original request after a repair.",
      "Constraint results cannot be tied to an input version or timestamp.",
      "A no-proof outcome is collapsed into a generic rejection without evidence context.",
    ],
    limitations: [
      "The sample is synthetic and deliberately excludes facility topology and protective thresholds.",
      "Schema completeness does not establish the correctness of an underlying model.",
      "Named review and release signing are pending.",
    ],
    primarySources: [provO, jsonCanonicalization, nistAiRmf],
    relatedPaths: ["/platform/dispatch-envelope", "/proof/proof-pack", "/insights/runtime-assurance-ai-data-centers"],
    publicationStatus: "gated",
    evidence: {
      claim: "The sample demonstrates a trace structure that separates request, repair, binding constraint, and rollback posture.",
      maturity: "DESIGN TARGET",
      environment: "synthetic",
      measurementWindow: "One synthetic decision instant plus a declared recovery window.",
      sampleSize: "One illustrative trace; no population inference.",
      version: "1.0.0-publication-candidate",
      artifactHash: "See the versioned release manifest for the example digest.",
      assumptions: ["Synthetic topology", "Synthetic telemetry", "No control command was issued"],
      method: ["Validate schema", "Inspect constraint sequence", "Verify original and repaired actions remain distinct"],
      result: "A structural example is supplied; no operational result is claimed.",
      uncertainty: "The example has not received named operator or independent review.",
      negativeCases: ["Missing input version", "Missing rollback", "Unlabeled repair", "No-proof collapsed into reject"],
      reproduction: ["Download the example and schema", "Run the release validator with Node 22", "Inspect the recorded constraint and decision fields"],
      downloadHref: "/evidence/releases/v1.0.0/proof-pack.example.json",
      interpretation: "Evaluate the transparency of the proposed artifact, not facility performance.",
      technicalOwner: "Unassigned — publication remains gated",
      reviewer: "Unassigned — no independent review is claimed",
      nextReviewDate: "Not scheduled until named ownership is approved",
    },
  },
  {
    kind: "evidence",
    slug: "accepted-headroom-ledger",
    path: "/evidence/accepted-headroom-ledger",
    title: "Accepted-Headroom Ledger | GridNinja Evidence",
    description:
      "A publication-gated specification for recording proof-adjusted capacity, binding constraints, evidence, and expiry conditions.",
    eyebrow: "Evidence object",
    h1: "Accepted-headroom ledger specification",
    shortAnswer:
      "An accepted-headroom ledger records only the capacity that passed the declared evidence and dispatch-envelope checks for a specific site context and time window. Each entry links the accepted quantity to its request, binding constraint, remaining margin, evidence versions, authority boundary, and expiry conditions. It prevents modeled or claimed headroom from being silently treated as durable sellable MW.",
    definition:
      "The ledger is an append-oriented capacity accounting record with explicit lineage from request to proof-adjusted acceptance.",
    notDefinition:
      "It is not an energy bill, DCIM inventory, commercial settlement statement, or guarantee that a past acceptance remains valid under changed conditions.",
    operationalSignificance:
      "Facilities, commercial, and assurance teams can reconcile which capacity was accepted, what evidence supported it, and why later entries changed or expired.",
    mechanism: [
      "Reference the original capacity request and evaluation context.",
      "Record accepted quantity, duration, binding constraint, and margin.",
      "Attach evidence versions, authority boundary, and rollback posture.",
      "Append correction, expiry, or retraction records without erasing prior state.",
    ],
    example: {
      label: "Synthetic ledger entry",
      summary: `${syntheticNotice} A time-bounded accepted quantity expires when topology version or telemetry freshness no longer matches the recorded evaluation context.`,
      synthetic: true,
    },
    textDiagram:
      "Capacity request → proof adjustment → accepted entry → active monitoring → expiry, correction, or re-evaluation → linked ledger history.",
    evidenceLinks: [
      { label: "Download proof-pack schema", href: "/evidence/releases/v1.0.0/proof-pack.schema.json" },
      { label: "Proof-adjusted capacity", href: "/insights/proof-adjusted-data-center-capacity" },
      { label: "Editorial corrections", href: "/methodology/editorial-corrections" },
    ],
    failureCases: [
      "Accepted quantity lacks a declared duration or expiry condition.",
      "Later corrections overwrite rather than reference the prior record.",
      "The same reserve or headroom is counted in overlapping entries.",
    ],
    limitations: [
      "The ledger structure does not independently prove the correctness of its inputs.",
      "Commercial use requires reconciliation with contracts and operating procedures.",
      "The example release is synthetic and publication-gated.",
    ],
    primarySources: [provO, jsonCanonicalization, nistOta],
    relatedPaths: ["/insights/proof-adjusted-data-center-capacity", "/proof/proof-pack", "/methodology/claims-and-evidence"],
    publicationStatus: "gated",
    evidence: {
      claim: "The proposed ledger schema preserves capacity lineage, evidence references, and expiry conditions.",
      maturity: "DESIGN TARGET",
      environment: "synthetic",
      measurementWindow: "Illustrative entries use declared start, end, and evidence-expiry timestamps.",
      sampleSize: "One schema and one synthetic example.",
      version: "1.0.0-publication-candidate",
      artifactHash: "See the versioned release manifest for per-file digests.",
      assumptions: ["Append-oriented records", "UTC timestamps", "Stable evidence identifiers"],
      method: ["Validate required lineage fields", "Verify expiry representation", "Verify corrections can reference superseded entries"],
      result: "A reviewable schema candidate is supplied; no production ledger is represented.",
      uncertainty: "Operator usability, scale, and external interoperability remain unreviewed.",
      negativeCases: ["Missing expiry", "Duplicate capacity", "Overwritten correction", "Unresolved evidence reference"],
      reproduction: ["Download the proof-pack schema and example", "Run the validator", "Inspect the acceptedHeadroomLedger entry and references"],
      downloadHref: "/evidence/releases/v1.0.0/proof-pack.schema.json",
      interpretation: "Use the candidate to review evidence lineage and capacity-accounting semantics.",
      technicalOwner: "Unassigned — publication remains gated",
      reviewer: "Unassigned — no independent review is claimed",
      nextReviewDate: "Not scheduled until named ownership is approved",
    },
  },
  {
    kind: "evidence",
    slug: "load-passport-specification",
    path: "/evidence/load-passport-specification",
    title: "Load Passport Specification | GridNinja Evidence",
    description:
      "A publication-gated specification for expressing workload capacity requirements, flexibility, recovery, evidence, and authority boundaries.",
    eyebrow: "Evidence specification",
    h1: "Load Passport specification",
    shortAnswer:
      "A Load Passport is a versioned contract describing what an AI workload requires and what flexibility it may safely offer. It expresses power and timing needs, placement constraints, SLA class, thermal or recovery dependencies, permitted actions, evidence requirements, and authority boundaries. It lets capacity decisions evaluate a workload as an operational contract rather than an anonymous demand curve.",
    definition:
      "The specification provides machine-readable and operator-readable fields for a workload's declared operating envelope and proof requirements.",
    notDefinition:
      "It is not a customer identity record, scheduler replacement, pricing agreement, or permission to expose workload contents, topology, credentials, or proprietary policy.",
    operationalSignificance:
      "Infrastructure teams can evaluate whether a proposed workload placement or flexibility action fits facility constraints while preserving the workload's explicit protections.",
    mechanism: [
      "Declare workload demand, duration, ramp, placement, and SLA requirements.",
      "Declare permitted flexibility, recovery, and rollback constraints.",
      "Bind the passport to policy and schema versions.",
      "Use only the minimum fields required for a capacity decision and proof artifact.",
    ],
    example: {
      label: "Synthetic passport",
      summary: `${syntheticNotice} The sample permits a bounded timing shift but forbids interruption and requires recovery before a declared deadline. No real workload or operator data is present.`,
      synthetic: true,
    },
    textDiagram:
      "Workload requirements + permitted flexibility + SLA and recovery limits → Load Passport → dispatch-envelope evaluation → accepted action and proof reference.",
    evidenceLinks: [
      { label: "Download Load Passport schema", href: "/evidence/releases/v1.0.0/load-passport.schema.json" },
      { label: "Accepted-headroom ledger", href: "/evidence/accepted-headroom-ledger" },
      { label: "Safe grid flexibility", href: "/insights/safe-data-center-grid-flexibility" },
    ],
    failureCases: [
      "Permitted flexibility is inferred rather than explicitly declared.",
      "SLA and recovery constraints cannot be tied to a policy version.",
      "The passport includes sensitive workload or facility data not required for acceptance.",
    ],
    limitations: [
      "The candidate schema does not replace site-specific workload, security, or change-control procedures.",
      "No interoperability or field-performance claim is made.",
      "Publication remains gated pending named technical and independent review.",
    ],
    primarySources: [jsonCanonicalization, provO, nistOta],
    relatedPaths: ["/platform", "/solutions/ai-cloud", "/evidence/accepted-headroom-ledger"],
    publicationStatus: "gated",
    evidence: {
      claim: "The schema candidate separates workload requirements, permitted flexibility, recovery, and evidence references.",
      maturity: "DESIGN TARGET",
      environment: "synthetic",
      measurementWindow: "The example declares a synthetic 30-minute operating and recovery window.",
      sampleSize: "One schema and one synthetic example embedded in the proof pack.",
      version: "1.0.0-publication-candidate",
      artifactHash: "See the versioned release manifest for the schema digest.",
      assumptions: ["No customer identifiers", "UTC timestamps", "Policy-controlled flexibility fields"],
      method: ["Validate schema", "Inspect required protections", "Verify the example contains no sensitive operational data"],
      result: "A sanitized schema candidate is supplied; no deployment claim is made.",
      uncertainty: "Scheduler interoperability and operator usability are not yet reviewed.",
      negativeCases: ["Missing SLA class", "Unbounded flexibility", "Missing recovery", "Sensitive data field"],
      reproduction: ["Download the schema and example", "Run the release validator", "Review fields against the documented authority boundary"],
      downloadHref: "/evidence/releases/v1.0.0/load-passport.schema.json",
      interpretation: "Use the artifact to review the proposed workload-to-capacity contract.",
      technicalOwner: "Unassigned — publication remains gated",
      reviewer: "Unassigned — no independent review is claimed",
      nextReviewDate: "Not scheduled until named ownership is approved",
    },
  },
  {
    kind: "methodology",
    slug: "claims-and-evidence",
    path: "/methodology/claims-and-evidence",
    title: "Claims and Evidence Methodology | GridNinja",
    description:
      "How GridNinja scopes public claims by environment, maturity, evidence, approved surface, caveat, and review expiry.",
    eyebrow: "Public evidence policy",
    h1: "Claims must never outrun evidence",
    shortAnswer:
      "GridNinja public claims should never outrun their evidence. Every quantitative, comparative, capability, or outcome claim is scoped to an environment, measurement window, sample, baseline, maturity, evidence URL, owner, caveat, approved surface, and review expiry. Synthetic and illustrative values stay visibly labeled, while expired or retracted claims are removed from eligible copy and retained in correction history.",
    definition:
      "Claim governance is the fail-closed publishing contract that connects exact public wording to active evidence and a named approval boundary.",
    notDefinition:
      "It is not a disclaimer added after publication, a marketing confidence score, or permission to generalize a replay, shadow, pilot, or synthetic result into production performance.",
    operationalSignificance:
      "Readers can distinguish design targets, implemented capability, replay evidence, Shadow Mode observations, operator acceptance, and independent validation. Internal teams can stop unsupported copy before release.",
    mechanism: [
      "Register the exact claim and classify its type, maturity, environment, and scope.",
      "Link evidence, sources, caveat, owner, approved surfaces, and expiry.",
      "Validate visible wording and structured data before publishing.",
      "Append corrections or retractions without silently rewriting history.",
    ],
    example: {
      label: "Governed illustrative claim",
      summary: `${syntheticNotice} The value appears beside this notice, is excluded from snippets when unsupported, and is not emitted as a structured-data fact.`,
      synthetic: true,
    },
    textDiagram:
      "Draft wording → claim registry → evidence and maturity check → surface approval → publication → expiry review → active, corrected, or retracted history.",
    evidenceLinks: [
      { label: "Editorial corrections", href: "/methodology/editorial-corrections" },
      { label: "Virtual Capacity Proof Test", href: "/evidence/virtual-capacity-proof-test" },
      { label: "Proof Pack", href: "/proof/proof-pack" },
    ],
    failureCases: [
      "A number appears publicly without an active claim record.",
      "Visible copy implies a higher maturity than its evidence supports.",
      "An expired competitor source continues to support a broad comparison.",
    ],
    limitations: [
      "Governance improves traceability but does not substitute for independent testing.",
      "Public evidence may be narrower than internal evidence because sensitive data must be excluded.",
      "Named editorial and technical ownership are required before this method becomes indexable.",
    ],
    primarySources: [nistAiRmf, provO, jsonCanonicalization],
    relatedPaths: ["/methodology/editorial-corrections", "/methodology/comparison-policy", "/proof"],
    publicationStatus: "gated",
  },
  {
    kind: "methodology",
    slug: "comparison-policy",
    path: "/methodology/comparison-policy",
    title: "Comparison Policy | GridNinja Methodology",
    description:
      "How GridNinja scopes public comparisons to reviewed primary materials, defined categories, stable citations, and explicit limitations.",
    eyebrow: "Comparison governance",
    h1: "A scoped, source-backed comparison policy",
    shortAnswer:
      "GridNinja comparisons must describe what reviewed public materials establish, not what a competitor supposedly cannot do. Each comparison names the category, capability, source, retrieval date, scope, and limitation. Sources receive quarterly review, and crawlable citations remain available outside interactive drawers. Comparisons are corrected when products, documentation, or evidence change rather than being preserved for marketing convenience.",
    definition:
      "The policy governs comparative wording about categories such as capacity acceptance, DCIM, digital twins, workload orchestration, and runtime assurance.",
    notDefinition:
      "It is not permission to infer unpublished product behavior, customer outcomes, market leadership, or universal absence from a limited documentation review.",
    operationalSignificance:
      "Technical evaluators can inspect the source boundary and distinguish architectural roles without relying on an unqualified feature matrix.",
    mechanism: [
      "Prefer first-party documentation, standards, and directly inspectable materials.",
      "Record retrieval date, the exact proposition established, and what is not established.",
      "Scope public wording to the evidence and expose stable source anchors.",
      "Review competitor-dependent records at least quarterly or after a known material release.",
    ],
    example: {
      label: "Scoped comparison example",
      summary: "A reviewed document may establish that a product reports facility telemetry. It does not establish that the product lacks a separate capacity-acceptance integration not described in that document.",
      synthetic: false,
    },
    textDiagram:
      "Comparison question → primary-source review → establishes / does not establish → scoped wording → stable citation → quarterly review or correction.",
    evidenceLinks: [
      { label: "Why GridNinja", href: "/why-gridninja" },
      { label: "Editorial corrections", href: "/methodology/editorial-corrections" },
      { label: "Claims and evidence", href: "/methodology/claims-and-evidence" },
    ],
    failureCases: [
      "Absence from one document is presented as proof that a capability does not exist.",
      "A category comparison becomes an unsupported named-product attack.",
      "Source links are available only inside client-rendered interaction.",
    ],
    limitations: [
      "Public materials may lag current product behavior.",
      "Category boundaries overlap and must be presented as architectural roles, not absolutes.",
      "Legal review may be required for named comparisons.",
    ],
    primarySources: [provO, nistAiRmf],
    relatedPaths: ["/why-gridninja", "/platform", "/methodology/editorial-corrections"],
    publicationStatus: "gated",
  },
  {
    kind: "methodology",
    slug: "editorial-corrections",
    path: "/methodology/editorial-corrections",
    title: "Editorial Corrections and Retractions | GridNinja",
    description:
      "The publication-gated GridNinja method for permanent correction, expiry, and retraction records for public technical claims.",
    eyebrow: "Trust policy",
    h1: "Corrections remain visible and attributable",
    shortAnswer:
      "GridNinja retains a permanent record when a substantive public claim is corrected, expires, or is retracted. The record identifies the affected wording and URL, prior state, reason, date, evidence change, owner, and replacement language when applicable. Corrections do not silently erase prior claims, and retracted values are removed from snippets, structured data, and active promotional surfaces.",
    definition:
      "A correction changes inaccurate or incomplete wording while preserving provenance; a retraction withdraws a claim that can no longer be supported; expiry pauses use pending review.",
    notDefinition:
      "It is not a general page changelog for typography or layout updates, nor a mechanism to hide unsupported claims after they have circulated.",
    operationalSignificance:
      "A durable history lets operators and partners understand what changed and whether prior decisions or downloaded artifacts require re-evaluation.",
    mechanism: [
      "Freeze the affected claim record and identify every approved surface.",
      "Publish the prior wording, reason, evidence change, and effective date.",
      "Remove or replace active wording and structured facts.",
      "Link superseded artifacts and notify owners of dependent material.",
    ],
    example: {
      label: "Correction record example",
      summary: "If a benchmark fixture is found to share a faulty assumption with its evaluator, the result is retracted, the artifact remains linked as superseded, and replacement evidence receives a new version.",
      synthetic: false,
    },
    textDiagram:
      "Issue discovered → affected claim frozen → correction or retraction record → surfaces and artifacts updated → dependent reviews notified → permanent linked history.",
    evidenceLinks: [
      { label: "Claims and evidence", href: "/methodology/claims-and-evidence" },
      { label: "Release changelog", href: "/evidence/releases/v1.0.0/CHANGELOG.md" },
      { label: "Comparison policy", href: "/methodology/comparison-policy" },
    ],
    failureCases: [
      "A value disappears without a public record after external distribution.",
      "Structured data retains a fact removed from visible copy.",
      "A superseded artifact is overwritten at the same versioned URL.",
    ],
    limitations: [
      "No public correction entries exist at launch; an empty history must not imply perfect accuracy.",
      "Notification reach may be limited for independently copied material.",
      "Named editorial ownership is required before this policy becomes indexable.",
    ],
    primarySources: [provO, jsonCanonicalization],
    relatedPaths: ["/methodology/claims-and-evidence", "/methodology/comparison-policy", "/evidence"],
    publicationStatus: "gated",
  },
  {
    kind: "methodology",
    slug: "capacity-audit",
    path: "/methodology/capacity-audit",
    title: "AI Data Center Capacity Audit Methodology | GridNinja",
    description:
      "A publication-gated method for finding proof-adjusted virtual capacity across workload, cooling, power, storage, reserves, and SLA constraints.",
    eyebrow: "Capacity Audit method",
    h1: "How a Capacity Audit turns constraints into a defensible decision",
    shortAnswer:
      "A GridNinja Capacity Audit maps claimed and modeled headroom to the evidence required for safe, usable, auditable capacity. It examines workload demand, topology, cooling, storage, bridge power, reserves, operating policy, telemetry quality, recovery, and SLA constraints. The deliverable separates accepted opportunities, repairable gaps, rejected assumptions, and no-proof conditions without promising a predetermined MW result.",
    definition:
      "The audit is a scoped discovery and evidence exercise that produces a capacity waterfall, constraint register, integration map, proof plan, and staged Shadow Mode recommendation.",
    notDefinition:
      "It is not an engineering stamp, safety certification, guaranteed savings study, or replacement for utility, equipment, commissioning, or facility sign-off.",
    operationalSignificance:
      "Executives see where time-to-power and sellable-capacity assumptions depend on unresolved evidence. Technical teams receive a prioritized path to test those assumptions without beginning with control authority.",
    mechanism: [
      "Define scope, authority boundaries, protected outcomes, and data-handling limits.",
      "Map capacity claims to topology, constraints, telemetry, policy, and recovery dependencies.",
      "Classify each opportunity as presently acceptable, repairable, rejected, or no-proof.",
      "Design a read-only Shadow Mode plan with acceptance tests, owners, and evidence outputs.",
    ],
    example: {
      label: "Synthetic audit output",
      summary: `${syntheticNotice} A capacity waterfall identifies a promising tranche but leaves it no-proof until reserve policy, telemetry freshness, and recovery behavior can be validated.`,
      synthetic: true,
    },
    textDiagram:
      "Business capacity question → constraint and evidence inventory → proof-adjusted waterfall → gaps and refusal cases → Shadow Mode test plan → reviewed capacity report.",
    evidenceLinks: [
      { label: "Request a Capacity Audit", href: "/roi" },
      { label: "Proof-adjusted capacity", href: "/insights/proof-adjusted-data-center-capacity" },
      { label: "Virtual Capacity Proof Test", href: "/evidence/virtual-capacity-proof-test" },
    ],
    failureCases: [
      "The audit begins with a target MW and back-solves assumptions to support it.",
      "Data limitations are hidden in a single confidence score.",
      "Shadow Mode acceptance criteria or operational owners are undefined.",
    ],
    limitations: [
      "Findings depend on the agreed scope, evidence access, and topology accuracy.",
      "The audit cannot authorize control or override facility engineering and operating procedures.",
      "Commercial projections require separate assumptions and approval.",
    ],
    primarySources: [nistAiRmf, nistOta, provO],
    relatedPaths: ["/roi", "/contact", "/insights/ai-data-center-time-to-power"],
    publicationStatus: "gated",
  },
] as const

export const insightResources = seoResources.filter(
  (resource) => resource.kind === "insight",
)

export const evidenceResources = seoResources.filter(
  (resource) => resource.kind === "evidence",
)

export const methodologyResources = seoResources.filter(
  (resource) => resource.kind === "methodology",
)

export const seoResourcePaths = seoResources.map((resource) => resource.path)

export function getSeoResource(kind: SeoResourceKind, slug: string) {
  return seoResources.find(
    (resource) => resource.kind === kind && resource.slug === slug,
  )
}
