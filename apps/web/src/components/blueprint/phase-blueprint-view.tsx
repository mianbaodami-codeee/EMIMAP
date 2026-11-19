import React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, HardDrive, Layers } from "lucide-react";
import type { PlatformModuleMeta } from "@omnikit/shared";
import { ModuleIcon } from "@/components/ui/module-icon";

/**
 * 尚未进入编码阶段（第 2–4 阶段）模块的诚实工程架构蓝图视图
 * 严格遵循「不得用静态假数据冒充真实功能，未经确认不越阶段扩展」原则，透明展示该模块的技术边界与排期。
 */
export function PhaseBlueprintView({
  moduleMeta,
}: {
  moduleMeta: PlatformModuleMeta;
}) {
  return (
    <div className="workspace-frame workspace-compact space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          style={{ color: "var(--fg-secondary)" }}
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:text-[var(--fg-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回平台工作台</span>
        </Link>

        <span
          style={{
            backgroundColor: "var(--status-verified-bg)",
            borderColor: "var(--status-verified-border)",
            color: "var(--status-verified-fg)",
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono"
        >
          <Clock className="h-3.5 w-3.5" />
          <span>计划交付阶段：第 {moduleMeta.phase} 阶段（待当前阶段审核通过后实施）</span>
        </span>
      </div>

      <section
        style={{ backgroundColor: "var(--bg-surface)" }}
        className="workspace-heading space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent-primary)",
              }}
              className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
            >
              <ModuleIcon name={moduleMeta.iconName} className="h-5 w-5" />
            </div>
            <div>
              <h1 className="workspace-title">
                {moduleMeta.name}
              </h1>
              <p
                style={{ color: "var(--fg-muted)" }}
                className="text-xs font-mono mt-0.5"
              >
                {moduleMeta.englishTag} · 路由 {moduleMeta.href} · {moduleMeta.executionBoundary}
              </p>
            </div>
          </div>

        </div>

        <p
          style={{ color: "var(--fg-secondary)" }}
          className="text-sm leading-relaxed"
        >
          {moduleMeta.summary}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div
            style={{ backgroundColor: "var(--bg-canvas)" }}
            className="rounded-md border p-4 space-y-2.5"
          >
            <div className="text-xs font-semibold flex items-center gap-2">
              <CheckCircle2
                style={{ color: "var(--status-measured-fg)" }}
                className="h-4 w-4"
              />
              <span>Web 端真实能力范围</span>
            </div>
            <ul
              style={{ color: "var(--fg-secondary)" }}
              className="space-y-2 text-xs leading-relaxed list-disc pl-4"
            >
              {moduleMeta.webCapabilities.map((cap) => (
                <li key={cap}>{cap}</li>
              ))}
            </ul>
          </div>

          <div
            style={{ backgroundColor: "var(--bg-canvas)" }}
            className="rounded-md border p-4 space-y-2.5"
          >
            <div className="text-xs font-semibold flex items-center gap-2">
              <HardDrive
                style={{ color: "var(--accent-primary)" }}
                className="h-4 w-4"
              />
              <span>原生客户端与系统边界说明</span>
            </div>
            <ul
              style={{ color: "var(--fg-secondary)" }}
              className="space-y-2 text-xs leading-relaxed list-disc pl-4"
            >
              {moduleMeta.nativeCapabilities.map((cap) => (
                <li key={cap}>{cap}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span
              style={{ color: "var(--fg-muted)" }}
              className="inline-flex items-center gap-1"
            >
              <Layers className="h-3.5 w-3.5" />
              预定技术栈：
            </span>
            {moduleMeta.techStackNotes.map((tech) => (
              <span
                key={tech}
                style={{ backgroundColor: "var(--bg-subtle)" }}
                className="px-2 py-0.5 rounded font-mono text-[11px]"
              >
                {tech}
              </span>
            ))}
          </div>

          <Link
            href="/hub"
            style={{ color: "var(--accent-primary)" }}
            className="font-medium hover:underline"
          >
            前往已上线的「常用网址导引」 →
          </Link>
        </div>
      </section>
    </div>
  );
}
