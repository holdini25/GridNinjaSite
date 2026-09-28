# V7 public topic and contact intake

The optional public topic is an allowlisted enum: `ai-cloud`, `colocation`, `power`, `cooling`, `storage`, or `workloads`. It is independent of visitor inquiry text and assessment identity. Invalid or repeated URL topic values are ignored. Form visitors may edit or remove the topic before submission.

The assessment-scoping page keeps its prerendered route. URL topic/source context is resolved by the existing form client boundary after hydration. Native static decision and evidence links remain usable without JavaScript; form submission already requires JavaScript and security verification, with an explicit no-JavaScript explanation.

## Deployment prerequisite

Apply the additive migration `drizzle/0002_public_assessment_topic.sql` through the repository's normal database release process **before deploying the updated contact application**. The implementation added the migration and Drizzle metadata; it did not run a database migration or send any inquiry. Existing rows remain valid with `topic = NULL`.

The optional topic is validated in contact schema v2, persisted separately in `lead_submissions.topic`, included in v2 delivery only when valid, and removed by the existing retention redaction. Webhook v1 and v2 records without a topic retain their existing payload shape; no new webhook version is introduced.

## Retry and privacy

- The topic participates in both browser and server normalized submission fingerprints. Changing it under an uncertain receipt requires the existing explicit new-inquiry action.
- Version-1 tab recovery attempts accept an absent topic. New attempts store only the public topic beside the existing reference, fingerprint, and placement attribution; visitor prose and security tokens remain unpersisted.
- An uncertain retry reuses its original business payload. Reload restores the original public topic independently of any new topic in the URL.
- Analytics retain the existing intent/source event schema. No inquiry text, equipment identity, or topic is added to analytics.
- Links carry only the allowlisted public topic and approved placement source. Assessment publications and their versioned bytes are unchanged.

## Verification

Unit coverage includes URL allowlisting and duplicate rejection, editable form selection, reload recovery, identical uncertain retry payloads, changed-topic idempotency conflict, API persistence, optional v2 delivery, and unchanged absent-topic/v1 delivery behavior. The PostgreSQL integration suite includes the additive migration and verifies nullable topic persistence when `TEST_DATABASE_URL` is available. No live database or external delivery is required for unit checks.
