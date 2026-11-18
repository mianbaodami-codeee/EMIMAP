import { NextRequest } from "next/server";
import {
  TestAIConnectionSchema,
  type AIGatewayStatus,
} from "@omnikit/shared";
import {
  apiError,
  apiOk,
  handleUnexpectedApiError,
} from "@/lib/http/api-response";
import { assertSafeOutboundUrl } from "@/lib/http/safe-url";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/status
 * 返回服务端统一 AI 网关就绪状态，严禁在响应中包含任何服务端密钥明文或掩码片段。
 */
export async function GET() {
  const startedAt = Date.now();
  const status: AIGatewayStatus = {
    openaiServerReady: Boolean((process.env.OPENAI_API_KEY || "").trim()),
    openaiDefaultModel:
      (process.env.OPENAI_DEFAULT_MODEL || "").trim() || "gpt-4o-mini",
    geminiServerReady: Boolean((process.env.GEMINI_API_KEY || "").trim()),
    geminiDefaultModel:
      (process.env.GEMINI_DEFAULT_MODEL || "").trim() || "gemini-2.5-flash",
    securityNotice:
      "服务器端密钥受进程级隔离保护；用户自定义 API Key 仅保存于当前浏览器本地存储，请求时经 HTTPS 单次转发且不落盘。",
  };

  return apiOk(status, { startedAt });
}

/**
 * POST /api/ai/status
 * 真实探测指定大模型供应商接口连通性（不返回任何伪造成功状态）。
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const body = await req.json();
    const input = TestAIConnectionSchema.parse(body);

    if (input.provider === "gemini") {
      const effectiveKey =
        input.apiKey?.trim() || (process.env.GEMINI_API_KEY || "").trim();
      if (!effectiveKey) {
        return apiError(
          "API_KEY_REQUIRED",
          "未检测到有效的 Gemini API Key（服务端未预置且未传入用户密钥）",
          { status: 400, startedAt }
        );
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          input.model
        )}?key=${encodeURIComponent(effectiveKey)}`;
        const resp = await fetch(endpoint, {
          method: "GET",
          signal: controller.signal,
        });
        if (!resp.ok) {
          return apiError(
            "UPSTREAM_ERROR",
            `Gemini 接口返回 HTTP ${resp.status}，请检查密钥权限或模型名称`,
            { status: 502, startedAt }
          );
        }
        return apiOk(
          {
            reachable: true,
            provider: "gemini",
            model: input.model,
            latencyMs: Date.now() - startedAt,
          },
          { startedAt }
        );
      } finally {
        clearTimeout(timer);
      }
    }

    // OpenAI 或兼容协议端点连通性验证
    const effectiveKey =
      input.apiKey?.trim() || (process.env.OPENAI_API_KEY || "").trim();
    if (!effectiveKey) {
      return apiError(
        "API_KEY_REQUIRED",
        "未检测到有效的 OpenAI API Key（服务端未预置且未传入用户密钥）",
        { status: 400, startedAt }
      );
    }

    const rawBase =
      input.baseUrl?.trim() ||
      (process.env.OPENAI_BASE_URL || "").trim() ||
      "https://api.openai.com/v1";
    const safeBase = assertSafeOutboundUrl(rawBase);
    const modelsUrl = `${safeBase.toString().replace(/\/+$/, "")}/models`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(modelsUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${effectiveKey}`,
        },
        signal: controller.signal,
      });
      if (!resp.ok) {
        return apiError(
          "UPSTREAM_ERROR",
          `模型接口返回 HTTP ${resp.status}，请核对 API Key 与 Base URL`,
          { status: 502, startedAt }
        );
      }
      return apiOk(
        {
          reachable: true,
          provider: input.provider,
          model: input.model,
          latencyMs: Date.now() - startedAt,
        },
        { startedAt }
      );
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return apiError("UPSTREAM_TIMEOUT", "连接上游模型服务超时（> 8s）", {
        status: 504,
        startedAt,
      });
    }
    return handleUnexpectedApiError(err, startedAt);
  }
}
