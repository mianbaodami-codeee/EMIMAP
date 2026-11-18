import { z } from "zod";
import { AIProviderIdSchema, type AIProviderId } from "./settings";

/**
 * 第二阶段：全球交互地图、逆地理编码、收藏地点与三源隔离 AI 地理分析数据契约
 */

export const GeoCoordinateSchema = z.object({
  lat: z.coerce.number().min(-90, "纬度超出 [-90, 90] 范围").max(90, "纬度超出 [-90, 90] 范围"),
  lon: z.coerce.number().min(-180, "经度超出 [-180, 180] 范围").max(180, "经度超出 [-180, 180] 范围"),
});

export type GeoDataSourceMode = "live_osm" | "local_gazetteer";

export interface GeoSearchCandidate {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  adminArea?: string;
  city?: string;
  category: string;
  source: "openstreetmap" | "builtin_gazetteer";
}

export interface NearbyPoiItem {
  id: string;
  name: string;
  category: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  source: "openstreetmap" | "builtin_gazetteer";
}

export interface ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  name: string;
  displayName: string;
  country: string;
  countryCode: string;
  adminArea: string;
  city: string;
  hemisphere: string;
  timezoneEstimate: string;
  elevationOrTerrain?: string;
  nearbyPois: NearbyPoiItem[];
  osmAttribution: string;
  dataMode: GeoDataSourceMode;
  queriedAt: string;
}

export const CreateSavedPlaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请填写地点名称")
    .max(160, "地点名称不能超过 160 个字符"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  country: z.string().trim().max(120).optional(),
  adminArea: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(600).optional(),
  osmMetadata: z.record(z.unknown()).optional(),
});

export type CreateSavedPlaceInput = z.infer<typeof CreateSavedPlaceSchema>;

export interface SavedPlaceItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  adminArea: string | null;
  notes: string | null;
  osmMetadata: Record<string, unknown> | null;
  createdAt: string;
}

export const GeoAnalyzeRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  placeName: z.string().trim().max(180).optional(),
  question: z
    .string()
    .trim()
    .min(2, "请输入至少 2 个字符的地理分析问题")
    .max(1200, "提问内容不能超过 1200 个字符"),
  provider: AIProviderIdSchema.optional(),
  model: z.string().trim().max(120).optional(),
  apiKey: z.string().trim().max(256).optional(),
  baseUrl: z.string().trim().max(300).optional(),
});

export type GeoAnalyzeRequest = z.infer<typeof GeoAnalyzeRequestSchema>;

export interface GeoWebSourceItem {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  retrievedAt: string;
}

export interface GeoAnalyzeResponse {
  historyId: string;
  place: ReverseGeocodeResult;
  question: string;
  /** 第一层：实测/确定性空间坐标与开放地理要素 */
  measured: {
    provenance: "measured";
    summary: string;
    metrics: Array<{ label: string; value: string }>;
    nearbyCount: number;
  };
  /** 第二层：公开权威百科/地理链接核验数据 */
  webVerified: {
    provenance: "web_verified";
    summary: string;
    sources: GeoWebSourceItem[];
  };
  /** 第三层：统一大模型网关空间推理结论（未配置密钥时优雅降级并透明说明） */
  aiInferred: {
    provenance: "ai_inferred";
    available: boolean;
    provider?: AIProviderId;
    model?: string;
    keySource?: "user" | "server";
    analysis: string;
    fallbackReason?: string;
  };
  createdAt: string;
}

export interface GeoQueryHistoryItem {
  id: string;
  placeName: string;
  latitude: number;
  longitude: number;
  prompt: string;
  provider: string | null;
  model: string | null;
  measuredFacts: Record<string, unknown>;
  webSources: GeoWebSourceItem[];
  aiAnalysis: string;
  createdAt: string;
}
