import type { DecisionPageContent } from "@/components/marketing/decision-page"
export const decisionPages = {
  about: {
    eyebrow: "About GridNinja", headline: "Building a defensible basis for capacity decisions.",
    body: "GridNinja focuses on constrained AI infrastructure: how a proposed workload or capacity commitment relates to facility limits, evidence quality, and commercial requirements.",
    sections: [
      { title: "The offer today", body: "A bounded, paid capacity decision assessment using authorized historical inputs. Scope, availability, reviewers, price, schedule, and deliverables are agreed before work begins.", link: { label: "Review the assessment", href: "/assessment" } },
      { title: "Demonstrated work and its limits", body: "The public sample shows a synthetic assessment record, model screening outcomes, explicit unknowns, and a versioned decision brief. It is not evidence of site deployment, customer performance, independent certification, or operating authority.", link: { label: "Inspect the synthetic example", href: "/demo" } },
      { title: "Establish the delivery team during scoping", body: "Named team biographies and verified customer case studies are not yet published. Before a paid engagement, establish the accountable delivery lead, technical reviewer, relevant experience, availability, and customer decision owner. Public credentials will be added only with supporting evidence and permission." },
      { title: "The development direction", body: "GridNinja is developing an AI Data Center Virtual Capacity Control Plane, a runtime-assured virtual capacity engine. The aim is safe, usable, auditable capacity through inside-the-fence orchestration. Live integration, Shadow Mode operations, and bounded autonomy remain separate steps requiring demonstrated capability, site evidence, and explicit authority.", link: { label: "Understand the platform direction", href: "/platform" } },
    ],
  },
  platform: {
    eyebrow: "Platform direction · specified", headline: "A control-plane direction, with evidence before authority.",
    body: "GridNinja is developing an AI Data Center Virtual Capacity Control Plane for vendor-agnostic, inside-the-fence orchestration. The current commercial offer is a bounded historical-data assessment; this page describes the intended architecture.",
    sections: [
      { title: "The intended decision loop", body: "Telemetry → model → decide → assure → prove. Each proposed action must carry its scope, constraints, margin to limit, evidence freshness, and authority boundary.", items: [
        { title: "Observe and model", body: "Reconcile workload, electrical, cooling, reserve, and on-site generation inputs. Unknown or inconsistent evidence must remain visible." },
        { title: "Decide and assure", body: "Compare a requested profile with explicit conditions. Runtime assurance is intended to allow, repair, reject, or return no-proof; a website model does not operate equipment." },
        { title: "Prove and review", body: "Keep the decision record, assumptions, audit log, and replay basis together. A reviewer must be able to reproduce the stated conclusion within its scope." },
        { title: "Integrate under site authority", body: "Future integrations would work with existing operational systems and local policy. Supported interfaces, read access, and control permissions require separate validation." },
      ] },
      { title: "Inspect a synthetic timed-dispatch example", body: "The dispatch-envelope teaching example uses a separate timed maneuver and dataset from DEMO-01. Its model output is neither a commercial commitment nor an operationally accepted action.", link: { label: "Explore the dispatch-envelope example", href: "/platform/dispatch-envelope" } },
      { title: "Proof before autonomy", body: "The intended path is historical assessment, separately agreed Shadow Mode, advisory review, and only then bounded autonomy under explicit envelopes. Expanded autonomy is conditional on accumulated evidence and approved authority, never implied by a successful demo.", link: { label: "Review evidence and authority boundaries", href: "/proof" } },
    ],
  },
  proof: {
    eyebrow: "Proof before autonomy", headline: "Evidence informs a decision. Authority stays explicit.",
    body: "A modeled result, a useful business outcome, acceptance of a report, and permission to operate are different things. A capacity assessment must keep those boundaries visible.",
    sections: [
      { title: "What each result means", body: "Model screening uses allow / repair / reject / no-proof for a stated profile and evidence set. The labels do not authorize equipment changes or establish safe sellable MW.", items: [
        { title: "Modeled eligibility", body: "A workload fits the authored model conditions, requires a revision, fails a stated requirement, or cannot be assessed. A result applies only to its scope and window." },
        { title: "Commercial usefulness", body: "The decision owner determines whether a profile meets the service and business need. A smaller modeled increment is not automatically a useful offer." },
        { title: "Report acceptance", body: "The customer reviews contracted deliverables against agreed criteria. Accepting a report is not acceptance of an operational action." },
        { title: "Operating permission", body: "Facilities and operational authorities control site changes. Engineering, safety, contractual, and regulatory review are separate from this public demonstration." },
      ] },
      { title: "A conditional path to more authority", body: "Shadow Mode would observe without control. Advisory Mode would put proposals before operators. Bounded Autonomy would require a verified dispatch envelope, explicit permissions, rollback, and audit evidence. Expanded Autonomy would require further evidence. These are development stages, not services proven by the synthetic sample." },
      { title: "What evidence must travel with a number", body: "A capacity report needs the requested and revised profiles, reference load, meter boundary, time interval, binding conditions, assumptions, unknowns, dataset/model versions, and review status. A safety report requires its own supported scope; a software check cannot stand in for it.", link: { label: "Inspect the proof-pack contents", href: "/proof/proof-pack" } },
    ],
  },
  proofPack: {
    eyebrow: "Assessment review package", headline: "A concise brief, with a traceable supporting record.",
    body: "A proof pack should make the reasoning inspectable. The public package is synthetic: it explains the record format and decision boundary without claiming a customer outcome or operational validation.",
    sections: [
      { title: "Start with the one-page decision brief", body: "See the requested increment, modeled revision, governing conditions, and unresolved business question together. The HTML, PDF, and technical export identify the same fixture and publication version.", link: { label: "Open the sample decision brief", href: "/demo#decision-brief" } },
      { title: "What belongs in the package", body: "A contracted package is scoped to the decision and available evidence. The sample illustrates these review objects.", items: [
        { title: "Decision contract and profile", body: "The facility boundary, historical interval, reference load, decision owner, requested profile, and any distinct revision." },
        { title: "Constraints and evidence gaps", body: "Binding conditions, assumptions, input provenance, known limitations, and reasons a conclusion may be unavailable." },
        { title: "Model record", body: "The modeled quantities and screening outcome with dataset, model, and schema versions. Economics remain unestimated unless separately scoped." },
        { title: "Review and authority boundary", body: "What the reviewer is being asked to decide; what has not been assessed; and a clear distinction between report acceptance and operating permission." },
      ] },
      { title: "Stable versions support a defensible review", body: "A published version binds the snapshot, narrative, HTML brief, PDF, and export. Corrections create a new version. Withdrawn or unavailable artifacts must not silently resolve to another result.", link: { label: "Browse public evidence", href: "/evidence" } },
    ],
  },
  why: {
    eyebrow: "Why GridNinja", headline: "Connect a capacity question to its evidence.",
    body: "Infrastructure teams already have monitoring, models, and operational systems. The proposed GridNinja role is to organize a bounded capacity decision around explicit constraints, reviewable evidence, and a clear authority boundary.",
    sections: [
      { title: "A focused decision alongside your existing systems", body: "A capacity assessment uses agreed outputs from existing systems where authorized. It does not replace DCIM, facility controls, digital twins, or the operator's responsibilities.", items: [
        { title: "Monitoring and inventories", body: "These can provide observations and topology. The assessment question is whether that evidence supports the proposed profile under the stated conditions." },
        { title: "Models and planning tools", body: "These can explore alternatives. The assessment records the assumptions, input limits, and remaining business question for one agreed decision." },
        { title: "Operational controls", body: "These retain their existing authority. A model screening result or decision brief is not a command or permission to operate." },
        { title: "Commercial planning", body: "The business determines usefulness, price, and commitment. Modeled capacity does not automatically establish revenue, time-to-power, or SLA protection." },
      ] },
      { title: "Judge the work within its stated scope", body: "The public example is synthetic and cannot establish superiority over another product. Any future comparison needs a defined task, comparable evidence, current primary sources, limitations, and an accountable review.", link: { label: "Review the comparison method", href: "/methodology/comparison-policy" } },
    ],
  },
  aiCloud: {
    eyebrow: "For AI cloud operators", headline: "Evaluate the next workload before committing capacity.",
    body: "Scope a bounded assessment of a proposed AI workload increment against authorized historical inputs and declared facility conditions. Keep time-to-power, service requirements, and the next commercial decision in view.",
    sections: [
      { title: "Start with one admission question", body: "What workload profile is proposed, at which facility boundary, over which window, and with what minimum service requirement? Name the infrastructure sponsor and operational reviewer before modeling." },
      { title: "A decision package for the right reviewers", body: "Agree the evidence and the review question rather than a target uplift.", items: [
        { title: "Infrastructure and facilities", body: "Review load history, cooling constraints, reserve policy, topology, and input gaps. A result is scoped to what the model can support." },
        { title: "Service and commercial owners", body: "Compare a requested profile and any modeled revision with the workload's actual service need. Revenue and delivered GPU-hours are not inferred from modeled MW." },
      ] },
      { title: "Keep investment options separate", body: "Rescheduling, phasing, cooling upgrades, and bridge power may be worth investigating. They remain unassessed until their technical feasibility, cost, timing, and contractual implications are evaluated.", link: { label: "Inspect fixture B's unresolved decision", href: "/demo#decision-brief" } },
    ],
  },
  colocation: {
    eyebrow: "For colocation and REIT operators", headline: "Review the evidence before the next tenant commitment.",
    body: "Scope a capacity decision assessment for one proposed tenant increment. Compare the request with declared facility conditions and make unresolved SLA, reserve, and commercial questions explicit.",
    sections: [
      { title: "A modeled increment is not yet sellable capacity", body: "Tenant commitments, reserve policy, cooling conditions, and operating authority need their own review. Safe oversubscription and safe sellable MW are objectives requiring site evidence; the sample does not demonstrate either." },
      { title: "Bring the decision owners together", body: "Agree the facility boundary and the commitment under consideration before analysis.", items: [
        { title: "Commercial decision owner", body: "State the proposed increment, timing, service obligation, and minimum useful profile. Decide whether any modeled revision meets the actual tenant need." },
        { title: "Operational reviewer", body: "Confirm authorized inputs and applicable constraints. Review unknowns and limitations without treating the report as permission to change equipment." },
      ] },
      { title: "Useful findings include refusal and uncertainty", body: "A request may fit the modeled conditions, require a commercially unacceptable revision, or remain unassessable because evidence is missing. Each can inform the next commitment without inventing recovered capacity or uptime improvement.", link: { label: "Compare the synthetic scenarios", href: "/demo" } },
    ],
  },
  bridgePower: {
    eyebrow: "For bridge power and DER partners", headline: "Define the capacity question before selecting the asset.",
    body: "Bridge power and on-site generation may be investigation options for constrained AI infrastructure. Their usefulness depends on site conditions, reserves, transitions, cooling, workload requirements, and the commercial agreement.",
    sections: [
      { title: "Separate an option from an assessed recommendation", body: "The public assessment sample does not evaluate a generator, BESS, fuel supply, interconnection, emissions permission, or investment return. It does not rank bridge power against cooling upgrades or workload changes." },
      { title: "Scope the partner contribution", body: "A partner discussion can establish what an eventual assessment would require.", items: [
        { title: "Asset and operating evidence", body: "Agree the relevant capabilities, reserve requirements, transition behavior, input permissions, and local review responsibilities." },
        { title: "Service and commercial conditions", body: "Identify the load obligation, decision owner, deployment constraints, and economic inputs that would need evaluation under a separate scope." },
      ] },
      { title: "Integration remains a separate validation step", body: "The control-plane direction is vendor-agnostic orchestration alongside existing systems. No live asset connectivity, dispatch authority, or partner integration is established by this website.", link: { label: "Contact partnerships", href: "/contact?intent=partnership&source=bridge-power-page" } },
    ],
  },
  dcii: {
    eyebrow: "Development context", headline: "A research direction for proof-backed AI capacity.",
    body: "DCII is a project framing for exploring constrained AI infrastructure. It is not a published customer deployment, funded award, commercial partnership, or proven capacity result.",
    sections: [
      { title: "Begin with a bounded capacity decision", body: "The current offer is a scoped historical-data assessment. Any research collaboration, site evaluation, live Shadow Mode work, or operational pilot requires a separate agreement and readiness review.", link: { label: "Review the current assessment offer", href: "/assessment" } },
      { title: "Evidence before broader claims", body: "The public material is synthetic. Authorized site evaluation and customer decision acceptance must be identified with their own scope, evidence, permission, and reviewer; neither can be inferred from the sample.", link: { label: "Inspect public evidence", href: "/evidence" } },
    ],
  },
  dataHandling: {
    eyebrow: "Data handling", headline: "Agree the data boundary before sharing operational inputs.",
    body: "The website collects scoping inquiries. It is not an operational-data upload channel. Do not include telemetry, diagrams, credentials, protective thresholds, or sensitive commercial records in the inquiry form.",
    sections: [
      { title: "What the inquiry collects", body: "Name, email, and organization are required. An optional decision description and optional scoping details help route the conversation. Inquiry intent and approved source labels may be recorded with the submission. A receipt confirms stored intake; it does not confirm delivery to an individual or acceptance of an engagement." },
      { title: "How the inquiry is handled", body: "The intake implementation stores submissions in a database and queues notifications for delivery. It includes bot verification, rate limiting, delivery retry, and an optional CRM integration. Service configuration and authorized recipients must be verified before production operation; this page does not claim an independently audited security certification." },
      { title: "Operational data requires a separate agreement", body: "Before exchanging historical site inputs, agree the data owner, permission to share, minimum necessary fields, authorized recipients, secure transfer method, storage location, access, retention, deletion, and permitted use. Confirm whether confidentiality or customer approvals are required. No such transfer is authorized by sending an inquiry." },
      { title: "Retention and correction", body: "The application schedules inquiry redaction after 180 days and deletion after 365 days, including retained notification request data. Operator execution, backups, and any email or CRM provider retention require separate verification; these schedules do not establish deletion from every processor. Use the contact route to request clarification or correction, identifying only the minimum information needed to locate the inquiry.", link: { label: "Contact GridNinja", href: "/contact" } },
    ],
  },
} as const satisfies Record<string, DecisionPageContent>
