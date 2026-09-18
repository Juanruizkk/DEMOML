ALTER TABLE "tenants" ALTER COLUMN "expires_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "billing_status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "next_billing_date" timestamp;