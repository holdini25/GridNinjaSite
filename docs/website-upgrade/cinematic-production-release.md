# Cinematic production integration — 28 September 2026

The owner requested merging the cinematic homepage into the final product,
deploying it, and resolving CI failures. The owner then selected: “Deploy the
visual upgrade with the current production contact backend; defer the new
monitoring system.” This is the release scope for this integration.

## Sources and scope

- Integration base: `b15d42234618fbb8acc95230aee6e2babf4d101d`.
- Current production contact baseline: `285f2a2e52366f8d2e4f184fd31a2e75c5742e0a`,
  verified in Vercel's current production deployment.
- Visual source: the preserved `cinematic-facility` worktree's 106-file task
  inventory, including the candidate13 blinking rack lights and restrained
  amber button hover/focus treatment.
- Registered media: `cinematic-v1`, manifest
  `b19c53acb14dd4a0318696a18de6b706b97061f1887fcbbf4edca23190dd3a3c`;
  facility `facility-v12`, manifest
  `95e5b6394da9183cdc57d00992407ffec4fd6d55d1674ffd9bb8d13b6955658f`.

The media is promoted through the normal release registries. No private-candidate
marker or preview override is used. Published assessment versions and previously
registered facility assets remain byte-for-byte unchanged. Editable render
sources and historical qualification evidence remain in the original worktree.

## Hosting and contact boundary

Vercel identifies the project as Hobby. Its rejection of the new every-minute
cron is addressed by deferring the unactivated monitoring system, as requested
by the owner. This is not a daily replacement schedule and does not assert that
an external monitor has been configured. The existing production contact delivery
workflow, database contract, and host credentials are retained. No database
migration, email delivery rehearsal, paid-plan purchase, or new scheduler is part
of this visual release.

## Evidence interpretation

The earlier candidate11 and candidate13 documents describe historical private
checks. They remain historical records: this production integration is a new
source state and must receive its own build and CI results. Owner deployment
authorization does not create independent craft, usability, physical-device, or
screen-reader review results. Missing independent reviews remain unperformed;
they must not be reported as passing.

## CI and delivery corrections

- Restore the deployed contact delivery and database contract; remove the
  unactivated minute cron that Hobby rejected.
- Align SEO, navigation, responsive and facility assertions with the actual
  registered release and assessment-first homepage.
- Keep complete transfer accounting and all thirty facility Lighthouse reports.
  Hosted software-renderer functionality is explicitly separate from physical
  device performance qualification; neither replaces the other.
- On devices reporting software rendering, retain the finished demo poster and
  offer the existing explicit “Explore in 3D” action. A small disposable native
  capability probe runs only when automatic loading would otherwise be eligible.
  Hardware or privacy-masked renderers retain automatic acquisition. Browser
  tests verify the native choice and use the visible control for manual coverage.
- Build explicitly before browser readiness checks in CI. Firefox verifies a
  real WebGL2 context and pixel readback through its headed Linux display.
  Server-readiness deadlines and product budgets are unchanged.
- Enumerate approved cinematic deployment files and exclude private sources;
  integrity, withdrawal, conditional requests, and byte ranges remain enforced.

The local integration build, lint, typecheck and all 1,055 unit tests pass after
these corrections. GitHub checks and Vercel deployment records attached to PR #3
are the authority for the exact merged revision and deployment outcome; earlier
preview success does not establish a successful production deployment.
