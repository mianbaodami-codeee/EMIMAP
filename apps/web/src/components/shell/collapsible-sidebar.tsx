"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Command,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  MODULE_DOMAIN_LABELS,
  PLATFORM_MODULES,
  type ModuleDomainGroup,
} from "@omnikit/shared";
import { ModuleIcon } from "@/components/ui/module-icon";
import { useAppUI } from "@/components/providers/app-providers";

const DOMAIN_ORDER: ModuleDomainGroup[] = [
  "workspace",
  "ai_explore",
  "hardware_cross",
];

const PIN_STORAGE_KEY = "omnikit.sidebar.pinned";

export function CollapsibleSidebar({
  mobileOpen,
  onCloseMobile,
  onPinnedChange,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onPinnedChange: (pinned: boolean) => void;
}) {
  const pathname = usePathname();
  const { setCommandOpen, setAiDrawerOpen, bridgeState } = useAppUI();

  // 默认处于可回缩模式 (isPinned = false)，鼠标移入自动弹出完整面板
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PIN_STORAGE_KEY);
      if (saved === "true") {
        setIsPinned(true);
        onPinnedChange(true);
      }
    } catch {}
  }, [onPinnedChange]);

  // 路由切换时自动关闭移动端抽屉
  useEffect(() => {
    onCloseMobile();
  }, [pathname, onCloseMobile]);

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    onPinnedChange(next);
    if (!next) {
      // 用户点击回缩时立即收起面板，下次鼠标重新移入时再弹出
      setIsHovered(false);
    }
    try {
      localStorage.setItem(PIN_STORAGE_KEY, String(next));
    } catch {}
  };

  const expanded = isPinned || isHovered;

  const isRouteActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* ==================== 桌面端可回缩悬停弹出导航栏 ==================== */}
      <aside
        id="global-sidebar"
        aria-label="主导航栏"
        data-expanded={expanded ? "true" : "false"}
        data-pinned={isPinned ? "true" : "false"}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: expanded ? 260 : 60,
          backgroundColor: "var(--bg-surface)",
          borderColor: expanded ? "var(--border-strong)" : "var(--border-subtle)",
          boxShadow: !isPinned && isHovered ? "var(--shadow-flyout)" : "none",
        }}
        className="fixed inset-y-0 left-0 z-40 hidden md:flex flex-col border-r transition-[width,box-shadow,border-color] duration-200 ease-out overflow-hidden select-none"
      >
        {/* 顶部品牌与固定/回缩控制 */}
        <div className="h-14 shrink-0 flex items-center border-b px-2">
          <Link
            href="/"
            id="sidebar-brand-link"
            className="flex items-center min-w-0 flex-1 rounded-md py-1 focus-visible:outline-none"
          >
            <div
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "var(--accent-foreground)",
              }}
              className="w-9 h-9 ml-1 shrink-0 rounded-md flex items-center justify-center font-mono text-sm font-bold tracking-tight"
            >
              OK
            </div>
            <div
              className={`ml-3 min-w-0 transition-opacity duration-150 ${
                expanded ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="text-sm font-semibold tracking-tight truncate">
                OmniKit AI
              </div>
              <div
                style={{ color: "var(--fg-muted)" }}
                className="text-[11px] font-mono truncate"
              >
                Precision Suite v0.1
              </div>
            </div>
          </Link>

          {expanded && (
            <button
              type="button"
              id="sidebar-pin-toggle"
              onClick={togglePin}
              title={
                isPinned
                  ? "切换为自动回缩（鼠标移开后收起）"
                  : "固定展开导航栏"
              }
              aria-label={isPinned ? "开启导航栏自动回缩" : "固定展开导航栏"}
              style={{ color: "var(--fg-secondary)" }}
              className="p-1.5 rounded-md hover:bg-[var(--bg-subtle)] transition-colors shrink-0"
            >
              {isPinned ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* 中部三域分组导航列表 */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4">
          {DOMAIN_ORDER.map((groupKey) => {
            const items = PLATFORM_MODULES.filter((m) => m.group === groupKey);
            return (
              <div key={groupKey} className="space-y-1">
                <div className="h-5 flex items-center px-2">
                  {expanded ? (
                    <span
                      style={{ color: "var(--fg-muted)" }}
                      className="text-[11px] font-semibold uppercase tracking-wider truncate"
                    >
                      {MODULE_DOMAIN_LABELS[groupKey]}
                    </span>
                  ) : (
                    <div
                      style={{ backgroundColor: "var(--border-subtle)" }}
                      className="w-5 h-px mx-auto"
                    />
                  )}
                </div>

                {items.map((mod) => {
                  const active = isRouteActive(mod.href);
                  return (
                    <Link
                      key={mod.id}
                      id={`nav-link-${mod.id}`}
                      href={mod.href}
                      title={!expanded ? `${mod.name} (${mod.englishTag})` : undefined}
                      style={{
                        backgroundColor: active
                          ? "var(--accent-soft)"
                          : "transparent",
                        color: active
                          ? "var(--accent-primary)"
                          : "var(--fg-secondary)",
                      }}
                      className="group relative flex items-center h-9 rounded-md px-2.5 transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
                    >
                      {active && (
                        <span
                          style={{ backgroundColor: "var(--accent-primary)" }}
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                        />
                      )}
                      <span className="w-6 flex items-center justify-center shrink-0">
                        <ModuleIcon name={mod.iconName} className="h-4 w-4" />
                      </span>
                      <span
                        className={`ml-2.5 flex-1 flex items-center justify-between min-w-0 transition-opacity duration-150 ${
                          expanded
                            ? "opacity-100"
                            : "opacity-0 pointer-events-none"
                        }`}
                      >
                        <span
                          style={{
                            color: active
                              ? "var(--fg-primary)"
                              : "inherit",
                          }}
                          className="text-xs font-medium truncate"
                        >
                          {mod.name}
                        </span>
                        {mod.status === "planned" ? (
                          <span
                            style={{
                              color: "var(--fg-muted)",
                              borderColor: "var(--border-subtle)",
                            }}
                            className="ml-1.5 px-1 py-0.5 text-[10px] font-mono rounded border leading-none shrink-0"
                          >
                            P{mod.phase}
                          </span>
                        ) : (
                          <span
                            style={{ color: "var(--status-measured-fg)" }}
                            className="ml-1.5 text-[10px] font-mono shrink-0"
                          >
                            就绪
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* 底部快捷工具与客户端桥接状态 */}
        <div className="shrink-0 border-t p-2 space-y-1">
          <button
            type="button"
            id="sidebar-cmd-btn"
            onClick={() => setCommandOpen(true)}
            style={{ color: "var(--fg-secondary)" }}
            title={!expanded ? "快捷命令面板 (Ctrl/Cmd + K)" : undefined}
            className="w-full flex items-center h-9 rounded-md px-2.5 hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <span className="w-6 flex items-center justify-center shrink-0">
              <Command className="h-4 w-4" />
            </span>
            <span
              className={`ml-2.5 flex-1 flex items-center justify-between text-xs transition-opacity duration-150 ${
                expanded ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <span>全局命令检索</span>
              <kbd
                style={{
                  backgroundColor: "var(--bg-subtle)",
                  borderColor: "var(--border-strong)",
                }}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded border"
              >
                ⌘K
              </kbd>
            </span>
          </button>

          <button
            type="button"
            id="sidebar-settings-btn"
            onClick={() => setAiDrawerOpen(true)}
            style={{ color: "var(--fg-secondary)" }}
            title={!expanded ? "AI 模型与本地客户端设置" : undefined}
            className="w-full flex items-center h-9 rounded-md px-2.5 hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <span className="w-6 flex items-center justify-center shrink-0 relative">
              <SlidersHorizontal className="h-4 w-4" />
              <span
                style={{
                  backgroundColor:
                    bridgeState === "connected"
                      ? "var(--status-measured-fg)"
                      : "var(--accent-primary)",
                }}
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              />
            </span>
            <span
              className={`ml-2.5 flex-1 flex items-center justify-between text-xs transition-opacity duration-150 ${
                expanded ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <span className="truncate">AI 与客户端配置</span>
              <span className="font-mono text-[10px] opacity-80">
                {bridgeState === "connected" ? "Bridge" : "Web"}
              </span>
            </span>
          </button>
        </div>
      </aside>

      {/* ==================== 移动端抽屉式导航栏 (< 768px) ==================== */}
      {mobileOpen && (
        <div
          id="mobile-nav-backdrop"
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="移动端主导航菜单"
        >
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/50 transition-opacity"
          />
          <div
            id="mobile-nav-drawer"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-strong)",
            }}
            className="relative z-10 w-72 max-w-[85vw] h-full border-r flex flex-col"
          >
            <div className="h-14 px-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  style={{
                    backgroundColor: "var(--accent-primary)",
                    color: "var(--accent-foreground)",
                  }}
                  className="w-8 h-8 rounded-md flex items-center justify-center font-mono text-xs font-bold"
                >
                  OK
                </div>
                <div>
                  <div className="text-sm font-semibold">OmniKit AI</div>
                  <div
                    style={{ color: "var(--fg-muted)" }}
                    className="text-[11px] font-mono"
                  >
                    跨平台工程工具集
                  </div>
                </div>
              </div>
              <button
                type="button"
                id="mobile-nav-close"
                onClick={onCloseMobile}
                aria-label="关闭导航菜单"
                className="p-1.5 rounded-md hover:bg-[var(--bg-subtle)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-4">
              {DOMAIN_ORDER.map((groupKey) => {
                const items = PLATFORM_MODULES.filter(
                  (m) => m.group === groupKey
                );
                return (
                  <div key={groupKey} className="space-y-1">
                    <div
                      style={{ color: "var(--fg-muted)" }}
                      className="px-2.5 text-[11px] font-semibold uppercase tracking-wider"
                    >
                      {MODULE_DOMAIN_LABELS[groupKey]}
                    </div>
                    {items.map((mod) => {
                      const active = isRouteActive(mod.href);
                      return (
                        <Link
                          key={mod.id}
                          id={`mobile-nav-link-${mod.id}`}
                          href={mod.href}
                          style={{
                            backgroundColor: active
                              ? "var(--accent-soft)"
                              : "transparent",
                            color: active
                              ? "var(--fg-primary)"
                              : "var(--fg-secondary)",
                          }}
                          className="flex items-center justify-between h-10 px-3 rounded-md text-sm"
                        >
                          <span className="flex items-center gap-2.5 truncate">
                            <ModuleIcon
                              name={mod.iconName}
                              className="h-4 w-4 shrink-0"
                            />
                            <span className="truncate font-medium">
                              {mod.name}
                            </span>
                          </span>
                          <span
                            style={{ color: "var(--fg-muted)" }}
                            className="text-xs font-mono"
                          >
                            {mod.status === "active" ? "就绪" : `P${mod.phase}`}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </nav>

            <div className="border-t p-3 flex items-center justify-between text-xs">
              <span
                style={{ color: "var(--fg-muted)" }}
                className="flex items-center gap-1.5"
              >
                <Radio className="h-3.5 w-3.5" />
                <span>
                  {bridgeState === "connected"
                    ? "已连接基米大师客户端"
                    : "当前运行于纯网页模式"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  setAiDrawerOpen(true);
                }}
                style={{ color: "var(--accent-primary)" }}
                className="font-medium"
              >
                配置模型
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
