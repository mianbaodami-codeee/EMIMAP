import type {
  AIConnectionCheckResult,
  AIModelVerificationStatus,
  AIProviderId,
  ApiErrorCode,
  TestAIConnectionInput,
} from "@omnikit/shared";
import { normalizeEndpointBaseUrl } from "@/lib/http/safe-url";
import {
  resolveValidatedPublicAddresses,
  UpstreamSecurityError,
  UpstreamTimeoutError,
  upstreamTransport,
  type DnsLookupAllFn,
  type ResolvedIpRecord,
  type SafeHttpsResponse,
  type SecureHttpsGetOptions,
} from "@/lib/http/safe-upstream";

const DEFAULT_OPENAI_TRUSTED_BASE = "https://api.openai.com/v1";
const GEMINI_TRUSTED_ORIGIN = "https://generativelanguage.googleapis.com";
const UPSTREAM_TIMEOUT_MS = 8000;

export interface ServerAIEnvConfig {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  GEMINI_API_KEY?: string;
}

export type HttpsGetFn = (
  url: string,
  options?: SecureHttpsGetOptions
) => Promise<SafeHttpsResponse>;

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

function isHtmlLikeResponse(contentType: string, rawBody: string): boolean {
  const ct = contentType.toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/xhtml+xml")) {
    return true;
  }
  const head = rawBody.trimStart().slice(0, 96).toLowerCase();
  return (
    head.startsWith("<!doctype html") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    head.startsWith("<body")
  );
}

function parseJsonObject(
  contentType: string,
  rawBody: string
): Record<string, unknown> | null {
  if (isHtmlLikeResponse(contentType, rawBody)) {
    return null;
  }
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return null;
  }
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

function isValidOpenAIModelListPayload(
  payload: Record<string, unknown> | null
): payload is { object?: unknown; data: Array<{ id: string }> } {
  if (!payload || !Array.isArray(payload.data)) {
    return false;
  }
  const allItemsValid = payload.data.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { id?: unknown }).id === "string" &&
      (entry as { id: string }).id.trim().length > 0
  );
  if (!allItemsValid) {
    return false;
  }
  if (payload.data.length === 0) {
    return payload.object === "list";
  }
  return true;
}

function isMatchingOpenAISingleModelPayload(
  payload: Record<string, unknown> | null,
  targetModel: string,
  requireModelObjectMeta = false
): boolean {
  if (!payload || typeof payload.id !== "string") {
    return false;
  }
  if (payload.id.trim() !== targetModel) {
    return false;
  }
  if (requireModelObjectMeta) {
    return (
      payload.object === "model" ||
      typeof payload.owned_by === "string" ||
      typeof payload.created === "number"
    );
  }
  return true;
}

function isMatchingGeminiModelPayload(
  payload: Record<string, unknown> | null,
  cleanModelId: string
): boolean {
  if (!payload || typeof payload.name !== "string") {
    return false;
  }
  const normalizedName = payload.name.trim();
  return (
    normalizedName === `models/${cleanModelId}` ||
    normalizedName === cleanModelId
  );
}

function isExplicitApiNotFoundResponse(resp: SafeHttpsResponse): boolean {
  if (resp.status !== 404) {
    return false;
  }
  const obj = parseJsonObject(resp.contentType, resp.body);
  if (!obj) {
    return false;
  }
  return (
    "error" in obj ||
    typeof obj.message === "string" ||
    typeof obj.detail === "string"
  );
}

function buildCheckResult(params: {
  provider: AIProviderId;
  endpointReachable: boolean;
  modelStatus: AIModelVerificationStatus;
  model: string;
  keySource: "user" | "server";
  checkedEndpoint: string;
  startedAt: number;
  message: string;
}): AIConnectionCheckResult {
  const modelAvailable = params.modelStatus === "confirmed";
  const endpointReachable = modelAvailable ? true : params.endpointReachable;
  return {
    provider: params.provider,
    reachable: endpointReachable,
    endpointReachable,
    modelAvailable,
    modelStatus: params.modelStatus,
    model: params.model,
    keySource: params.keySource,
    checkedEndpoint: params.checkedEndpoint,
    latencyMs: Math.max(0, Date.now() - params.startedAt),
    message: params.message,
  };
}

async function resolveEndpointPinnedIpsOrThrow(
  endpointUrl: string,
  dnsLookup: DnsLookupAllFn
): Promise<
  | { ok: true; pinnedAddresses: ResolvedIpRecord[] }
  | { ok: false; reason: string }
> {
  try {
    const hostname = new URL(endpointUrl).hostname;
    const pinnedAddresses = await resolveValidatedPublicAddresses(
      hostname,
      dnsLookup
    );
    return { ok: true, pinnedAddresses };
  } catch (err) {
    if (err instanceof UpstreamSecurityError) {
      throw new AIConnectionCheckError("FORBIDDEN_OPERATION", err.message, 403);
    }
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "DNS 解析异常",
    };
  }
}

async function verifyOpenAIEndpointAndModel(params: {
  provider: AIProviderId;
  targetBase: string;
  apiKey: string;
  keySource: "user" | "server";
  model: string;
  startedAt: number;
  dnsLookup: DnsLookupAllFn;
  httpsGet: HttpsGetFn;
}): Promise<AIConnectionCheckResult> {
  const {
    provider,
    targetBase,
    apiKey,
    keySource,
    model,
    startedAt,
    dnsLookup,
    httpsGet,
  } = params;

  if (model.includes("..") || model.includes("?") || model.includes("#") || model.includes("\\")) {
    throw new AIConnectionCheckError(
      "VALIDATION_ERROR",
      "模型名称包含非法字符",
      400
    );
  }

  const dnsResult = await resolveEndpointPinnedIpsOrThrow(targetBase, dnsLookup);
  if (!dnsResult.ok) {
    return buildCheckResult({
      provider,
      endpointReachable: false,
      modelStatus: "unverifiable",
      model,
      keySource,
      checkedEndpoint: targetBase,
      startedAt,
      message: `无法确认：服务端点域名解析失败（${dnsResult.reason}）`,
    });
  }

  const { pinnedAddresses } = dnsResult;
  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
  };

  let listResp: SafeHttpsResponse;
  try {
    listResp = await httpsGet(`${targetBase}/models`, {
      headers: authHeaders,
      timeoutMs: UPSTREAM_TIMEOUT_MS,
      pinnedAddresses,
      dnsLookup,
    });
  } catch (err) {
    if (err instanceof UpstreamSecurityError) {
      throw new AIConnectionCheckError("FORBIDDEN_OPERATION", err.message, 403);
    }
    if (err instanceof UpstreamTimeoutError) {
      return buildCheckResult({
        provider,
        endpointReachable: false,
        modelStatus: "unverifiable",
        model,
        keySource,
        checkedEndpoint: targetBase,
        startedAt,
        message: "无法确认：连接上游模型服务超时，请稍后重试",
      });
    }
    return buildCheckResult({
      provider,
      endpointReachable: false,
      modelStatus: "unverifiable",
      model,
      keySource,
      checkedEndpoint: targetBase,
      startedAt,
      message: `无法确认：上游网络连接异常（${
        err instanceof Error ? err.message : "连接失败"
      }）`,
    });
  }

  if (listResp.status === 401 || listResp.status === 403) {
    return buildCheckResult({
      provider,
      endpointReachable: false,
      modelStatus: "unverifiable",
      model,
      keySource,
      checkedEndpoint: targetBase,
      startedAt,
      message: `无法确认：服务端点鉴权未通过（HTTP ${listResp.status}），请检查 API Key 是否有效`,
    });
  }

  if (listResp.status !== 200) {
    // 部分兼容网关可能关闭 /models 列表但保留 /models/{id} 单项元数据查询
    if (
      listResp.status === 404 &&
      !isHtmlLikeResponse(listResp.contentType, listResp.body)
    ) {
      try {
        const singleFallback = await httpsGet(
          `${targetBase}/models/${encodeURIComponent(model)}`,
          {
            headers: authHeaders,
            timeoutMs: UPSTREAM_TIMEOUT_MS,
            pinnedAddresses,
            dnsLookup,
          }
        );
        if (singleFallback.status === 200) {
          const singleJson = parseJsonObject(
            singleFallback.contentType,
            singleFallback.body
          );
          if (isMatchingOpenAISingleModelPayload(singleJson, model, true)) {
            return buildCheckResult({
              provider,
              endpointReachable: true,
              modelStatus: "confirmed",
              model,
              keySource,
              checkedEndpoint: targetBase,
              startedAt,
              message: `已确认：服务端点返回有效模型元数据，模型 "${model}" 可用`,
            });
          }
        }
        if (singleFallback.status === 404) {
          const errObj = parseJsonObject(
            singleFallback.contentType,
            singleFallback.body
          );
          const errDetail = errObj?.error;
          if (
            errDetail &&
            typeof errDetail === "object" &&
            (errDetail as { code?: unknown }).code === "model_not_found"
          ) {
            return buildCheckResult({
              provider,
              endpointReachable: true,
              modelStatus: "not_found",
              model,
              keySource,
              checkedEndpoint: targetBase,
              startedAt,
              message: `未找到：模型查询明确返回 404，未找到模型 "${model}"`,
            });
          }
        }
      } catch (err) {
        if (err instanceof UpstreamSecurityError) {
          throw new AIConnectionCheckError(
            "FORBIDDEN_OPERATION",
            err.message,
            403
          );
        }
      }

      return buildCheckResult({
        provider,
        endpointReachable: false,
        modelStatus: "unverifiable",
        model,
        keySource,
        checkedEndpoint: targetBase,
        startedAt,
        message:
          "无法确认：模型列表接口返回 HTTP 404，请检查 Base URL 路径（例如是否缺少 /v1）",
      });
    }

    return buildCheckResult({
      provider,
      endpointReachable: false,
      modelStatus: "unverifiable",
      model,
      keySource,
      checkedEndpoint: targetBase,
      startedAt,
      message: `无法确认：上游服务返回异常状态（HTTP ${listResp.status}），无法判定模型可用性`,
    });
  }

  // HTTP 200：严格拒绝将 HTML 网页或无效/非标准 JSON 视为鉴权成功
  if (isHtmlLikeResponse(listResp.contentType, listResp.body)) {
    return buildCheckResult({
      provider,
      endpointReachable: false,
      modelStatus: "unverifiable",
      model,
      keySource,
      checkedEndpoint: targetBase,
      startedAt,
      message:
        "无法确认：目标地址返回了普通 HTML 页面而非有效 API 响应，未通过端点与鉴权校验",
    });
  }

  const listPayload = parseJsonObject(listResp.contentType, listResp.body);
  if (!isValidOpenAIModelListPayload(listPayload)) {
    return buildCheckResult({
      provider,
      endpointReachable: false,
      modelStatus: "unverifiable",
      model,
      keySource,
      checkedEndpoint: targetBase,
      startedAt,
      message:
        "无法确认：目标地址返回了无效 JSON 或非预期接口结构，未通过有效 API 校验",
    });
  }

  // 至此 /models 已确认为有效 API 响应，检查模型元数据是否在列表中精确匹配
  const inList = listPayload.data.some((item) => item.id.trim() === model);
  if (inList) {
    return buildCheckResult({
      provider,
      endpointReachable: true,
      modelStatus: "confirmed",
      model,
      keySource,
      checkedEndpoint: targetBase,
      startedAt,
      message: `已确认：服务端点返回有效 API 响应，且模型 "${model}" 元数据匹配`,
    });
  }

  // 列表中未包含时，继续发起单项模型查询 /models/{model}，严格区分 200 匹配、明确 404 与 503/超时/异常
  const elapsed = Date.now() - startedAt;
  const remainingTimeoutMs = Math.max(1500, UPSTREAM_TIMEOUT_MS - elapsed);

  let singleResp: SafeHttpsResponse;
  try {
    singleResp = await httpsGet(
      `${targetBase}/models/${encodeURIComponent(model)}`,
      {
        headers: authHeaders,
        timeoutMs: remainingTimeoutMs,
        pinnedAddresses,
        dnsLookup,
      }
    );
  } catch (err) {
    if (err instanceof UpstreamSecurityError) {
      throw new AIConnectionCheckError("FORBIDDEN_OPERATION", err.message, 403);
    }
    if (err instanceof UpstreamTimeoutError) {
      return buildCheckResult({
        provider,
        endpointReachable: true,
        modelStatus: "unverifiable",
        model,
        keySource,
        checkedEndpoint: targetBase,
        startedAt,
        message: `无法确认：服务端点已响应，但查询模型 "${model}" 元数据时超时`,
      });
    }
    return buildCheckResult({
      provider,
      endpointReachable: true,
      modelStatus: "unverifiable",
      model,
      keySource,
      checkedEndpoint: targetBase,
      startedAt,
      message: `无法确认：服务端点已响应，但查询模型 "${model}" 时发生网络异常`,
    });
  }

  if (singleResp.status === 200) {
    const singleJson = parseJsonObject(singleResp.contentType, singleResp.body);
    if (isMatchingOpenAISingleModelPayload(singleJson, model)) {
      return buildCheckResult({
        provider,
        endpointReachable: true,
        modelStatus: "confirmed",
        model,
        keySource,
        checkedEndpoint: targetBase,
        startedAt,
        message: `已确认：服务端点返回有效 API 响应，且模型 "${model}" 元数据匹配`,
      });
    }
    return buildCheckResult({
      provider,
      endpointReachable: true,
      modelStatus: "unverifiable",
      model,
      keySource,
      checkedEndpoint: targetBase,
      startedAt,
      message: `无法确认：单项模型查询返回了 HTML 或不匹配的模型元数据`,
    });
  }

  if (isExplicitApiNotFoundResponse(singleResp)) {
    return buildCheckResult({
      provider,
      endpointReachable: true,
      modelStatus: "not_found",
      model,
      keySource,
      checkedEndpoint: targetBase,
      startedAt,
      message: `未找到：服务端点有效，但模型查询明确返回 404（未找到模型 "${model}"）`,
    });
  }

  return buildCheckResult({
    provider,
    endpointReachable: true,
    modelStatus: "unverifiable",
    model,
    keySource,
    checkedEndpoint: targetBase,
    startedAt,
    message: `无法确认：单项模型查询返回异常（HTTP ${singleResp.status}），不视为模型名称错误`,
  });
}

/**
 * 执行服务端点连通性与具体模型可用性检查。
 *
 * 安全与准确性保证：
 * 1. 服务器预置密钥仅允许发送至管理员配置的可信 HTTPS 端点；自定义端点仅允许使用个人密钥。
 * 2. 强制 HTTPS、禁止自动跟随 3xx 重定向、校验全部 DNS 解析 IP 为公网单播地址并绑定 socket 建连目标。
 * 3. 模型检查结果严格区分为 confirmed（已确认）、not_found（明确 404）、unverifiable（HTML/无效 JSON/超时/503 等）。
 */
export async function runAIConnectionCheck(
  input: TestAIConnectionInput,
  options?: {
    env?: ServerAIEnvConfig;
    dnsLookup?: DnsLookupAllFn;
    httpsGet?: HttpsGetFn;
    startedAt?: number;
  }
): Promise<AIConnectionCheckResult> {
  const env: ServerAIEnvConfig = options?.env ?? {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
  const dnsLookup = options?.dnsLookup ?? upstreamTransport.dnsLookupAll;
  const httpsGet = options?.httpsGet ?? upstreamTransport.httpsGet;
  const startedAt = options?.startedAt ?? Date.now();

  const userKey = (input.apiKey || "").trim();
  const rawUserBase = (input.baseUrl || "").trim();
  const targetModel = input.model.trim();

  // 1. Google Gemini 分支：仅允许官方 HTTPS 可信端点，密钥通过 x-goog-api-key 请求头传输
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

    const cleanGeminiModel = targetModel.replace(/^models\//, "").trim();
    if (
      !cleanGeminiModel ||
      cleanGeminiModel.includes("/") ||
      cleanGeminiModel.includes("..") ||
      cleanGeminiModel.includes("?") ||
      cleanGeminiModel.includes("#")
    ) {
      throw new AIConnectionCheckError(
        "VALIDATION_ERROR",
        "Gemini 模型名称格式无效",
        400
      );
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

    const checkedEndpoint = `${GEMINI_TRUSTED_ORIGIN}/v1beta`;
    const dnsResult = await resolveEndpointPinnedIpsOrThrow(
      checkedEndpoint,
      dnsLookup
    );
    if (!dnsResult.ok) {
      return buildCheckResult({
        provider: "gemini",
        endpointReachable: false,
        modelStatus: "unverifiable",
        model: targetModel,
        keySource,
        checkedEndpoint,
        startedAt,
        message: `无法确认：Gemini 服务端点域名解析失败（${dnsResult.reason}）`,
      });
    }

    let resp: SafeHttpsResponse;
    try {
      resp = await httpsGet(
        `${checkedEndpoint}/models/${encodeURIComponent(cleanGeminiModel)}`,
        {
          headers: {
            "x-goog-api-key": effectiveKey,
          },
          timeoutMs: UPSTREAM_TIMEOUT_MS,
          pinnedAddresses: dnsResult.pinnedAddresses,
          dnsLookup,
        }
      );
    } catch (err) {
      if (err instanceof UpstreamSecurityError) {
        throw new AIConnectionCheckError(
          "FORBIDDEN_OPERATION",
          err.message,
          403
        );
      }
      if (err instanceof UpstreamTimeoutError) {
        return buildCheckResult({
          provider: "gemini",
          endpointReachable: false,
          modelStatus: "unverifiable",
          model: targetModel,
          keySource,
          checkedEndpoint,
          startedAt,
          message: "无法确认：连接 Gemini 服务超时，请稍后重试",
        });
      }
      return buildCheckResult({
        provider: "gemini",
        endpointReachable: false,
        modelStatus: "unverifiable",
        model: targetModel,
        keySource,
        checkedEndpoint,
        startedAt,
        message: `无法确认：Gemini 网络连接异常（${
          err instanceof Error ? err.message : "连接失败"
        }）`,
      });
    }

    if (resp.status === 200) {
      if (isHtmlLikeResponse(resp.contentType, resp.body)) {
        return buildCheckResult({
          provider: "gemini",
          endpointReachable: false,
          modelStatus: "unverifiable",
          model: targetModel,
          keySource,
          checkedEndpoint,
          startedAt,
          message:
            "无法确认：返回了 HTML 页面而非有效 Gemini API 响应，未视为鉴权成功",
        });
      }
      const geminiPayload = parseJsonObject(resp.contentType, resp.body);
      if (isMatchingGeminiModelPayload(geminiPayload, cleanGeminiModel)) {
        return buildCheckResult({
          provider: "gemini",
          endpointReachable: true,
          modelStatus: "confirmed",
          model: targetModel,
          keySource,
          checkedEndpoint,
          startedAt,
          message: `已确认：Gemini 返回有效 API 响应，且模型 "${targetModel}" 元数据匹配`,
        });
      }
      return buildCheckResult({
        provider: "gemini",
        endpointReachable: false,
        modelStatus: "unverifiable",
        model: targetModel,
        keySource,
        checkedEndpoint,
        startedAt,
        message:
          "无法确认：返回了无效 JSON 或不匹配的 Gemini 模型元数据，未视为确认通过",
      });
    }

    if (isExplicitApiNotFoundResponse(resp)) {
      return buildCheckResult({
        provider: "gemini",
        endpointReachable: true,
        modelStatus: "not_found",
        model: targetModel,
        keySource,
        checkedEndpoint,
        startedAt,
        message: `未找到：Gemini 模型查询明确返回 404（未找到模型 "${targetModel}"）`,
      });
    }

    if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
      return buildCheckResult({
        provider: "gemini",
        endpointReachable: false,
        modelStatus: "unverifiable",
        model: targetModel,
        keySource,
        checkedEndpoint,
        startedAt,
        message: `无法确认：Gemini 鉴权或请求未通过（HTTP ${resp.status}），请检查 API Key`,
      });
    }

    return buildCheckResult({
      provider: "gemini",
      endpointReachable: false,
      modelStatus: "unverifiable",
      model: targetModel,
      keySource,
      checkedEndpoint,
      startedAt,
      message: `无法确认：Gemini 服务返回异常状态（HTTP ${resp.status}），无法判定模型是否存在`,
    });
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
        "兼容端点模式必须填写有效的 HTTPS API Base URL",
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
      dnsLookup,
      httpsGet,
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
      dnsLookup,
      httpsGet,
    });
  }

  // 用户已提供个人 API Key：允许使用默认官方端点或用户自行指定的安全公网 HTTPS 端点，绝不读取服务器密钥
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
    dnsLookup,
    httpsGet,
  });
}
