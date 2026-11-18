import { NextRequest } from "next/server";
import { DiscoverSearchRequestSchema } from "@omnikit/shared";
import {
  DiscoverComplianceError,
  runResourceDiscoveryAgent,
} from "@/lib/discover/agent";
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
      `discover:search:${clientId}`,
      30,
      60
    );
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", "资源检索过于频繁，请稍后重试", {
        status: 429,
        startedAt,
      });
    }

    const body = await req.json();
    const parsed = DiscoverSearchRequestSchema.parse(body);
    const result = await runResourceDiscoveryAgent(parsed);

    return apiOk(result, {
      startedAt,
      headers: isNewCookie
        ? { "Set-Cookie": buildClientCookieHeader(clientId) }
        : undefined,
    });
  } catch (err) {
    if (err instanceof DiscoverComplianceError) {
      return apiError(err.code, err.message, {
        status: err.status,
        startedAt,
      });
    }
    if (err instanceof UnifiedAIError) {
      return apiError(err.code, err.message, {
        status: err.status,
        startedAt,
      });
    }
    return handleUnexpectedApiError(err, startedAt);
  }
}
