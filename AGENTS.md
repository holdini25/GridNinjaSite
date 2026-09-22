## Approved assessment-first upgrade (22 September 2026)

The current public offer is a bounded, paid capacity decision assessment using
authorized historical inputs. Use “Scope an assessment” as the primary CTA and
“See a sample decision brief” as the secondary. The control-plane/category rules
below describe the development direction and must not imply shipped live control.
Use the source and release boundaries in `docs/website-upgrade/implementation-plan.md`.
All public examples remain synthetic; economics unestimated; accepted/delivered
capacity not applicable. Preserve immutable published brief versions and do not
reintroduce gated files under `public/`. Use npm and the existing package-lock.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

# AGENTS.md

## Purpose

This repository contains the public-facing GridNinja website.

The website's job is to present GridNinja as an **AI Data Center Virtual Capacity Control Plane** and a **runtime-assured virtual capacity engine** that unlocks safe, sellable, usable MW by coordinating workloads, cooling, and on-site power assets inside strict safety and SLA envelopes, with **proof before autonomy**.

This repo is not for building a generic SaaS site, generic climate-tech site, or generic dashboard clone.

---

## Product positioning rules

### Always preserve this category language
Use these phrases frequently and consistently:
- AI Data Center Virtual Capacity Control Plane
- runtime-assured virtual capacity engine
- virtual capacity
- safe, usable, auditable capacity
- proof before autonomy
- Shadow Mode
- bounded autonomy
- Capacity Audit
- dispatch envelope
- inside-the-fence orchestration
- safe sellable MW
- time-to-power
- bridge power
- runtime assurance
- allow / repair / reject

### Avoid these framing mistakes
Do **not** position GridNinja primarily as:
- energy management software
- EMS
- sustainability software
- generic optimization
- PUE optimization
- DCIM replacement
- demand response aggregator
- digital twin platform

These may appear as adjacent concepts, but they must never become the main category label or hero message.

### Core value narrative
The website should repeatedly communicate:
1. The problem is constrained AI capacity, not lack of dashboards.
2. GridNinja converts constrained infrastructure into usable, auditable capacity.
3. The differentiator is inside-the-fence execution + runtime assurance + proof.
4. The business outcomes are:
   - faster time-to-power
   - more sellable capacity
   - safer oversubscription
   - protected SLAs
   - verified flexibility
   - revenue acceleration

---

## Audience priorities

Primary audiences:
- AI cloud operators
- colocation / REIT operators
- bridge power / DER partners
- infrastructure executives
- critical facilities / operations evaluators

When writing copy or building pages:
- executives should understand the business case in under 60 seconds
- technical evaluators should see safety, explainability, and integration discipline
- partners should see that GridNinja integrates with their ecosystem rather than trying to replace everything
- every page should move the user toward a Capacity Audit, Shadow Mode discussion, or pilot conversation

Primary CTA:
- Request Capacity Audit

Secondary CTAs:
- See Shadow Mode
- Book Demo
- Contact Partnerships

---

## Website goals

The site should:
- look premium, technical, and distinctive
- feel like mission control / operator software for executives
- be legible and persuasive without hype
- support future expansion into interactive demos, proof-pack previews, and ROI tools

The site should not:
- look like a generic Tailwind template
- rely on vague AI buzzwords
- overuse stock imagery
- use sustainability tropes (leaves, globes, greenwashing visuals)
- look like a crypto landing page
- bury the business case under technical jargon

---

## Tech stack expectations

Preferred stack:
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Motion
- Apache ECharts
- Vercel

### Implementation defaults
- Prefer Server Components by default.
- Use Client Components only for real interactivity:
  - nav drawer
  - ROI calculators
  - animated diagrams
  - charts
  - interactive forms
- Keep pages light; isolate heavy client-side logic into small islands.
- Prefer composable, reusable section components over giant page files.
- Prefer strongly typed content/config objects for repeated copy and KPI blocks.
- Prefer SVG and code-driven diagrams over image-heavy hero sections.

### Package manager
- Prefer `pnpm` unless the repo already uses a different lockfile.
- Do not switch package managers without a clear reason.

---

## Information architecture expectations

Primary pages expected in this repo:
- Home
- Platform
- Solutions / AI Cloud
- Solutions / Colocation & REIT
- Solutions / Bridge Power & DER
- Proof Before Autonomy
- ROI / Capacity Audit
- About
- Contact

Future pages may include:
- Water-Aware Dispatch
- Partner Ecosystem
- Technical Architecture
- Case Studies
- Demo shell

Do not add new top-level pages casually. Favor improving the existing page system first.

---

## Design system rules

### Visual direction
The site should feel:
- precise
- calm
- premium
- operational
- trustworthy
- technical

### Design language
Use:
- dark surfaces
- clean grids
- strong typography
- thin-line technical diagrams
- disciplined spacing
- restrained motion
- custom KPI cards
- custom comparison layouts
- subtle signal colors for states

Avoid:
- loud gradients used as decoration only
- visual clutter
- oversized glows
- novelty animations
- fake terminal gimmicks
- generic SaaS illustrations

### Motion
Use motion to clarify, not decorate.
Good uses:
- reveal of system diagrams
- capacity-envelope transitions
- KPI count-ups
- subtle hover movement
- proof ladder transitions

Bad uses:
- excessive parallax
- large page transition gimmicks
- looping background motion that hurts legibility

---

## Copywriting rules

### Tone
- executive-grade
- specific
- confident
- concrete
- no fluff

### Copy principles
- prefer business outcomes over feature dumping
- prefer “capacity” over “efficiency”
- prefer “proof” over “claims”
- prefer “safe MW” over abstract “optimization”
- prefer “operators” and “infrastructure teams” over generic “users”

### Homepage message hierarchy
1. The Power Wall / constrained AI infrastructure
2. Why existing tools stop short
3. What GridNinja is
4. How it works
5. KPI / business outcomes
6. Proof Before Autonomy
7. Solution fit by buyer type
8. Capacity Audit CTA

### Required narrative elements somewhere on the site
- virtual capacity
- time-to-power
- bridge power / on-site generation
- runtime assurance
- Shadow Mode
- proof artifacts / evidence
- safe oversubscription
- vendor-agnostic orchestration
- integration with existing systems
- business value tied to capacity / revenue / SLA protection

---

## Proof and trust requirements

This website must consistently reinforce trust.

Always prefer:
- glass-box explanations over black-box claims
- explicit constraints over magic AI language
- proof artifacts over hand-wavy performance claims
- staged autonomy over instant full automation narratives

When presenting product behavior, emphasize:
- Shadow Mode first
- Advisory Mode next
- Bounded Autonomy under strict envelopes
- Expanded Autonomy only after evidence accumulates

Use language like:
- binding constraint
- margin to limit
- allow / repair / reject
- replay
- audit log
- rollback
- proof pack
- capacity report
- safety report

---

## Engineering rules

### Component discipline
- Keep components small and purposeful.
- Prefer one component per conceptual block.
- Avoid giant components that mix layout, content, logic, and animation.
- Move repeated copy or KPI definitions into content/config files.

### Accessibility
Every change should protect:
- semantic structure
- keyboard access
- visible focus states
- strong color contrast
- chart readability
- motion reduction where appropriate

### Performance
Protect:
- fast first load
- limited client JS
- image optimization
- lazy loading where sensible
- transform/opacity-based animation
- minimal layout shift

### SEO
Every public page should have:
- page-specific metadata
- strong title and description
- good heading structure
- OG-ready content where applicable

---

## Charts, diagrams, and interactivity

### Charts
Charts should clarify business value or control logic, not exist for decoration.

Preferred chart types:
- capacity waterfall
- time-to-power comparison
- value stack per MW
- KPI trend lines
- control envelope visuals
- action / proof timelines

### Diagrams
Preferred diagrams:
- telemetry -> model -> decide -> assure -> prove loop
- topology / orchestration map
- autonomy ladder
- proof-pack artifact map
- bridge-power orchestration flow

Do not create arbitrary “AI architecture” diagrams that don’t support the business narrative.

### Calculators
ROI and capacity tools should:
- be simple
- feel credible
- expose assumptions clearly
- never overpromise
- keep outputs tied to business value:
  - accelerated revenue
  - unlocked sellable capacity
  - flexibility value
  - avoided penalties / protected uptime

---

## Integration and content constraints

- Do not introduce a CMS unless asked.
- Do not introduce auth unless asked.
- Do not add a blog unless asked.
- Do not add analytics vendors casually; if adding analytics, keep it minimal and privacy-conscious.
- Do not add unnecessary dependencies for simple UI effects.
- Do not replace the approved stack without explicit instruction.

If the repo later contains partial work, preserve and extend patterns instead of rewriting from scratch unless the current implementation is clearly broken or misaligned.

---

## Working style for Codex

When starting a task:
1. Read the local page/component context before changing code.
2. Keep changes scoped to the request.
3. Reuse existing primitives before inventing new ones.
4. Preserve the product positioning rules in all copy edits.
5. For larger tasks, outline the plan before editing many files.
6. After making changes, run the relevant checks.
7. Review your own diff for:
   - design consistency
   - copy drift
   - broken responsiveness
   - unnecessary complexity
   - positioning mistakes

If you notice repeated friction, propose an update to this AGENTS.md so the guidance improves over time.

---

## Commands and checks

If the relevant scripts exist, run them after meaningful changes:

- install: `pnpm install`
- dev: `pnpm dev`
- lint: `pnpm lint`
- typecheck: `pnpm typecheck`
- test: `pnpm test`
- build: `pnpm build`

Minimum expectation before considering work complete:
- lint passes
- typecheck passes
- build succeeds for substantial UI work

If a command is missing, do not invent it silently. Note the missing script and continue with the checks that do exist.

---

## Review checklist

Before finishing, verify:

### Product / message
- Does this reinforce GridNinja as a virtual capacity control plane?
- Does any copy drift into generic energy-management language?
- Is “proof before autonomy” still visible and clear?
- Is the business case legible?

### UX / design
- Does it look premium and custom?
- Is the page visually coherent on desktop and mobile?
- Are CTAs clear?
- Are charts and diagrams actually useful?

### Engineering
- Is the implementation simpler than the obvious alternative?
- Are client components limited to where interactivity is needed?
- Did we avoid unnecessary dependencies?
- Are accessibility and performance still sound?

---

## If this repo grows

Add nested `AGENTS.md` files only when there is real local complexity, for example:
- `src/app/(marketing)/AGENTS.md` for page/copy rules
- `src/components/charts/AGENTS.md` for charting conventions
- `src/components/diagrams/AGENTS.md` for diagram system rules
- `src/app/demo/AGENTS.md` for the future interactive product shell

Nested guidance should be narrower and more tactical than this root file.

---

## Final rule

If a proposed change makes the site feel like a generic dashboard, generic sustainability software, or generic AI landing page, reject that direction and choose the one that better reinforces:

**GridNinja = proof-backed virtual capacity for constrained AI infrastructure.**
<!-- END:nextjs-agent-rules -->
