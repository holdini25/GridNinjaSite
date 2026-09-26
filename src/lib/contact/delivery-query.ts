import { sql } from "drizzle-orm"

export function beginProviderAttemptQuery(outboxId: string, leaseToken: string,
  request: { body: string; targetUrl: string }, now: Date) {
  // Lock the lead before the outbox, in the same order as retention. A worker
  // holding an old in-memory claim cannot recreate a redacted request snapshot.
  return sql`WITH eligible_lead AS MATERIALIZED (
    SELECT l.id FROM lead_submissions l JOIN lead_delivery_outbox o ON o.lead_id = l.id
    WHERE o.id = ${outboxId} AND l.redacted_at IS NULL
      AND l.redact_after > clock_timestamp() AND l.delete_after > clock_timestamp()
    FOR UPDATE OF l
  ) UPDATE lead_delivery_outbox o SET
    first_provider_attempt_at = coalesce(o.first_provider_attempt_at, ${now}),
    provider_request_body = coalesce(o.provider_request_body, ${request.body}),
    provider_target_url = coalesce(o.provider_target_url, ${request.targetUrl}),
    updated_at = ${now}
  FROM eligible_lead l WHERE o.id = ${outboxId} AND o.lead_id = l.id
    AND o.lease_token = ${leaseToken} AND o.status = 'processing'
    AND o.lease_expires_at > clock_timestamp() AND o.review_required_at IS NULL
  RETURNING o.first_provider_attempt_at, o.provider_request_body, o.provider_target_url`
}

export function redactExpiredLeadsQuery(cutoff: Date, limit: number) {
  const boundedLimit = Math.max(1, Math.min(limit, 5000))
  // A single materialized ID set is shared by both mutations. Re-evaluating a
  // LIMIT query in a second statement could redact a different set of leads.
  return sql`WITH candidates AS MATERIALIZED (
    SELECT id FROM lead_submissions WHERE redacted_at IS NULL AND redact_after <= ${cutoff}
    ORDER BY redact_after, id LIMIT ${boundedLimit} FOR UPDATE SKIP LOCKED
  ), retired_outbox AS (
    UPDATE lead_delivery_outbox o SET
      provider_request_body = NULL, provider_target_url = NULL,
      lease_token = NULL, lease_expires_at = NULL,
      status = CASE WHEN o.status IN ('pending', 'retry_scheduled', 'processing')
        THEN 'dead_letter'::lead_delivery_status ELSE o.status END,
      dead_lettered_at = CASE WHEN o.status IN ('pending', 'retry_scheduled', 'processing')
        THEN ${cutoff} ELSE o.dead_lettered_at END,
      last_error_code = CASE WHEN o.status IN ('pending', 'retry_scheduled', 'processing')
        THEN 'lead_retention_expired' ELSE o.last_error_code END,
      updated_at = CASE WHEN o.status IN ('pending', 'retry_scheduled', 'processing') THEN ${cutoff} ELSE o.updated_at END
    WHERE o.lead_id IN (SELECT id FROM candidates) RETURNING o.id
  ) UPDATE lead_submissions l SET
    request_fingerprint = NULL, name = NULL, company = NULL, email = NULL,
    normalized_email = NULL, role = NULL, buyer_type = NULL, site_type = NULL,
    timeline = NULL, capacity_range = NULL, topic = NULL, constraints = NULL,
    message = NULL, source = NULL, ip_hash = NULL, turnstile_hostname = NULL,
    turnstile_action = NULL, turnstile_challenge_at = NULL,
    redacted_at = ${cutoff}, updated_at = ${cutoff},
    status = CASE
      WHEN NOT EXISTS (SELECT 1 FROM lead_delivery_outbox o WHERE o.lead_id = l.id AND o.status <> 'delivered')
        THEN 'delivered'::lead_status
      WHEN EXISTS (SELECT 1 FROM lead_delivery_outbox o WHERE o.lead_id = l.id AND o.status = 'delivered')
        THEN 'partially_delivered'::lead_status
      ELSE 'dead_letter'::lead_status END
  WHERE l.id IN (SELECT id FROM candidates) AND (SELECT count(*) FROM retired_outbox) >= 0
  RETURNING l.id`
}
