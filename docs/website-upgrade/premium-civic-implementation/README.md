# Premium civic implementation

The browser implementation is the current design reference. The user explicitly approved proceeding with browser review while Figma synchronization remains pending. The [focused Figma file](https://www.figma.com/design/NwWJIF0no26vNQPZ1sDkeF) is a draft with the known corrections listed in [figma-state.json](figma-state.json), not a locked design or production sign-off.

The subsequent user-supplied architectural reference reopens the civic composition: a static photographic-style landscape and separately composed mobile scene replace the primary outline illustration. These two civic images were produced with the built-in image-generation tool; two native render studies were rejected for insufficient realism. The existing illustration remains a non-JavaScript media fallback. Shared type, color, materials, section transitions and complete visitor paths govern integration. The reference's outcome claims and navigation are not approved copy. Prior candidate `fa933dc` checks remain historical; affected acceptance must bind to the replacement build. See the [civic artwork record](civic-artwork.md) for sources, exact prompts and limitations.

## Implemented scope

- Predominantly dark shared palette and typography, distinct orange/semantic colors, aligned content, mobile actions and selective light document surfaces.
- Civic ambition with a static facility/grid/community composition and explicit current-assessment limits.
- Five distinct homepage subjects: rack infrastructure, colocation hall, nonnumeric published-brief excerpt, authority gate, and whole facility. The three architectural subjects are locally ray-traced, immutable `editorial-v1` assets with responsive WebP delivery.
- Server-rendered three-note research introduction and seven-source annotated bibliography at `/evidence#research`, separate from synthetic GridNinja evidence.
- Assessment, Demo, Platform, Proof, Evidence, About and solution journey refinements using existing primitives and interfaces.
- Source/build-bound QA, expanded route/performance coverage and bounded production tooling. No inquiry backend, assessment schema or analytics vendor change.

Current implementation and the supporting materials follow the [review specification](../premium-civic-review-2026-10-10/design-specification.md). The existing publication, cinematic and facility releases remain immutable.

## Review and release evidence

The [run record](run-record.json) identifies owners, separate reviewers, scope, stopping rules and open dependencies. The [QA runbook](qa-runbook.md) distinguishes candidate checks from release approval. Exact candidate/build identity and command receipts are generated during qualification; provisional screenshots and passing author checks do not close release gates.

The [a3e399c qualification disposition](evidence/a3e399c-qualification.md) preserves the subsequent CI and local failures, their corrections and the explicit bounded requalification decision. Its passing preview and scoped reviews were not a production approval.

The [ac3bf52 qualification disposition](evidence/ac3bf52-qualification.md) records passing local startup/full-scroll evidence, the remaining CI mobile LCP failures, and the narrowly authorized parser-deferred navigation bootstrap correction. Every valid performance sample remains retained.

The [65208e3 qualification disposition](evidence/65208e3-qualification.md) preserves the module-aware unit-harness failure and the bounded correction. Its unchanged application and passing visual captures do not override failed unit qualification.

The [artwork record](editorial-artwork.md) documents the Cycles Metal pipeline, 128/256-sample comparison, color management and its measurement limits. The [research review](research-publication-review.md) preserves actual review dates, source access and limitations. The [participant protocol](participant-validation-protocol.md) and [session template](session-record-template.md) are ready for actual readers; no sessions have been fabricated or replaced by agent simulations.

Physical iPhone/Safari is available but untested. Reader recruitment, physical-device and assistive-technology evidence, final independent reviews, production-configured performance and deployment verification remain release dependencies. Business outcomes require private records and follow-up; diagnostic click counts are not session conversion rates.
