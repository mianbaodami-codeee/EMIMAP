import { count, eq } from "drizzle-orm";
import { getReadyDb } from "./client";
import { siteBookmarks } from "./schema";

async function main() {
  const started = Date.now();
  const { db, driver } = await getReadyDb();
  const [row] = await db
    .select({ value: count() })
    .from(siteBookmarks)
    .where(eq(siteBookmarks.isBuiltin, true));

  console.log(
    JSON.stringify(
      {
        ok: true,
        driver,
        builtinSitesSeeded: Number(row?.value ?? 0),
        durationMs: Date.now() - started,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[db:init] 数据库初始化失败:", err);
  process.exit(1);
});
