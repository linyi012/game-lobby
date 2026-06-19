CREATE TABLE IF NOT EXISTS "script_murder_scripts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE cascade,
  "title" varchar(128) NOT NULL,
  "description" varchar(512) DEFAULT '' NOT NULL,
  "min_players" integer DEFAULT 4 NOT NULL,
  "max_players" integer DEFAULT 8 NOT NULL,
  "content_json" text DEFAULT '{}' NOT NULL,
  "is_official" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
