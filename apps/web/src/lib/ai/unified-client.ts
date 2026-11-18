import type {
  AIChatMessage,
  AIProviderId,
  ApiErrorCode,
  UnifiedAIChatRequest,
  UnifiedAIChatResponse,
} from "@omnikit/shared";
import { normalizeEndpointBaseUrl } from "@/lib/http/safe-url";
import {
  resolveValidatedPublicAddresses,
  UpstreamSecurityError,
  UpstreamTimeoutError,
  upstreamTransport,
  type DnsLookupAllFn,
  type SafeHttpsResponse,
  type SecureHttpsGetOptions,
} from "@/lib/http/safe-upstream";
import type { ServerAIEnvConfig } from "./connection-check";

const DEFAULT_OPENAI_TRUSTED_BASE = "https://api.openai.com/v1";
const GEMINI_TRUSTED_ORIGIN = "https://generativelanguage.googleapis.com";
const GENERATION_TIMEOUT_MS = 18_000;

export type HttpsPostFn = (
  url: string,
  body: string,
  options?: SecureHttpsGetOptions
) => Promise<SafeHttpsResponse>;

export class UnifiedAIError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;

  constructor(code: ApiErrorCode, message: string, status = 400) {
    super(message);
    this.name = "UnifiedAIError";
    this.code = code;
    this.status = status;
  }
}

function parseSafeEndpointBaseUrl(rawUrl: string, label = "API Base URL"): string {
  try {
    return normalizeEndpointBaseUrl(rawUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "无效的服务端点地址";
    if (msg.includes("安全策略已拦截")) {
      throw new UnifiedAIError("FORBIDDEN_OPERATION", msg, 403);
    }
    throw new UnifiedAIError("VALIDATION_ERROR", `${label} 无效：${msg}`, 400);
  }
}

function isHtmlLike(contentType: string, body: string): boolean {
  const ct = contentType.toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/xhtml+xml")) {
    return true;
  }
  const head = body.trimStart().slice(0, 96).toLowerCase();
  return (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    head.startsWith("<body")
  );
}

function parseJsonBody(
  contentType: string,
  body: string
): Record<string, unknown> | null {
  if (isHtmlLike(contentType, body)) {
    return null;
  }
  const trimmed = body.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function defaultModelForProvider(provider: AIProviderId): string {
  if (provider === "gemini") return "gemini-2.5-flash";
  return "gpt-4.1-mini";
}

/**
 * 检查当前请求或服务端环境变量是否具备可用的大模型凭据（不触发网络请求）。
 * 供地理分析与资源检索在无密钥场景下提前走优雅降级分支。
 */
export function hasUsableAICredentials(
  input: {
    provider?: AIProviderId;
    apiKey?: string;
    baseUrl?: string;
  },
  env?: ServerAIEnvConfig
): boolean {
  const resolvedEnv: ServerAIEnvConfig = env ?? {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
  const provider = input.provider ?? "openai";
  const userKey = (input.apiKey || "").trim();
  const rawBase = (input.baseUrl || "").trim();

  if (userKey) return true;
  if (provider === "openai_compatible") return false;
  if (provider === "gemini") {
    return Boolean((resolvedEnv.GEMINI_API_KEY || "").trim());
  }
  if (rawBase) {
    try {
      const trustedBase = normalizeEndpointBaseUrl(
        (resolvedEnv.OPENAI_BASE_URL || "").trim() || DEFAULT_OPENAI_TRUSTED_BASE
      );
      if (normalizeEndpointBaseUrl(rawBase) !== trustedBase) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return Boolean((resolvedEnv.OPENAI_API_KEY || "").trim());
}

function toGeminiPayload(
  messages: AIChatMessage[],
  temperature: number,
  maxTokens: number
): Record<string, unknown> {
  const systemTexts: string[] = [];
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemTexts.push(msg.content);
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  if (contents.length === 0) {
    contents.push({
      role: "user",
      parts: [{ text: systemTexts.join("\n\n") || "Hello" }],
    });
    systemTexts.length = 0;
  }

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (systemTexts.length > 0) {
    payload.systemInstruction = {
      parts: [{ text: systemTexts.join("\n\n") }],
    };
  }

  return payload;
}

/**
 * 统一大模型推理网关：支持 OpenAI、Google Gemini 与 OpenAI-Compatible 端点。
 * 严格继承第一阶段 1054a7c 验收基线的全部网络与密钥隔离安全约束：
 * - 服务器预置密钥仅用于管理员配置的可信 HTTPS 端点；自定义端点强制要求用户 BYOK 密钥。
 * - 强制 HTTPS、禁止自动跟随 3xx 重定向、校验全部 DNS 公网 IP 并绑定建连 socket。
 * - 拒绝将 HTML 页面或畸形 JSON 误判为有效推理结果。
 */
export async function generateUnifiedAIText(
  input: UnifiedAIChatRequest,
  options?: {
    env?: ServerAIEnvConfig;
    dnsLookup?: DnsLookupAllFn;
    httpsPost?: HttpsPostFn;
    timeoutMs?: number;
  }
): Promise<UnifiedAIChatResponse> {
  const env: ServerAIEnvConfig = options?.env ?? {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
  const dnsLookup = options?.dnsLookup ?? upstreamTransport.dnsLookupAll;
  const httpsPost = options?.httpsPost ?? upstreamTransport.httpsPost;
  const timeoutMs = options?.timeoutMs ?? GENERATION_TIMEOUT_MS;
  const startedAt = Date.now();

  const provider = input.provider;
  const model = (input.model || "").trim() || defaultModelForProvider(provider);
  const userKey = (input.apiKey || "").trim();
  const rawUserBase = (input.baseUrl || "").trim();
  const temperature = input.temperature ?? 0.3;
  const maxTokens = input.maxTokens ?? 900;

  if (
    model.includes("..") ||
    model.includes("?") ||
    model.includes("#") ||
    model.includes("\\")
  ) {
    throw new UnifiedAIError("VALIDATION_ERROR", "模型名称包含非法字符", 400);
  }

  // === 分支 1：Google Gemini 官方端点 ===
  if (provider === "gemini") {
    if (rawUserBase) {
      const normalizedGeminiBase = parseSafeEndpointBaseUrl(rawUserBase);
      if (
        normalizedGeminiBase !== GEMINI_TRUSTED_ORIGIN &&
        normalizedGeminiBase !== `${GEMINI_TRUSTED_ORIGIN}/v1beta`
      ) {
        throw new UnifiedAIError(
          "FORBIDDEN_OPERATION",
          "安全边界限制：Gemini 模式仅允许连接 Google 官方可信端点，不支持自定义 Base URL",
          403
        );
      }
    }

    const cleanGeminiModel = model.replace(/^models\//, "").trim();
    if (!cleanGeminiModel || cleanGeminiModel.includes("/")) {
      throw new UnifiedAIError("VALIDATION_ERROR", "Gemini 模型名称格式无效", 400);
    }

    const serverGeminiKey = (env.GEMINI_API_KEY || "").trim();
    const keySource: "user" | "server" = userKey ? "user" : "server";
    const effectiveKey = userKey || serverGeminiKey;
    if (!effectiveKey) {
      throw new UnifiedAIError(
        "API_KEY_REQUIRED",
        "未检测到可用的 Gemini API Key（可在右上角 AI 模型配置中填入个人密钥）",
        400
      );
    }

    const checkedEndpoint = `${GEMINI_TRUSTED_ORIGIN}/v1beta`;
    let pinnedAddresses;
    try {
      pinnedAddresses = await resolveValidatedPublicAddresses(
        new URL(checkedEndpoint).hostname,
        dnsLookup
      );
    } catch (err) {
      if (err instanceof UpstreamSecurityError) {
        throw new UnifiedAIError("FORBIDDEN_OPERATION", err.message, 403);
      }
      throw new UnifiedAIError(
        "UPSTREAM_AI_ERROR",
        `Gemini 端点域名解析失败：${err instanceof Error ? err.message : "DNS 异常"}`,
        502
      );
    }

    const url = `${checkedEndpoint}/models/${encodeURIComponent(cleanGeminiModel)}:generateContent`;
    const bodyStr = JSON.stringify(
      toGeminiPayload(input.messages, temperature, maxTokens)
    );

    let resp: SafeHttpsResponse;
    try {
      resp = await httpsPost(url, bodyStr, {
        headers: {
          "x-goog-api-key": effectiveKey,
          "Content-Type": "application/json; charset=utf-8",
        },
        timeoutMs,
        pinnedAddresses,
        dnsLookup,
      });
    } catch (err) {
      if (err instanceof UpstreamSecurityError) {
        throw new UnifiedAIError("FORBIDDEN_OPERATION", err.message, 403);
      }
      if (err instanceof UpstreamTimeoutError) {
        throw new UnifiedAIError("UPSTREAM_AI_ERROR", err.message, 504);
      }
      throw new UnifiedAIError(
        "UPSTREAM_AI_ERROR",
        `调用 Gemini 服务失败：${err instanceof Error ? err.message : "网络错误"}`,
        502
      );
    }

    const payload = parseJsonBody(resp.contentType, resp.body);
    if (resp.status !== 200 || !payload) {
      const apiMsg =
        (payload?.error as { message?: string } | undefined)?.message ||
        `HTTP ${resp.status}`;
      throw new UnifiedAIError(
        "UPSTREAM_AI_ERROR",
        `Gemini 推理请求未通过（${apiMsg}）`,
        resp.status === 401 || resp.status === 403 ? 401 : 502
      );
    }

    const candidates = Array.isArray(payload.candidates)
      ? payload.candidates
      : [];
    const firstCandidate = candidates[0] as
      | {
          finishReason?: string;
          content?: { parts?: Array<{ text?: string }> };
        }
      | undefined;
    const text = (firstCandidate?.content?.parts || [])
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();

    if (!text) {
      throw new UnifiedAIError(
        "UPSTREAM_AI_ERROR",
        "Gemini 返回了空内容或非文本结构响应",
        502
      );
    }

    return {
      provider: "gemini",
      model,
      keySource,
      checkedEndpoint,
      content: text,
      latencyMs: Math.max(1, Date.now() - startedAt),
      finishReason: firstCandidate?.finishReason,
    };
  }

  // === 分支 2 & 3：OpenAI 官方 / OpenAI 兼容端点 ===
  let targetBase: string;
  let effectiveKey: string;
  let keySource: "user" | "server";

  if (provider === "openai_compatible") {
    if (!userKey) {
      throw new UnifiedAIError(
        "FORBIDDEN_OPERATION",
        "安全边界限制：兼容端点模式只能使用您自行提供的 API Key，服务器预置密钥仅用于管理员配置的可信端点",
        403
      );
    }
    if (!rawUserBase) {
      throw new UnifiedAIError(
        "VALIDATION_ERROR",
        "兼容端点模式必须填写有效的 HTTPS API Base URL",
        400
      );
    }
    targetBase = parseSafeEndpointBaseUrl(rawUserBase);
    effectiveKey = userKey;
    keySource = "user";
  } else {
    const rawServerBase = (env.OPENAI_BASE_URL || "").trim();
    const trustedServerBase = rawServerBase
      ? parseSafeEndpointBaseUrl(rawServerBase, "服务器预置 OPENAI_BASE_URL")
      : DEFAULT_OPENAI_TRUSTED_BASE;

    const normalizedUserBase = rawUserBase
      ? parseSafeEndpointBaseUrl(rawUserBase)
      : "";
    const isCustomUntrustedEndpoint =
      Boolean(normalizedUserBase) && normalizedUserBase !== trustedServerBase;

    if (isCustomUntrustedEndpoint) {
      if (!userKey) {
        throw new UnifiedAIError(
          "FORBIDDEN_OPERATION",
          "安全边界限制：自定义 API 端点只能使用您自行提供的 API Key，服务器预置密钥不会发送至自定义地址",
          403
        );
      }
      targetBase = normalizedUserBase;
      effectiveKey = userKey;
      keySource = "user";
    } else {
      const serverOpenAIKey = (env.OPENAI_API_KEY || "").trim();
      effectiveKey = userKey || serverOpenAIKey;
      keySource = userKey ? "user" : "server";
      if (!effectiveKey) {
        throw new UnifiedAIError(
          "API_KEY_REQUIRED",
          "未检测到可用的 OpenAI API Key（可在右上角 AI 模型配置中填入个人密钥）",
          400
        );
      }
      targetBase = trustedServerBase;
    }
  }

  let pinnedAddresses;
  try {
    pinnedAddresses = await resolveValidatedPublicAddresses(
      new URL(targetBase).hostname,
      dnsLookup
    );
  } catch (err) {
    if (err instanceof UpstreamSecurityError) {
      throw new UnifiedAIError("FORBIDDEN_OPERATION", err.message, 403);
    }
    throw new UnifiedAIError(
      "UPSTREAM_AI_ERROR",
      `模型服务端点域名解析失败：${err instanceof Error ? err.message : "DNS 异常"}`,
      502
    );
  }

  const chatUrl = `${targetBase}/chat/completions`;
  const chatBody = JSON.stringify({
    model,
    messages: input.messages,
    temperature,
    max_tokens: maxTokens,
  });

  let resp: SafeHttpsResponse;
  try {
    resp = await httpsPost(chatUrl, chatBody, {
      headers: {
        Authorization: `Bearer ${effectiveKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      timeoutMs,
      pinnedAddresses,
      dnsLookup,
    });
  } catch (err) {
    if (err instanceof UpstreamSecurityError) {
      throw new UnifiedAIError("FORBIDDEN_OPERATION", err.message, 403);
    }
    if (err instanceof UpstreamTimeoutError) {
      throw new UnifiedAIError("UPSTREAM_AI_ERROR", err.message, 504);
    }
    throw new UnifiedAIError(
      "UPSTREAM_AI_ERROR",
      `调用模型推理接口失败：${err instanceof Error ? err.message : "连接异常"}`,
      502
    );
  }

  const payload = parseJsonBody(resp.contentType, resp.body);
  if (resp.status !== 200 || !payload) {
    const errMsg =
      (payload?.error as { message?: string } | undefined)?.message ||
      (isHtmlLike(resp.contentType, resp.body)
        ? "上游返回了普通 HTML 页面而非有效 JSON API 响应"
        : `HTTP ${resp.status}`);
    throw new UnifiedAIError(
      "UPSTREAM_AI_ERROR",
      `模型推理请求未通过（${errMsg}）`,
      resp.status === 401 || resp.status === 403 ? 401 : 502
    );
  }

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices[0] as
    | {
        finish_reason?: string;
        message?: { content?: string | Array<{ text?: string }> };
      }
    | undefined;
  const rawContent = firstChoice?.message?.content;
  const text =
    typeof rawContent === "string"
      ? rawContent.trim()
      : Array.isArray(rawContent)
        ? rawContent
            .map((part) => (typeof part?.text === "string" ? part.text : ""))
            .join("")
            .trim()
        : "";

  if (!text) {
    throw new UnifiedAIError(
      "UPSTREAM_AI_ERROR",
      "上游模型未返回有效文本补全内容",
      502
    );
  }

  return {
    provider,
    model,
    keySource,
    checkedEndpoint: targetBase,
    content: text,
    latencyMs: Math.max(1, Date.now() - startedAt),
    finishReason: firstChoice?.finish_reason,
  };
}
