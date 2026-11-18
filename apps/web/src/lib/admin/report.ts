import { count, eq } from "drizzle-orm";
import type { HealthReport } from "@omnikit/shared";
import { getReadyDb } from "@/lib/db/client";
import { siteBookmarks } from "@/lib/db/schema";
import { getCacheStore } from "@/lib/cache/store";
import { isAdmin } from "./session";

export async function readAdminReport(): Promise<HealthReport | null> {
  if (!(await isAdmin())) return null;
  const dbStart = Date.now();
  const { db, driver } = await getReadyDb();
  const [row] = await db
    .select({ value: count() })
    .from(siteBookmarks)
    .where(eq(siteBookmarks.isBuiltin, true));
  const dbLatencyMs = Math.max(0, Date.now() - dbStart);

  const cache = getCacheStore();
  const cacheOk = await cache.ping();

  const openaiConfigured = Boolean((process.env.OPENAI_API_KEY || "").trim());
  const geminiConfigured = Boolean((process.env.GEMINI_API_KEY || "").trim());

  const report: HealthReport = {
    status: cacheOk ? "healthy" : "degraded",
    service: "omnikit-ai-web",
    version: "0.1.0",
    phase: "Phase 2",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      ok: true,
      driver,
      latencyMs: dbLatencyMs,
      builtinSiteCount: Number(row?.value ?? 0),
    },
    cache: {
      ok: cacheOk,
      driver: cache.driver,
    },
    aiGateway: {
      openaiServerKeyConfigured: openaiConfigured,
      geminiServerKeyConfigured: geminiConfigured,
      byokSupported: true,
    },
  };

  return report;
}
