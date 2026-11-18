import { z } from "zod";
import { AIProviderIdSchema, type AIProviderId } from "./settings";

/**
 * 统一大模型网关对话契约 (OpenAI / Google Gemini / OpenAI-Compatible)
 * 供第二阶段「全球地图 AI 空间分析」「AI 资源寻找代理」及后续诊断模块共用。
 */

export const AIChatRoleSchema = z.enum(["system", "user", "assistant"]);
export type AIChatRole = z.infer<typeof AIChatRoleSchema>;

export const AIChatMessageSchema = z.object({
  role: AIChatRoleSchema,
  content: z.string().trim().min(1).max(16000),
});
export type AIChatMessage = z.infer<typeof AIChatMessageSchema>;

export const UnifiedAIChatRequestSchema = z.object({
  provider: AIProviderIdSchema.default("openai"),
  model: z.string().trim().min(1).max(120).optional(),
  apiKey: z.string().trim().max(256).optional(),
  baseUrl: z.string().trim().max(300).optional(),
  messages: z.array(AIChatMessageSchema).min(1).max(24),
  temperature: z.number().min(0).max(1.5).optional().default(0.3),
  maxTokens: z.number().int().min(64).max(4096).optional().default(900),
});

export type UnifiedAIChatRequest = z.infer<typeof UnifiedAIChatRequestSchema>;

export interface UnifiedAIChatResponse {
  provider: AIProviderId;
  model: string;
  keySource: "user" | "server";
  checkedEndpoint: string;
  content: string;
  latencyMs: number;
  finishReason?: string;
}
