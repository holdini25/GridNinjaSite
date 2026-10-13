CREATE TABLE "lead_provider_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"outbox_id" uuid NOT NULL,
	"lease_token" uuid NOT NULL,
	"claim_ordinal" integer NOT NULL,
	"reserved_at" timestamp with time zone NOT NULL,
	"provider_account_ref" varchar(64) NOT NULL,
	"result_category" varchar(32),
	"provider_message_id" varchar(128),
	"result_code" varchar(64),
	"result_http_status" integer,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_delivery_acknowledgements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"outbox_id" uuid NOT NULL,
	"operator_reference" varchar(64) NOT NULL,
	"reviewed_through" timestamp with time zone NOT NULL,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_operations_heartbeats" (
	"job" varchar(32) PRIMARY KEY NOT NULL,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_provider_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider_account_ref" varchar(64) NOT NULL,
	"provider_event_id" varchar(200) NOT NULL,
	"provider_message_id" varchar(128) NOT NULL,
	"outbox_id" uuid,
	"event_type" varchar(32) NOT NULL,
	"provider_occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"conflicted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "prepared_request_version" integer;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "provider_request_body" text;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "provider_request_body_sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "provider_target_url" text;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "provider_account_ref" varchar(64);--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "provider_destination_ref" varchar(64);--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "first_provider_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "review_required_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD COLUMN "review_reason" varchar(64);--> statement-breakpoint
ALTER TABLE "lead_provider_attempts" ADD CONSTRAINT "lead_provider_attempts_outbox_id_lead_delivery_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."lead_delivery_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_delivery_acknowledgements" ADD CONSTRAINT "lead_delivery_acknowledgements_outbox_id_lead_delivery_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."lead_delivery_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_provider_events" ADD CONSTRAINT "lead_provider_events_outbox_id_lead_delivery_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."lead_delivery_outbox"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_provider_attempts_lease_uidx" ON "lead_provider_attempts" USING btree ("outbox_id","lease_token");--> statement-breakpoint
CREATE INDEX "lead_provider_attempts_message_idx" ON "lead_provider_attempts" USING btree ("provider_account_ref","provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_delivery_acknowledgements_review_uidx" ON "lead_delivery_acknowledgements" USING btree ("outbox_id","operator_reference","reviewed_through");--> statement-breakpoint
CREATE INDEX "lead_delivery_acknowledgements_outbox_idx" ON "lead_delivery_acknowledgements" USING btree ("outbox_id","reviewed_through");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_provider_events_account_event_uidx" ON "lead_provider_events" USING btree ("provider_account_ref","provider_event_id");--> statement-breakpoint
CREATE INDEX "lead_provider_events_account_message_idx" ON "lead_provider_events" USING btree ("provider_account_ref","provider_message_id");--> statement-breakpoint
CREATE INDEX "lead_provider_events_outbox_received_idx" ON "lead_provider_events" USING btree ("outbox_id","received_at");--> statement-breakpoint
-- Existing unresolved claims have no trustworthy request/account or first-send
-- clock. Preserve IDs and keys, and quarantine rather than inventing history.
UPDATE lead_delivery_outbox SET status = 'dead_letter',
  dead_lettered_at = now(), review_required_at = now(),
  review_reason = 'legacy_attempt_unknown',
  last_error_code = 'alert_pending:legacy_attempt_unknown',
  lease_token = NULL, lease_expires_at = NULL, next_attempt_at = now(), updated_at = now()
WHERE (attempt_count > 0 OR status = 'processing')
  AND status IN ('pending', 'retry_scheduled', 'processing');
--> statement-breakpoint
UPDATE lead_submissions l SET status = (
  SELECT CASE
    WHEN count(*) FILTER (WHERE o.status <> 'delivered') = 0 THEN 'delivered'::lead_status
    WHEN count(*) FILTER (WHERE o.status <> 'dead_letter') = 0 THEN 'dead_letter'::lead_status
    WHEN count(*) FILTER (WHERE o.status = 'delivered') > 0 THEN 'partially_delivered'::lead_status
    WHEN count(*) FILTER (WHERE o.status = 'processing') > 0 THEN 'processing'::lead_status
    ELSE 'queued'::lead_status END FROM lead_delivery_outbox o WHERE o.lead_id = l.id
), updated_at = now()
WHERE EXISTS (SELECT 1 FROM lead_delivery_outbox o WHERE o.lead_id = l.id AND o.review_reason = 'legacy_attempt_unknown');
--> statement-breakpoint
COMMENT ON COLUMN lead_delivery_outbox.delivered_at IS
  'Legacy transport field: provider acceptance, not recipient mail-server delivery.';
