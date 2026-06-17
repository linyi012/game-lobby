CREATE TABLE IF NOT EXISTS "pair_pack_categories" (
  "id" varchar(32) PRIMARY KEY NOT NULL,
  "name" varchar(64) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pair_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
  "category_id" varchar(32) REFERENCES "pair_pack_categories"("id") ON DELETE cascade,
  "name" varchar(64) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pair_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pack_id" uuid NOT NULL REFERENCES "pair_packs"("id") ON DELETE cascade,
  "civilian_word" varchar(32) NOT NULL,
  "undercover_word" varchar(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS "pair_pack_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" varchar(64),
  "success" boolean NOT NULL,
  "added_count" integer DEFAULT 0 NOT NULL,
  "removed_count" integer DEFAULT 0 NOT NULL,
  "error" text,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
