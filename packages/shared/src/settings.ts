import { z } from "zod";

/**
 * 统一 AI 模型配置与本地客户端桥接设置契约
 * 服务端密钥永不下发至客户端；用户自带密钥 (BYOK) 仅存本地浏览器并在调用时经请求头单次透传。
 */

export const AI_PROVIDERS = ["openai", "gemini", "openai_compatible"] as const;
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

export const TestAIConnectionSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  apiKey: z.string().trim().max(256).optional(),
  baseUrl: z.string().trim().max(256).optional(),
  model: z.string().trim().min(1).max(80),
});

export type TestAIConnectionInput = z.infer<typeof TestAIConnectionSchema>;

export interface AIConnectionCheckResult {
  provider: AIProviderId;
  /** 兼容布尔字段（同 endpointReachable） */
  reachable: boolean;
  /** 服务端点是否网络可达且通过 API Key 鉴权 */
  endpointReachable: boolean;
  /** 用户指定的模型名称是否在该端点模型列表或模型元数据中确认存在 */
  modelAvailable: boolean;
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
