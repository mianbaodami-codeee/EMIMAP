import { sql } from "drizzle-orm";
import { getReadyDb } from "@/lib/db/client";
import { getCacheStore } from "@/lib/cache/store";

export const dynamic = "force-dynamic";
export async function GET() {
  let healthy = false;
  try {
    const { db } = await getReadyDb();
    await db.execute(sql`SELECT 1`);
    healthy = await getCacheStore().ping();
  } catch { /* 公开探针只报告是否可服务。 */ }
  return Response.json({ ok: healthy, data: { status: healthy ? "healthy" : "degraded" } },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
