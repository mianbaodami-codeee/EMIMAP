import { beforeAll, describe, expect, it } from "vitest";
import {
  generateUnifiedAIText,
  UnifiedAIError,
} from "@/lib/ai/unified-client";
import {
  analyzeGeoLocation,
  computeHaversineKm,
  createSavedPlace,
  deleteSavedPlace,
  listGeoQueryHistory,
  listSavedPlaces,
  reverseGeocodeCoordinate,
  searchGeoPlaces,
} from "@/lib/geo/service";
import {
  DiscoverComplianceError,
  runResourceDiscoveryAgent,
} from "@/lib/discover/agent";
import type { DnsLookupAllFn, SafeHttpsResponse } from "@/lib/http/safe-upstream";

beforeAll(() => {
  process.env.DATABASE_URL = "memory://";
  process.env.REDIS_URL = "";
});

const PUBLIC_DNS: DnsLookupAllFn = async () => [
  { address: "104.18.32.45", family: 4 },
];

const PRIVATE_DNS: DnsLookupAllFn = async () => [
  { address: "10.0.12.8", family: 4 },
];

describe("第二阶段：统一大模型推理网关 (OpenAI / Gemini / 兼容端点安全边界)", () => {
  it("严格阻止将服务器预置 OPENAI_API_KEY 发送至用户自定义 Base URL", async () => {
    let called = false;
    await expect(
      generateUnifiedAIText(
        {
          provider: "openai",
          model: "gpt-4.1-mini",
          baseUrl: "https://custom-relay.example.com/v1",
          messages: [{ role: "user", content: "Hello" }],
          temperature: 0.2,
          maxTokens: 128,
        },
        {
          env: {
            OPENAI_API_KEY: "sk-server-secret-never-leak",
            OPENAI_BASE_URL: "https://api.openai.com/v1",
          },
          dnsLookup: PUBLIC_DNS,
          httpsPost: async () => {
            called = true;
            return { status: 200, contentType: "application/json", body: "{}" };
          },
        }
      )
    ).rejects.toMatchObject({
      code: "FORBIDDEN_OPERATION",
      status: 403,
    });
    expect(called).toBe(false);
  });

  it("拦截解析为内网保留 IP 的自定义端点且拒绝将 HTML 200 响应视为有效推理结果", async () => {
    await expect(
      generateUnifiedAIText(
        {
          provider: "openai_compatible",
          model: "qwen-plus",
          apiKey: "sk-user-byok-key",
          baseUrl: "https://intranet-llm.example.com/v1",
          messages: [{ role: "user", content: "ping" }],
          temperature: 0.2,
          maxTokens: 128,
        },
        {
          dnsLookup: PRIVATE_DNS,
          httpsPost: async () => ({
            status: 200,
            contentType: "application/json",
            body: "{}",
          }),
        }
      )
    ).rejects.toBeInstanceOf(UnifiedAIError);

    // 返回 HTML 登录页（HTTP 200）时应明确报错而非当成模型回复
    await expect(
      generateUnifiedAIText(
        {
          provider: "openai_compatible",
          model: "qwen-plus",
          apiKey: "sk-user-byok-key",
          baseUrl: "https://portal.example.com/v1",
          messages: [{ role: "user", content: "ping" }],
          temperature: 0.2,
          maxTokens: 128,
        },
        {
          dnsLookup: PUBLIC_DNS,
          httpsPost: async () => ({
            status: 200,
            contentType: "text/html; charset=utf-8",
            body: "<!doctype html><html><body>Gateway Login</body></html>",
          }),
        }
      )
    ).rejects.toMatchObject({
      code: "UPSTREAM_AI_ERROR",
    });
  });

  it("正确解析 OpenAI 与 Google Gemini 标准 JSON 补全结构", async () => {
    const openaiOut = await generateUnifiedAIText(
      {
        provider: "openai",
        model: "gpt-4.1-mini",
        apiKey: "sk-user-valid",
        messages: [{ role: "user", content: "测试统一接口" }],
        temperature: 0.2,
        maxTokens: 200,
      },
      {
        dnsLookup: PUBLIC_DNS,
        httpsPost: async (url, _body, opts) => {
          expect(url).toBe("https://api.openai.com/v1/chat/completions");
          expect(opts?.headers?.Authorization).toBe("Bearer sk-user-valid");
          return {
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: { content: "OpenAI 空间推理就绪" },
                },
              ],
            }),
          };
        },
      }
    );
    expect(openaiOut.content).toBe("OpenAI 空间推理就绪");
    expect(openaiOut.keySource).toBe("user");

    const geminiOut = await generateUnifiedAIText(
      {
        provider: "gemini",
        model: "gemini-2.5-flash",
        apiKey: "AIzaSyTestUserKey",
        messages: [
          { role: "system", content: "系统角色约束" },
          { role: "user", content: "测试 Gemini" },
        ],
        temperature: 0.2,
        maxTokens: 200,
      },
      {
        dnsLookup: PUBLIC_DNS,
        httpsPost: async (url, _body, opts) => {
          expect(url).toContain(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
          );
          expect(opts?.headers?.["x-goog-api-key"]).toBe("AIzaSyTestUserKey");
          return {
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              candidates: [
                {
                  finishReason: "STOP",
                  content: { parts: [{ text: "Gemini 多模态空间推理就绪" }] },
                },
              ],
            }),
          };
        },
      }
    );
    expect(geminiOut.content).toBe("Gemini 多模态空间推理就绪");
  });
});

describe("第二阶段：全球地图逆地理编码、地点收藏隔离与三源 AI 空间问答", () => {
  const geoClientA = "wk_geo_client_alpha_01";
  const geoClientB = "wk_geo_client_bravo_02";

  it("球面大圆距离 Haversine 计算精确且支持关键词/坐标双模检索", async () => {
    // 上海 (31.2304, 121.4737) -> 东京 (35.6762, 139.6503) 大圆距离约 1760 km
    const dist = computeHaversineKm(31.2304, 121.4737, 35.6762, 139.6503);
    expect(dist).toBeGreaterThan(1720);
    expect(dist).toBeLessThan(1800);

    const offlineGet = async (): Promise<SafeHttpsResponse> => {
      throw new Error("sandbox offline");
    };

    const hits = await searchGeoPlaces("深圳", { httpsGet: offlineGet });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.name).toContain("深圳");
    expect(hits[0]!.countryCode).toBe("CN");

    const rev = await reverseGeocodeCoordinate(35.6762, 139.6503, {
      httpsGet: offlineGet,
    });
    expect(rev.country).toBe("日本");
    expect(rev.nearbyPois.length).toBeGreaterThan(0);
  });

  it("支持收藏地点持久化 CRUD 且严格隔离不同匿名工作区数据", async () => {
    const saved = await createSavedPlace(geoClientA, {
      name: "苏黎世精密工程观测站",
      latitude: 47.3769,
      longitude: 8.5417,
      country: "瑞士",
      adminArea: "Zürich",
      notes: "欧洲图形学节点",
    });
    expect(saved.id).toBeTruthy();

    const listA = await listSavedPlaces(geoClientA);
    const listB = await listSavedPlaces(geoClientB);
    expect(listA.some((p) => p.id === saved.id)).toBe(true);
    expect(listB.some((p) => p.id === saved.id)).toBe(false);

    // B 无权删除 A 的收藏地点
    const crossDelete = await deleteSavedPlace(geoClientB, saved.id);
    expect(crossDelete).toBe(false);

    const ownerDelete = await deleteSavedPlace(geoClientA, saved.id);
    expect(ownerDelete).toBe(true);
  });

  it("三源隔离 AI 地理分析严格区分 measured / web_verified / ai_inferred 并写入历史表", async () => {
    const offlineGet = async (): Promise<SafeHttpsResponse> => {
      throw new Error("offline");
    };

    // 1. 未配置 AI 密钥时优雅降级，不报错且保留实测与公开核验数据
    const degraded = await analyzeGeoLocation(
      geoClientA,
      {
        latitude: 1.3521,
        longitude: 103.8198,
        placeName: "新加坡",
        question: "分析马六甲海峡东口的网络与航运区位特征",
      },
      {
        env: { OPENAI_API_KEY: "", GEMINI_API_KEY: "" },
        httpsGet: offlineGet,
      }
    );
    expect(degraded.measured.provenance).toBe("measured");
    expect(degraded.webVerified.provenance).toBe("web_verified");
    expect(degraded.aiInferred.provenance).toBe("ai_inferred");
    expect(degraded.aiInferred.available).toBe(false);

    // 2. 提供有效 BYOK 密钥时返回在线推理结果并记录历史
    const active = await analyzeGeoLocation(
      geoClientA,
      {
        latitude: 31.2304,
        longitude: 121.4737,
        placeName: "上海",
        question: "分析长三角国际海缆登陆站区位条件",
        provider: "openai",
        model: "gpt-4.1-mini",
        apiKey: "sk-user-geo-test",
      },
      {
        dnsLookup: PUBLIC_DNS,
        httpsGet: offlineGet,
        httpsPost: async () => ({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content:
                    "上海地处长江入海口与西太平洋沿岸中枢，具备平坦冲积大陆架与多路国际海缆汇聚优势。",
                },
              },
            ],
          }),
        }),
      }
    );
    expect(active.aiInferred.available).toBe(true);
    expect(active.aiInferred.analysis).toContain("国际海缆");

    const history = await listGeoQueryHistory(geoClientA, 10);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0]!.placeName).toBe("上海");
  });
});

describe("第二阶段：AI 自主资源寻找代理与正版合规边界", () => {
  it("输出完整的四步检索轨迹、官方源核验依据及注意事项，并支持仅官方源过滤", async () => {
    const offlineGet = async (): Promise<SafeHttpsResponse> => {
      throw new Error("offline");
    };

    const res = await runResourceDiscoveryAgent(
      {
        query: "Steam 与 SteamDB 正版游戏价格查询",
        category: "game",
        officialOnly: false,
        conversationHistory: [],
      },
      {
        env: { OPENAI_API_KEY: "", GEMINI_API_KEY: "" },
        httpsGet: offlineGet,
      }
    );

    expect(res.steps).toHaveLength(4);
    expect(res.items.length).toBeGreaterThanOrEqual(2);
    expect(res.items.some((i) => i.domain === "steamdb.info" && !i.isOfficial)).toBe(
      true
    );

    // 开启 officialOnly 后应自动剔除第三方社区站点 steamdb.info，仅保留第一方官方商店
    const officialFiltered = await runResourceDiscoveryAgent(
      {
        query: "Steam 与 SteamDB 正版游戏价格查询",
        category: "game",
        officialOnly: true,
        conversationHistory: [],
      },
      {
        env: { OPENAI_API_KEY: "", GEMINI_API_KEY: "" },
        httpsGet: offlineGet,
      }
    );
    expect(officialFiltered.items.length).toBeGreaterThan(0);
    expect(officialFiltered.items.every((i) => i.isOfficial)).toBe(true);
    expect(
      officialFiltered.items.some((i) => i.domain === "steamdb.info")
    ).toBe(false);
  });

  it("严格拦截盗版破解、注册机及绕过付费门禁的违规检索请求", async () => {
    await expect(
      runResourceDiscoveryAgent({
        query: "求 Cyberpunk 2077 免付费破解版下载与激活码生成器 keygen",
        category: "all",
        officialOnly: false,
        conversationHistory: [],
      })
    ).rejects.toBeInstanceOf(DiscoverComplianceError);
  });
});
