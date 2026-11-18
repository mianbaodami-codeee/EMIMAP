-- OmniKit AI Initial PostgreSQL Migration (0000_initial_schema.sql)
-- Compatible with PostgreSQL 16/17 and PGlite

CREATE TABLE IF NOT EXISTS "site_bookmarks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_client_id" varchar(64) DEFAULT 'system' NOT NULL,
  "slug" varchar(128) NOT NULL,
  "name" varchar(80) NOT NULL,
  "url" varchar(512) NOT NULL,
  "domain" varchar(160) NOT NULL,
  "category" varchar(32) NOT NULL,
  "description" text NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_official" boolean DEFAULT false NOT NULL,
  "is_builtin" boolean DEFAULT false NOT NULL,
  "verified_note" varchar(240),
  "sort_order" integer DEFAULT 100 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "site_bookmarks_owner_slug_uq"
  ON "site_bookmarks" ("owner_client_id", "slug");
CREATE INDEX IF NOT EXISTS "site_bookmarks_category_idx"
  ON "site_bookmarks" ("category");
CREATE INDEX IF NOT EXISTS "site_bookmarks_owner_idx"
  ON "site_bookmarks" ("owner_client_id");

CREATE TABLE IF NOT EXISTS "site_favorites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" varchar(64) NOT NULL,
  "site_id" uuid NOT NULL REFERENCES "site_bookmarks"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "site_favorites_client_site_uq"
  ON "site_favorites" ("client_id", "site_id");
CREATE INDEX IF NOT EXISTS "site_favorites_client_idx"
  ON "site_favorites" ("client_id");

CREATE TABLE IF NOT EXISTS "saved_places" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" varchar(64) NOT NULL,
  "name" varchar(160) NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "country" varchar(120),
  "admin_area" varchar(160),
  "osm_metadata" jsonb,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "saved_places_client_idx"
  ON "saved_places" ("client_id");

CREATE TABLE IF NOT EXISTS "geo_query_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" varchar(64) NOT NULL,
  "place_name" varchar(180) NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "prompt" text NOT NULL,
  "provider" varchar(32),
  "model" varchar(128),
  "measured_facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "web_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "ai_analysis" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "geo_query_history_client_created_idx"
  ON "geo_query_history" ("client_id", "created_at");

CREATE TABLE IF NOT EXISTS "benchmark_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "execution_mode" varchar(24) NOT NULL,
  "suite_version" varchar(24) NOT NULL,
  "os_info" varchar(120) NOT NULL,
  "cpu_label" varchar(160) NOT NULL,
  "gpu_label" varchar(160) NOT NULL,
  "logical_cores" integer NOT NULL,
  "cpu_single_score" integer NOT NULL,
  "cpu_multi_score" integer NOT NULL,
  "gpu_score" integer NOT NULL,
  "memory_score" integer NOT NULL,
  "storage_score" integer NOT NULL,
  "total_score" integer NOT NULL,
  "verified" boolean DEFAULT false NOT NULL,
  "environment_meta" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "benchmark_runs_mode_score_idx"
  ON "benchmark_runs" ("execution_mode", "total_score");
