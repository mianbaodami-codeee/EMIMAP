"use client";

import React, { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  Moon,
  Radio,
  Search,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { PLATFORM_MODULES } from "@omnikit/shared";
import { CollapsibleSidebar } from "./collapsible-sidebar";
import { CommandPalette } from "./command-palette";
import { AISettingsDrawer } from "./ai-settings-drawer";
import { useAppUI } from "@/components/providers/app-providers";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    theme,
    toggleTheme,
    setCommandOpen,
    setAiDrawerOpen,
    aiSettings,
    bridgeState,
  } = useAppUI();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const currentModule =
    PLATFORM_MODULES.find((m) =>
      m.href === "/"
        ? pathname === "/"
        : pathname === m.href || pathname.startsWith(`${m.href}/`)
    ) || PLATFORM_MODULES[0]!;

  const providerBadge =
    aiSettings.activeProvider === "gemini"
      ? "Gemini"
      : aiSettings.activeProvider === "openai_compatible"
      ? "Custom API"
      : "OpenAI";

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* 导航栏主体（默认 60px 回缩导轨，鼠标移入丝滑弹出 260px） */}
      <CollapsibleSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={closeMobileMenu}
        onPinnedChange={setSidebarPinned}
      />

      {/* 桌面端占位槽：未固定时仅占 60px，悬停弹出不抖动主内容布局；固定时占 260px */}
      <div
        aria-hidden="true"
        style={{ width: sidebarPinned ? 260 : 60 }}
        className="hidden md:block shrink-0 transition-[width] duration-200 ease-out"
      />

      {/* 右侧主内容列 */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-subtle)",
          }}
          className="sticky top-0 z-30 h-14 border-b px-4 sm:px-6 flex items-center justify-between gap-3"
        >
          {/* 左侧：移动端菜单触发器 + 当前位置上下文 */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              id="mobile-menu-trigger"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="打开主导航菜单"
              className="md:hidden p-1.5 -ml-1 rounded-md hover:bg-[var(--bg-subtle)]"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold truncate">
                {currentModule.name}
              </span>
              <span
                style={{
                  color: "var(--fg-muted)",
                  borderColor: "var(--border-subtle)",
                  backgroundColor: "var(--bg-subtle)",
                }}
                className="hidden sm:inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-mono shrink-0"
              >
                {currentModule.executionBoundary}
              </span>
            </div>
          </div>

          {/* 右侧：精密工具栏（全局搜索、客户端状态、AI 配置、深浅色切换） */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="header-search-trigger"
              onClick={() => setCommandOpen(true)}
              style={{
                backgroundColor: "var(--bg-canvas)",
                borderColor: "var(--border-subtle)",
                color: "var(--fg-muted)",
              }}
              className="h-8 px-2.5 sm:px-3 rounded-md border flex items-center gap-2 text-xs hover:border-[var(--border-strong)] transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">检索模块或网址...</span>
              <kbd className="hidden lg:inline font-mono text-[10px] px-1 py-0.5 rounded bg-[var(--bg-subtle)]">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              id="header-ai-trigger"
              onClick={() => setAiDrawerOpen(true)}
              style={{
                backgroundColor: "var(--bg-subtle)",
                borderColor: "var(--border-subtle)",
                color: "var(--fg-secondary)",
              }}
              className="h-8 px-2.5 rounded-md border flex items-center gap-1.5 text-xs hover:text-[var(--fg-primary)] transition-colors"
              title="配置大模型 API 与本地客户端连接"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden md:inline font-mono">{providerBadge}</span>
              <span
                style={{ color: "var(--fg-muted)" }}
                className="hidden xl:inline-flex items-center gap-1 pl-1.5 ml-1 border-l font-mono text-[11px]"
              >
                <Radio className="h-3 w-3" />
                {bridgeState === "connected" ? "客户端在线" : "Web模式"}
              </span>
            </button>

            <button
              type="button"
              id="header-theme-toggle"
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? "切换为浅色主题" : "切换为深色主题"
              }
              title={theme === "dark" ? "切换为浅色主题" : "切换为深色主题"}
              style={{
                backgroundColor: "var(--bg-subtle)",
                borderColor: "var(--border-subtle)",
                color: "var(--fg-secondary)",
              }}
              className="h-8 w-8 rounded-md border flex items-center justify-center hover:text-[var(--fg-primary)] transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>

        <footer
          style={{
            borderColor: "var(--border-subtle)",
            color: "var(--fg-muted)",
          }}
          className="border-t px-4 sm:px-6 py-3 text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <span>
            OmniKit AI 跨平台工程工具平台 · 严格区分实测硬件/地理数据、公开联网信源与大模型推理
          </span>
          <span className="font-mono tabular-nums">
            Phase 1 Foundation · PostgreSQL Ready
          </span>
        </footer>
      </div>

      <CommandPalette />
      <AISettingsDrawer />
    </div>
  );
}
