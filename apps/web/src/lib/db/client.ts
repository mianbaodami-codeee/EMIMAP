import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { BUILTIN_SITE_SEEDS } from "./seed-sites";
import { extractDomain } from "../http/safe-url";

/**
 * 数据库双模连接与幂等迁移引擎
 * - 当 DATABASE_URL 为 postgresql:// 或 postgres:// 时，使用标准 pg 连接池连接外部 PostgreSQL 服务（生产环境 / Docker Compose）。
 * - 当 DATABASE_URL 为空、memory:// 或 pglite:// 时，自动启动内嵌原生 PostgreSQL 引擎 PGlite，保证零守护进程环境下 100% SQL 兼容。
 */

export type DatabaseDriverType = "postgres" | "pglite";
export type AppDb = PgliteDatabase<typeof schema>;

interface GlobalDbHolder {
  __omnikitDbInstance?: {
    db: AppDb;
    driver: DatabaseDriverType;
    rawExec: (ddl: string) => Promise<void>;
  };
  __omnikitDbInitPromise?: Promise<{
    db: AppDb;
    driver: DatabaseDriverType;
  }>;
}

const globalForDb = globalThis as unknown as GlobalDbHolder;

function resolveMigrationSql(): string {
  const candidates = [
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), "drizzle/0000_initial_schema.sql"),
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), "apps/web/drizzle/0000_initial_schema.sql"),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      return fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8");
    }
  }
  throw new Error("未找到 PostgreSQL 初始迁移文件 0000_initial_schema.sql");
}

function createDatabaseHandle(): {
  db: AppDb;
  driver: DatabaseDriverType;
  rawExec: (ddl: string) => Promise<void>;
} {
  if (globalForDb.__omnikitDbInstance) {
    return globalForDb.__omnikitDbInstance;
  }

  const rawUrl = (process.env.DATABASE_URL || "").trim();
  const isRemotePostgres =
    rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://");

  if (isRemotePostgres) {
    const pool = new Pool({
      connectionString: rawUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
    const db = drizzleNodePg(pool, { schema }) as unknown as AppDb;
    globalForDb.__omnikitDbInstance = {
      db,
      driver: "postgres",
      rawExec: async (ddl: string) => {
        await pool.query(ddl);
      },
    };
    return globalForDb.__omnikitDbInstance;
  }

  // 解析 PGlite 存储路径：默认存放于用户缓存目录（源码树之外），避免 WAL 写入触发 Next.js 开发态热重载循环
  const defaultLocalDir = path.join(
    /*turbopackIgnore: true*/ os.homedir(),
    ".cache",
    "omnikit-ai",
    "pgdata"
  );
  let pgliteTarget: string | undefined;
  if (rawUrl === "memory://" || rawUrl === ":memory:") {
    pgliteTarget = undefined; // 内存模式（专供快速隔离单元测试）
  } else if (rawUrl.startsWith("pglite://")) {
    const customPath = rawUrl.slice("pglite://".length).trim();
    pgliteTarget =
      customPath && customPath !== "default"
        ? path.resolve(/*turbopackIgnore: true*/ os.homedir(), customPath)
        : defaultLocalDir;
  } else {
    pgliteTarget = defaultLocalDir;
  }

  if (pgliteTarget) {
    fs.mkdirSync(/*turbopackIgnore: true*/ pgliteTarget, {
      recursive: true,
    });
  }

  const client = pgliteTarget ? new PGlite(pgliteTarget) : new PGlite();
  const db = drizzlePglite(client, { schema });

  globalForDb.__omnikitDbInstance = {
    db,
    driver: "pglite",
    rawExec: async (ddl: string) => {
      await client.exec(ddl);
    },
  };
  return globalForDb.__omnikitDbInstance;
}

/**
 * 确保数据库已完成建表迁移并幂等写入系统内置的 24 个权威站点种子数据
 */
export async function getReadyDb(): Promise<{
  db: AppDb;
  driver: DatabaseDriverType;
}> {
  if (!globalForDb.__omnikitDbInitPromise) {
    globalForDb.__omnikitDbInitPromise = (async () => {
      const handle = createDatabaseHandle();
      const migrationSql = resolveMigrationSql();
      await handle.rawExec(migrationSql);

      // 幂等同步系统内置预置站点（支持版本升级时自动补充新站点或修正描述）
      for (const seed of BUILTIN_SITE_SEEDS) {
        const domain = extractDomain(seed.url);
        await handle.db
          .insert(schema.siteBookmarks)
          .values({
            ownerClientId: "system",
            slug: seed.slug,
            name: seed.name,
            url: seed.url,
            domain,
            category: seed.category,
            description: seed.description,
            tags: seed.tags,
            isOfficial: seed.isOfficial,
            isBuiltin: true,
            verifiedNote: seed.verifiedNote,
            sortOrder: seed.sortOrder,
          })
          .onConflictDoUpdate({
            target: [schema.siteBookmarks.ownerClientId, schema.siteBookmarks.slug],
            set: {
              name: seed.name,
              url: seed.url,
              domain,
              category: seed.category,
              description: seed.description,
              tags: seed.tags,
              isOfficial: seed.isOfficial,
              verifiedNote: seed.verifiedNote,
              sortOrder: seed.sortOrder,
              updatedAt: sql`now()`,
            },
          });
      }

      return { db: handle.db, driver: handle.driver };
    })().catch((err) => {
      // 初始化失败时清除锁，允许下次请求重试连接
      globalForDb.__omnikitDbInitPromise = undefined;
      throw err;
    });
  }

  return globalForDb.__omnikitDbInitPromise;
}
