CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"cpf" text,
	"phone" text
);
--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "people_user_id_idx" ON "people" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_cpf_idx" ON "people" USING btree ("cpf");