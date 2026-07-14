# GridNinja Public Website

This repository contains the public-facing GridNinja website.

GridNinja is positioned as an **AI Data Center Virtual Capacity Control Plane**
and **runtime-assured virtual capacity engine**. The site should communicate
proof-backed virtual capacity for constrained AI infrastructure, not generic
energy management software, DCIM, sustainability software, or dashboard SaaS.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui primitives
- Motion for bounded SVG/diagram animation
- ECharts for chart surfaces

The repo currently uses `package-lock.json`, so use npm unless package-manager
migration is explicitly requested.

## Local Setup

This repository pins Node 22 and npm 10 through `package.json`.

```bash
node -v
node -p "require('./node_modules/next/package.json').engines"
npm install
npm run dev
```

Open `http://localhost:3000`.

## Contact Intake

The Contact and Capacity Audit forms use a durable accept-first pipeline. A
successful browser response means the lead and its delivery outbox already exist
in Postgres; Resend and the optional CRM webhook are processed asynchronously by
signed QStash workers.

Copy `.env.example` to `.env.local` and configure:

- Neon Postgres through `DATABASE_URL`.
- Upstash Redis for distributed IP/email limits.
- Upstash QStash for delivery wake-ups, the one-minute recovery sweep, and the
  daily retention job.
- Cloudflare Turnstile site and secret keys. The example contains Cloudflare's
  pass-through test keys for local development only.
- Resend with a verified `LEAD_EMAIL_FROM` and an internal `LEAD_EMAIL_TO`.
- `LEAD_PSEUDONYM_SECRET` for HMAC-derived IP/email identifiers.
- A no-PII `LEAD_ALERT_WEBHOOK_URL` in production.

CRM delivery is optional. To enable it, configure both `LEAD_WEBHOOK_URL` and
`LEAD_WEBHOOK_SIGNING_SECRET`. GridNinja sends a versioned
`lead.accepted.v1` envelope signed over `<timestamp>.<exact-body>` with the
`X-GridNinja-Timestamp`, `X-GridNinja-Signature`, and idempotency headers. The
receiver must reject stale timestamps and duplicate event IDs. The legacy
bearer-token payload is not supported.

Generate and apply checked-in schema migrations with:

```bash
npm run db:check
npm run db:migrate
```

After deployment, create QStash schedules for
`POST /api/internal/lead-sweep` using `* * * * *` and
`POST /api/internal/lead-retention` using `17 3 * * *` (UTC). Internal endpoints
must never be invoked directly without a valid QStash signature. Use stable
schedule IDs so a configuration rerun updates rather than duplicates them.
The repository command `npm run contact:qstash:configure` creates or updates
both schedules from `QSTASH_TOKEN` and `NEXT_PUBLIC_SITE_URL`.

The manual `Contact staging canary` workflow uses staging-only Turnstile and
notification destinations, submits one real browser lead, and verifies the lead
and all configured delivery rows directly in the staging database.

## Validation

Run these checks before considering substantial UI work complete:

```bash
npm run lint
npm run typecheck
npm run seo:validate
npm run build
npm run test:seo
npm run lighthouse
```

The repository includes dedicated typecheck, unit, integration, and browser-test
scripts. The integration suite requires a disposable PostgreSQL database.

## Main Routes

- `/`
- `/platform`
- `/solutions/ai-cloud`
- `/solutions/colocation`
- `/solutions/bridge-power`
- `/proof`
- `/proof/proof-pack`
- `/demo`
- `/dcii`
- `/roi`
- `/about`
- `/contact`
- `/insights` and publication-gated technical explainers
- `/evidence` and versioned public evidence releases
- `/methodology` for claims, comparisons, corrections, and Capacity Audit methods

Search-facing identity, route, query, claim, and schema contracts live in
`src/seo`. See `docs/seo-release-runbook.md` for Vercel domain, webmaster-tool,
evidence publication, observation, and waiver controls.

## Copy And Product Rules

Preserve the core language:

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
- allow / repair / reject / no-proof

Sample KPI and demo values must be labeled illustrative unless backed by
validated site evidence. DCII and market-context claims should be source-checked
before publication.
