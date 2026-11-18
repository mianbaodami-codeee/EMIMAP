import { isAdmin } from "@/lib/admin/session";
import React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Compass, Shield } from "lucide-react";
import { PLATFORM_MODULES, PROVENANCE_META, type ProvenanceKind } from "@omnikit/shared";
import { BUILTIN_SITE_SEEDS } from "@/lib/db/seed-sites";
import { ModuleIcon } from "@/components/ui/module-icon";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  resolveSiteBrandAppearance,
  BrandCardBackdrop,
  SiteBrandMark,
} from "@/components/ui/site-brand-mark";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const admin = await isAdmin();
  const builtinTotal = BUILTIN_SITE_SEEDS.length;
  const coreModules = PLATFORM_MODULES.filter((m) => m.id !== "overview");
  const featuredSites = BUILTIN_SITE_SEEDS.slice(0, 10);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 space-y-8">
      {admin && <Link href="/admin" className="text-sm underline">管理员面板</Link>}
      <section className="workbench-hero">
        <div className="hero-content">
          <h1>AI 驱动的跨平台工程与硬件工具中枢</h1>
          <p>在世界地图上探索地点，查找有出处的资源，收藏常用工具。</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/map" className="hero-primary"><Compass size={16} />探索全球地图</Link>
            <Link id="hero-open-hub" href="/hub" className="hero-secondary">网址导引 · {builtinTotal}<ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>
      {/* 十大核心权威站点速达矩阵 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">常用网站</h2>

          </div>
          <Link
            href="/hub"
            style={{ color: "var(--accent-primary)" }}
            className="text-xs font-medium inline-flex items-center gap-1 hover:underline shrink-0"
          >
            <span>查看全部</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {featuredSites.map((site) => {
            const brand = resolveSiteBrandAppearance({
              slug: site.slug,
              domain: site.url,
              name: site.name,
            });
            return (
              <a
                key={site.slug}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: "var(--bg-surface)" }}
                className="brand-card quick-brand group relative overflow-hidden rounded-xl border p-3 flex items-center justify-between gap-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[var(--border-strong)] hover:shadow-[0_10px_24px_-10px_rgba(15,23,42,0.14)] transition-[border-color,box-shadow] duration-200"
              >
                <BrandCardBackdrop brand={brand} />
                <div className="relative flex items-center gap-2.5 min-w-0">
                  <SiteBrandMark
                    slug={site.slug}
                    domain={site.url}
                    name={site.name}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate group-hover:text-[var(--accent-primary)] transition-colors">
                      {site.name}
                    </div>
                    <div
                      style={{ color: "var(--fg-muted)" }}
                      className="text-[11px] font-mono truncate"
                    >
                      {new URL(site.url).hostname.replace(/^www\./, "")}
                    </div>
                  </div>
                </div>
                <ArrowUpRight
                  style={{ color: "var(--fg-muted)" }}
                  className="relative h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </a>
            );
          })}
        </div>
      </section>

      {/* 七大核心功能模块全景矩阵 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">工具工作台</h2>

          </div>

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
                className="rounded-xl border p-4 flex flex-col justify-between gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[var(--border-strong)] hover:shadow-[0_10px_24px_-10px_rgba(15,23,42,0.12)] transition-[border-color,box-shadow]"
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
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
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
                      {isReady ? `Phase ${mod.phase} 已上线` : `Phase ${mod.phase} 规划`}
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
