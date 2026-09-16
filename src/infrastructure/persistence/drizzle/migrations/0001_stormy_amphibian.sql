CREATE TABLE "golden_dataset" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"source_question_id" text NOT NULL,
	"question_text" text NOT NULL,
	"item_snapshot" text NOT NULL,
	"llm_intent" text NOT NULL,
	"human_intent" text NOT NULL,
	"llm_answer" text NOT NULL,
	"final_answer" text NOT NULL,
	"decision" text NOT NULL,
	"quality_rating" integer,
	"reviewer_id" text,
	"reasoning_note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_golden_seller" ON "golden_dataset" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_golden_intent" ON "golden_dataset" USING btree ("human_intent");--> statement-breakpoint
CREATE INDEX "idx_golden_decision" ON "golden_dataset" USING btree ("decision");