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
  openaiBaseUrl: z
    .string()
    .trim()
    .max(256)
    .default("https://api.openai.com/v1"),
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

export interface AIGatewayStatus {
  openaiServerReady: boolean;
  openaiDefaultModel: string;
  geminiServerReady: boolean;
  geminiDefaultModel: string;
  securityNotice: string;
}
