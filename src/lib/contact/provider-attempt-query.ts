import { sql } from "drizzle-orm"
import { MAX_DELIVERY_ATTEMPTS } from "@/lib/contact/delivery-core"
import type { PreparedProviderRequest } from "@/lib/contact/provider-request"

export function reserveProviderAttemptQuery(outboxId: string, leaseToken: string, reservationId: string, request: PreparedProviderRequest) {
  // All paths lock the lead before its outbox. No lock is held during HTTP.
  return sql`WITH eligible_lead AS MATERIALIZED (
    SELECT l.id FROM lead_submissions l JOIN lead_delivery_outbox o ON o.lead_id = l.id
    WHERE o.id = ${outboxId}::uuid AND l.redacted_at IS NULL
      AND l.redact_after > clock_timestamp() AND l.delete_after > clock_timestamp()
    FOR UPDATE OF l
  ), locked AS MATERIALIZED (
    SELECT o.* FROM lead_delivery_outbox o JOIN eligible_lead l ON l.id = o.lead_id
    WHERE o.id = ${outboxId}::uuid AND o.lease_token = ${leaseToken}::uuid
      AND o.status = 'processing' AND o.lease_expires_at > clock_timestamp()
    FOR UPDATE OF o
  ), classified AS MATERIALIZED (
    SELECT o.*, clock_timestamp() AS checked_at, CASE
      WHEN o.channel::text <> ${request.channel} OR o.idempotency_key <> ${request.idempotencyKey} THEN 'provider_request_identity_changed'
      WHEN o.review_required_at IS NOT NULL THEN 'provider_review_required'
      WHEN o.attempt_count < 1 OR o.attempt_count > ${MAX_DELIVERY_ATTEMPTS} THEN 'attempt_limit_reached'
      WHEN num_nonnulls(o.prepared_request_version, o.provider_request_body, o.provider_request_body_sha256,
        o.provider_target_url, o.provider_account_ref, o.provider_destination_ref, o.first_provider_attempt_at) NOT IN (0, 7)
        THEN 'provider_snapshot_invalid'
      WHEN o.prepared_request_version IS NOT NULL AND o.prepared_request_version <> 1 THEN 'provider_snapshot_invalid'
      WHEN o.first_provider_attempt_at > clock_timestamp() THEN 'provider_clock_invalid'
      WHEN o.first_provider_attempt_at <= clock_timestamp() - interval '23 hours' THEN 'provider_retry_window_expired'
      WHEN o.provider_account_ref IS NOT NULL AND o.provider_account_ref <> ${request.accountRef} THEN 'provider_account_changed'
      WHEN o.provider_target_url IS NOT NULL AND (o.provider_target_url <> ${request.targetUrl}
        OR o.provider_destination_ref <> ${request.destinationRef}) THEN 'provider_destination_changed'
      ELSE NULL END AS stop_reason
    FROM locked o
  ), prepared AS (
    UPDATE lead_delivery_outbox o SET
      status = CASE WHEN c.stop_reason IS NULL THEN o.status ELSE 'dead_letter'::lead_delivery_status END,
      dead_lettered_at = CASE WHEN c.stop_reason IS NULL THEN o.dead_lettered_at ELSE c.checked_at END,
      review_required_at = CASE WHEN c.stop_reason IS NULL THEN o.review_required_at ELSE c.checked_at END,
      review_reason = coalesce(c.stop_reason, o.review_reason),
      last_error_code = CASE WHEN c.stop_reason IS NULL THEN o.last_error_code ELSE 'alert_pending:' || c.stop_reason END,
      next_attempt_at = CASE WHEN c.stop_reason IS NULL THEN o.next_attempt_at ELSE c.checked_at END,
      prepared_request_version = CASE WHEN c.stop_reason IS NULL THEN coalesce(o.prepared_request_version, 1) ELSE o.prepared_request_version END,
      provider_request_body = CASE WHEN c.stop_reason IS NULL THEN coalesce(o.provider_request_body, ${request.bodyUtf8}) ELSE o.provider_request_body END,
      provider_request_body_sha256 = CASE WHEN c.stop_reason IS NULL THEN coalesce(o.provider_request_body_sha256, ${request.bodySha256}) ELSE o.provider_request_body_sha256 END,
      provider_target_url = CASE WHEN c.stop_reason IS NULL THEN coalesce(o.provider_target_url, ${request.targetUrl}) ELSE o.provider_target_url END,
      provider_account_ref = CASE WHEN c.stop_reason IS NULL THEN coalesce(o.provider_account_ref, ${request.accountRef}) ELSE o.provider_account_ref END,
      provider_destination_ref = CASE WHEN c.stop_reason IS NULL THEN coalesce(o.provider_destination_ref, ${request.destinationRef}) ELSE o.provider_destination_ref END,
      first_provider_attempt_at = CASE WHEN c.stop_reason IS NULL THEN coalesce(o.first_provider_attempt_at, c.checked_at) ELSE o.first_provider_attempt_at END,
      updated_at = c.checked_at
    FROM classified c WHERE o.id = c.id
    RETURNING o.*, c.stop_reason, c.checked_at
  ), reservation AS (
    INSERT INTO lead_provider_attempts (id, outbox_id, lease_token, claim_ordinal, reserved_at, provider_account_ref)
    SELECT ${reservationId}::uuid, p.id, ${leaseToken}::uuid, p.attempt_count, p.checked_at, p.provider_account_ref
    FROM prepared p WHERE p.stop_reason IS NULL
    ON CONFLICT (outbox_id, lease_token) DO NOTHING RETURNING id
  ), refreshed AS (
    UPDATE lead_submissions l SET status = CASE
      WHEN EXISTS (SELECT 1 FROM lead_delivery_outbox o WHERE o.lead_id = l.id AND o.status = 'delivered') THEN 'partially_delivered'::lead_status
      WHEN EXISTS (SELECT 1 FROM lead_delivery_outbox o WHERE o.lead_id = l.id AND o.id <> p.id AND o.status = 'processing') THEN 'processing'::lead_status
      WHEN EXISTS (SELECT 1 FROM lead_delivery_outbox o WHERE o.lead_id = l.id AND o.id <> p.id AND o.status IN ('pending','retry_scheduled')) THEN 'queued'::lead_status
      ELSE 'dead_letter'::lead_status END, updated_at = p.checked_at
    FROM prepared p WHERE p.lead_id = l.id AND p.stop_reason IS NOT NULL RETURNING l.id
  ) SELECT p.*, (SELECT id FROM reservation) AS reservation_id FROM prepared p
    WHERE (SELECT count(*) FROM refreshed) >= 0`
}
