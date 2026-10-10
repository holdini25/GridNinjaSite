# Secondary journey integration

Implemented and checked 10 October 2026 in the shared `codex/premium-civic-upgrade` worktree. This records source integration, not a production deployment, Figma canvas approval, or participant result.

## Changes

| Surface | Integration and boundary |
| --- | --- |
| Three solution pages | The shared `DecisionPage` supplies the existing Hero `trustLine` prop: “Paid, bounded assessment of authorized historical inputs. No live connection or equipment control.” Existing assessment and sample helpers retain each solution's source/topic parameters. |
| About | `CivicComposition` follows “The offer today.” The adjacent statement makes explicit that the current assessment does not establish community acceptance or public benefit, which require their own participants, evidence and scope. |
| Proof | `AuthorityComposition` follows the result taxonomy. Its operating-permission step remains a separate authorization gate; the current assessment has no live connection or equipment control. |
| Platform | A static civic illustration follows the intended decision loop. Copy describes a development direction and requires separate validation, agreements and operating authority for any future grid-facing service. The current paid historical-input offer is repeated. |
| Evidence | A helper-based “See a sample decision brief” action appears in the opening header only on `/evidence`. The four existing immutable synthetic publications remain first; a distinct, ungated `ResearchBibliography` follows at `/evidence#research`. Existing publication filters and resources awaiting publication remain in place. |

`SeoResourceHub` gains only an optional `research: ReactNode` slot after `introduction`. Existing metadata, schema, related links and destination helpers remain intact. No new page, tracking event, client island, public artifact release, live-control claim or research figure was added. This change does not alter Home, Hero, Assessment, Demo or CSS; the page owner handles styles and Home integration.

The additional class hooks are `gn-evidence-sample-action`, `gn-civic-local-boundary`, `gn-proof-authority`, `gn-platform-context` and `gn-platform-context-boundary`. Civic geometry is static and decorative, with one equivalent shared-infrastructure description in its HTML caption and an always-visible illustrative/evidence boundary. Its separate mobile composition is a source-level solution to the earlier cropping concern; browser review still has to establish the rendered result.

## Verification and open gates

Nine focused research/journey Vitest tests passed on 10 October 2026. Targeted ESLint passed for all three integration files, research catalog/components and both test files. The full repository type check initially found four image-element typing errors in the concurrently edited browser test `tests/e2e/public-routes.spec.ts`; its owner added explicit image-element narrowing. A subsequent full `tsc --noEmit --incremental false` and `git diff --check` passed. The final release owner must record checks against the completed integrated source, including build and browser results.

The saved Figma research source now uses exact canonical catalog strings. The native Figma file remains pending synchronization because the connector quota prevented inspection and repair; no canvas signoff is claimed. The user approved continuing with a corrected browser design reference while that synchronization is pending.

Browser review must confirm narrow-width visibility, text order, figure/caption pairing, research density and adjacent limitations after styles are applied. Physical iPhone Safari testing, Android coverage and all twelve target-buyer plus four separate grid/community sessions remain pending under the [participant protocol](participant-validation-protocol.md). Expert source review and these automated checks do not substitute for those results.
