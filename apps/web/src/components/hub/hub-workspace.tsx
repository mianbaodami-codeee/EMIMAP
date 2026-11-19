"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  Edit3,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  SITE_CATEGORIES,
  SITE_CATEGORY_LABELS,
  type HubListResponse,
  type HubSiteItem,
  type SiteCategory,
} from "@omnikit/shared";
import { CustomSiteModal } from "./custom-site-modal";
import {
  resolveSiteBrandAppearance,
  DirectoryBrandArt,
} from "@/components/ui/site-brand-mark";

export function HubWorkspace({
  initialData,
}: {
  initialData: HubListResponse;
}) {
  const [sites, setSites] = useState<HubSiteItem[]>(initialData.items);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SiteCategory | "all">(
    "all"
  );
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [officialOnly, setOfficialOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<HubSiteItem | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 计算实时统计与分类计数
  const stats = useMemo(() => {
    const countsByCat: Record<string, number> = { all: sites.length };
    for (const cat of SITE_CATEGORIES) {
      countsByCat[cat] = 0;
    }
    let favCount = 0;
    let customCount = 0;
    for (const s of sites) {
      countsByCat[s.category] = (countsByCat[s.category] || 0) + 1;
      if (s.isFavorite) favCount += 1;
      if (!s.isBuiltin) customCount += 1;
    }
    return { countsByCat, favCount, customCount, total: sites.length };
  }, [sites]);

  // 客户端即时过滤 + 收藏优先排序
  const filteredSites = useMemo(() => {
    const kw = searchQuery.trim().toLowerCase();
    return sites
      .filter((item) => {
        if (activeCategory !== "all" && item.category !== activeCategory) {
          return false;
        }
        if (favoritesOnly && !item.isFavorite) return false;
        if (officialOnly && !item.isOfficial) return false;
        if (kw) {
          const hay = [
            item.name,
            item.domain,
            item.description,
            ...item.tags,
          ]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? 1 : -1;
        return 0;
      });
  }, [sites, searchQuery, activeCategory, favoritesOnly, officialOnly]);

  const handleToggleFavorite = async (site: HubSiteItem) => {
    const nextFav = !site.isFavorite;
    // 乐观更新提升响应速度，失败则回滚
    setSites((prev) =>
      prev.map((x) => (x.id === site.id ? { ...x, isFavorite: nextFav } : x))
    );

    try {
      const res = await fetch(`/api/hub/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: nextFav }),
      });
      const payload = await res.json();
      if (!payload.ok) {
        throw new Error(payload.error?.message);
      }
    } catch {
      setSites((prev) =>
        prev.map((x) => (x.id === site.id ? { ...x, isFavorite: !nextFav } : x))
      );
    }
  };

  const handleDeleteCustomSite = async (site: HubSiteItem) => {
    if (site.isBuiltin) return;
    const res = await fetch(`/api/hub/sites/${site.id}`, { method: "DELETE" });
    const payload = await res.json();
    if (payload.ok) {
      setSites((prev) => prev.filter((x) => x.id !== site.id));
      setBannerNotice(`已移除自定义网址「${site.name}」`);
    }
  };

  const handleSavedSite = (saved: HubSiteItem, isEdit: boolean) => {
    setSites((prev) => {
      if (isEdit) {
        return prev.map((x) => (x.id === saved.id ? saved : x));
      }
      return [saved, ...prev];
    });
    setBannerNotice(
      isEdit
        ? `已更新自定义网址「${saved.name}」`
        : `已成功添加自定义网址「${saved.name}」`
    );
  };

  const handleExportJson = async () => {
    const res = await fetch("/api/hub/export");
    const payload = await res.json();
    if (!payload.ok) return;
    const blob = new Blob([JSON.stringify(payload.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omnikit-custom-sites-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed?.sites;
      if (!Array.isArray(list) || list.length === 0) {
        setBannerNotice("导入文件格式不合法或列表为空");
        return;
      }

      const res = await fetch("/api/hub/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sites: list }),
      });
      const payload = await res.json();
      if (!payload.ok) {
        setBannerNotice(payload.error?.message || "导入校验未通过");
        return;
      }

      // 重新拉取合并后的最新列表
      const latestRes = await fetch("/api/hub/sites");
      const latestJson = await latestRes.json();
      if (latestJson.ok) {
        setSites(latestJson.data.items);
      }
      setBannerNotice(
        `书签导入完成：新增 ${payload.data.importedCount} 条，跳过重复 ${payload.data.skippedCount} 条`
      );
    } catch {
      setBannerNotice("解析 JSON 书签文件失败，请确认文件编码格式");
    }
  };

  return (
    <div className="workspace-frame space-y-5">
      {/* 页面主标题与操作栏 */}
      <div className="directory-heading flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="workspace-title">
            常用网址导引
          </h1>
          <p className="workspace-description">
            按分类浏览游戏、开发和 AI 网站，或搜索名称、域名与标签。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            id="hub-import-btn"
            onClick={() => fileInputRef.current?.click()}
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="h-8 px-3 rounded-md border inline-flex items-center gap-1.5 hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>导入 JSON</span>
          </button>

          <button
            type="button"
            id="hub-export-btn"
            onClick={handleExportJson}
            style={{ backgroundColor: "var(--bg-surface)" }}
            className="h-8 px-3 rounded-md border inline-flex items-center gap-1.5 hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>导出自定义 ({stats.customCount})</span>
          </button>

          <button
            type="button"
            id="hub-add-site-btn"
            onClick={() => {
              setEditingSite(null);
              setModalOpen(true);
            }}
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--accent-foreground)",
            }}
            className="h-8 px-3.5 rounded-md font-medium inline-flex items-center gap-1.5 transition-opacity hover:opacity-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>添加自定义网址</span>
          </button>
        </div>
      </div>

      {bannerNotice && (
        <div
          id="hub-banner-notice"
          style={{
            backgroundColor: "var(--status-measured-bg)",
            borderColor: "var(--status-measured-border)",
            color: "var(--status-measured-fg)",
          }}
          className="px-3.5 py-2 rounded-md border text-xs flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{bannerNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => setBannerNotice(null)}
            className="underline opacity-80 hover:opacity-100"
          >
            知道了
          </button>
        </div>
      )}

      {/* 搜索框与精细筛选矩阵 */}
      <div
        style={{ backgroundColor: "var(--bg-surface)" }}
        className="p-3.5 rounded-lg border space-y-3"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search
              style={{ color: "var(--fg-muted)" }}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            />
            <input
              id="hub-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="搜索网站"
              placeholder="搜索网站、域名或标签"
              style={{ backgroundColor: "var(--bg-canvas)" }}
              className="h-11 w-full rounded-xl border pl-9 pr-3 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs">
            <button
              type="button"
              id="hub-filter-favorites"
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((v) => !v)}
              style={{
                backgroundColor: favoritesOnly
                  ? "var(--accent-soft)"
                  : "var(--bg-canvas)",
                borderColor: favoritesOnly
                  ? "var(--accent-primary)"
                  : "var(--border-subtle)",
                color: favoritesOnly
                  ? "var(--accent-primary)"
                  : "var(--fg-secondary)",
              }}
              className="h-9 px-3 rounded-md border inline-flex items-center gap-1.5 font-medium transition-colors"
            >
              <Star className="h-3.5 w-3.5" />
              <span className="tabular-nums">收藏 ({stats.favCount})</span>
            </button>

            <button
              type="button"
              id="hub-filter-official"
              aria-pressed={officialOnly}
              onClick={() => setOfficialOnly((v) => !v)}
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
              className="h-9 px-3 rounded-md border inline-flex items-center gap-1.5 font-medium transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>仅官方源</span>
            </button>
          </div>
        </div>

        {/* 分类胶囊标签 */}
        <div
          role="tablist"
          aria-label="网址分类筛选"
          className="flex flex-wrap items-center gap-1.5 pt-1"
        >
          {(["all", ...SITE_CATEGORIES] as const).map((cat) => {
            const active = activeCategory === cat;
            const label =
              cat === "all" ? "全部站点" : SITE_CATEGORY_LABELS[cat];
            const countVal = stats.countsByCat[cat] ?? 0;

            return (
              <button
                key={cat}
                id={`hub-cat-${cat}`}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setActiveCategory(cat)}
                style={{
                  backgroundColor: active
                    ? "var(--accent-primary)"
                    : "var(--bg-subtle)",
                  color: active
                    ? "var(--accent-foreground)"
                    : "var(--fg-secondary)",
                  borderColor: active ? "transparent" : "var(--border-subtle)",
                }}
                className="px-2.5 py-1 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <span>{label}</span>
                <span className="font-mono text-[11px] tabular-nums opacity-85">
                  {countVal}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 结果统计行 */}
      <div
        style={{ color: "var(--fg-muted)" }}
        className="flex items-center justify-between text-xs px-0.5"
      >
        <span className="tabular-nums">
          当前匹配显示 <strong style={{ color: "var(--fg-primary)" }}>{filteredSites.length}</strong> /{" "}
          {stats.total} 个站点（收藏项自动排在首位）
        </span>
        {(searchQuery || activeCategory !== "all" || favoritesOnly || officialOnly) && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setActiveCategory("all");
              setFavoritesOnly(false);
              setOfficialOnly(false);
            }}
            style={{ color: "var(--accent-primary)" }}
            className="font-medium hover:underline"
          >
            重置全部筛选条件
          </button>
        )}
      </div>

      {/* 站点高密度网格 */}
      {filteredSites.length === 0 ? (
        <div
          style={{ backgroundColor: "var(--bg-surface)" }}
          className="rounded-lg border py-14 px-4 text-center space-y-2"
        >
          <p className="text-sm font-medium">没有找到符合当前筛选条件的网址</p>
          <p style={{ color: "var(--fg-muted)" }} className="text-xs">
            您可以尝试放宽分类/搜索词，或点击右上角「添加自定义网址」收录常用链接。
          </p>
        </div>
      ) : (
        <div
          id="hub-sites-grid"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5"
        >
          {filteredSites.map((site) => {
            const brand = resolveSiteBrandAppearance({
              slug: site.slug,
              domain: site.domain,
              name: site.name,
            });
            return (
              <article
                key={site.id}
                data-site-slug={site.slug}
                className="directory-card directory-site"
                style={{ "--directory-accent": brand.accentHex } as React.CSSProperties}
              >
                <DirectoryBrandArt brand={brand} />
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="directory-category">
                      {SITE_CATEGORY_LABELS[site.category]}
                    </span>
                    {site.isOfficial ? (
                      <span className="directory-verified" title={site.verifiedNote || "经核实的官方主站"}>
                        <ShieldCheck className="size-3.5" aria-hidden="true" /> 官方
                      </span>
                    ) : !site.isBuiltin && (
                      <span className="text-xs text-[var(--fg-muted)]">自定义</span>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => void handleToggleFavorite(site)}
                      aria-label={`${site.isFavorite ? "取消收藏" : "收藏"} ${site.name}`}
                      aria-pressed={site.isFavorite}
                      title={site.isFavorite ? "取消收藏" : "加入收藏置顶"}
                      className="directory-icon-button"
                    >
                      <Star className="size-4" fill={site.isFavorite ? "currentColor" : "none"} />
                    </button>

                    {!site.isBuiltin && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSite(site);
                            setModalOpen(true);
                          }}
                          aria-label={`编辑 ${site.name}`}
                          className="directory-icon-button"
                        >
                          <Edit3 className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCustomSite(site)}
                          aria-label={`删除 ${site.name}`}
                          className="directory-icon-button hover:!text-[var(--danger-fg)]"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="directory-site-copy">
                  <h2 className="directory-site-name">
                    <a href={site.url} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">
                      {site.name}
                    </a>
                  </h2>
                  <p className="mt-0.5 break-all text-xs text-[var(--fg-muted)]">{site.domain}</p>
                  <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-[var(--fg-secondary)]">
                    {site.description}
                  </p>
                </div>

                <div className="directory-site-footer">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--fg-muted)]">
                    {site.tags.slice(0, 2).map((tag) => <span key={tag} className="truncate">#{tag}</span>)}
                  </div>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`访问 ${site.name}`}
                    className="directory-visit"
                  >
                    访问 <ArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CustomSiteModal
        open={modalOpen}
        editingSite={editingSite}
        onClose={() => setModalOpen(false)}
        onSaved={handleSavedSite}
      />
    </div>
  );
}
