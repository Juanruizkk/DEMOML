CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"ml_store" text NOT NULL,
	"weekly_questions" text NOT NULL,
	"qualified" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'nuevo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
