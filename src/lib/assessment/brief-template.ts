import { parseAssessment } from "@/lib/assessment/invariants"
import type { AssessmentQuantity, AssessmentRecord } from "@/types/assessment"

export const BRIEF_TEMPLATE_VERSION = "1.0.0"
const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)
const mw = (value: number) => `${(value / 1000).toFixed(1)} MW`
const quantity = (value: AssessmentQuantity) => value.status === "known" ? mw(value.valueKW) : value.status === "unknown" ? "Unknown" : "Not applicable"

/** Approved, frozen business narrative. No calculated economics or operational acceptance. */
export function assessmentNarrative(input: AssessmentRecord) {
  const record = parseAssessment(input)
  return {
    version: record.publication.narrativeVersion,
    title: record.title,
    conclusion: record.conclusion,
    businessQuestion: record.commercial.question,
    governingConditions: record.reasons.map((reason) => `${reason.label}: ${reason.detail}`),
    economics: record.economics.reason,
    limitations: record.limitations,
    nextStep: "Scope a bounded paid assessment using authorized historical inputs. Scope and price follow the decision and data-readiness discussion.",
  }
}

/** Self-contained HTML is frozen with the snapshot and is the exact input to PDF generation. */
export function renderAssessmentBrief(input: AssessmentRecord): string {
  const record = parseAssessment(input)
  const narrative = assessmentNarrative(record)
  const windowLabel = `${record.basis.startUTC} to ${record.basis.endUTC}`
  const canonical = `https://gridninja.ai/evidence/assessments/${record.publication.id}/v${record.publication.version}`
  const rows = [
    ["Nominal increment", quantity(record.nominal)],
    ["Modeled eligible increment", quantity(record.modeledEligible)],
    ["Requested workload", mw(record.requestedProfile.incrementKW)],
    ["Proposed revised workload", record.revisedProfile ? mw(record.revisedProfile.incrementKW) : "No revision proposed"],
    ["Operator-accepted / observed delivered", "Not applicable / Not applicable"],
  ]
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta name="description" content="${escape(record.conclusion)} Synthetic example; no operational authority."><title>GridNinja decision brief — scenario ${record.scenario.toUpperCase()} v${record.publication.version}</title><link rel="canonical" href="${canonical}">
<style>
@page{size:Letter;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#edf0f2;color:#14212b;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.48}main{max-width:780px;margin:24px auto;padding:30px;background:white;border-top:5px solid #ad6000}header{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #ccd3d9;padding-bottom:14px}.brand{font-weight:700;letter-spacing:.16em}.label{color:#684007;font-weight:700}h1{font-size:28px;line-height:1.15;margin:18px 0 10px}h2{font-size:16px;margin:18px 0 6px}p{margin:6px 0}.summary{font-size:16px;font-weight:600}.scope{background:#f4f6f8;padding:12px;margin:14px 0}table{border-collapse:collapse;width:100%;margin:10px 0}caption{text-align:left;font-weight:700;padding-bottom:6px}th,td{border-bottom:1px solid #dce1e5;padding:6px 0;text-align:left;vertical-align:top}th{font-weight:400;width:64%}td{font-weight:700}ul{padding-left:18px;margin:6px 0}.profiles{font-size:12px;overflow-wrap:anywhere}.question{border-left:3px solid #ad6000;padding-left:12px}footer{border-top:1px solid #ccd3d9;margin-top:16px;padding-top:10px;font-size:12px}a{color:#684007;text-underline-offset:3px}a:focus-visible{outline:2px solid #14212b;outline-offset:3px}.identity{overflow-wrap:anywhere}.print-link{margin-top:10px}.disclaimer{font-weight:700}@media(max-width:550px){main{margin:0;padding:20px}header{display:block}h1{font-size:25px}th{width:56%}}@media print{body{background:white;font-size:10pt;line-height:1.35}main{max-width:none;margin:0;padding:0;border-top:4px solid #ad6000}h1{font-size:22pt}h2{font-size:12pt;margin-top:12px}.summary{font-size:12pt}.scope{padding:9px;margin:10px 0}header{padding:9px 0}th,td{padding:4px 0}.profiles,footer{font-size:8.5pt}.print-link{display:none}section,table,.question,footer{break-inside:avoid}a{color:inherit}}
</style></head><body><main id="main-content"><header><div class="brand">GRIDNINJA</div><div class="label">SYNTHETIC DECISION BRIEF<br>Scenario ${record.scenario.toUpperCase()} · ${escape(record.screeningOutcome)} · v${record.publication.version}</div></header>
<h1>${escape(narrative.title)}</h1><p class="summary">${escape(narrative.conclusion)}</p>
<div class="scope"><strong>${escape(record.basis.siteId)} · ${escape(record.basis.meterBoundary)}</strong><p>All MW figures are additional load above a steady ${mw(record.basis.referenceLoadKW)} reference. Authored UTC window: ${escape(windowLabel)}.</p><p class="disclaimer">Synthetic teaching scenario. No customer result or equipment-control authority.</p></div>
<table><caption>One scope, one hour, distinct quantities</caption><tbody>${rows.map(([label,value]) => `<tr><th scope="row">${escape(label)}</th><td>${escape(value)}</td></tr>`).join("")}</tbody></table>
<p class="profiles">Requested profile: ${escape(record.requestedProfile.id)}.<br>Revised profile: ${record.revisedProfile ? escape(record.revisedProfile.id) : "Not applicable"}.</p>
<section><h2>Governing conditions</h2>${narrative.governingConditions.map((condition) => `<p>${escape(condition)}</p>`).join("")}<p>Boundary, hour, operating reserve, cooling evidence, and workload requirements must be reviewed together.</p></section>
<section class="question"><h2>Business decision still to resolve</h2><p>${escape(narrative.businessQuestion)}</p><p><strong>Economics unestimated.</strong> ${escape(narrative.economics)}</p></section>
<section><h2>What this does not establish</h2><p>Physical feasibility, commercial usefulness, customer report acceptance, operational capacity acceptance, and equipment authority require separate evidence and decisions.</p><p>Phasing, another time window, cooling investment, and bridge power are unassessed investigation options, not evaluated alternatives.</p></section>
<footer><p>${escape(narrative.nextStep)} <a href="https://gridninja.ai/assessment">Scope an assessment</a>.</p><p class="identity">Publication ${escape(record.publication.id)} / ${record.publication.version} · Schema ${escape(record.schemaVersion)} · Narrative ${escape(record.publication.narrativeVersion)} · Template ${BRIEF_TEMPLATE_VERSION}</p><p><a href="${canonical}">Open this exact publication</a> · Integrity hashes identify files; they do not establish validity or permission.</p><p class="print-link">Use your browser’s Print command for a paper copy. <a href="/downloads/assessment/${record.publication.id}/v${record.publication.version}/pdf">Download the matching PDF</a>.</p></footer></main></body></html>`
}
