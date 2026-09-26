import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { pathToFileURL } from "node:url"

// Reviewed capability exclusions, not a snapshot of whatever happened to skip.
// Every other selected test must execute in every project; new skips fail closed.
const projects = ["chromium-desktop", "chromium-mobile", "firefox-desktop", "webkit-desktop", "webkit-mobile"]
const common = [
  "all ordered transitions keep the explanation, quantities, and exact exports synchronized",
  "technical download serves the current record and its publication version",
  "history and reset restore the same record, perspective, interval, and disclosure state",
  "unavailable and ambiguous deep links never display a substituted result",
  "keyboard focus and accessible alternatives survive reduced-motion scenario changes",
  "server-rendered explanation and fixture navigation work without JavaScript",
  "hands off from the drawer to a non-wrapping desktop header at 1120px",
  "uses one mobile accordion at a time without duplicate parent links",
  "keeps active navigation scrollable above a fixed mobile CTA",
  "a hypothetical minimum never changes assessment identity, files, or navigation",
  "visible reading stops scene frames, keeps interaction, and resumes ambient activity without rewriting preferences",
  "reading pauses playback at the current chapter and closing it requires explicit Play",
  "published briefs and hypothetical examples remain usable without JavaScript",
  "production CSP preserves native journeys while blocking handlers and external scripts",
  "frozen publications retain their stricter CSP and no executable application code",
  "home keeps inspection journeys native and loads no specimen before an explicit demo action",
  "deep links restore authored focus without graphics and preserve exact records across history",
  "unknown focus clears only selection; conflicting assessment identities remain unavailable",
  "solution still entry carries an editable public topic through named scoping navigation",
  "no-JavaScript focus and evidence remain usable as HTML",
]
const desktop = [
  "uses deterministic disclosure buttons with concise destination context",
  "supports pointer hover without making hover the only interaction",
  "traverses submenu links and restores trigger focus on Escape",
  "closes on outside interaction and when focus leaves the group",
  "marks one most-specific child and shows the active orange dot",
  "updates the active marker after a client-side route change and history return",
]
const representative = [
  { title: "opens disclosures by tap without depending on hover", reason: "one representative touch-capable desktop context" },
  { title: "remains usable with motion reduction enabled", reason: "one representative reduced-motion context" },
]

export function enterpriseFunctionalPolicy(project) {
  if (!projects.includes(project)) throw new Error(`Unknown qualification project: ${project}`)
  const mobile = project.endsWith("-mobile"), representativeProject = project === "chromium-desktop"
  return {
    scope: "software-browser-functional-only",
    productionConfiguredPerformance: "not-run; requires actual production observability, verification and HTTPS delivery",
    requiredTitles: [...common, ...(mobile ? [] : desktop), ...(representativeProject ? representative.map(item => item.title) : [])].map(title => ({ title, project })),
    allowedSkips: [
      ...(mobile ? desktop.map(title => ({ title, project, reason: "desktop navigation only" })) : []),
      ...(!representativeProject ? representative.map(item => ({ ...item, project })) : []),
    ],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [project, output] = process.argv.slice(2)
  if (!output) throw new Error("Usage: enterprise-functional-policy.mjs <project> <output.json>")
  const policy = enterpriseFunctionalPolicy(project)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(policy, null, 2)}\n`)
}
