import type {
  ApiErrorCode,
  ConcreteDiscoverCategory,
  DiscoverAgentStep,
  DiscoverCategory,
  DiscoveredResourceItem,
  DiscoverSearchRequest,
  DiscoverSearchResponse,
} from "@omnikit/shared";
import { extractDomain, normalizeExternalHttpUrl } from "@/lib/http/safe-url";
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
  CURATED_AUTHORITATIVE_RESOURCES,
  VERIFIED_OFFICIAL_DOMAINS,
} from "./catalog";

const DISCOVER_HTTP_TIMEOUT_MS = 3200;
const DISCOVER_USER_AGENT =
  "OmniKit-AI-DiscoveryAgent/0.2 (https://github.com/mianbaodami-codeee/EMIMAP)";

type HttpsGetFn = (
  url: string,
  options?: SecureHttpsGetOptions
) => Promise<SafeHttpsResponse>;

export class DiscoverComplianceError extends Error {
  public readonly code: ApiErrorCode = "FORBIDDEN_OPERATION";
  public readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = "DiscoverComplianceError";
  }
}

const PROHIBITED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /(破解版|盗版|免付费破解|学习版下载|内购破解|未加密破解补丁|cracked\s+download|pirated|warez|fitgirl\s+repack|torrent\s+crack)/i,
    reason:
      "合规与安全拦截：本平台严格遵循正版与知识产权保护准则，不提供盗版、破解补丁或非授权拷贝下载链接。您可以检索对应的 Steam / GOG（DRM-Free）官方正版渠道或同类型免费开源替代软件。",
  },
  {
    pattern:
      /(注册机|激活码生成器|序列号生成器|绕过付费墙|绕过登录鉴权|keygen|serial\s+generator|license\s+crack|bypass\s+paywall|bypass\s+auth)/i,
    reason:
      "合规与安全拦截：禁止检索注册机、序列号生成器或绕过付费/授权门禁的工具（此类资源极易携带供应链木马）。请改为检索官方试用版、教育授权或开源许可工具。",
  },
  {
    pattern: /(游戏外挂|透视自瞄|木马免杀|勒索病毒源码|ddos攻击脚本|aimbot\s+hack)/i,
    reason:
      "安全边界拦截：禁止检索恶意软件、作弊外挂或网络攻击工具。",
  },
];

export function assertDiscoveryCompliance(query: string): void {
  for (const rule of PROHIBITED_PATTERNS) {
    if (rule.pattern.test(query)) {
      throw new DiscoverComplianceError(rule.reason);
    }
  }
}

function inferIntentCategory(
  combinedText: string,
  explicitCategory: DiscoverCategory
): ConcreteDiscoverCategory | "mixed" {
  if (explicitCategory !== "all") {
    return explicitCategory;
  }
  const q = combinedText.toLowerCase();
  if (
    /(steam|gog|epic|playstation|ps5|xbox|nintendo|switch|cyberpunk|赛博朋克|游戏|买正版|game|elden|wukong|黑神话)/i.test(
      q
    )
  ) {
    return "game";
  }
  if (
    /(openai|gemini|huggingface|claude|anthropic|大模型|llm|模型权重|safetensors|ai\s*model|mcp)/i.test(
      q
    )
  ) {
    return "ai_model";
  }
  if (
    /(文档|手册|规范|标准|mdn|microsoft\s*learn|api\s*docs|documentation|教程|reference)/i.test(
      q
    )
  ) {
    return "docs";
  }
  if (
    /(开源|github|仓库|repo|scrcpy|tauri|maplibre|blender|obs|源码|open\s*source)/i.test(
      q
    )
  ) {
    return "open_source";
  }
  if (
    /(工具|编译器|安装|rust|cargo|npm|playwright|adb|ffmpeg|docker|cli|sdk)/i.test(
      q
    )
  ) {
    return "dev_tool";
  }
  return "mixed";
}

function extractExpandedKeywords(rawQuery: string, historyText: string): string[] {
  const tokens = `${rawQuery} ${historyText}`
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5.+-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const stopWords = new Set([
    "请问",
    "帮我",
    "寻找",
    "查找",
    "搜索",
    "哪里",
    "怎么",
    "下载",
    "官方",
    "推荐",
    "一个",
    "哪些",
    "the",
    "for",
    "and",
    "with",
    "official",
    "download",
    "find",
  ]);

  const unique: string[] = [];
  for (const tok of tokens) {
    if (!stopWords.has(tok) && !unique.includes(tok)) {
      unique.push(tok);
    }
  }
  if (unique.length === 0 && rawQuery.trim()) {
    unique.push(rawQuery.trim());
  }
  return unique.slice(0, 6);
}

export function isVerifiedOfficialUrl(rawUrl: string): {
  safeUrl: string;
  domain: string;
  isOfficialDomain: boolean;
} {
  const safeUrl = normalizeExternalHttpUrl(rawUrl);
  const domain = extractDomain(safeUrl);
  const isOfficialDomain = Array.from(VERIFIED_OFFICIAL_DOMAINS).some(
    (trusted) => domain === trusted || domain.endsWith(`.${trusted}`)
  );
  return { safeUrl, domain, isOfficialDomain };
}

async function probeGitHubRepositories(
  keyword: string,
  httpsGet: HttpsGetFn
): Promise<DiscoveredResourceItem[]> {
  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
      keyword
    )}&sort=stars&order=desc&per_page=4`;
    const resp = await httpsGet(url, {
      headers: {
        "User-Agent": DISCOVER_USER_AGENT,
        Accept: "application/vnd.github+json",
      },
      timeoutMs: DISCOVER_HTTP_TIMEOUT_MS,
    });
    if (resp.status !== 200) return [];
    const data = JSON.parse(resp.body) as {
      items?: Array<{
        id?: number;
        full_name?: string;
        html_url?: string;
        description?: string;
        stargazers_count?: number;
        pushed_at?: string;
        license?: { spdx_id?: string; name?: string } | null;
        topics?: string[];
        language?: string | null;
      }>;
    };
    const out: DiscoveredResourceItem[] = [];
    for (const repo of data.items || []) {
      if (!repo.html_url || !repo.full_name) continue;
      const { safeUrl, domain } = isVerifiedOfficialUrl(repo.html_url);
      const stars = Number(repo.stargazers_count ?? 0);
      const licenseLabel =
        repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION"
          ? `${repo.license.spdx_id} 开源许可`
          : repo.license?.name || "请查阅仓库 LICENSE 文件";
      const updatedDate = repo.pushed_at
        ? `最近推送 ${repo.pushed_at.slice(0, 10)}`
        : "GitHub 实时检索";

      out.push({
        id: `gh-${repo.id || repo.full_name}`,
        name: repo.full_name,
        sourceSite: "GitHub Repositories API",
        domain,
        slugHint: "github",
        url: safeUrl,
        category: "open_source",
        summary:
          repo.description ||
          `GitHub 公开开源代码仓库（主语言：${repo.language || "多语言"}）。`,
        isOfficial: true,
        versionOrUpdatedAt: `${updatedDate} · ★ ${stars.toLocaleString()}`,
        licenseOrPricing: licenseLabel,
        platforms: repo.language ? [repo.language, "Cross-Platform"] : ["Cross-Platform"],
        credibilityBasis: `通过 GitHub 官方公开 API 实时核验仓库地址（Stars: ${stars.toLocaleString()}），源码与提交历史公开可审计。`,
        cautionNotes:
          "下载预编译二进制文件时请仅从该仓库右侧官方 Releases 页面获取，并核查许可证条款与 SHA256 校验值。",
        provenance: "web_verified",
        liveVerified: true,
        tags: (repo.topics || []).slice(0, 4),
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function probeSteamStoreSearch(
  keyword: string,
  httpsGet: HttpsGetFn
): Promise<DiscoveredResourceItem[]> {
  try {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
      keyword
    )}&l=schinese&cc=US`;
    const resp = await httpsGet(url, {
      headers: { "User-Agent": DISCOVER_USER_AGENT },
      timeoutMs: DISCOVER_HTTP_TIMEOUT_MS,
    });
    if (resp.status !== 200) return [];
    const data = JSON.parse(resp.body) as {
      items?: Array<{
        id?: number;
        name?: string;
        price?: { final?: number; currency?: string } | null;
        platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
      }>;
    };
    const out: DiscoveredResourceItem[] = [];
    for (const app of (data.items || []).slice(0, 3)) {
      if (!app.id || !app.name) continue;
      const appUrl = `https://store.steampowered.com/app/${app.id}/`;
      const { safeUrl, domain } = isVerifiedOfficialUrl(appUrl);
      const platforms: string[] = [];
      if (app.platforms?.windows) platforms.push("Windows");
      if (app.platforms?.mac) platforms.push("macOS");
      if (app.platforms?.linux) platforms.push("Linux");

      const priceText = app.price?.final
        ? `Steam 官方正版 (${(app.price.final / 100).toFixed(2)} ${app.price.currency || "USD"})`
        : "Steam 正版商店上架（免费游玩或见商店页定价）";

      out.push({
        id: `steam-app-${app.id}`,
        name: `${app.name} (Steam 正版商店)`,
        sourceSite: "Steam Store API",
        domain,
        slugHint: "steam",
        url: safeUrl,
        category: "game",
        summary: `Steam 官方数字发行商店直达条目（AppID: ${app.id}），提供正版购买、补丁更新与社区支持。`,
        isOfficial: true,
        versionOrUpdatedAt: `Steam AppID ${app.id} · 实时在售核验`,
        licenseOrPricing: priceText,
        platforms: platforms.length > 0 ? platforms : ["Windows"],
        credibilityBasis:
          "由 Valve 官方 store.steampowered.com 商店检索接口实时返回的正版 AppID 页面。",
        cautionNotes: "请在登录官方 Steam 客户端或确认浏览器 HTTPS 证书归属 Valve 后完成购买。",
        provenance: "web_verified",
        liveVerified: true,
        tags: ["Steam官方", `AppID:${app.id}`, "正版数字版"],
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function probeNpmPackages(
  keyword: string,
  httpsGet: HttpsGetFn
): Promise<DiscoveredResourceItem[]> {
  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(
      keyword
    )}&size=3`;
    const resp = await httpsGet(url, {
      headers: { "User-Agent": DISCOVER_USER_AGENT },
      timeoutMs: DISCOVER_HTTP_TIMEOUT_MS,
    });
    if (resp.status !== 200) return [];
    const data = JSON.parse(resp.body) as {
      objects?: Array<{
        package?: {
          name?: string;
          version?: string;
          description?: string;
          date?: string;
          links?: { npm?: string; homepage?: string; repository?: string };
          keywords?: string[];
        };
      }>;
    };
    const out: DiscoveredResourceItem[] = [];
    for (const obj of data.objects || []) {
      const pkg = obj.package;
      if (!pkg?.name) continue;
      const rawLink =
        pkg.links?.npm || `https://www.npmjs.com/package/${encodeURIComponent(pkg.name)}`;
      const { safeUrl, domain } = isVerifiedOfficialUrl(rawLink);
      out.push({
        id: `npm-${pkg.name}`,
        name: `${pkg.name} (npm Package)`,
        sourceSite: "npm Official Registry",
        domain,
        slugHint: "npm",
        url: safeUrl,
        category: "dev_tool",
        summary: pkg.description || `npm 官方仓库公开软件包 ${pkg.name}。`,
        isOfficial: true,
        versionOrUpdatedAt: `v${pkg.version || "latest"}${
          pkg.date ? ` · 发布于 ${pkg.date.slice(0, 10)}` : ""
        }`,
        licenseOrPricing: "开源软件包（详见包主页 SPDX 许可声明）",
        platforms: ["Node.js", "TypeScript / JavaScript"],
        credibilityBasis:
          "通过 registry.npmjs.org 官方注册表接口核验包名与最新版本号。",
        cautionNotes:
          "安装前请核准包名拼写以防 Typosquatting 同名投毒，并在生产项目中锁定 pnpm-lock.yaml。",
        provenance: "web_verified",
        liveVerified: true,
        tags: (pkg.keywords || []).slice(0, 4),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function searchCuratedCatalog(
  rawQuery: string,
  expandedKeywords: string[],
  inferredIntent: ConcreteDiscoverCategory | "mixed"
): DiscoveredResourceItem[] {
  const fullLower = rawQuery.trim().toLowerCase();
  const scored: Array<{ score: number; item: DiscoveredResourceItem }> = [];

  for (const seed of CURATED_AUTHORITATIVE_RESOURCES) {
    let score = 0;
    const hay = [
      seed.name,
      seed.sourceSite,
      seed.domain,
      seed.summary,
      ...seed.keywords,
      ...seed.tags,
    ]
      .join(" ")
      .toLowerCase();

    if (seed.name.toLowerCase().includes(fullLower)) score += 90;
    if (seed.keywords.some((k) => fullLower.includes(k.toLowerCase()))) {
      score += 75;
    }
    for (const kw of expandedKeywords) {
      if (hay.includes(kw.toLowerCase())) {
        score += 32;
      }
    }
    if (inferredIntent !== "mixed" && seed.category === inferredIntent) {
      score += 18;
    }

    if (score > 0) {
      const { safeUrl, domain, isOfficialDomain } = isVerifiedOfficialUrl(
        seed.url
      );
      scored.push({
        score,
        item: {
          id: seed.id,
          name: seed.name,
          sourceSite: seed.sourceSite,
          domain,
          slugHint: seed.slugHint,
          url: safeUrl,
          category: seed.category,
          summary: seed.summary,
          isOfficial: seed.isOfficial && isOfficialDomain,
          versionOrUpdatedAt: seed.versionOrUpdatedAt,
          licenseOrPricing: seed.licenseOrPricing,
          platforms: seed.platforms,
          credibilityBasis: seed.credibilityBasis,
          cautionNotes: seed.cautionNotes,
          provenance: "web_verified",
          liveVerified: false,
          tags: seed.tags,
        },
      });
    }
  }

  // 若用户查询非常宽泛，按推定的意图分类回退精选官方入口，避免空白页
  if (scored.length === 0) {
    const fallbackSeeds = CURATED_AUTHORITATIVE_RESOURCES.filter((s) =>
      inferredIntent === "mixed" ? true : s.category === inferredIntent
    ).slice(0, 6);
    return fallbackSeeds.map((seed) => {
      const { safeUrl, domain, isOfficialDomain } = isVerifiedOfficialUrl(
        seed.url
      );
      return {
        id: seed.id,
        name: seed.name,
        sourceSite: seed.sourceSite,
        domain,
        slugHint: seed.slugHint,
        url: safeUrl,
        category: seed.category,
        summary: seed.summary,
        isOfficial: seed.isOfficial && isOfficialDomain,
        versionOrUpdatedAt: seed.versionOrUpdatedAt,
        licenseOrPricing: seed.licenseOrPricing,
        platforms: seed.platforms,
        credibilityBasis: seed.credibilityBasis,
        cautionNotes: seed.cautionNotes,
        provenance: "web_verified",
        liveVerified: false,
        tags: seed.tags,
      };
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10).map((s) => s.item);
}

function buildFollowUpSuggestions(
  intent: ConcreteDiscoverCategory | "mixed",
  rawQuery: string
): string[] {
  if (intent === "game") {
    return [
      `${rawQuery} 是否有 GOG DRM-Free 无加密离线版？`,
      "对比 Steam、Epic 与主机平台的正版跨端存档支持",
      "查询 SteamDB 历史价格与官方硬件配置要求",
    ];
  }
  if (intent === "open_source" || intent === "dev_tool") {
    return [
      `筛选仅保留 Apache-2.0 / MIT 宽松开源许可的 ${rawQuery} 方案`,
      "查看官方 GitHub Releases 签名校验与安装指南",
      "检索配套的官方权威 API 技术文档",
    ];
  }
  if (intent === "ai_model") {
    return [
      "对比 OpenAI、Gemini 与 Hugging Face 开源权重的接入方式",
      "检索支持本地私有化部署且提供 Safetensors 格式的开源模型",
      "查看官方 API 安全限流与密钥隔离最佳实践",
    ];
  }
  return [
    "仅筛选第一方官方源站点",
    "同时检索 GitHub 上的相关高星开源实现",
    "查看跨平台（Windows / Linux / Android）兼容性支持说明",
  ];
}

/**
 * 执行 AI 自主资源寻找代理全链路：
 * 合规预检 -> 意图拆解与关键词规划 -> 多源公开权威检索 -> 官方性与安全核验 -> 结构化推理汇总
 */
export async function runResourceDiscoveryAgent(
  input: DiscoverSearchRequest,
  options?: {
    env?: ServerAIEnvConfig;
    dnsLookup?: DnsLookupAllFn;
    httpsGet?: HttpsGetFn;
    httpsPost?: HttpsPostFn;
  }
): Promise<DiscoverSearchResponse> {
  const httpsGet = options?.httpsGet ?? upstreamTransport.httpsGet;
  const steps: DiscoverAgentStep[] = [];

  // Step 0: 合规边界门禁（包括多轮上下文与当前问题）
  const historyText = (input.conversationHistory || [])
    .filter((t) => t.role === "user")
    .map((t) => t.content)
    .join(" ");
  assertDiscoveryCompliance(`${input.query} ${historyText}`);

  // Step 1: 自主规划与意图拆解
  const t1 = Date.now();
  const inferredIntent = inferIntentCategory(
    `${input.query} ${historyText}`,
    input.category
  );
  const expandedKeywords = extractExpandedKeywords(input.query, historyText);
  const primarySearchTerm = expandedKeywords.slice(0, 3).join(" ") || input.query.trim();

  const intentLabelMap: Record<ConcreteDiscoverCategory | "mixed", string> = {
    game: "正版游戏商店与官方发行渠道检索",
    open_source: "开源代码仓库与官方 Release 发行包检索",
    dev_tool: "开发编译器、SDK 与工程工具链检索",
    docs: "标准组织与厂商第一方技术文档检索",
    ai_model: "大模型官方 API 平台与安全开源权重检索",
    mixed: "综合正版软件、开源工程与权威文档检索",
  };

  steps.push({
    id: "intent_plan",
    title: "需求拆解与检索规划",
    status: "completed",
    detail: `识别目标类型为「${intentLabelMap[inferredIntent]}」，扩展检索词：[${expandedKeywords.join(", ")}]`,
    durationMs: Math.max(1, Date.now() - t1),
  });

  // Step 2: 多源公开接口与权威知识库并行检索
  const t2 = Date.now();
  const probeTasks: Array<Promise<DiscoveredResourceItem[]>> = [];
  if (inferredIntent === "game" || inferredIntent === "mixed") {
    probeTasks.push(probeSteamStoreSearch(primarySearchTerm, httpsGet));
  }
  if (
    inferredIntent === "open_source" ||
    inferredIntent === "dev_tool" ||
    inferredIntent === "ai_model" ||
    inferredIntent === "mixed"
  ) {
    probeTasks.push(probeGitHubRepositories(primarySearchTerm, httpsGet));
  }
  if (inferredIntent === "dev_tool") {
    probeTasks.push(probeNpmPackages(primarySearchTerm, httpsGet));
  }

  const settledLive = await Promise.all(probeTasks);
  const liveItems = settledLive.flat();
  const curatedItems = searchCuratedCatalog(
    input.query,
    expandedKeywords,
    inferredIntent
  );

  steps.push({
    id: "multi_source_search",
    title: "多源公开权威检索",
    status: "completed",
    detail:
      liveItems.length > 0
        ? `实时公开接口命中 ${liveItems.length} 条，内置权威核验索引匹配 ${curatedItems.length} 条`
        : `已从内置权威官方核验库匹配 ${curatedItems.length} 条候选资源（外部公开 API 未返回新增条目或网络受限）`,
    durationMs: Math.max(1, Date.now() - t2),
  });

  // Step 3: 官方性核验、URL 安全过滤与去重
  const t3 = Date.now();
  const seenUrls = new Set<string>();
  const auditedItems: DiscoveredResourceItem[] = [];

  // 精选第一方官方主站优先，随后补充实时 API 检索结果
  for (const candidate of [...curatedItems, ...liveItems]) {
    try {
      const { safeUrl, domain, isOfficialDomain } = isVerifiedOfficialUrl(
        candidate.url
      );
      const dedupeKey = safeUrl.replace(/\/+$/, "").toLowerCase();
      if (seenUrls.has(dedupeKey)) continue;
      seenUrls.add(dedupeKey);

      const finalOfficial = candidate.isOfficial && isOfficialDomain;
      if (input.category !== "all" && candidate.category !== input.category) {
        continue;
      }
      if (input.officialOnly && !finalOfficial) {
        continue;
      }

      auditedItems.push({
        ...candidate,
        url: safeUrl,
        domain,
        isOfficial: finalOfficial,
      });
    } catch {
      // 自动剔除任何不合法或非公网 HTTP/HTTPS 链接
    }
  }

  const finalItems = auditedItems.slice(0, 12);
  const officialCount = finalItems.filter((i) => i.isOfficial).length;

  steps.push({
    id: "credibility_audit",
    title: "官方域名与安全可信度核验",
    status: "completed",
    detail: `完成 HTTPS/公网 URL 校验与去重，保留 ${finalItems.length} 条结构化结果（其中 ${officialCount} 条经核验归属官方/权威托管主域名）`,
    durationMs: Math.max(1, Date.now() - t3),
  });

  // Step 4: 统一大模型选型建议汇总（严格区分 web_verified 与 ai_inferred）
  const t4 = Date.now();
  const provider = input.provider ?? "openai";
  const targetModel =
    (input.model || "").trim() || defaultModelForProvider(provider);
  const hasExplicitCustomEndpoint =
    provider === "openai_compatible" || Boolean((input.baseUrl || "").trim());

  let aiSynthesis: DiscoverSearchResponse["aiSynthesis"];

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
      const resourceDigest = finalItems
        .slice(0, 6)
        .map(
          (item, idx) =>
            `${idx + 1}. ${item.name} [${item.isOfficial ? "官方源" : "权威社区"}] (${item.url}) — ${item.licenseOrPricing}`
        )
        .join("\n");

      const llm = await generateUnifiedAIText(
        {
          provider,
          model: targetModel,
          apiKey: input.apiKey,
          baseUrl: input.baseUrl,
          temperature: 0.25,
          maxTokens: 700,
          messages: [
            {
              role: "system",
              content:
                "你是 OmniKit AI 资源核验与技术选型顾问。请仅根据下方已核验的资源列表回答用户，给出简明扼要的选择建议、平台兼容性提示与安全校验提醒（150–320字）。严禁编造列表中不存在的下载网址，严禁提供任何盗版或绕过付费门禁建议。",
            },
            {
              role: "user",
              content: `用户需求：${input.query}\n已核验候选资源：\n${
                resourceDigest || "暂无匹配条目，请建议调整筛选条件。"
              }`,
            },
          ],
        },
        {
          env: options?.env,
          dnsLookup: options?.dnsLookup,
          httpsPost: options?.httpsPost,
        }
      );

      aiSynthesis = {
        provenance: "ai_inferred",
        available: true,
        provider: llm.provider,
        model: llm.model,
        keySource: llm.keySource,
        content: llm.content,
      };
      steps.push({
        id: "structured_synthesis",
        title: "AI 选型与安全对比汇总",
        status: "completed",
        detail: `已由 ${llm.provider} (${llm.model}) 基于已核验信源生成选型建议`,
        durationMs: Math.max(1, Date.now() - t4),
      });
    } catch (err) {
      if (
        err instanceof UnifiedAIError &&
        (err.code === "FORBIDDEN_OPERATION" || err.code === "VALIDATION_ERROR")
      ) {
        throw err;
      }
      const errReason = err instanceof Error ? err.message : "模型服务暂不可用";
      aiSynthesis = {
        provenance: "ai_inferred",
        available: false,
        provider,
        model: targetModel,
        content: `已为您定位到 ${finalItems.length} 个经过域名与协议安全核验的资源入口（其中官方源 ${officialCount} 个）。大模型在线综述暂未返回（${errReason}），请直接查阅下方结构化资源卡片的可信度依据与注意事项。`,
        fallbackReason: errReason,
      };
      steps.push({
        id: "structured_synthesis",
        title: "结构化核验结论汇总",
        status: "degraded",
        detail: `结构化资源卡片已就绪；大模型在线综述已优雅降级（${errReason}）`,
        durationMs: Math.max(1, Date.now() - t4),
      });
    }
  } else {
    aiSynthesis = {
      provenance: "ai_inferred",
      available: false,
      provider,
      model: targetModel,
      content: `已针对「${input.query}」完成自主检索与官方域名核验，共筛选出 ${finalItems.length} 条可验证结果（官方源 ${officialCount} 条）。优先建议选择带有「官方源」标识的第一方商店或原始开源仓库 Release 页面；如需开启大模型多方案对比综述，可在右上角「AI 模型与客户端配置」中填入 API Key（BYOK）。`,
      fallbackReason: "未配置 AI API Key（支持右上角 BYOK 开启深度选型综述）",
    };
    steps.push({
      id: "structured_synthesis",
      title: "结构化核验结论汇总",
      status: "completed",
      detail: "已输出完整可验证资源列表（未配置 AI 密钥，使用确定性核验摘要）",
      durationMs: Math.max(1, Date.now() - t4),
    });
  }

  return {
    query: input.query,
    intentCategory: inferredIntent === "mixed" ? "all" : inferredIntent,
    intentSummary: intentLabelMap[inferredIntent],
    expandedKeywords,
    steps,
    items: finalItems,
    aiSynthesis,
    followUpSuggestions: buildFollowUpSuggestions(inferredIntent, input.query),
    complianceNotice:
      "合规声明：本模块仅检索公开合法的正版商店、开源仓库与权威技术文档，绝不提供盗版、破解或绕过授权门禁的链接。",
    generatedAt: new Date().toISOString(),
  };
}
