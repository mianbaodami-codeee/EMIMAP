"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  FileJson,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  DISCOVER_CATEGORIES,
  DISCOVER_CATEGORY_LABELS,
  resolveClientAIRequestParams,
  type DiscoverCategory,
  type DiscoverSearchResponse,
  type DiscoverTurn,
} from "@omnikit/shared";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  resolveSiteBrandAppearance,
  SiteBrandMark,
} from "@/components/ui/site-brand-mark";
import { useAppUI } from "@/components/providers/app-providers";

const QUICK_DISCOVER_PROMPTS = [
  {
    label: "Cyberpunk 2077 正版与无加密渠道",
    query: "Cyberpunk 2077 官方正版购买渠道与 DRM-Free 离线安装包",
    category: "game" as DiscoverCategory,
  },
  {
    label: "Android 免 Root 开源投屏 scrcpy",
    query: "免 Root 高帧率 Android 屏幕投屏控制开源工具 scrcpy",
    category: "open_source" as DiscoverCategory,
  },
  {
    label: "Rust 跨平台客户端框架 Tauri",
    query: "Rust 轻量跨平台桌面应用框架 Tauri v2 与官方文档",
    category: "all" as DiscoverCategory,
  },
  {
    label: "开源大模型权重与安全格式",
    query: "Hugging Face 开源大模型权重下载与 OpenAI / Gemini 官方 API",
    category: "ai_model" as DiscoverCategory,
  },
];

export function DiscoverWorkspace({
  initialResult,
}: {
  initialResult: DiscoverSearchResponse;
}) {
  const { aiSettings, setAiDrawerOpen } = useAppUI();

  const [query, setQuery] = useState("Cyberpunk 2077 官方正版购买渠道");
  const [category, setCategory] = useState<DiscoverCategory>("all");
  const [officialOnly, setOfficialOnly] = useState(false);
  const [turns, setTurns] = useState<DiscoverTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscoverSearchResponse>(initialResult);
  const [complianceError, setComplianceError] = useState<string | null>(null);

  const executeDiscovery = async (opts?: {
    overrideQuery?: string;
    overrideCategory?: DiscoverCategory;
    overrideOfficialOnly?: boolean;
    resetTurns?: boolean;
  }) => {
    const q = (opts?.overrideQuery ?? query).trim();
    if (q.length < 2) return;
    const cat = opts?.overrideCategory ?? category;
    const offOnly = opts?.overrideOfficialOnly ?? officialOnly;
    const historyToSend = opts?.resetTurns ? [] : turns;

    setLoading(true);
    setComplianceError(null);

    try {
      const aiReq = resolveClientAIRequestParams(aiSettings);
      const res = await fetch("/api/discover/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          category: cat,
          officialOnly: offOnly,
          conversationHistory: historyToSend,
          ...aiReq,
        }),
      });
      const payload = await res.json();
      if (!payload.ok) {
        setComplianceError(
          payload.error?.message || "资源检索请求未通过校验"
        );
        return;
      }

      const data = payload.data as DiscoverSearchResponse;
      setResult(data);
      setTurns((prev) => {
        const base = opts?.resetTurns ? [] : prev;
        return [
          ...base,
          { role: "user" as const, content: q },
          {
            role: "assistant" as const,
            content: `命中 ${data.items.length} 条核验资源（${data.intentSummary}）`,
          },
        ].slice(-8);
      });
    } catch {
      setComplianceError("网络请求异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void executeDiscovery();
  };

  const triggerDownload = (filename: string, mime: string, content: string) => {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleExportJson = () => {
    triggerDownload(
      `omnikit-discover-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json",
      JSON.stringify(result, null, 2)
    );
  };

  const handleExportMarkdown = () => {
    const lines = [
      `# OmniKit AI 资源检索与可信度核验清单`,
      "",
      `- **检索需求**：${result.query}`,
      `- **识别类型**：${result.intentSummary}`,
      `- **生成时间**：${result.generatedAt}`,
      "",
      `## AI 选型综述`,
      result.aiSynthesis.content,
      "",
      `## 已核验资源列表 (${result.items.length})`,
      "",
      ...result.items.flatMap((item, idx) => [
        `### ${idx + 1}. ${item.name} ${item.isOfficial ? "[官方源]" : "[权威社区]"}`,
        `- **原始链接**：${item.url}`,
        `- **来源站点**：${item.sourceSite} (\`${item.domain}\`)`,
        `- **版本 / 更新时间**：${item.versionOrUpdatedAt}`,
        `- **授权 / 定价**：${item.licenseOrPricing}`,
        `- **可信度依据**：${item.credibilityBasis}`,
        `- **注意事项**：${item.cautionNotes}`,
        "",
      ]),
    ];
    triggerDownload(
      `omnikit-discover-${new Date().toISOString().slice(0, 10)}.md`,
      "text/markdown;charset=utf-8",
      lines.join("\n")
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* 页面主标题与操作栏 */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              AI 自主资源寻找代理
            </h1>
            <span
              style={{
                color: "var(--status-measured-fg)",
                backgroundColor: "var(--status-measured-bg)",
                borderColor: "var(--status-measured-border)",
              }}
              className="px-2 py-0.5 rounded border text-[11px] font-mono"
            >
              Phase 2 · Verified Agent
            </span>
          </div>
          <p
            style={{ color: "var(--fg-secondary)" }}
            className="text-xs sm:text-sm max-w-3xl"
          >
            自主拆解检索需求、并发查询公开权威接口与核验索引，为您定位正版游戏发行商店、开源代码仓库、开发工具链与第一方官方文档，并逐项附带官方性依据与安全注意事项。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
          <button
            type="button"
            id="discover-export-md-btn"
            onClick={handleExportMarkdown}
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="h-8 px-3 rounded-md border inline-flex items-center gap-1.5 hover:bg-[var(--bg-subtle)]"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>导出 Markdown</span>
          </button>
          <button
            type="button"
            id="discover-export-json-btn"
            onClick={handleExportJson}
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="h-8 px-3 rounded-md border inline-flex items-center gap-1.5 hover:bg-[var(--bg-subtle)]"
          >
            <FileJson className="h-3.5 w-3.5" />
            <span>导出 JSON</span>
          </button>
          <button
            type="button"
            onClick={() => setAiDrawerOpen(true)}
            style={{
              backgroundColor: "var(--accent-soft)",
              color: "var(--accent-primary)",
            }}
            className="h-8 px-3 rounded-md font-medium inline-flex items-center gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>
              模型：{aiSettings.activeProvider === "gemini" ? "Gemini" : "OpenAI"}
            </span>
          </button>
        </div>
      </div>

      {/* 检索输入、分类过滤与多轮对话状态 */}
      <section
        style={{ backgroundColor: "var(--bg-surface)" }}
        className="rounded-xl border p-4 space-y-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <Search
              style={{ color: "var(--fg-muted)" }}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            />
            <input
              id="discover-query-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入想寻找的正版游戏、开源仓库、开发工具或权威技术文档（支持多轮追问）..."
              style={{ backgroundColor: "var(--bg-canvas)" }}
              className="w-full h-10 pl-10 pr-3 rounded-lg border text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs">
            <button
              type="button"
              id="discover-official-toggle"
              onClick={() => {
                const next = !officialOnly;
                setOfficialOnly(next);
                void executeDiscovery({ overrideOfficialOnly: next });
              }}
              style={{
                backgroundColor: officialOnly
                  ? "var(--status-measured-bg)"
                  : "var(--bg-canvas)",
                borderColor: officialOnly
                  ? "var(--status-measured-border)"
                  : "var(--border-subtle)",
                color: officialOnly
                  ? "var(--status-measured-fg)"
                  : "var(--fg-secondary)",
              }}
              className="h-10 px-3 rounded-lg border font-medium inline-flex items-center gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>仅看官方源</span>
            </button>

            <button
              id="discover-submit-btn"
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "var(--accent-foreground)",
              }}
              className="h-10 px-4 rounded-lg font-medium inline-flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span>执行自主检索</span>
            </button>
          </div>
        </form>

        {/* 来源分类胶囊 */}
        <div
          role="tablist"
          aria-label="资源来源类型筛选"
          className="flex flex-wrap items-center gap-1.5"
        >
          {DISCOVER_CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                id={`discover-cat-${cat}`}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => {
                  setCategory(cat);
                  void executeDiscovery({ overrideCategory: cat });
                }}
                style={{
                  backgroundColor: active
                    ? "var(--accent-primary)"
                    : "var(--bg-subtle)",
                  color: active
                    ? "var(--accent-foreground)"
                    : "var(--fg-secondary)",
                }}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
              >
                {DISCOVER_CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>

        {/* 预设场景与多轮历史控制 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span style={{ color: "var(--fg-muted)" }}>典型检索示例：</span>
            {QUICK_DISCOVER_PROMPTS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setQuery(preset.query);
                  setCategory(preset.category);
                  void executeDiscovery({
                    overrideQuery: preset.query,
                    overrideCategory: preset.category,
                    resetTurns: true,
                  });
                }}
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="px-2.5 py-1 rounded border hover:border-[var(--accent-primary)] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => setTurns([])}
              style={{ color: "var(--fg-muted)" }}
              className="inline-flex items-center gap-1 hover:text-[var(--fg-primary)]"
            >
              <RotateCcw className="h-3 w-3" />
              <span>清空多轮上下文 ({Math.floor(turns.length / 2)} 轮)</span>
            </button>
          )}
        </div>
      </section>

      {/* 合规与安全拦截告警 */}
      {complianceError && (
        <div
          id="discover-compliance-alert"
          role="alert"
          style={{
            backgroundColor: "var(--danger-bg)",
            borderColor: "var(--danger-border)",
            color: "var(--danger-fg)",
          }}
          className="rounded-xl border p-4 flex items-start gap-3 text-xs leading-relaxed"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="font-semibold text-sm">请求已被合规与安全策略拦截</div>
            <p>{complianceError}</p>
          </div>
        </div>
      )}

      {/* Agent 四步自主规划与核验执行轨迹 */}
      <section
        id="discover-agent-steps"
        aria-label="代理自主检索轨迹"
        style={{ backgroundColor: "var(--bg-surface)" }}
        className="rounded-xl border p-4 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-semibold flex items-center gap-2">
            <CheckCircle2
              style={{ color: "var(--status-measured-fg)" }}
              className="h-4 w-4"
            />
            <span>自主检索与核验执行链路：{result.intentSummary}</span>
          </div>
          <span style={{ color: "var(--fg-muted)" }} className="font-mono">
            关键词扩展：{result.expandedKeywords.join(" / ")}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {result.steps.map((step, idx) => (
            <div
              key={step.id}
              style={{ backgroundColor: "var(--bg-canvas)" }}
              className="rounded-lg border p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {idx + 1}. {step.title}
                </span>
                <span
                  style={{ color: "var(--fg-muted)" }}
                  className="font-mono text-[11px] tabular-nums inline-flex items-center gap-0.5"
                >
                  <Clock className="h-3 w-3" />
                  {step.durationMs}ms
                </span>
              </div>
              <p
                style={{ color: "var(--fg-secondary)" }}
                className="text-[11px] leading-relaxed"
              >
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* AI 选型综述卡片（与下方核验资源卡片严格隔离） */}
      <section
        id="discover-ai-synthesis"
        style={{ backgroundColor: "var(--bg-surface)" }}
        className="rounded-xl border p-4 space-y-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ProvenanceBadge kind="ai_inferred" />
            <span className="text-xs font-semibold">
              选型建议与安全校验综述
            </span>
          </div>
          <span
            style={{ color: "var(--fg-muted)" }}
            className="text-[11px] font-mono"
          >
            {result.aiSynthesis.available
              ? `${result.aiSynthesis.provider} · ${result.aiSynthesis.model}`
              : "确定性核验摘要（可配 BYOK 开启深度推理）"}
          </span>
        </div>

        <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">
          {result.aiSynthesis.content}
        </p>

        {/* 多轮追问快捷建议 */}
        <div className="pt-2 border-t flex flex-wrap items-center gap-1.5 text-xs">
          <span style={{ color: "var(--fg-muted)" }}>继续追问：</span>
          {result.followUpSuggestions.map((sug, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQuery(sug);
                void executeDiscovery({ overrideQuery: sug });
              }}
              style={{
                backgroundColor: "var(--bg-subtle)",
                color: "var(--accent-primary)",
              }}
              className="px-2.5 py-1 rounded-md font-medium hover:underline text-left"
            >
              {sug}
            </button>
          ))}
        </div>
      </section>

      {/* 结构化已核验资源卡片网格 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs px-0.5">
          <div className="flex items-center gap-2">
            <ProvenanceBadge kind="web_verified" />
            <span style={{ color: "var(--fg-secondary)" }}>
              共核验输出 <strong>{result.items.length}</strong> 条结构化公开资源
            </span>
          </div>
          <span style={{ color: "var(--fg-muted)" }} className="hidden sm:inline">
            {result.complianceNotice}
          </span>
        </div>

        {result.items.length === 0 ? (
          <div
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="rounded-xl border py-12 px-4 text-center space-y-2"
          >
            <p className="text-sm font-medium">当前筛选条件下暂无匹配资源</p>
            <p style={{ color: "var(--fg-muted)" }} className="text-xs">
              请尝试切换回「全部资源类型」或关闭「仅看官方源」筛选。
            </p>
          </div>
        ) : (
          <div
            id="discover-results-grid"
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {result.items.map((item) => {
              const brand = resolveSiteBrandAppearance({
                slug: item.slugHint,
                domain: item.domain,
                name: item.sourceSite,
              });
              return (
                <article
                  key={item.id}
                  data-resource-domain={item.domain}
                  style={{ backgroundColor: "var(--bg-surface)" }}
                  className="group relative overflow-hidden rounded-xl border p-4 flex flex-col justify-between gap-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[var(--border-strong)] hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.14)] transition-[border-color,box-shadow]"
                >
                  <span
                    aria-hidden="true"
                    style={{
                      background: `radial-gradient(170px circle at 24px 24px, ${brand.accentHex}16, transparent 74%)`,
                    }}
                    className="pointer-events-none absolute inset-0 opacity-75 group-hover:opacity-100 transition-opacity"
                  />

                  <div className="relative space-y-3">
                    {/* 首行：品牌渐变方块 + 资源标题 + 官方标识 */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`访问 ${item.name}`}
                          className="shrink-0"
                        >
                          <SiteBrandMark
                            slug={item.slugHint}
                            domain={item.domain}
                            name={item.sourceSite}
                            size="lg"
                          />
                        </a>
                        <div className="min-w-0 space-y-0.5">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold block truncate group-hover:text-[var(--accent-primary)] hover:underline"
                          >
                            {item.name}
                          </a>
                          <div
                            style={{ color: "var(--fg-muted)" }}
                            className="text-[11px] font-mono truncate"
                          >
                            {item.sourceSite} · {item.domain}
                          </div>
                        </div>
                      </div>

                      <span
                        style={
                          item.isOfficial
                            ? {
                                color: "var(--status-measured-fg)",
                                backgroundColor: "var(--status-measured-bg)",
                                borderColor: "var(--status-measured-border)",
                              }
                            : {
                                color: "var(--status-verified-fg)",
                                backgroundColor: "var(--status-verified-bg)",
                                borderColor: "var(--status-verified-border)",
                              }
                        }
                        className="px-2 py-0.5 rounded border text-[11px] font-medium shrink-0"
                      >
                        {item.isOfficial ? "官方源" : "权威社区"}
                      </span>
                    </div>

                    <p
                      style={{ color: "var(--fg-secondary)" }}
                      className="text-xs leading-relaxed"
                    >
                      {item.summary}
                    </p>

                    {/* 结构化版本、授权与支持平台 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div
                        style={{ backgroundColor: "var(--bg-canvas)" }}
                        className="p-2 rounded-lg border"
                      >
                        <div
                          style={{ color: "var(--fg-muted)" }}
                          className="text-[11px]"
                        >
                          版本 / 更新时间
                        </div>
                        <div className="font-mono font-medium mt-0.5 truncate">
                          {item.versionOrUpdatedAt}
                        </div>
                      </div>
                      <div
                        style={{ backgroundColor: "var(--bg-canvas)" }}
                        className="p-2 rounded-lg border"
                      >
                        <div
                          style={{ color: "var(--fg-muted)" }}
                          className="text-[11px]"
                        >
                          授权与定价模式
                        </div>
                        <div className="font-medium mt-0.5 truncate">
                          {item.licenseOrPricing}
                        </div>
                      </div>
                    </div>

                    {/* 可验证的可信度依据与注意事项 */}
                    <div
                      style={{ backgroundColor: "var(--bg-canvas)" }}
                      className="rounded-lg border p-2.5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-start gap-1.5">
                        <ShieldCheck
                          style={{ color: "var(--status-measured-fg)" }}
                          className="h-3.5 w-3.5 shrink-0 mt-0.5"
                        />
                        <span>
                          <strong>可信度核验依据：</strong>
                          {item.credibilityBasis}
                        </span>
                      </div>
                      <div
                        style={{ color: "var(--fg-secondary)" }}
                        className="flex items-start gap-1.5"
                      >
                        <AlertTriangle
                          style={{ color: "var(--status-verified-fg)" }}
                          className="h-3.5 w-3.5 shrink-0 mt-0.5"
                        />
                        <span>
                          <strong>注意事项：</strong>
                          {item.cautionNotes}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 底栏平台标签与原始跳转链接 */}
                  <div className="relative pt-2.5 border-t flex items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1 overflow-hidden">
                      <span
                        style={{
                          backgroundColor: "var(--bg-subtle)",
                          color: "var(--fg-secondary)",
                        }}
                        className="px-1.5 py-0.5 rounded text-[11px]"
                      >
                        {DISCOVER_CATEGORY_LABELS[item.category]}
                      </span>
                      {item.platforms.slice(0, 3).map((pf) => (
                        <span
                          key={pf}
                          style={{ color: "var(--fg-muted)" }}
                          className="font-mono text-[11px]"
                        >
                          · {pf}
                        </span>
                      ))}
                    </div>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent-primary)" }}
                      className="font-medium inline-flex items-center gap-1 shrink-0 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>打开原始链接</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
