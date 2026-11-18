import { z } from "zod";
import { AIProviderIdSchema, type AIProviderId } from "./settings";

/**
 * 第二阶段：AI 自主资源寻找代理 (Resource Discovery Agent) 契约
 */

export const DISCOVER_CATEGORIES = [
  "all",
  "game",
  "open_source",
  "dev_tool",
  "docs",
  "ai_model",
] as const;

export type DiscoverCategory = (typeof DISCOVER_CATEGORIES)[number];
export type ConcreteDiscoverCategory = Exclude<DiscoverCategory, "all">;

export const DISCOVER_CATEGORY_LABELS: Record<DiscoverCategory, string> = {
  all: "全部资源类型",
  game: "正版游戏与商店",
  open_source: "开源项目与仓库",
  dev_tool: "开发与系统工具",
  docs: "权威技术文档",
  ai_model: "AI 模型与平台",
};

export const DiscoverTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
});
export type DiscoverTurn = z.infer<typeof DiscoverTurnSchema>;

export const DiscoverSearchRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "请输入至少 2 个字符的资源检索需求")
    .max(500, "检索需求不能超过 500 个字符"),
  category: z.enum(DISCOVER_CATEGORIES).default("all"),
  officialOnly: z.boolean().default(false),
  conversationHistory: z.array(DiscoverTurnSchema).max(10).optional().default([]),
  provider: AIProviderIdSchema.optional(),
  model: z.string().trim().max(120).optional(),
  apiKey: z.string().trim().max(256).optional(),
  baseUrl: z.string().trim().max(300).optional(),
});

export type DiscoverSearchRequest = z.infer<typeof DiscoverSearchRequestSchema>;

export interface DiscoverAgentStep {
  id:
    | "intent_plan"
    | "multi_source_search"
    | "credibility_audit"
    | "structured_synthesis";
  title: string;
  status: "completed" | "degraded";
  detail: string;
  durationMs: number;
}

export interface DiscoveredResourceItem {
  id: string;
  name: string;
  sourceSite: string;
  domain: string;
  slugHint?: string;
  url: string;
  category: ConcreteDiscoverCategory;
  summary: string;
  isOfficial: boolean;
  versionOrUpdatedAt: string;
  licenseOrPricing: string;
  platforms: string[];
  credibilityBasis: string;
  cautionNotes: string;
  provenance: "web_verified";
  liveVerified: boolean;
  tags: string[];
}

export interface DiscoverSearchResponse {
  query: string;
  intentCategory: DiscoverCategory;
  intentSummary: string;
  expandedKeywords: string[];
  steps: DiscoverAgentStep[];
  items: DiscoveredResourceItem[];
  aiSynthesis: {
    provenance: "ai_inferred";
    available: boolean;
    provider?: AIProviderId;
    model?: string;
    keySource?: "user" | "server";
    content: string;
    fallbackReason?: string;
  };
  followUpSuggestions: string[];
  complianceNotice: string;
  generatedAt: string;
}
