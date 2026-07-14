import "server-only"

import { proofPackChecklist, proofPackIncludes, proofPackSampleLog } from "@/content/copy/proof-pack"

export function GET() {
  const lines = [
    "# GridNinja Sample Proof Pack",
    "",
    "This illustrative sample previews the operator-facing artifacts behind Proof Before Autonomy. It is not validated site evidence.",
    "",
    "## Deployment boundary",
    "- Mode: read-only Shadow Mode",
    "- Write credentials: none",
    "- Command VLAN requirement: none",
    "- Authority: operator policy, deterministic checks, and runtime assurance remain the gate",
    "",
    "## Proof thesis",
    "Every accepted MW must point to a proof row. If evidence is stale, incomplete, or outside policy, the correct answer is no-proof.",
    "",
    "## Included artifacts",
    ...proofPackIncludes.map((item) => `- ${item}`),
    "",
    "## Evidence classes",
    "- Technical data: telemetry completeness, constraint maps, replay traces, RTA outcomes",
    "- Operational data: operator review time, no-proof gaps, policy exceptions, workload/cooling constraints",
    "- Commercial data: proof-adjusted MW, accepted-headroom ledger, design-partner criteria",
    "- Impact data: grid-readiness posture, dispatch envelope, local reliability support potential",
    "",
    "## Sample log",
    ...proofPackSampleLog.map((line) => `- ${line.label}: ${line.value}`),
    "",
    "## No-proof posture",
    "- Missing telemetry is assigned to an owner before capacity is counted.",
    "- Unknown topology is a proof gap, not hidden headroom.",
    "- Reserve-floor policy is declared before bridge power or storage is considered flexible.",
    "",
    "## Review checklist",
    ...proofPackChecklist.map((item) => `- ${item}`),
    "",
    "## Public / private boundary",
    "- Public: artifact types, methodology summary, non-confidential findings, and source notes.",
    "- Private: site topology, credentials, customer data, security-sensitive telemetry, and exact operating limits.",
    "",
    "## Next step",
    "Request a Capacity Audit to generate a site-specific proof pack and Shadow Mode evidence baseline.",
    "",
  ]

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="gridninja-sample-proof-pack.md"',
      "Cache-Control": "public, max-age=0, must-revalidate",
      Link: '<https://gridninja.ai/proof/proof-pack>; rel="canonical"',
      "X-Robots-Tag": "noindex, follow, noarchive",
    },
  })
}
