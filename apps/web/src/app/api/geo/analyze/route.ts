import { NextRequest } from "next/server";
import { GeoAnalyzeRequestSchema } from "@omnikit/shared";
import { analyzeGeoLocation } from "@/lib/geo/service";
import { UnifiedAIError } from "@/lib/ai/unified-client";
import { getCacheStore } from "@/lib/cache/store";
import {
  apiError,
  apiOk,
  handleUnexpectedApiError,
} from "@/lib/http/api-response";
import {
  buildClientCookieHeader,
  resolveClientWorkspaceId,
} from "@/lib/session/client-id";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const { clientId, isNewCookie } = await resolveClientWorkspaceId();
    const rl = await getCacheStore().checkRateLimit(
      `geo:analyze:${clientId}`,
      20,
      60
    );
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", "AI 地理分析请求过于频繁，请稍后重试", {
        status: 429,
        startedAt,
      });
    }

    const body = await req.json();
    const parsed = GeoAnalyzeRequestSchema.parse(body);
    const analysis = await analyzeGeoLocation(clientId, parsed);

    return apiOk(analysis, {
      startedAt,
      headers: isNewCookie
        ? { "Set-Cookie": buildClientCookieHeader(clientId) }
        : undefined,
    });
  } catch (err) {
    if (err instanceof UnifiedAIError) {
      return apiError(err.code, err.message, {
        status: err.status,
        startedAt,
      });
    }
    return handleUnexpectedApiError(err, startedAt);
  }
}
