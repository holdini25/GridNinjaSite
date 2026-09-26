CREATE TABLE "lead_operation_heartbeats" (
	"operation" varchar(32) PRIMARY KEY NOT NULL,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_provider_events" (
	"event_id" varchar(200) PRIMARY KEY NOT NULL,
	"provider_message_id" varchar(128) NOT NULL,
	"outbox_id" uuid,
	"event_type" varchar(40) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "provider_request_body" text;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "provider_target_url" text;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "first_provider_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "review_required_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "operator_acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "operator_reviewed_through" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "operator_reference" varchar(64);--> statement-breakpoint
ALTER TABLE "lead_provider_events" ADD CONSTRAINT "lead_provider_events_outbox_id_lead_delivery_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."lead_delivery_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_provider_events_message_idx" ON "lead_provider_events" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "lead_provider_events_outbox_idx" ON "lead_provider_events" USING btree ("outbox_id");--> statement-breakpoint
CREATE INDEX "lead_provider_events_received_idx" ON "lead_provider_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "lead_provider_events_type_idx" ON "lead_provider_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "lead_delivery_outbox_provider_message_idx" ON "lead_delivery_outbox" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "lead_delivery_outbox_review_idx" ON "lead_delivery_outbox" USING btree ("review_required_at");--> statement-breakpoint
-- Previously attempted unresolved work has no trustworthy first-attempt clock
-- or byte snapshot. Quarantine it for reconciliation instead of guessing.
UPDATE lead_delivery_outbox SET status = 'dead_letter', review_required_at = now(),
  dead_lettered_at = now(), last_error_code = 'needs_review_legacy_attempt_unknown',
  lease_token = NULL, lease_expires_at = NULL
WHERE attempt_count > 0 AND status IN ('pending', 'retry_scheduled', 'processing');
--> statement-breakpoint
COMMENT ON COLUMN lead_delivery_outbox.delivered_at IS
  'Legacy transport timestamp: provider acceptance, not recipient mail-server delivery.';
--> statement-breakpoint
UPDATE lead_submissions l SET status = (
  SELECT CASE
    WHEN count(*) FILTER (WHERE o.status <> 'delivered') = 0 THEN 'delivered'::lead_status
    WHEN count(*) FILTER (WHERE o.status <> 'dead_letter') = 0 THEN 'dead_letter'::lead_status
    WHEN count(*) FILTER (WHERE o.status = 'delivered') > 0 THEN 'partially_delivered'::lead_status
    WHEN count(*) FILTER (WHERE o.status = 'processing') > 0 THEN 'processing'::lead_status
    ELSE 'queued'::lead_status END
  FROM lead_delivery_outbox o WHERE o.lead_id = l.id
), updated_at = now()
WHERE EXISTS (SELECT 1 FROM lead_delivery_outbox o WHERE o.lead_id = l.id
  AND o.last_error_code = 'needs_review_legacy_attempt_unknown');
