import { z } from "zod";

/**
 * 常用网址导引 (/hub) 领域类型与输入校验规则
 */

export const SITE_CATEGORIES = [
  "gaming",
  "dev",
  "ai",
  "platform_docs",
  "hardware_net",
  "custom",
] as const;

export type SiteCategory = (typeof SITE_CATEGORIES)[number];

export const SITE_CATEGORY_LABELS: Record<SiteCategory, string> = {
  gaming: "游戏与数字发行",
  dev: "开发与开源社区",
  ai: "AI 与大模型",
  platform_docs: "官方平台与技术文档",
  hardware_net: "硬件与网络工具",
  custom: "用户自定义",
};

/**
 * 校验外部网址合法性：仅允许 http:// 或 https:// 协议，防止 javascript:/data: 注入
 */
export const SafeHttpUrlSchema = z
  .string()
  .trim()
  .min(4, "请输入有效的网址链接")
  .max(512, "网址长度不能超过 512 个字符")
  .refine(
    (val) => {
      try {
        const parsed = new URL(val);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "仅支持以 http:// 或 https:// 开头的完整有效网址" }
  );

export const CreateCustomSiteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "网站名称不能为空")
    .max(60, "网站名称不能超过 60 个字符"),
  url: SafeHttpUrlSchema,
  category: z.enum(SITE_CATEGORIES).default("custom"),
  description: z
    .string()
    .trim()
    .min(2, "请填写简短的网站介绍（至少 2 个字符）")
    .max(240, "网站介绍不能超过 240 个字符"),
  tags: z
    .array(z.string().trim().min(1).max(24))
    .max(6, "最多添加 6 个标签")
    .default([]),
});

export const UpdateSitePatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  url: SafeHttpUrlSchema.optional(),
  category: z.enum(SITE_CATEGORIES).optional(),
  description: z.string().trim().min(2).max(240).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(6).optional(),
  isFavorite: z.boolean().optional(),
});

export const ImportCustomSitesSchema = z.object({
  sites: z
    .array(CreateCustomSiteSchema)
    .min(1, "导入列表不能为空")
    .max(100, "单次最多导入 100 条自定义网址"),
});

export type CreateCustomSiteInput = z.infer<typeof CreateCustomSiteSchema>;
export type UpdateSitePatchInput = z.infer<typeof UpdateSitePatchSchema>;

export interface HubSiteItem {
  id: string;
  slug: string;
  name: string;
  url: string;
  domain: string;
  category: SiteCategory;
  description: string;
  tags: string[];
  isOfficial: boolean;
  isBuiltin: boolean;
  isFavorite: boolean;
  verifiedNote: string | null;
  createdAt: string;
}

export interface HubListResponse {
  items: HubSiteItem[];
  stats: {
    totalCount: number;
    builtinCount: number;
    customCount: number;
    favoriteCount: number;
  };
}
