"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ClientAISettingsSchema,
  type AIGatewayStatus,
  type ClientAISettings,
} from "@omnikit/shared";

export type ThemeMode = "light" | "dark";
export type LocalBridgeState = "web_only" | "checking" | "connected";

interface AppUIContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  aiDrawerOpen: boolean;
  setAiDrawerOpen: (open: boolean) => void;
  restoreAiDrawerTriggerFocus: () => void;
  aiSettings: ClientAISettings;
  updateAiSettings: (patch: Partial<ClientAISettings>) => void;
  serverAiStatus: AIGatewayStatus | null;
  bridgeState: LocalBridgeState;
  probeLocalBridge: () => Promise<void>;
}

const DEFAULT_SETTINGS: ClientAISettings = ClientAISettingsSchema.parse({});
const THEME_STORAGE_KEY = "omnikit.theme";
const AI_SETTINGS_STORAGE_KEY = "omnikit.ai.settings";

const AppUIContext = createContext<AppUIContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [commandOpen, setCommandOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpenState] = useState(false);
  const aiDrawerTriggerRef = useRef<HTMLElement | null>(null);
  const [aiSettings, setAiSettings] =
    useState<ClientAISettings>(DEFAULT_SETTINGS);
  const [serverAiStatus, setServerAiStatus] =
    useState<AIGatewayStatus | null>(null);
  const [bridgeState, setBridgeState] = useState<LocalBridgeState>("web_only");

  const setAiDrawerOpen = useCallback((open: boolean) => {
    if (open && typeof document !== "undefined") {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active !== document.body &&
        !active.closest("#ai-settings-drawer")
      ) {
        aiDrawerTriggerRef.current = active;
      }
    }
    setAiDrawerOpenState(open);
  }, []);

  const restoreAiDrawerTriggerFocus = useCallback(() => {
    if (typeof document === "undefined") return;
    const saved = aiDrawerTriggerRef.current;
    if (saved && saved.isConnected && saved.getClientRects().length > 0) {
      saved.focus();
      return;
    }
    const fallback =
      document.getElementById("header-ai-trigger") ||
      document.getElementById("mobile-menu-trigger");
    if (fallback && fallback.getClientRects().length > 0) {
      fallback.focus();
    }
  }, []);

  // 初始化读取主题与本地 AI 配置
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === "light" || savedTheme === "dark") {
        setThemeState(savedTheme);
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(savedTheme);
      } else {
        const isDark = document.documentElement.classList.contains("dark");
        setThemeState(isDark ? "dark" : "light");
      }

      const rawAi = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
      if (rawAi) {
        const parsed = ClientAISettingsSchema.safeParse(JSON.parse(rawAi));
        if (parsed.success) {
          setAiSettings(parsed.data);
        }
      }
    } catch {
      // 忽略隐私无痕窗口的存储异常
    }
  }, []);

  // 拉取服务端统一 AI 网关可用状态（不含任何密钥值）
  useEffect(() => {
    let active = true;
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((payload) => {
        if (active && payload?.ok && payload.data) {
          setServerAiStatus(payload.data as AIGatewayStatus);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // 全局监听 Cmd/Ctrl + K 打开快捷命令面板
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const applyThemeDom = useCallback((next: ThemeMode) => {
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.classList.remove("light", "dark");
    root.classList.add(next);
    void root.offsetHeight;
    root.classList.remove("theme-switching");
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }, []);

  const setTheme = useCallback(
    (next: ThemeMode) => {
      applyThemeDom(next);
    },
    [applyThemeDom]
  );

  const toggleTheme = useCallback(() => {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    const next: ThemeMode = isCurrentlyDark ? "light" : "dark";
    applyThemeDom(next);
  }, [applyThemeDom]);

  const updateAiSettings = useCallback((patch: Partial<ClientAISettings>) => {
    setAiSettings((prev) => {
      const merged = ClientAISettingsSchema.parse({ ...prev, ...patch });
      try {
        localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    });
  }, []);

  // 真实探测本地是否运行「基米大师」客户端守护端口（未运行时如实返回 web_only）
  const probeLocalBridge = useCallback(async () => {
    setBridgeState("checking");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch(
        `http://127.0.0.1:${aiSettings.localBridgePort}/health`,
        {
          method: "GET",
          mode: "cors",
          signal: controller.signal,
        }
      );
      setBridgeState(res.ok ? "connected" : "web_only");
    } catch {
      setBridgeState("web_only");
    } finally {
      clearTimeout(timer);
    }
  }, [aiSettings.localBridgePort]);

  const value = useMemo<AppUIContextValue>(
    () => ({
      theme,
      toggleTheme,
      setTheme,
      commandOpen,
      setCommandOpen,
      aiDrawerOpen,
      setAiDrawerOpen,
      restoreAiDrawerTriggerFocus,
      aiSettings,
      updateAiSettings,
      serverAiStatus,
      bridgeState,
      probeLocalBridge,
    }),
    [
      theme,
      toggleTheme,
      setTheme,
      commandOpen,
      aiDrawerOpen,
      setAiDrawerOpen,
      restoreAiDrawerTriggerFocus,
      aiSettings,
      updateAiSettings,
      serverAiStatus,
      bridgeState,
      probeLocalBridge,
    ]
  );

  return (
    <AppUIContext.Provider value={value}>{children}</AppUIContext.Provider>
  );
}

export function useAppUI(): AppUIContextValue {
  const ctx = useContext(AppUIContext);
  if (!ctx) {
    throw new Error("useAppUI 必须在 AppProviders 内部调用");
  }
  return ctx;
}
