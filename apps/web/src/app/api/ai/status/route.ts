import { isAdmin } from "@/lib/admin/session";
import { NextRequest } from "next/server";
import {
  TestAIConnectionSchema,
  type AIGatewayStatus,
} from "@omnikit/shared";
import {
  AIConnectionCheckError,
  runAIConnectionCheck,
} from "@/lib/ai/connection-check";
import {
  apiError,
  apiOk,
  handleUnexpectedApiError,
} from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/status
 * 返回服务端统一 AI 网关就绪状态，严禁在响应中包含任何服务端密钥明文或掩码片段。
 */
export async function GET() {
  if (!(await isAdmin())) return Response.json({ ok: false }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const startedAt = Date.now();
  const status: AIGatewayStatus = {
    openaiServerReady: Boolean((process.env.OPENAI_API_KEY || "").trim()),
    openaiDefaultModel:
      (process.env.OPENAI_DEFAULT_MODEL || "").trim() || "gpt-4o-mini",
    geminiServerReady: Boolean((process.env.GEMINI_API_KEY || "").trim()),
    geminiDefaultModel:
      (process.env.GEMINI_DEFAULT_MODEL || "").trim() || "gemini-2.5-flash",
    securityNotice:
      "服务器端预置密钥仅允许发往管理员配置的可信端点；自定义服务端点仅允许使用用户自行提供的本地会话密钥（BYOK）。",
  };

  return apiOk(status, { startedAt });
}

/**
 * POST /api/ai/status
 * 执行服务端点连通性与具体模型可用性检查（严格隔离服务端密钥与用户自定义端点）。
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const body = await req.json();
    const input = TestAIConnectionSchema.parse(body);
    const result = await runAIConnectionCheck(input, { startedAt });
    return apiOk(result, { startedAt });
  } catch (err) {
    if (err instanceof AIConnectionCheckError) {
      return apiError(err.code, err.message, {
        status: err.status,
        details: err.details,
        startedAt,
      });
    }
    if (err instanceof Error && err.name === "AbortError") {
      return apiError("UPSTREAM_TIMEOUT", "连接上游模型服务超时（> 8s）", {
        status: 504,
        startedAt,
      });
    }
    return handleUnexpectedApiError(err, startedAt);
  }
}
