/** Retained filename and MIME contract; points to a frozen default publication. */
export function GET() {
  return new Response([
    "# GridNinja Sample Proof Pack — compatibility pointer", "",
    "This legacy download points to the synthetic default decision brief (scenario B, v1.0.0).",
    "It is an authored teaching example, not customer evidence or permission to operate equipment.", "",
    "HTML: https://gridninja.ai/evidence/assessments/demo-01-b/v1.0.0",
    "PDF: https://gridninja.ai/downloads/assessment/demo-01-b/v1.0.0/pdf",
    "JSON: https://gridninja.ai/downloads/assessment/demo-01-b/v1.0.0/json", "",
    "Scope a bounded paid assessment: https://gridninja.ai/assessment", "",
  ].join("\n"), { headers: {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Disposition": 'attachment; filename="gridninja-sample-proof-pack.md"',
    "Cache-Control": "public, max-age=0, must-revalidate",
    Link: '<https://gridninja.ai/evidence/assessments/demo-01-b/v1.0.0>; rel="canonical"',
    "X-Robots-Tag": "noindex, follow, noarchive", "X-Content-Type-Options": "nosniff",
  } })
}
