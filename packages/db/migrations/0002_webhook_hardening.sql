ALTER TABLE "outbox_events" ADD COLUMN "fanned_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "first_failure_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "outbox_unfanned_idx" ON "outbox_events" USING btree ("id") WHERE fanned_out_at IS NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_client_guest_unbilled" CHECK ("memberships"."role" NOT IN ('client', 'guest') OR "memberships"."is_billable_seat" = false);