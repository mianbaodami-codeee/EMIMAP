import React from "react";
import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { ArrowRight, ArrowUpRight, Compass, Database, Shield } from "lucide-react";
import { PLATFORM_MODULES, PROVENANCE_META, type ProvenanceKind } from "@omnikit/shared";
import { getReadyDb } from "@/lib/db/client";
import { siteBookmarks } from "@/lib/db/schema";
import { BUILTIN_SITE_SEEDS } from "@/lib/db/seed-sites";
import { getCacheStore } from "@/lib/cache/store";
import { ModuleIcon } from "@/components/ui/module-icon";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // 真实查询数据库与缓存状态，拒绝任何硬编码假遥测指标
  const t0 = Date.now();
  const { db, driver } = await getReadyDb();
  const [siteCountRow] = await db
    .select({ value: count() })
    .from(siteBookmarks)
    .where(eq(siteBookmarks.isBuiltin, true));
  const dbQueryMs = Math.max(1, Date.now() - t0);
  const builtinTotal = Number(siteCountRow?.value ?? 0);
  const cacheDriver = getCacheStore().driver;

  const coreModules = PLATFORM_MODULES.filter((m) => m.id !== "overview");
  const featuredSites = BUILTIN_SITE_SEEDS.slice(0, 10);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-8">
      {/* 顶部主标题与核心动作区 */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b">
        <div className="space-y-2.5 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            AI 驱动的跨平台工程与硬件工具中枢
          </h1>
          <p
            style={{ color: "var(--fg-secondary)" }}
            className="text-sm sm:text-base leading-relaxed"
          >
            面向开发者、硬件玩家与多设备用户的长期软件工程平台。整合全球空间地理分析、可溯源 AI 资源检索、Windows/Android 实测诊断、原生系统客户端「基米大师」与跨设备协同「玩机器」。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 text-xs">
          <Link
            id="hero-open-hub"
            href="/hub"
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--accent-foreground)",
            }}
            className="h-9 px-4 rounded-md font-medium inline-flex items-center gap-2 hover:opacity-95 transition-opacity"
          >
            <Compass className="h-4 w-4" />
            <span>进入常用网址导引 ({builtinTotal}+)</span>
          </Link>

          <a
            href="/api/health"
            target="_blank"
            rel="noopener noreferrer"
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="h-9 px-3.5 rounded-md border font-mono inline-flex items-center gap-1.5 hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <Database className="h-3.5 w-3.5" />
            <span>/api/health</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* 服务端实测系统底座遥测条 */}
      <section
        aria-label="系统基础设施实测状态"
        style={{ backgroundColor: "var(--bg-surface)" }}
        className="rounded-lg border grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x"
      >
        <div className="p-4 space-y-1">
          <div style={{ color: "var(--fg-muted)" }} className="text-xs">
            数据库引擎 (实测连通)
          </div>
          <div className="text-sm font-mono font-semibold tabular-nums">
            PostgreSQL ({driver}) · {dbQueryMs}ms
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div style={{ color: "var(--fg-muted)" }} className="text-xs">
            缓存与限流驱动
          </div>
          <div className="text-sm font-mono font-semibold">
            {cacheDriver === "redis" ? "Redis 7 Cluster" : "Memory TTL-LRU"}
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div style={{ color: "var(--fg-muted)" }} className="text-xs">
            权威导航种子库
          </div>
          <div className="text-sm font-mono font-semibold tabular-nums">
            {builtinTotal} 个已核验站点
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div style={{ color: "var(--fg-muted)" }} className="text-xs">
            统一大模型网关
          </div>
          <div className="text-sm font-mono font-semibold">
            OpenAI / Gemini (支持 BYOK)
          </div>
        </div>
      </section>

      {/* 十大核心权威站点速达矩阵 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">核心网站一键直达</h2>
            <p style={{ color: "var(--fg-muted)" }} className="text-xs">
              初始必选的 10 大游戏、开源、AI 与官方开发者入口，更多站点、分类搜索与自定义管理请前往导引中心
            </p>
          </div>
          <Link
            href="/hub"
            style={{ color: "var(--accent-primary)" }}
            className="text-xs font-medium inline-flex items-center gap-1 hover:underline shrink-0"
          >
            <span>全部导引与自定义收藏</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {featuredSites.map((site) => (
            <a
              key={site.slug}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: "var(--bg-surface)" }}
              className="group rounded-md border px-3 py-2.5 flex items-center justify-between gap-2 hover:border-[var(--border-strong)] transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate group-hover:underline">
                  {site.name}
                </div>
                <div
                  style={{ color: "var(--fg-muted)" }}
                  className="text-[11px] font-mono truncate"
                >
                  {new URL(site.url).hostname.replace(/^www\./, "")}
                </div>
              </div>
              <ArrowUpRight
                style={{ color: "var(--fg-muted)" }}
                className="h-3.5 w-3.5 shrink-0"
              />
            </a>
          ))}
        </div>
      </section>

      {/* 七大核心功能模块全景矩阵 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">七大核心工程板块矩阵</h2>
            <p style={{ color: "var(--fg-muted)" }} className="text-xs">
              按技术依赖分五阶段演进交付，清晰界定浏览器可执行范围与本地原生客户端权限边界
            </p>
          </div>
          <span
            style={{ color: "var(--fg-muted)" }}
            className="text-xs font-mono"
          >
            提示：将鼠标移至左侧窄导轨即可弹出完整导航菜单
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {coreModules.map((mod) => {
            const isReady = mod.status === "active";
            return (
              <Link
                key={mod.id}
                id={`module-card-${mod.id}`}
                href={mod.href}
                style={{ backgroundColor: "var(--bg-surface)" }}
                className="rounded-lg border p-4 flex flex-col justify-between gap-4 hover:border-[var(--border-strong)] transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        style={{
                          backgroundColor: isReady
                            ? "var(--accent-soft)"
                            : "var(--bg-subtle)",
                          color: isReady
                            ? "var(--accent-primary)"
                            : "var(--fg-secondary)",
                        }}
                        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                      >
                        <ModuleIcon name={mod.iconName} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold truncate">
                          {mod.name}
                        </h3>
                        <div
                          style={{ color: "var(--fg-muted)" }}
                          className="text-[11px] font-mono"
                        >
                          {mod.englishTag}
                        </div>
                      </div>
                    </div>

                    <span
                      style={
                        isReady
                          ? {
                              color: "var(--status-measured-fg)",
                              backgroundColor: "var(--status-measured-bg)",
                              borderColor: "var(--status-measured-border)",
                            }
                          : {
                              color: "var(--fg-muted)",
                              backgroundColor: "var(--bg-subtle)",
                              borderColor: "var(--border-subtle)",
                            }
                      }
                      className="px-2 py-0.5 rounded border text-[11px] font-mono shrink-0"
                    >
                      {isReady ? "Phase 1 已上线" : `Phase ${mod.phase} 规划`}
                    </span>
                  </div>

                  <p
                    style={{ color: "var(--fg-secondary)" }}
                    className="text-xs leading-relaxed"
                  >
                    {mod.summary}
                  </p>
                </div>

                <div className="pt-2.5 border-t flex items-center justify-between text-[11px]">
                  <span
                    style={{ color: "var(--fg-muted)" }}
                    className="font-mono"
                  >
                    {mod.executionBoundary}
                  </span>
                  <span
                    style={{ color: "var(--accent-primary)" }}
                    className="font-medium inline-flex items-center gap-1"
                  >
                    <span>{isReady ? "立即使用" : "查看架构蓝图"}</span>
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 全站四类数据可信度与执行域工程准则 */}
      <section
        style={{ backgroundColor: "var(--bg-surface)" }}
        className="rounded-lg border p-4 sm:p-5 space-y-3"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Shield
            style={{ color: "var(--accent-primary)" }}
            className="h-4 w-4"
          />
          <h2>全站数据真实性与能力边界准则</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {(
            ["measured", "web_verified", "ai_inferred", "native_only"] as ProvenanceKind[]
          ).map((kind) => (
            <div
              key={kind}
              style={{ backgroundColor: "var(--bg-canvas)" }}
              className="rounded-md border p-3 space-y-1.5"
            >
              <ProvenanceBadge kind={kind} />
              <p
                style={{ color: "var(--fg-secondary)" }}
                className="leading-relaxed pt-0.5"
              >
                {PROVENANCE_META[kind].description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
