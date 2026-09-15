CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"order_id" text NOT NULL,
	"type" text NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"reason_detail" text,
	"buyer_id" text,
	"buyer_nickname" text,
	"item_id" text,
	"item_title" text,
	"item_price" double precision,
	"item_quantity" integer,
	"complainant_message" text,
	"actions_json" text DEFAULT '[]' NOT NULL,
	"due_date" timestamp NOT NULL,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" text,
	"question_id" text,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "item_knowledge" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"item_id" text NOT NULL,
	"custom_instructions" text DEFAULT '',
	"faqs_json" text DEFAULT '[]',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "items_cache" (
	"item_id" text PRIMARY KEY NOT NULL,
	"seller_id" text,
	"payload_json" text NOT NULL,
	"cached_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"channel" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"tokens_estimated" boolean DEFAULT false NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "llm_usage_monthly" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"year_month" text NOT NULL,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" double precision DEFAULT 0 NOT NULL,
	"spending_limit_usd" double precision,
	"alert_sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "order_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"pack_id" text NOT NULL,
	"order_id" text,
	"buyer_id" text NOT NULL,
	"buyer_nickname" text,
	"item_id" text,
	"item_title" text,
	"message_text" text NOT NULL,
	"sender_role" text NOT NULL,
	"intent" text,
	"confidence" double precision,
	"requires_human" boolean DEFAULT false,
	"reason" text,
	"suggested_answer" text,
	"final_answer" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"replied_at" timestamp,
	"latency_ms" integer,
	"ml_error" text
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"question_id" text PRIMARY KEY NOT NULL,
	"seller_id" text DEFAULT 'default' NOT NULL,
	"item_id" text NOT NULL,
	"buyer_id" text,
	"text" text NOT NULL,
	"ml_status" text,
	"intent" text,
	"confidence" double precision,
	"requires_human" boolean DEFAULT false,
	"reason" text,
	"suggested_answer" text,
	"final_answer" text,
	"app_status" text NOT NULL,
	"received_at" timestamp DEFAULT now(),
	"answered_at" timestamp,
	"latency_ms" integer,
	"ml_error" text
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"nickname" text,
	"email" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" integer NOT NULL,
	"settings_json" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_seller_id_unique" UNIQUE("seller_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"seller_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"activation_token" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "idx_claims_seller" ON "claims" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_claims_due_date" ON "claims" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_events_seller" ON "events" USING btree ("seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_knowledge_seller_item_key" ON "item_knowledge" USING btree ("seller_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_item_knowledge_seller" ON "item_knowledge" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_llm_usage_logs_seller_date" ON "llm_usage_logs" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "llm_usage_monthly_seller_month_key" ON "llm_usage_monthly" USING btree ("seller_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_llm_usage_monthly_seller" ON "llm_usage_monthly" USING btree ("seller_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_order_messages_seller" ON "order_messages" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_order_messages_pack" ON "order_messages" USING btree ("pack_id");--> statement-breakpoint
CREATE INDEX "idx_order_messages_status" ON "order_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_questions_seller" ON "questions" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_questions_status" ON "questions" USING btree ("app_status");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_seller" ON "users" USING btree ("seller_id");