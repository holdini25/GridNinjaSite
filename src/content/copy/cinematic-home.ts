/** Current offer copy; the facility is an illustration, never assessment evidence. */
export const cinematicHome = {
  eyebrow: "Capacity decisions · Proof before autonomy",
  headline: "Understand your capacity. Know the limits.",
  body: "Review your next AI workload or tenant commitment against declared facility limits. GridNinja offers a paid, bounded assessment of authorized historical inputs, with a decision brief, supporting model record and unresolved questions for review.",
  trust: "Historical inputs. No live connection or equipment control.",
  purpose: "Data centers share infrastructure with the communities around them. We want growing data centers to be better neighbors and responsible stewards of that shared infrastructure.",
  mechanism: [
    { title: "Model the constraints", body: "Bring the workload, power, cooling and reserve conditions into one bounded assessment." },
    { title: "Check the request", body: "Compare the proposed profile with the declared limits, evidence quality and time window." },
    { title: "Inspect the evidence", body: "Review the result, its assumptions and the business question that still needs an answer." },
  ],
  buyers: [
    { title: "Admit the next AI workload.", audience: "AI cloud infrastructure and operations", body: "Review a proposed workload increment before a service commitment. Keep the facility conditions and service need together.", href: "/solutions/ai-cloud", topic: "ai-cloud" },
    { title: "Commit colocation capacity.", audience: "Colocation operators and infrastructure teams", body: "Examine a proposed tenant increment before a commercial commitment. Make the reserve, evidence and SLA questions explicit.", href: "/solutions/colocation", topic: "colocation" },
  ],
  evidence: [
    { title: "A versioned decision brief", status: "Sample output · Synthetic", body: "A requested profile, modeled revision and unresolved question in a traceable record.", href: "/demo#decision-brief", link: "See a sample decision brief", image: "brief" },
    { title: "Proof before autonomy", status: "Method and authority boundaries", body: "Why a modeled result, a business decision and permission to operate remain distinct.", href: "/proof", link: "Understand the boundaries", image: "cooling" },
    { title: "Physical constraints", status: "Platform direction · In development", body: "The intended relationship between workloads, facility limits and inside-the-fence orchestration.", href: "/platform", link: "Explore the platform direction", image: "construction" },
  ],
} as const
