"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Radio,
  ShieldAlert,
  X,
} from "lucide-react";
import type {
  AIConnectionCheckResult,
  AIProviderId,
} from "@omnikit/shared";
import { useAppUI } from "@/components/providers/app-providers";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-hidden") !== "true" &&
      el.getClientRects().length > 0
  );
}

type ConnectionUiState =
  | {
      kind: "result";
      tone: "success" | "warning" | "danger";
      data: AIConnectionCheckResult;
    }
  | {
      kind: "error";
      message: string;
    };

export function AISettingsDrawer() {
  const {
    aiDrawerOpen,
    setAiDrawerOpen,
    restoreAiDrawerTriggerFocus,
    aiSettings,
    updateAiSettings,
    bridgeState,
    probeLocalBridge,
  } = useAppUI();

  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<ConnectionUiState | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);

  // 管理抽屉打开时的自动聚焦、键盘 Tab 循环陷阱、Esc 关闭，以及关闭后焦点回退原触发按钮
  useEffect(() => {
    if (!aiDrawerOpen) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        restoreAiDrawerTriggerFocus();
      }
      return;
    }

    wasOpenRef.current = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 打开时立即将键盘焦点移入抽屉内首个交互控件
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setAiDrawerOpen(false);
        return;
      }

      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = getFocusableElements(panel);
        if (focusables.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }

        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        const insidePanel = active ? panel.contains(active) : false;

        if (e.shiftKey) {
          if (!insidePanel || active === panel || active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!insidePanel || active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const panel = panelRef.current;
      const target = e.target as Node | null;
      if (panel && target && !panel.contains(target)) {
        const focusables = getFocusableElements(panel);
        (focusables[0] ?? panel).focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [aiDrawerOpen, setAiDrawerOpen, restoreAiDrawerTriggerFocus]);

  if (!aiDrawerOpen) return null;

  const isGemini = aiSettings.activeProvider === "gemini";
  const isCompatible = aiSettings.activeProvider === "openai_compatible";
  const hasCustomBaseWithoutUserKey =
    !isGemini &&
    !aiSettings.openaiApiKey.trim() &&
    (isCompatible || Boolean(aiSettings.openaiBaseUrl.trim()));

  const handleTestConnection = async () => {
    setTesting(true);
    setTestState(null);
    try {
      const trimmedBase = aiSettings.openaiBaseUrl.trim();
      const res = await fetch("/api/ai/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiSettings.activeProvider,
          apiKey: isGemini
            ? aiSettings.geminiApiKey
            : aiSettings.openaiApiKey,
          baseUrl: isGemini ? undefined : trimmedBase || undefined,
          model: isGemini ? aiSettings.geminiModel : aiSettings.openaiModel,
        }),
      });
      const payload = await res.json();
      if (payload.ok && payload.data) {
        const checkData = payload.data as AIConnectionCheckResult;
        const tone =
          checkData.modelStatus === "confirmed"
            ? "success"
            : checkData.endpointReachable
            ? "warning"
            : "danger";
        setTestState({
          kind: "result",
          tone,
          data: checkData,
        });
      } else {
        setTestState({
          kind: "error",
          message: payload.error?.message || "服务端点连通性检查未通过",
        });
      }
    } catch {
      setTestState({
        kind: "error",
        message: "网络请求异常，请检查网络连接",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      id="ai-settings-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-drawer-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      <div
        aria-hidden="true"
        onClick={() => setAiDrawerOpen(false)}
        className="fixed inset-0 bg-black/50"
      />
      <div
        ref={panelRef}
        id="ai-settings-drawer-panel"
        tabIndex={-1}
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-strong)",
        }}
        className="relative z-10 w-full max-w-md h-full border-l flex flex-col overflow-hidden outline-none"
      >
        <div className="h-14 px-5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <KeyRound
              style={{ color: "var(--accent-primary)" }}
              className="h-4 w-4"
            />
            <h2 id="ai-drawer-title" className="text-sm font-semibold">
              AI 模型适配与本地客户端中心
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            id="ai-drawer-close"
            onClick={() => setAiDrawerOpen(false)}
            aria-label="关闭设置抽屉"
            className="p-1.5 rounded-md hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* 激活供应商选择 */}
          <section className="space-y-3">
            <label className="block font-semibold">
              当前默认推理供应商（供地图分析、资源检索、设备排障共用）
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "openai", label: "OpenAI" },
                  { id: "gemini", label: "Google Gemini" },
                  { id: "openai_compatible", label: "兼容端点" },
                ] as { id: AIProviderId; label: string }[]
              ).map((item) => {
                const active = aiSettings.activeProvider === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    id={`provider-tab-${item.id}`}
                    onClick={() => {
                      setTestState(null);
                      updateAiSettings({ activeProvider: item.id });
                    }}
                    style={{
                      backgroundColor: active
                        ? "var(--accent-soft)"
                        : "var(--bg-surface)",
                      borderColor: active
                        ? "var(--accent-primary)"
                        : "var(--border-subtle)",
                      color: active
                        ? "var(--accent-primary)"
                        : "var(--fg-secondary)",
                    }}
                    className="py-2 px-2.5 rounded-md border font-medium text-center transition-colors"
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* OpenAI / 兼容端点表单 */}
          {!isGemini ? (
            <section className="space-y-3">
              <div>
                <label
                  htmlFor="input-openai-key"
                  className="block font-medium mb-1"
                >
                  {isCompatible
                    ? "兼容接口个人 API Key（必填 · 本地存储）"
                    : "OpenAI 个人 API Key（本地存储）"}
                </label>
                <input
                  id="input-openai-key"
                  type="password"
                  value={aiSettings.openaiApiKey}
                  onChange={(e) =>
                    updateAiSettings({ openaiApiKey: e.target.value })
                  }
                  placeholder="sk-..."
                  style={{ backgroundColor: "var(--bg-canvas)" }}
                  className="w-full h-9 px-3 rounded-md border font-mono text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="input-openai-base"
                  className="block font-medium mb-1"
                >
                  {isCompatible
                    ? "自定义 API Base URL（必填）"
                    : "自定义 API Base URL（可选 · 留空使用默认可信端点）"}
                </label>
                <input
                  id="input-openai-base"
                  type="url"
                  value={aiSettings.openaiBaseUrl}
                  onChange={(e) =>
                    updateAiSettings({ openaiBaseUrl: e.target.value })
                  }
                  placeholder={
                    isCompatible
                      ? "https://openrouter.ai/api/v1"
                      : "留空默认使用服务端可信端点"
                  }
                  style={{ backgroundColor: "var(--bg-canvas)" }}
                  className="w-full h-9 px-3 rounded-md border font-mono text-xs"
                />
                {hasCustomBaseWithoutUserKey && (
                  <p
                    style={{ color: "var(--status-verified-fg)" }}
                    className="mt-1 leading-relaxed"
                  >
                    提示：自定义端点与兼容端点不会使用服务器预置密钥，请一并填写上方的个人 API Key。
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="input-openai-model"
                  className="block font-medium mb-1"
                >
                  目标模型名称
                </label>
                <input
                  id="input-openai-model"
                  type="text"
                  value={aiSettings.openaiModel}
                  onChange={(e) =>
                    updateAiSettings({ openaiModel: e.target.value })
                  }
                  placeholder="gpt-4o-mini"
                  style={{ backgroundColor: "var(--bg-canvas)" }}
                  className="w-full h-9 px-3 rounded-md border font-mono text-xs"
                />
              </div>
            </section>
          ) : (
            <section className="space-y-3">
              <div>
                <label
                  htmlFor="input-gemini-key"
                  className="block font-medium mb-1"
                >
                  Google Gemini API Key（本地存储）
                </label>
                <input
                  id="input-gemini-key"
                  type="password"
                  value={aiSettings.geminiApiKey}
                  onChange={(e) =>
                    updateAiSettings({ geminiApiKey: e.target.value })
                  }
                  placeholder="AIza..."
                  style={{ backgroundColor: "var(--bg-canvas)" }}
                  className="w-full h-9 px-3 rounded-md border font-mono text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="input-gemini-model"
                  className="block font-medium mb-1"
                >
                  Gemini 模型名称
                </label>
                <input
                  id="input-gemini-model"
                  type="text"
                  value={aiSettings.geminiModel}
                  onChange={(e) =>
                    updateAiSettings({ geminiModel: e.target.value })
                  }
                  placeholder="gemini-2.5-flash"
                  style={{ backgroundColor: "var(--bg-canvas)" }}
                  className="w-full h-9 px-3 rounded-md border font-mono text-xs"
                />
              </div>
            </section>
          )}

          {/* 服务端点连通性检查与模型核验（明确区分端点可达与模型可用） */}
          <div className="space-y-2">
            <button
              type="button"
              id="btn-test-ai-connection"
              disabled={testing}
              onClick={handleTestConnection}
              style={{
                backgroundColor: "var(--accent-primary)",
                color: "var(--accent-foreground)",
              }}
              className="w-full h-9 rounded-md font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {testing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>服务端点连通性检查</span>
            </button>
            <p style={{ color: "var(--fg-muted)" }} className="leading-relaxed">
              说明：仅允许公网 HTTPS 直连端点（禁止重定向与非公网地址）；模型检查结果严格区分「已确认」「未找到（404）」与「无法确认（HTML/无效 JSON/超时/503 等）」，不消耗推理 Token。
            </p>

            {testState && (
              <div
                id="ai-connection-test-result"
                role="status"
                style={{
                  backgroundColor:
                    testState.kind === "result" && testState.tone === "success"
                      ? "var(--status-measured-bg)"
                      : testState.kind === "result" &&
                        testState.tone === "warning"
                      ? "var(--status-verified-bg)"
                      : "var(--danger-bg)",
                  borderColor:
                    testState.kind === "result" && testState.tone === "success"
                      ? "var(--status-measured-border)"
                      : testState.kind === "result" &&
                        testState.tone === "warning"
                      ? "var(--status-verified-border)"
                      : "var(--danger-border)",
                  color:
                    testState.kind === "result" && testState.tone === "success"
                      ? "var(--status-measured-fg)"
                      : testState.kind === "result" &&
                        testState.tone === "warning"
                      ? "var(--status-verified-fg)"
                      : "var(--danger-fg)",
                }}
                className="p-3 rounded-md border space-y-1.5"
              >
                {testState.kind === "error" ? (
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">安全策略拦截或配置无效</div>
                      <div className="mt-0.5">{testState.message}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    {testState.tone === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : testState.tone === "warning" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="font-semibold">{testState.data.message}</div>
                      <div className="font-mono text-[11px] flex flex-wrap gap-x-3 gap-y-1 opacity-90">
                        <span>
                          端点状态：
                          {testState.data.endpointReachable
                            ? `有效 API 响应 (${testState.data.latencyMs}ms)`
                            : "未通过有效 API 校验"}
                        </span>
                        <span>
                          模型状态：
                          {testState.data.modelStatus === "confirmed"
                            ? "已确认"
                            : testState.data.modelStatus === "not_found"
                            ? "未找到（404）"
                            : "无法确认"}
                        </span>
                        <span>
                          密钥来源：
                          {testState.data.keySource === "server"
                            ? "服务端预置"
                            : "本地个人密钥"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 本地客户端桥接探测 */}
          <section className="pt-4 border-t space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5" />
                <span>本地客户端守护连接（基米大师 / 玩机器）</span>
              </span>
              <span
                style={{
                  color:
                    bridgeState === "connected"
                      ? "var(--status-measured-fg)"
                      : "var(--fg-muted)",
                }}
                className="font-mono"
              >
                {bridgeState === "checking"
                  ? "探测中..."
                  : bridgeState === "connected"
                  ? "● 已连接"
                  : "○ 仅网页模式"}
              </span>
            </div>
            <p style={{ color: "var(--fg-muted)" }} className="leading-relaxed">
              涉及底层 WMI 硬件传感器、网卡 DNS 修改、ADB 与 Apple 驱动诊断的操作需在本地启动 Windows 客户端（默认回环端口{" "}
              <code className="font-mono">{aiSettings.localBridgePort}</code>
              ）。
            </p>
            <button
              type="button"
              id="btn-probe-bridge"
              onClick={() => void probeLocalBridge()}
              disabled={bridgeState === "checking"}
              style={{
                backgroundColor: "var(--bg-subtle)",
                borderColor: "var(--border-strong)",
              }}
              className="w-full h-8 rounded-md border font-medium hover:bg-[var(--bg-hover)] transition-colors"
            >
              重新检测本地客户端状态
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
