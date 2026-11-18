import type {
  AIConnectionCheckResult,
  AIProviderId,
  ApiErrorCode,
  TestAIConnectionInput,
} from "@omnikit/shared";
import { normalizeEndpointBaseUrl } from "@/lib/http/safe-url";

const DEFAULT_OPENAI_TRUSTED_BASE = "https://api.openai.com/v1";
const GEMINI_TRUSTED_ORIGIN = "https://generativelanguage.googleapis.com";
const UPSTREAM_TIMEOUT_MS = 8000;

export interface ServerAIEnvConfig {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  GEMINI_API_KEY?: string;
}

export class AIConnectionCheckError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(
    code: ApiErrorCode,
    message: string,
    status = 400,
    details?: unknown
  ) {
    super(message);
    this.name = "AIConnectionCheckError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function parseSafeEndpointBaseUrl(rawUrl: string, label = "API Base URL"): string {
  try {
    return normalizeEndpointBaseUrl(rawUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "无效的服务端点地址";
    if (msg.includes("安全策略已拦截")) {
      throw new AIConnectionCheckError("FORBIDDEN_OPERATION", msg, 403);
    }
    throw new AIConnectionCheckError(
      "VALIDATION_ERROR",
      `${label} 无效：${msg}`,
      400
    );
  }
}

function hasModelInListPayload(payload: unknown, targetModel: string): boolean {
  if (!payload || typeof payload !== "object") return false;
  const list = (payload as { data?: unknown }).data;
  if (!Array.isArray(list)) return false;
  return list.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { id?: unknown }).id === "string" &&
      (entry as { id: string }).id.trim() === targetModel
  );
}

async function verifyOpenAIEndpointAndModel(params: {
  provider: AIProviderId;
  targetBase: string;
  apiKey: string;
  keySource: "user" | "server";
  model: string;
  startedAt: number;
  fetchImpl: typeof fetch;
}): Promise<AIConnectionCheckResult> {
  const {
    provider,
    targetBase,
    apiKey,
    keySource,
    model,
    startedAt,
    fetchImpl,
  } = params;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const modelsUrl = `${targetBase}/models`;
    const authHeaders = {
      Authorization: `Bearer ${apiKey}`,
    };

    const resp = await fetchImpl(modelsUrl, {
      method: "GET",
      headers: authHeaders,
      signal: controller.signal,
    });

    if (!resp.ok) {
      throw new AIConnectionCheckError(
        "UPSTREAM_ERROR",
        `服务端点连通性检查未通过（HTTP ${resp.status}），请检查 API Key 与 Base URL`,
        502,
        {
          endpointReachable: false,
          modelAvailable: false,
          checkedEndpoint: targetBase,
        }
      );
    }

    const listPayload = await resp.json().catch(() => null);
    let modelAvailable = hasModelInListPayload(listPayload, model);

    // 若 /models 列表分页或未直接包含微调/别名模型，则尝试单项查询 /models/{model} 辅助确认
    if (!modelAvailable) {
      const retrieveUrl = `${targetBase}/models/${encodeURIComponent(model)}`;
      const singleResp = await fetchImpl(retrieveUrl, {
        method: "GET",
        headers: authHeaders,
        signal: controller.signal,
      }).catch(() => null);

      if (singleResp && singleResp.ok) {
        const singleJson = await singleResp.json().catch(() => null);
        if (
          singleJson &&
          typeof singleJson === "object" &&
          typeof (singleJson as { id?: unknown }).id === "string" &&
          (singleJson as { id: string }).id.trim() === model
        ) {
          modelAvailable = true;
        }
      }
    }

    const latencyMs = Math.max(0, Date.now() - startedAt);
    return {
      provider,
      reachable: true,
      endpointReachable: true,
      modelAvailable,
      model,
      keySource,
      checkedEndpoint: targetBase,
      latencyMs,
      message: modelAvailable
        ? `服务端点可达，且已在模型列表中确认模型 "${model}" 可用`
        : `服务端点可达（鉴权通过），但未在该端点查询到模型 "${model}"，请核对模型名称`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 执行服务端点连通性与具体模型可用性检查。
 *
 * 安全边界保证：
 * 1. 服务器预置密钥（OPENAI_API_KEY / GEMINI_API_KEY）仅允许发送至管理员配置的可信端点。
 * 2. 用户自定义 Base URL 或「兼容端点 (openai_compatible)」模式强制只能使用用户自行提供的密钥。
 */
export async function runAIConnectionCheck(
  input: TestAIConnectionInput,
  options?: {
    env?: ServerAIEnvConfig;
    fetchImpl?: typeof fetch;
    startedAt?: number;
  }
): Promise<AIConnectionCheckResult> {
  const env: ServerAIEnvConfig = options?.env ?? {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
  const fetchImpl = options?.fetchImpl ?? fetch;
  const startedAt = options?.startedAt ?? Date.now();

  const userKey = (input.apiKey || "").trim();
  const rawUserBase = (input.baseUrl || "").trim();
  const targetModel = input.model.trim();

  // 1. Google Gemini 分支：仅允许官方可信端点，密钥通过 x-goog-api-key 请求头传输
  if (input.provider === "gemini") {
    if (rawUserBase) {
      const normalizedGeminiBase = parseSafeEndpointBaseUrl(rawUserBase);
      if (
        normalizedGeminiBase !== GEMINI_TRUSTED_ORIGIN &&
        normalizedGeminiBase !== `${GEMINI_TRUSTED_ORIGIN}/v1beta`
      ) {
        throw new AIConnectionCheckError(
          "FORBIDDEN_OPERATION",
          "安全边界限制：Gemini 模式仅允许连接 Google 官方可信端点，不支持自定义 Base URL",
          403
        );
      }
    }

    const serverGeminiKey = (env.GEMINI_API_KEY || "").trim();
    const keySource: "user" | "server" = userKey ? "user" : "server";
    const effectiveKey = userKey || serverGeminiKey;

    if (!effectiveKey) {
      throw new AIConnectionCheckError(
        "API_KEY_REQUIRED",
        "未检测到有效的 Gemini API Key（服务端未预置且未传入个人密钥）",
        400
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    const checkedEndpoint = `${GEMINI_TRUSTED_ORIGIN}/v1beta`;

    try {
      const endpoint = `${checkedEndpoint}/models/${encodeURIComponent(
        targetModel
      )}`;
      const resp = await fetchImpl(endpoint, {
        method: "GET",
        headers: {
          "x-goog-api-key": effectiveKey,
        },
        signal: controller.signal,
      });

      if (resp.status === 404) {
        return {
          provider: "gemini",
          reachable: true,
          endpointReachable: true,
          modelAvailable: false,
          model: targetModel,
          keySource,
          checkedEndpoint,
          latencyMs: Math.max(0, Date.now() - startedAt),
          message: `Gemini 服务端点可达，但未找到模型 "${targetModel}"，请核对模型名称`,
        };
      }

      if (!resp.ok) {
        throw new AIConnectionCheckError(
          "UPSTREAM_ERROR",
          `Gemini 服务端点连通性或鉴权未通过（HTTP ${resp.status}），请检查 API Key 权限`,
          502,
          {
            endpointReachable: false,
            modelAvailable: false,
            checkedEndpoint,
          }
        );
      }

      return {
        provider: "gemini",
        reachable: true,
        endpointReachable: true,
        modelAvailable: true,
        model: targetModel,
        keySource,
        checkedEndpoint,
        latencyMs: Math.max(0, Date.now() - startedAt),
        message: `服务端点可达，且已确认 Gemini 模型 "${targetModel}" 可用`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // 2. OpenAI 兼容自定义端点分支：严格禁止回退使用服务器预置密钥
  if (input.provider === "openai_compatible") {
    if (!userKey) {
      throw new AIConnectionCheckError(
        "FORBIDDEN_OPERATION",
        "安全边界限制：兼容端点模式只能使用您自行提供的 API Key，服务器预置密钥仅用于管理员配置的可信端点",
        403
      );
    }
    if (!rawUserBase) {
      throw new AIConnectionCheckError(
        "VALIDATION_ERROR",
        "兼容端点模式必须填写有效的 API Base URL",
        400
      );
    }

    const customBase = parseSafeEndpointBaseUrl(rawUserBase);
    return verifyOpenAIEndpointAndModel({
      provider: "openai_compatible",
      targetBase: customBase,
      apiKey: userKey,
      keySource: "user",
      model: targetModel,
      startedAt,
      fetchImpl,
    });
  }

  // 3. OpenAI 标准分支：区分「个人密钥」与「服务器预置密钥（仅限管理员可信端点）」
  const configuredTrustedBaseRaw =
    (env.OPENAI_BASE_URL || "").trim() || DEFAULT_OPENAI_TRUSTED_BASE;
  const trustedServerBase = parseSafeEndpointBaseUrl(
    configuredTrustedBaseRaw,
    "服务端 OPENAI_BASE_URL"
  );

  if (!userKey) {
    // 未提供个人密钥：仅当未指定自定义端点（或与管理员可信端点完全一致）时才允许使用服务器预置密钥
    if (rawUserBase) {
      const requestedBase = parseSafeEndpointBaseUrl(rawUserBase);
      if (requestedBase !== trustedServerBase) {
        throw new AIConnectionCheckError(
          "FORBIDDEN_OPERATION",
          "安全边界限制：自定义 API Base URL 只能使用您自行提供的 API Key，服务器预置密钥仅允许发往管理员配置的可信端点",
          403
        );
      }
    }

    const serverOpenAIKey = (env.OPENAI_API_KEY || "").trim();
    if (!serverOpenAIKey) {
      throw new AIConnectionCheckError(
        "API_KEY_REQUIRED",
        "未检测到有效的 OpenAI API Key（服务端未预置且未传入个人密钥）",
        400
      );
    }

    return verifyOpenAIEndpointAndModel({
      provider: "openai",
      targetBase: trustedServerBase,
      apiKey: serverOpenAIKey,
      keySource: "server",
      model: targetModel,
      startedAt,
      fetchImpl,
    });
  }

  // 用户已提供个人 API Key：允许使用默认官方端点或用户自行指定的安全公网端点，绝不读取服务器密钥
  const userTargetBase = rawUserBase
    ? parseSafeEndpointBaseUrl(rawUserBase)
    : DEFAULT_OPENAI_TRUSTED_BASE;

  return verifyOpenAIEndpointAndModel({
    provider: "openai",
    targetBase: userTargetBase,
    apiKey: userKey,
    keySource: "user",
    model: targetModel,
    startedAt,
    fetchImpl,
  });
}
