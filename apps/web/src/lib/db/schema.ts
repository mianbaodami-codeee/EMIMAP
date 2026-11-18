import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * 核心数据库表结构 (PostgreSQL 17 / PGlite 100% 兼容)
 * 包含第一阶段完整使用的「常用网址导引」表，以及为后续阶段规范预留的地理分析与跑分表结构。
 */

export const siteBookmarks = pgTable(
  "site_bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 'system' 代表系统内置预置网站；其他值为创建该自定义网站的用户会话 ID */
    ownerClientId: varchar("owner_client_id", { length: 64 })
      .notNull()
      .default("system"),
    slug: varchar("slug", { length: 128 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    url: varchar("url", { length: 512 }).notNull(),
    domain: varchar("domain", { length: 160 }).notNull(),
    category: varchar("category", { length: 32 }).notNull(),
    description: text("description").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    isOfficial: boolean("is_official").notNull().default(false),
    isBuiltin: boolean("is_builtin").notNull().default(false),
    verifiedNote: varchar("verified_note", { length: 240 }),
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("site_bookmarks_owner_slug_uq").on(
      table.ownerClientId,
      table.slug
    ),
    index("site_bookmarks_category_idx").on(table.category),
    index("site_bookmarks_owner_idx").on(table.ownerClientId),
  ]
);

export const siteFavorites = pgTable(
  "site_favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => siteBookmarks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("site_favorites_client_site_uq").on(
      table.clientId,
      table.siteId
    ),
    index("site_favorites_client_idx").on(table.clientId),
  ]
);

/** 第二阶段：全球地图收藏地点表 */
export const savedPlaces = pgTable(
  "saved_places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    country: varchar("country", { length: 120 }),
    adminArea: varchar("admin_area", { length: 160 }),
    osmMetadata: jsonb("osm_metadata").$type<Record<string, unknown>>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("saved_places_client_idx").on(table.clientId)]
);

/** 第二阶段：全球地图与 AI 地理空间问答历史记录表 */
export const geoQueryHistory = pgTable(
  "geo_query_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    placeName: varchar("place_name", { length: 180 }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    prompt: text("prompt").notNull(),
    provider: varchar("provider", { length: 32 }),
    model: varchar("model", { length: 128 }),
    measuredFacts: jsonb("measured_facts")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    webSources: jsonb("web_sources")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    aiAnalysis: text("ai_analysis").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("geo_query_history_client_created_idx").on(
      table.clientId,
      table.createdAt
    ),
  ]
);

/** 第三阶段预留：跑分挑战 Nonce 与排行榜记录表 */
export const benchmarkRuns = pgTable(
  "benchmark_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    executionMode: varchar("execution_mode", { length: 24 }).notNull(),
    suiteVersion: varchar("suite_version", { length: 24 }).notNull(),
    osInfo: varchar("os_info", { length: 120 }).notNull(),
    cpuLabel: varchar("cpu_label", { length: 160 }).notNull(),
    gpuLabel: varchar("gpu_label", { length: 160 }).notNull(),
    logicalCores: integer("logical_cores").notNull(),
    cpuSingleScore: integer("cpu_single_score").notNull(),
    cpuMultiScore: integer("cpu_multi_score").notNull(),
    gpuScore: integer("gpu_score").notNull(),
    memoryScore: integer("memory_score").notNull(),
    storageScore: integer("storage_score").notNull(),
    totalScore: integer("total_score").notNull(),
    verified: boolean("verified").notNull().default(false),
    environmentMeta: jsonb("environment_meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("benchmark_runs_mode_score_idx").on(
      table.executionMode,
      table.totalScore
    ),
  ]
);
