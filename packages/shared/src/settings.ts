import { z } from "zod";

/**
 * 统一 AI 模型配置与本地客户端桥接设置契约
 * 服务端密钥永不下发至客户端；用户自带密钥 (BYOK) 仅存本地浏览器并在调用时经请求头单次透传。
 */

export const AI_PROVIDERS = ["openai", "gemini", "openai_compatible"] as const;
export const AIProviderIdSchema = z.enum(AI_PROVIDERS);
export type AIProviderId = (typeof AI_PROVIDERS)[number];

export const ClientAISettingsSchema = z.object({
  activeProvider: z.enum(AI_PROVIDERS).default("openai"),
  preferUserKey: z.boolean().default(true),
  openaiApiKey: z.string().trim().max(256).default(""),
  openaiBaseUrl: z.string().trim().max(256).default(""),
  openaiModel: z.string().trim().min(1).max(80).default("gpt-4o-mini"),
  geminiApiKey: z.string().trim().max(256).default(""),
  geminiModel: z.string().trim().min(1).max(80).default("gemini-2.5-flash"),
  localBridgePort: z.number().int().min(1024).max(65535).default(47920),
});

export type ClientAISettings = z.infer<typeof ClientAISettingsSchema>;

export function resolveClientAIRequestParams(settings: ClientAISettings): {
  provider: AIProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string;
} {
  const provider = settings.activeProvider;
  if (provider === "gemini") {
    return {
      provider: "gemini",
      model: settings.geminiModel,
      apiKey:
        settings.preferUserKey && settings.geminiApiKey
          ? settings.geminiApiKey
          : undefined,
    };
  }
  return {
    provider,
    model: settings.openaiModel,
    apiKey:
      (settings.preferUserKey || provider === "openai_compatible") &&
      settings.openaiApiKey
        ? settings.openaiApiKey
        : undefined,
    baseUrl: settings.openaiBaseUrl || undefined,
  };
}

export const TestAIConnectionSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  apiKey: z.string().trim().max(256).optional(),
  baseUrl: z.string().trim().max(256).optional(),
  model: z.string().trim().min(1).max(80),
});

export type TestAIConnectionInput = z.infer<typeof TestAIConnectionSchema>;

export type AIModelVerificationStatus =
  | "confirmed"
  | "not_found"
  | "unverifiable";

export interface AIConnectionCheckResult {
  provider: AIProviderId;
  /** 兼容布尔字段（同 endpointReachable） */
  reachable: boolean;
  /** 服务端点是否返回了有效的受保护 API 响应（普通 HTML 页面 HTTP 200 不视为 true） */
  endpointReachable: boolean;
  /** 仅当 modelStatus === "confirmed" 时为 true */
  modelAvailable: boolean;
  /**
   * 模型检查明确三态：
   * - confirmed：返回有效 API 响应，且模型元数据匹配
   * - not_found：模型查询明确返回 404（有效 API 错误响应）
   * - unverifiable：返回 HTML、无效 JSON、超时、503 或其他服务异常
   */
  modelStatus: AIModelVerificationStatus;
  /** 本次检查的目标模型名称 */
  model: string;
  /** 本次检查实际使用的密钥来源（绝不包含密钥值） */
  keySource: "user" | "server";
  /** 本次检查实际请求的服务端点基础地址（不含路径参数与凭据） */
  checkedEndpoint: string;
  latencyMs: number;
  message: string;
}

export interface AIGatewayStatus {
  openaiServerReady: boolean;
  openaiDefaultModel: string;
  geminiServerReady: boolean;
  geminiDefaultModel: string;
  securityNotice: string;
}
