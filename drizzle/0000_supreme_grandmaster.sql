CREATE TABLE "authors" (
	"id" bigint PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"avatar_url" text,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" bigint PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"alt_text" text,
	"width" integer,
	"height" integer,
	"sizes" jsonb NOT NULL,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_terms" (
	"post_id" bigint NOT NULL,
	"term_id" bigint NOT NULL,
	CONSTRAINT "post_terms_post_id_term_id_pk" PRIMARY KEY("post_id","term_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" bigint PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"excerpt_html" text,
	"content_html" text NOT NULL,
	"status" text NOT NULL,
	"type" text NOT NULL,
	"link" text,
	"published_at" timestamp with time zone NOT NULL,
	"modified_at" timestamp with time zone NOT NULL,
	"author_id" bigint,
	"featured_media_id" bigint,
	"raw" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"modified_after" timestamp with time zone,
	"posts_upserted" integer DEFAULT 0,
	"errors" integer DEFAULT 0,
	"status" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" bigint PRIMARY KEY NOT NULL,
	"taxonomy" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_terms" ADD CONSTRAINT "post_terms_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_terms" ADD CONSTRAINT "post_terms_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_featured_media_id_media_id_fk" FOREIGN KEY ("featured_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_terms_term_id_idx" ON "post_terms" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "posts_published_at_idx" ON "posts" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_modified_at_idx" ON "posts" USING btree ("modified_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_status_published_at_idx" ON "posts" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "terms_taxonomy_slug_unique" ON "terms" USING btree ("taxonomy","slug");--> statement-breakpoint
CREATE INDEX "terms_taxonomy_idx" ON "terms" USING btree ("taxonomy");