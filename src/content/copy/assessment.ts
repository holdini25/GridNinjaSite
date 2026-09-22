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
