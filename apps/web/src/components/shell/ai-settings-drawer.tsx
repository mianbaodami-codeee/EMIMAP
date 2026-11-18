"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Radio,
  ShieldAlert,
  X,
} from "lucide-react";
import type { AIProviderId } from "@omnikit/shared";
import { useAppUI } from "@/components/providers/app-providers";

export function AISettingsDrawer() {
  const {
    aiDrawerOpen,
    setAiDrawerOpen,
    aiSettings,
    updateAiSettings,
    serverAiStatus,
    bridgeState,
    probeLocalBridge,
  } = useAppUI();

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  if (!aiDrawerOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const isGemini = aiSettings.activeProvider === "gemini";
      const res = await fetch("/api/ai/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiSettings.activeProvider,
          apiKey: isGemini
            ? aiSettings.geminiApiKey
            : aiSettings.openaiApiKey,
          baseUrl: isGemini ? undefined : aiSettings.openaiBaseUrl,
          model: isGemini ? aiSettings.geminiModel : aiSettings.openaiModel,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          message: `连接验证通过 (${data.data.provider} · ${data.data.latencyMs}ms)`,
        });
      } else {
        setTestResult({
          ok: false,
          message: data.error?.message || "连接测试未通过",
        });
      }
    } catch {
      setTestResult({
        ok: false,
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
      aria-label="统一 AI 模型与本地客户端桥接设置"
      className="fixed inset-0 z-50 flex justify-end"
    >
      <div
        onClick={() => setAiDrawerOpen(false)}
        className="fixed inset-0 bg-black/50"
      />
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-strong)",
        }}
        className="relative z-10 w-full max-w-md h-full border-l flex flex-col overflow-hidden"
      >
        <div className="h-14 px-5 border-b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <KeyRound
              style={{ color: "var(--accent-primary)" }}
              className="h-4 w-4"
            />
            <h2 className="text-sm font-semibold">
              AI 模型适配与本地客户端中心
            </h2>
          </div>
          <button
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
          {/* 服务端预置状态 */}
          <section
            style={{ backgroundColor: "var(--bg-subtle)" }}
            className="p-3.5 rounded-md border space-y-2"
          >
            <div className="font-semibold flex items-center justify-between">
              <span>服务端网关密钥状态</span>
              <span className="font-mono text-[11px] opacity-75">
                密钥零前端暴露
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div
                style={{ backgroundColor: "var(--bg-surface)" }}
                className="p-2 rounded border flex items-center justify-between"
              >
                <span>OpenAI 服务端</span>
                <span
                  style={{
                    color: serverAiStatus?.openaiServerReady
                      ? "var(--status-measured-fg)"
                      : "var(--fg-muted)",
                  }}
                  className="font-mono"
                >
                  {serverAiStatus?.openaiServerReady ? "已配置" : "未预置"}
                </span>
              </div>
              <div
                style={{ backgroundColor: "var(--bg-surface)" }}
                className="p-2 rounded border flex items-center justify-between"
              >
                <span>Gemini 服务端</span>
                <span
                  style={{
                    color: serverAiStatus?.geminiServerReady
                      ? "var(--status-measured-fg)"
                      : "var(--fg-muted)",
                  }}
                  className="font-mono"
                >
                  {serverAiStatus?.geminiServerReady ? "已配置" : "未预置"}
                </span>
              </div>
            </div>
            <p style={{ color: "var(--fg-muted)" }} className="leading-relaxed">
              当服务端未预置密钥或您希望使用个人配额时，可在下方填入自有 API Key（BYOK），密钥仅存储于您当前浏览器本地。
            </p>
          </section>

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
                    onClick={() =>
                      updateAiSettings({ activeProvider: item.id })
                    }
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
          {aiSettings.activeProvider !== "gemini" ? (
            <section className="space-y-3">
              <div>
                <label
                  htmlFor="input-openai-key"
                  className="block font-medium mb-1"
                >
                  OpenAI / 兼容接口 API Key（本地存储）
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
                  API Base URL
                </label>
                <input
                  id="input-openai-base"
                  type="url"
                  value={aiSettings.openaiBaseUrl}
                  onChange={(e) =>
                    updateAiSettings({ openaiBaseUrl: e.target.value })
                  }
                  placeholder="https://api.openai.com/v1"
                  style={{ backgroundColor: "var(--bg-canvas)" }}
                  className="w-full h-9 px-3 rounded-md border font-mono text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="input-openai-model"
                  className="block font-medium mb-1"
                >
                  默认模型名称
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

          {/* 真实连通性测试 */}
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
              <span>真实探测当前模型接口连通性</span>
            </button>

            {testResult && (
              <div
                style={{
                  backgroundColor: testResult.ok
                    ? "var(--status-measured-bg)"
                    : "var(--danger-bg)",
                  borderColor: testResult.ok
                    ? "var(--status-measured-border)"
                    : "var(--danger-border)",
                  color: testResult.ok
                    ? "var(--status-measured-fg)"
                    : "var(--danger-fg)",
                }}
                className="p-2.5 rounded-md border flex items-start gap-2"
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
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
