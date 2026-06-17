CREATE TABLE IF NOT EXISTS "word_pack_categories" (
  "id" varchar(32) PRIMARY KEY NOT NULL,
  "name" varchar(64) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "word_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
  "category_id" varchar(32) REFERENCES "word_pack_categories"("id") ON DELETE cascade,
  "name" varchar(64) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "word_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pack_id" uuid NOT NULL REFERENCES "word_packs"("id") ON DELETE cascade,
  "word" varchar(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS "word_pack_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" varchar(64),
  "success" boolean NOT NULL,
  "added_count" integer DEFAULT 0 NOT NULL,
  "removed_count" integer DEFAULT 0 NOT NULL,
  "error" text,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
