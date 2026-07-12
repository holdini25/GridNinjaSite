CREATE TYPE "public"."lead_delivery_channel" AS ENUM('internal_email', 'crm_webhook');--> statement-breakpoint
CREATE TYPE "public"."lead_delivery_status" AS ENUM('pending', 'processing', 'retry_scheduled', 'delivered', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."lead_form_type" AS ENUM('capacity_audit', 'contact');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('queued', 'processing', 'partially_delivered', 'delivered', 'dead_letter');--> statement-breakpoint
CREATE TABLE "lead_delivery_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lead_id" uuid NOT NULL,
	"channel" "lead_delivery_channel" NOT NULL,
	"status" "lead_delivery_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"dead_lettered_at" timestamp with time zone,
	"provider_message_id" varchar(255),
	"last_error_code" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"client_submission_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"schema_version" integer NOT NULL,
	"form_type" "lead_form_type" NOT NULL,
	"status" "lead_status" DEFAULT 'queued' NOT NULL,
	"intent" varchar(64) NOT NULL,
	"request_fingerprint" varchar(64),
	"name" varchar(120),
	"company" varchar(160),
	"email" varchar(254),
	"normalized_email" varchar(254),
	"role" varchar(120),
	"buyer_type" varchar(120),
	"site_type" varchar(120),
	"timeline" varchar(120),
	"constraints" jsonb,
	"message" text,
	"source" varchar(120),
	"ip_hash" varchar(64),
	"turnstile_hostname" varchar(253),
	"turnstile_action" varchar(64),
	"turnstile_challenge_at" timestamp with time zone,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"redact_after" timestamp with time zone NOT NULL,
	"delete_after" timestamp with time zone NOT NULL,
	"redacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_delivery_outbox" ADD CONSTRAINT "lead_delivery_outbox_lead_id_lead_submissions_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_delivery_outbox_lead_channel_uidx" ON "lead_delivery_outbox" USING btree ("lead_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_delivery_outbox_idempotency_key_uidx" ON "lead_delivery_outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "lead_delivery_outbox_due_idx" ON "lead_delivery_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "lead_delivery_outbox_lease_idx" ON "lead_delivery_outbox" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_submissions_client_submission_id_uidx" ON "lead_submissions" USING btree ("client_submission_id");--> statement-breakpoint
CREATE INDEX "lead_submissions_redact_after_idx" ON "lead_submissions" USING btree ("redact_after");--> statement-breakpoint
CREATE INDEX "lead_submissions_delete_after_idx" ON "lead_submissions" USING btree ("delete_after");