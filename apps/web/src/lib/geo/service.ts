import { computeHaversineKm, estimateSolarUtcOffset, formatHemisphere, searchBuiltinGazetteer } from "./atlas";
export { computeHaversineKm, estimateSolarUtcOffset, formatHemisphere } from "./atlas";
import { desc, eq, and } from "drizzle-orm";
import type {
  CreateSavedPlaceInput,
  GeoAnalyzeRequest,
  GeoAnalyzeResponse,
  GeoQueryHistoryItem,
  GeoSearchCandidate,
  GeoWebSourceItem,
  NearbyPoiItem,
  ReverseGeocodeResult,
  SavedPlaceItem,
} from "@omnikit/shared";
import { getReadyDb } from "@/lib/db/client";
import { geoQueryHistory, savedPlaces } from "@/lib/db/schema";
import { getCacheStore } from "@/lib/cache/store";
import {
  upstreamTransport,
  type DnsLookupAllFn,
  type SafeHttpsResponse,
  type SecureHttpsGetOptions,
} from "@/lib/http/safe-upstream";
import {
  defaultModelForProvider,
  generateUnifiedAIText,
  hasUsableAICredentials,
  UnifiedAIError,
  type HttpsPostFn,
} from "@/lib/ai/unified-client";
import type { ServerAIEnvConfig } from "@/lib/ai/connection-check";
import {
  WORLD_ATLAS_GAZETTEER,
  type GazetteerEntry,
} from "./world-atlas-data";

const OSM_ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";
const GEO_HTTP_TIMEOUT_MS = 3200;
const GEO_USER_AGENT = "OmniKit-AI-GeoModule/0.2 (https://github.com/mianbaodami-codeee/EMIMAP)";

type HttpsGetFn = (
  url: string,
  options?: SecureHttpsGetOptions
) => Promise<SafeHttpsResponse>;

function inferOceanOrContinentalZone(lat: number, lon: number): {
  regionName: string;
  country: string;
  countryCode: string;
  terrain: string;
} {
  if (lat > 66.5) {
    return {
      regionName: "北极圈及高纬度海域/苔原带",
      country: "北极高纬区域",
      countryCode: "AQ",
      terrain: "高纬度极地气候带",
    };
  }
  if (lat < -60) {
    return {
      regionName: "南大洋与南极洲边缘带",
      country: "国际南极条约区",
      countryCode: "AQ",
      terrain: "极地冰盖与绕极洋流区",
    };
  }
  if (lon >= 70 && lon <= 148 && lat >= 15 && lat <= 54) {
    return {
      regionName: "东亚大陆与西太平洋沿岸区",
      country: "东亚地理区",
      countryCode: "EA",
      terrain: "季风平原/高原或边缘海区域",
    };
  }
  if (lon >= -15 && lon <= 45 && lat >= 35 && lat <= 70) {
    return {
      regionName: "欧洲大陆与北大西洋东岸区",
      country: "欧洲地理区",
      countryCode: "EU",
      terrain: "温带海洋/大陆性平原与山地",
    };
  }
  if (lon >= -130 && lon <= -65 && lat >= 24 && lat <= 55) {
    return {
      regionName: "北美大陆中纬度区域",
      country: "北美地理区",
      countryCode: "NA",
      terrain: "北美平原与科迪勒拉山系带",
    };
  }
  if (lon > 145 || lon < -125) {
    return {
      regionName: "太平洋公海与大洋盆地",
      country: "国际海域 (Pacific Ocean)",
      countryCode: "OC",
      terrain: "深海盆地与大洋航线区",
    };
  }
  if (lon >= -65 && lon <= -15 && lat >= -45 && lat <= 60) {
    return {
      regionName: "大西洋海域走廊",
      country: "国际海域 (Atlantic Ocean)",
      countryCode: "OC",
      terrain: "大西洋中脊与跨洋航道区",
    };
  }
  if (lon >= 45 && lon <= 110 && lat >= -45 && lat < 15) {
    return {
      regionName: "印度洋海域走廊",
      country: "国际海域 (Indian Ocean)",
      countryCode: "OC",
      terrain: "热带/亚热带季风洋面",
    };
  }
  return {
    regionName: "全球陆海过渡观测区",
    country: "开放地理坐标区",
    countryCode: "GL",
    terrain: "WGS84 大地测量坐标点",
  };
}

/**
 * 地点关键词检索：优先请求 OpenStreetMap Nominatim 实时公开接口，并融合内置权威地理库保底。
 */
export async function searchGeoPlaces(
  rawQuery: string,
  options?: { httpsGet?: HttpsGetFn }
): Promise<GeoSearchCandidate[]> {
  const q = rawQuery.trim();
  if (!q) {
    return WORLD_ATLAS_GAZETTEER.slice(0, 8).map((entry) => ({
      id: entry.id,
      name: `${entry.name} (${entry.englishName})`,
      displayName: `${entry.name} · ${entry.adminArea}, ${entry.country}`,
      latitude: entry.latitude,
      longitude: entry.longitude,
      country: entry.country,
      countryCode: entry.countryCode,
      adminArea: entry.adminArea,
      city: entry.city,
      category: entry.category,
      source: "builtin_gazetteer",
    }));
  }

  const cacheKey = `geo:search:${q.toLowerCase()}`;
  const cache = getCacheStore();
  const cached = await cache.get<GeoSearchCandidate[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  const httpsGet = options?.httpsGet ?? upstreamTransport.httpsGet;
  const localMatches = searchBuiltinGazetteer(q);
  if (localMatches[0]?.countryCode === "WGS84") return [localMatches[0]];
  const liveMatches: GeoSearchCandidate[] = [];

  try {
    if (!options?.httpsGet && !(await cache.checkRateLimit("geo:nominatim", 1, 1)).allowed) {
      return localMatches;
    }
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(
      q
    )}`;
    const resp = await httpsGet(nominatimUrl, {
      headers: {
        "User-Agent": GEO_USER_AGENT,
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      timeoutMs: GEO_HTTP_TIMEOUT_MS,
    });

    if (resp.status === 200) {
      const parsed: unknown = JSON.parse(resp.body);
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          if (!row || typeof row !== "object") continue;
          const item = row as Record<string, unknown>;
          const lat = Number(item.lat);
          const lon = Number(item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const addr =
            (item.address as Record<string, string | undefined> | undefined) ||
            {};
          liveMatches.push({
            id: `osm-${String(item.place_id || `${lat}-${lon}`)}`,
            name: String(
              item.name ||
                addr.city ||
                addr.town ||
                String(item.display_name || "").split(",")[0] ||
                q
            ),
            displayName: String(item.display_name || q),
            latitude: Number(lat.toFixed(5)),
            longitude: Number(lon.toFixed(5)),
            country: addr.country || "OpenStreetMap",
            countryCode: (addr.country_code || "OSM").toUpperCase(),
            adminArea: addr.state || addr.province || addr.region,
            city: addr.city || addr.town || addr.county,
            category: String(item.type || item.category || "地理要素"),
            source: "openstreetmap",
          });
        }
      }
    }
  } catch {
    // 外部 Nominatim 不可达（如受限代理/离线环境）时静默回退至本地权威地理索引
  }

  // 合并去重：经纬度距离小于 8km 视为同一城市地标
  const combined: GeoSearchCandidate[] = [...liveMatches];
  for (const local of localMatches) {
    const duplicate = combined.some(
      (c) =>
        computeHaversineKm(
          c.latitude,
          c.longitude,
          local.latitude,
          local.longitude
        ) < 8
    );
    if (!duplicate) {
      combined.push(local);
    }
  }

  const finalResults = combined.slice(0, 10);
  if (finalResults.length > 0) {
    await cache.set(cacheKey, finalResults, 600);
  }
  return finalResults;
}

function findNearestGazetteerPois(
  lat: number,
  lon: number,
  maxItems = 5
): Array<{ entry: GazetteerEntry; distanceKm: number }> {
  return WORLD_ATLAS_GAZETTEER.map((entry) => ({
    entry,
    distanceKm: computeHaversineKm(lat, lon, entry.latitude, entry.longitude),
  }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, maxItems);
}

/**
 * 逆地理编码与周边要素识别：支持全球任意 WGS84 坐标拾取。
 */
export async function reverseGeocodeCoordinate(
  rawLat: number,
  rawLon: number,
  options?: { httpsGet?: HttpsGetFn }
): Promise<ReverseGeocodeResult> {
  const latitude = Number(rawLat.toFixed(6));
  const longitude = Number(rawLon.toFixed(6));
  // 邻近坐标可能分属两栋建筑，缓存按完整坐标保存。
  const cacheKey = `geo:rev:v2:${latitude}:${longitude}`;
  const cache = getCacheStore();
  const cached = await cache.get<ReverseGeocodeResult>(cacheKey);
  if (cached) return cached;

  const httpsGet = options?.httpsGet ?? upstreamTransport.httpsGet;
  const nearest = findNearestGazetteerPois(latitude, longitude, 5);
  const closest = nearest[0];

  const nearbyPois: NearbyPoiItem[] = nearest.slice(0, 4).map((item) => ({
    id: item.entry.id,
    name: `${item.entry.name} (${item.entry.englishName})`,
    category: item.entry.category,
    distanceKm: item.distanceKm,
    latitude: item.entry.latitude,
    longitude: item.entry.longitude,
    source: "builtin_gazetteer",
  }));

  const canQueryLive = options?.httpsGet || (await cache.checkRateLimit("geo:nominatim", 1, 1)).allowed;
  try {
    if (canQueryLive) {
      const revUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${latitude}&lon=${longitude}`;
      const resp = await httpsGet(revUrl, {
        headers: {
          "User-Agent": GEO_USER_AGENT,
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
        timeoutMs: GEO_HTTP_TIMEOUT_MS,
      });

      if (resp.status === 200) {
        const data = JSON.parse(resp.body) as Record<string, unknown>;
        if (data && typeof data === "object" && !data.error) {
          const addr =
            (data.address as Record<string, string | undefined> | undefined) || {};
          const city =
            addr.city ||
            addr.town ||
            addr.county ||
            addr.municipality ||
            addr.village ||
            "";
          const adminArea = addr.state || addr.province || addr.region || city || "行政辖区";
          const country = addr.country || "国际区域";
          const countryCode = (addr.country_code || "OSM").toUpperCase();
          const primaryName =
            String(data.name || "").trim() ||
            city ||
            adminArea ||
            `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`;

          const liveResult: ReverseGeocodeResult = {
            latitude,
            longitude,
            name: primaryName,
            displayName: String(data.display_name || `${primaryName}, ${country}`),
            country,
            countryCode,
            adminArea,
            city: city || primaryName,
            hemisphere: formatHemisphere(latitude, longitude),
            timezoneEstimate: estimateSolarUtcOffset(longitude),
            elevationOrTerrain:
              closest && closest.distanceKm < 5
                ? closest.entry.elevationOrTerrain
                : undefined,
            nearbyPois,
            osmAttribution: OSM_ATTRIBUTION,
            dataMode: "live_osm",
            queriedAt: new Date().toISOString(),
          };
          await cache.set(cacheKey, liveResult, 600);
          return liveResult;
        }
      }
    }
  } catch {
    // 外部逆地理接口不可达时使用内置大圆距离空间索引诚实回退
  }

  if (closest && closest.distanceKm <= 260) {
    const isDirectHit = closest.distanceKm <= 35;
    const placeTitle = isDirectHit
      ? `${closest.entry.name} (${closest.entry.englishName})`
      : `${closest.entry.name} 周边区域 (距中心约 ${closest.distanceKm} km)`;

    const fallbackNearCity: ReverseGeocodeResult = {
      latitude,
      longitude,
      name: placeTitle,
      displayName: `${placeTitle} · ${closest.entry.adminArea}, ${closest.entry.country}`,
      country: closest.entry.country,
      countryCode: closest.entry.countryCode,
      adminArea: closest.entry.adminArea,
      city: closest.entry.city,
      hemisphere: formatHemisphere(latitude, longitude),
      timezoneEstimate: estimateSolarUtcOffset(longitude),
      elevationOrTerrain: closest.entry.elevationOrTerrain,
      nearbyPois,
      osmAttribution: `${OSM_ATTRIBUTION} · 内置空间基准库离线回退`,
      dataMode: "local_gazetteer",
      queriedAt: new Date().toISOString(),
    };
    await cache.set(cacheKey, fallbackNearCity, canQueryLive ? 300 : 10);
    return fallbackNearCity;
  }

  const zone = inferOceanOrContinentalZone(latitude, longitude);
  const remotePointResult: ReverseGeocodeResult = {
    latitude,
    longitude,
    name: `${zone.regionName} (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`,
    displayName: `${zone.regionName} · WGS84 (${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°)`,
    country: zone.country,
    countryCode: zone.countryCode,
    adminArea: zone.regionName,
    city: closest
      ? `最近枢纽：${closest.entry.name} (${closest.distanceKm} km)`
      : zone.regionName,
    hemisphere: formatHemisphere(latitude, longitude),
    timezoneEstimate: estimateSolarUtcOffset(longitude),
    elevationOrTerrain: zone.terrain,
    nearbyPois,
    osmAttribution: `${OSM_ATTRIBUTION} · 内置空间基准库计算`,
    dataMode: "local_gazetteer",
    queriedAt: new Date().toISOString(),
  };
  await cache.set(cacheKey, remotePointResult, canQueryLive ? 300 : 10);
  return remotePointResult;
}

/**
 * 收藏地点 CRUD（按客户端工作区隔离存储在 PostgreSQL saved_places 表）
 */
export async function listSavedPlaces(
  clientId: string
): Promise<SavedPlaceItem[]> {
  const { db } = await getReadyDb();
  const rows = await db
    .select()
    .from(savedPlaces)
    .where(eq(savedPlaces.clientId, clientId))
    .orderBy(desc(savedPlaces.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country,
    adminArea: r.adminArea,
    notes: r.notes,
    osmMetadata: r.osmMetadata ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createSavedPlace(
  clientId: string,
  input: CreateSavedPlaceInput
): Promise<SavedPlaceItem> {
  const { db } = await getReadyDb();
  const [inserted] = await db
    .insert(savedPlaces)
    .values({
      clientId,
      name: input.name.trim(),
      latitude: Number(input.latitude.toFixed(5)),
      longitude: Number(input.longitude.toFixed(5)),
      country: input.country?.trim() || null,
      adminArea: input.adminArea?.trim() || null,
      notes: input.notes?.trim() || null,
      osmMetadata: input.osmMetadata ?? null,
    })
    .returning();

  if (!inserted) {
    throw new Error("保存收藏地点失败");
  }

  return {
    id: inserted.id,
    name: inserted.name,
    latitude: inserted.latitude,
    longitude: inserted.longitude,
    country: inserted.country,
    adminArea: inserted.adminArea,
    notes: inserted.notes,
    osmMetadata: inserted.osmMetadata ?? null,
    createdAt: inserted.createdAt.toISOString(),
  };
}

export async function deleteSavedPlace(
  clientId: string,
  placeId: string
): Promise<boolean> {
  const { db } = await getReadyDb();
  const deleted = await db
    .delete(savedPlaces)
    .where(and(eq(savedPlaces.id, placeId), eq(savedPlaces.clientId, clientId)))
    .returning({ id: savedPlaces.id });
  return deleted.length > 0;
}

export async function listGeoQueryHistory(
  clientId: string,
  limit = 20
): Promise<GeoQueryHistoryItem[]> {
  const { db } = await getReadyDb();
  const rows = await db
    .select()
    .from(geoQueryHistory)
    .where(eq(geoQueryHistory.clientId, clientId))
    .orderBy(desc(geoQueryHistory.createdAt))
    .limit(Math.max(1, Math.min(50, limit)));

  return rows.map((r) => ({
    id: r.id,
    placeName: r.placeName,
    latitude: r.latitude,
    longitude: r.longitude,
    prompt: r.prompt,
    provider: r.provider,
    model: r.model,
    measuredFacts: r.measuredFacts ?? {},
    webSources: (r.webSources ?? []) as unknown as GeoWebSourceItem[],
    aiAnalysis: r.aiAnalysis,
    createdAt: r.createdAt.toISOString(),
  }));
}

async function retrievePlaceWebSources(
  place: ReverseGeocodeResult,
  httpsGet: HttpsGetFn
): Promise<{ summary: string; sources: GeoWebSourceItem[] }> {
  const nowIso = new Date().toISOString();
  const sources: GeoWebSourceItem[] = [];

  const matchedGazetteer = findNearestGazetteerPois(
    place.latitude,
    place.longitude,
    1
  )[0];
  const isCloseGazetteer =
    matchedGazetteer && matchedGazetteer.distanceKm <= 85;

  const wikiSlug = isCloseGazetteer
    ? matchedGazetteer.entry.wikiSlugEn
    : encodeURIComponent(place.city || place.name);

  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiSlug}`;
    const resp = await httpsGet(wikiUrl, {
      headers: {
        "User-Agent": GEO_USER_AGENT,
      },
      timeoutMs: 2600,
    });
    if (resp.status === 200) {
      const parsed = JSON.parse(resp.body) as {
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
      };
      if (parsed.extract) {
        const pageUrl =
          parsed.content_urls?.desktop?.page ||
          `https://en.wikipedia.org/wiki/${wikiSlug}`;
        sources.push({
          title: `Wikipedia · ${parsed.title || place.name}`,
          url: pageUrl,
          domain: "en.wikipedia.org",
          snippet: parsed.extract.slice(0, 280),
          retrievedAt: nowIso,
        });
      }
    }
  } catch {
    // 外部百科超时或受限时继续使用已核验权威地理参考链接
  }

  if (isCloseGazetteer) {
    sources.push({
      title: `权威地理背景核验 · ${matchedGazetteer.entry.name} (${matchedGazetteer.entry.englishName})`,
      url: `https://en.wikipedia.org/wiki/${matchedGazetteer.entry.wikiSlugEn}`,
      domain: "en.wikipedia.org",
      snippet: matchedGazetteer.entry.factualSummary,
      retrievedAt: nowIso,
    });
  }

  sources.push({
    title: `OpenStreetMap 开放要素图幅 (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)})`,
    url: `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=11/${place.latitude}/${place.longitude}`,
    domain: "openstreetmap.org",
    snippet: `${place.displayName} · 数据归属 ${OSM_ATTRIBUTION}`,
    retrievedAt: nowIso,
  });

  const summary =
    sources[0]?.snippet ||
    `${place.displayName} 位于 ${place.country}（${place.adminArea}），可通过 OpenStreetMap 查阅开放道路与周边设施要素。`;

  return { summary, sources };
}

/**
 * 执行三源隔离（实测地理要素 + 公开信源核验 + 统一大模型空间推理）地理问答，并持久化历史记录。
 */
export async function analyzeGeoLocation(
  clientId: string,
  input: GeoAnalyzeRequest,
  options?: {
    env?: ServerAIEnvConfig;
    dnsLookup?: DnsLookupAllFn;
    httpsGet?: HttpsGetFn;
    httpsPost?: HttpsPostFn;
  }
): Promise<GeoAnalyzeResponse> {
  const httpsGet = options?.httpsGet ?? upstreamTransport.httpsGet;
  const place = await reverseGeocodeCoordinate(
    input.latitude,
    input.longitude,
    { httpsGet }
  );

  const effectivePlaceName = input.placeName?.trim() || place.name;
  const measuredMetrics = [
    {
      label: "WGS84 经纬度",
      value: `${place.latitude.toFixed(4)}°, ${place.longitude.toFixed(4)}°`,
    },
    { label: "所属国家 / 地区", value: `${place.country} (${place.countryCode})` },
    { label: "行政辖区", value: place.adminArea },
    { label: "半球与经度时区带", value: `${place.hemisphere} · ${place.timezoneEstimate}` },
    ...(place.elevationOrTerrain
      ? [{ label: "地形与高程特征", value: place.elevationOrTerrain }]
      : []),
    {
      label: "最近参考枢纽",
      value: place.nearbyPois[0]
        ? `${place.nearbyPois[0].name} (${place.nearbyPois[0].distanceKm} km)`
        : "当前坐标点",
    },
  ];

  const measuredSummary = `坐标 (${place.latitude.toFixed(4)}°, ${place.longitude.toFixed(4)}°) 定位为「${effectivePlaceName}」，归属 ${place.country} · ${place.adminArea}，处于 ${place.hemisphere}（${place.timezoneEstimate}），周边检索到 ${place.nearbyPois.length} 个关联参考节点。`;

  const webContext = await retrievePlaceWebSources(place, httpsGet);

  const provider = input.provider ?? "openai";
  const targetModel =
    (input.model || "").trim() || defaultModelForProvider(provider);

  // 若用户显式选择了自定义端点或传入了自定义 Base URL，必须先执行与第一阶段一致的安全边界检查（禁止静默吞掉安全违规）
  const hasExplicitCustomEndpoint =
    provider === "openai_compatible" || Boolean((input.baseUrl || "").trim());

  let aiInferred: GeoAnalyzeResponse["aiInferred"];

  if (
    hasExplicitCustomEndpoint ||
    hasUsableAICredentials(
      {
        provider,
        apiKey: input.apiKey,
        baseUrl: input.baseUrl,
      },
      options?.env
    )
  ) {
    try {
      const llmResp = await generateUnifiedAIText(
        {
          provider,
          model: targetModel,
          apiKey: input.apiKey,
          baseUrl: input.baseUrl,
          temperature: 0.3,
          maxTokens: 850,
          messages: [
            {
              role: "system",
              content:
                "你是 OmniKit AI 空间地理与基础设施分析助手。请严格基于提供的实测经纬度、行政区划与公开背景信息回答用户问题。遵循诚实可溯源原则：不要编造未测量的实时气象或精确人口数字；重点从空间区位、地形气候带、交通航运/网络通信基础设施或区域产业特征角度给出清晰、结构化的中文分析（200–450字）。",
            },
            {
              role: "user",
              content: [
                `目标地点：${effectivePlaceName} (${place.displayName})`,
                `精确坐标：纬度 ${place.latitude}°, 经度 ${place.longitude}° (${place.hemisphere}, ${place.timezoneEstimate})`,
                place.elevationOrTerrain
                  ? `地形参考：${place.elevationOrTerrain}`
                  : "",
                `周边枢纽距离：${place.nearbyPois
                  .map((p) => `${p.name} ${p.distanceKm}km`)
                  .join("；")}`,
                `公开核验摘要：${webContext.summary}`,
                `用户提问：${input.question}`,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
        {
          env: options?.env,
          dnsLookup: options?.dnsLookup,
          httpsPost: options?.httpsPost,
        }
      );

      aiInferred = {
        provenance: "ai_inferred",
        available: true,
        provider: llmResp.provider,
        model: llmResp.model,
        keySource: llmResp.keySource,
        analysis: llmResp.content,
      };
    } catch (err) {
      if (
        err instanceof UnifiedAIError &&
        (err.code === "FORBIDDEN_OPERATION" || err.code === "VALIDATION_ERROR")
      ) {
        throw err;
      }
      const errReason =
        err instanceof Error ? err.message : "上游大模型服务暂时不可用";
      aiInferred = {
        provenance: "ai_inferred",
        available: false,
        provider,
        model: targetModel,
        analysis: `当前未能完成大模型在线生成（${errReason}）。上方「实测地理要素」与「联网检索信源」均为真实可用数据，您可在右上角「AI 配置」中检查 API Key 或稍后重试。`,
        fallbackReason: errReason,
      };
    }
  } else {
    aiInferred = {
      provenance: "ai_inferred",
      available: false,
      provider,
      model: targetModel,
      analysis: `当前环境尚未配置 ${provider === "gemini" ? "Gemini" : "OpenAI"} API Key，已为您完整输出实测空间坐标、时区方位与公开百科信源摘要。如需针对「${input.question}」生成大模型深度空间推理，请点击右上角「AI 模型与客户端配置」填入个人密钥（BYOK）。`,
      fallbackReason: "未检测到可用的 AI API Key（支持右上角 BYOK 配置）",
    };
  }

  const { db } = await getReadyDb();
  const [historyRow] = await db
    .insert(geoQueryHistory)
    .values({
      clientId,
      placeName: effectivePlaceName.slice(0, 180),
      latitude: place.latitude,
      longitude: place.longitude,
      prompt: input.question,
      provider: aiInferred.available ? provider : null,
      model: aiInferred.available ? targetModel : null,
      measuredFacts: {
        summary: measuredSummary,
        metrics: measuredMetrics,
        dataMode: place.dataMode,
      },
      webSources: webContext.sources as unknown as Array<Record<string, unknown>>,
      aiAnalysis: aiInferred.analysis,
    })
    .returning();

  const createdAt = historyRow?.createdAt.toISOString() ?? new Date().toISOString();

  return {
    historyId: historyRow?.id ?? `hist_${Date.now()}`,
    place: {
      ...place,
      name: effectivePlaceName,
    },
    question: input.question,
    measured: {
      provenance: "measured",
      summary: measuredSummary,
      metrics: measuredMetrics,
      nearbyCount: place.nearbyPois.length,
    },
    webVerified: {
      provenance: "web_verified",
      summary: webContext.summary,
      sources: webContext.sources,
    },
    aiInferred,
    createdAt,
  };
}
