/** Shared buyer summary; detailed scope remains in the arrays below. */
export const assessmentOffer = {
  heading: "One capacity decision. A documented basis for review.",
  introduction: "Review a proposed AI workload or tenant commitment against the facility conditions and authorized historical inputs agreed for the assessment.",
  bring: "A capacity decision, decision owner, a facility boundary, the proposed workload or commitment, and permission to use the relevant historical inputs.",
  receive: "A decision brief, supporting model record, assumptions and evidence gaps, and a review of unresolved questions.",
  agreement: "We first review fit and input readiness. Deliverables, review rounds, price and schedule are agreed before paid work begins.",
  boundary: "A useful result may identify a conditional path, an unsuitable request or insufficient evidence. The assessment does not authorize equipment operation.",
  privacy: "Do not send operational files or credentials through this website.",
  pricing: "Scope depends on the number of facilities and boundaries, historical windows, profile alternatives, input readiness and agreed review rounds. These factors guide a scoping conversation; they are not an automated quotation or a delivery commitment.",
} as const

export const assessmentDeliverables = [
  { title: "Decision contract", body: "One capacity question, facility boundary, historical window, agreed alternatives, and acceptance criteria for the report." },
  { title: "Readiness and constraint findings", body: "An input inventory, assumptions, binding constraints, and evidence gaps that limit what can be concluded." },
  { title: "Bounded model comparison", body: "Requested and revised workload profiles assessed against the agreed conditions. Unassessed alternatives remain separate." },
  { title: "Review package", body: "A concise decision brief with the supporting model record, limitations, unresolved questions, and agreed review rounds." },
] as const

export const assessmentInputs = [
  { title: "Customer responsibilities", body: "Name the decision owner and operational reviewer. Confirm permission to share inputs, the facility boundary, workload requirements, and applicable operating constraints." },
  { title: "Historical inputs", body: "Agree the relevant load and cooling history, capacity commitments, topology, reserve policies, and workload profiles. Readiness is reviewed before modeling is scoped." },
  { title: "GridNinja responsibilities", body: "Document assumptions and gaps, perform the agreed analysis, distinguish modeled findings from operating permission, and deliver the contracted review package." },
] as const

export const assessmentSteps = [
  { title: "Start a scoping inquiry", body: "Describe the capacity decision and organization. This starts a conversation; it does not purchase an assessment." },
  { title: "Review fit and readiness", body: "Agree who owns the decision, what evidence is available, what may be shared, and whether a bounded assessment can answer the question." },
  { title: "Agree the paid scope", body: "Confirm deliverables, schedule, price, review rounds, data handling, exclusions, and acceptance criteria before work starts." },
] as const

export const assessmentOutcomes = [
  { title: "A conditional path", body: "A requested or revised profile fits the modeled conditions. Commercial usefulness and operating permission still require separate decisions." },
  { title: "A useful negative result", body: "The request does not fit the agreed conditions, or a modeled revision does not meet the stated service requirement. The constraint is explicit." },
  { title: "An evidence gap", body: "The available information cannot support a conclusion. The report identifies what is missing and the next investigation required." },
] as const
