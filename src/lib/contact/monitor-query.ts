import { sql } from "drizzle-orm"

export function monitorCountsQuery(now: Date) {
  return sql`SELECT
      extract(epoch FROM (${now}::timestamptz - min(CASE WHEN status = 'processing' THEN lease_expires_at ELSE next_attempt_at END)
        FILTER (WHERE (status IN ('pending', 'retry_scheduled') AND next_attempt_at <= ${now})
          OR (status = 'processing' AND lease_expires_at <= ${now})))) * 1000 AS oldest_due_ms,
      count(*) FILTER (WHERE status = 'dead_letter' AND (operator_reviewed_through IS NULL OR updated_at > operator_reviewed_through)) AS dead_letters,
      count(*) FILTER (WHERE review_required_at IS NOT NULL AND (operator_reviewed_through IS NULL OR updated_at > operator_reviewed_through)) AS needs_review,
      count(*) FILTER (WHERE status = 'dead_letter' AND last_error_code LIKE '%not_configured' AND (operator_reviewed_through IS NULL OR updated_at > operator_reviewed_through)) AS configuration_failures,
      (SELECT count(DISTINCT e.outbox_id) FROM lead_provider_events e JOIN lead_delivery_outbox o ON o.id = e.outbox_id
        WHERE e.event_type IN ('email.bounced', 'email.failed', 'email.complained', 'email.suppressed')
        AND (o.operator_reviewed_through IS NULL OR e.received_at > o.operator_reviewed_through)) AS recipient_failures,
      max(updated_at) FILTER (WHERE status = 'dead_letter' AND (operator_reviewed_through IS NULL OR updated_at > operator_reviewed_through)) AS dead_letter_revision,
      max(review_required_at) FILTER (WHERE review_required_at IS NOT NULL AND (operator_reviewed_through IS NULL OR updated_at > operator_reviewed_through)) AS review_revision,
      (SELECT max(e.received_at) FROM lead_provider_events e JOIN lead_delivery_outbox o ON o.id = e.outbox_id
        WHERE e.event_type IN ('email.bounced', 'email.failed', 'email.complained', 'email.suppressed')
        AND (o.operator_reviewed_through IS NULL OR e.received_at > o.operator_reviewed_through)) AS recipient_revision,
      (SELECT count(*) FROM lead_provider_events WHERE outbox_id IS NULL AND received_at < ${new Date(now.getTime() - 300_000)}) AS unmatched_events
      FROM lead_delivery_outbox
      WHERE status IN ('pending', 'retry_scheduled', 'processing', 'dead_letter')
        OR (review_required_at IS NOT NULL AND (operator_reviewed_through IS NULL OR updated_at > operator_reviewed_through))`
}
