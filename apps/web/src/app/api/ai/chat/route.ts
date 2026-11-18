import { NextRequest } from "next/server";
import { UnifiedAIChatRequestSchema } from "@omnikit/shared";
import { getCacheStore } from "@/lib/cache/store";
import {
  buildClientCookieHeader,
  resolveClientWorkspaceId,
} from "@/lib/session/client-id";
import {
  apiError,
  apiOk,
  handleUnexpectedApiError,
} from "@/lib/http/api-response";
import {
  generateUnifiedAIText,
  UnifiedAIError,
} from "@/lib/ai/unified-client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const { clientId, isNewCookie } = await resolveClientWorkspaceId();
    const limiter = await getCacheStore().checkRateLimit(
      `ai_chat:${clientId}`,
      24,
      60
    );
    if (!limiter.allowed) {
      return apiError("RATE_LIMITED", "AI 对话调用过于频繁，请稍后再试", {
        status: 429,
        startedAt,
      });
    }

    const raw = await req.json();
    const parsed = UnifiedAIChatRequestSchema.parse(raw);
    const result = await generateUnifiedAIText(parsed);

    return apiOk(result, {
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
