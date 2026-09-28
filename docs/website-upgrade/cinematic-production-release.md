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

Current CI corrections and deployment outcome will be recorded after execution.
