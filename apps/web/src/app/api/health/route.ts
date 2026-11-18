import { count, eq } from "drizzle-orm";
import type { HealthReport } from "@omnikit/shared";
import { getReadyDb } from "@/lib/db/client";
import { siteBookmarks } from "@/lib/db/schema";
import { getCacheStore } from "@/lib/cache/store";
import { apiOk, handleUnexpectedApiError } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
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
      phase: "Phase 1 — Foundation & Navigator Hub",
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

    return apiOk(report, {
      status: report.status === "healthy" ? 200 : 503,
      startedAt,
    });
  } catch (err) {
    return handleUnexpectedApiError(err, startedAt);
  }
}
