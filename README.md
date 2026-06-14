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

Next.js 16.2 requires Node `>=20.9.0`.

```bash
node -v
node -p "require('./node_modules/next/package.json').engines"
npm install
npm run dev
```

Open `http://localhost:3000`.

## Lead Delivery

The contact API intentionally requires at least one delivery target:

- `LEAD_WEBHOOK_URL`
- or `RESEND_API_KEY` with `LEAD_EMAIL_TO`

Optional variables:

- `LEAD_WEBHOOK_BEARER_TOKEN`
- `LEAD_EMAIL_FROM`
- `NEXT_PUBLIC_SITE_URL`

Without a configured delivery target, `/api/contact` returns a delivery error by
design.

## Validation

Run these checks before considering substantial UI work complete:

```bash
npm run lint
npm exec tsc -- --noEmit
npm run build
```

There is no dedicated `typecheck` or `test` script at the moment. Use
`npm exec tsc -- --noEmit` for TypeScript validation.

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
