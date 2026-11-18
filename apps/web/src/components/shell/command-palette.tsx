"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import { PLATFORM_MODULES } from "@omnikit/shared";
import { BUILTIN_SITE_SEEDS } from "@/lib/db/seed-sites";
import { ModuleIcon } from "@/components/ui/module-icon";
import { SiteBrandMark } from "@/components/ui/site-brand-mark";
import { useAppUI } from "@/components/providers/app-providers";

export function CommandPalette() {
  const router = useRouter();
  const {
    commandOpen,
    setCommandOpen,
    theme,
    toggleTheme,
    setAiDrawerOpen,
  } = useAppUI();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (commandOpen) {
      setQuery("");
      const timer = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(timer);
    }
  }, [commandOpen]);

  useEffect(() => {
    if (!commandOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  const kw = query.trim().toLowerCase();

  const matchedModules = useMemo(() => {
    if (!kw) return PLATFORM_MODULES;
    return PLATFORM_MODULES.filter((m) =>
      `${m.name} ${m.englishTag} ${m.summary}`.toLowerCase().includes(kw)
    );
  }, [kw]);

  const matchedSites = useMemo(() => {
    const list = kw
      ? BUILTIN_SITE_SEEDS.filter((s) =>
          `${s.name} ${s.description} ${s.tags.join(" ")}`
            .toLowerCase()
            .includes(kw)
        )
      : BUILTIN_SITE_SEEDS.slice(0, 6);
    return list.slice(0, 8);
  }, [kw]);

  if (!commandOpen) return null;

  return (
    <div
      id="command-palette-modal"
      role="dialog"
      aria-modal="true"
      aria-label="全局快捷命令与导航面板"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
    >
      <div
        onClick={() => setCommandOpen(false)}
        className="fixed inset-0 bg-black/50"
      />
      <div
        style={{
          backgroundColor: "var(--bg-elevated)",
          borderColor: "var(--border-strong)",
          boxShadow: "var(--shadow-flyout)",
        }}
        className="relative z-10 w-full max-w-xl rounded-lg border overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-3.5 h-12 border-b">
          <Search
            style={{ color: "var(--fg-muted)" }}
            className="h-4 w-4 shrink-0"
          />
          <input
            ref={inputRef}
            id="command-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="跳转功能模块、检索权威网址或执行快捷设置..."
            className="flex-1 bg-transparent text-sm outline-none focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={() => setCommandOpen(false)}
            aria-label="关闭命令面板"
            style={{ color: "var(--fg-muted)" }}
            className="p-1 rounded hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
          {matchedModules.length > 0 && (
            <div>
              <div
                style={{ color: "var(--fg-muted)" }}
                className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
              >
                平台功能板块
              </div>
              <div className="space-y-0.5">
                {matchedModules.map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => {
                      setCommandOpen(false);
                      router.push(mod.href);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-left hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <ModuleIcon
                        name={mod.iconName}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="text-xs font-medium truncate">
                        {mod.name}
                      </span>
                      <span
                        style={{ color: "var(--fg-muted)" }}
                        className="text-xs font-mono hidden sm:inline"
                      >
                        {mod.href}
                      </span>
                    </span>
                    <span
                      style={{ color: "var(--fg-muted)" }}
                      className="text-[11px] font-mono shrink-0"
                    >
                      {mod.status === "active" ? "已上线" : `第 ${mod.phase} 阶段`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedSites.length > 0 && (
            <div>
              <div
                style={{ color: "var(--fg-muted)" }}
                className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
              >
                常用权威网址直达
              </div>
              <div className="space-y-0.5">
                {matchedSites.map((site) => (
                  <a
                    key={site.slug}
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setCommandOpen(false)}
                    className="group w-full flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0 pr-3">
                      <SiteBrandMark
                        slug={site.slug}
                        domain={site.url}
                        name={site.name}
                        size="sm"
                      />
                      <span className="min-w-0 truncate">
                        <span className="text-xs font-medium">{site.name}</span>
                        <span
                          style={{ color: "var(--fg-muted)" }}
                          className="ml-2 text-xs truncate"
                        >
                          {site.verifiedNote}
                        </span>
                      </span>
                    </span>
                    <ArrowUpRight
                      style={{ color: "var(--fg-muted)" }}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <div
              style={{ color: "var(--fg-muted)" }}
              className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
            >
              系统快捷操作
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setCommandOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md text-xs hover:bg-[var(--bg-subtle)]"
              >
                {theme === "dark" ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
                <span>
                  切换至{theme === "dark" ? "浅色 (Light)" : "深色 (Dark)"}主题
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCommandOpen(false);
                  setAiDrawerOpen(true);
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md text-xs hover:bg-[var(--bg-subtle)]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>打开 AI 模型与本地客户端配置</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
