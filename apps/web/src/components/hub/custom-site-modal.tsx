"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Plus, Save, X } from "lucide-react";
import {
  SITE_CATEGORIES,
  SITE_CATEGORY_LABELS,
  type HubSiteItem,
  type SiteCategory,
} from "@omnikit/shared";

export function CustomSiteModal({
  open,
  editingSite,
  onClose,
  onSaved,
}: {
  open: boolean;
  editingSite: HubSiteItem | null;
  onClose: () => void;
  onSaved: (site: HubSiteItem, isEdit: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<SiteCategory>("custom");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingSite) {
      setName(editingSite.name);
      setUrl(editingSite.url);
      setCategory(editingSite.category);
      setDescription(editingSite.description);
      setTagsInput(editingSite.tags.join(", "));
    } else {
      setName("");
      setUrl("https://");
      setCategory("custom");
      setDescription("");
      setTagsInput("");
    }
    setErrorMsg(null);
  }, [open, editingSite]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const parsedTags = tagsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);

    try {
      const endpoint = editingSite
        ? `/api/hub/sites/${editingSite.id}`
        : "/api/hub/sites";
      const method = editingSite ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          category,
          description,
          tags: parsedTags,
        }),
      });

      const payload = await res.json();
      if (!payload.ok) {
        setErrorMsg(payload.error?.message || "保存失败，请检查输入内容");
        return;
      }

      onSaved(payload.data as HubSiteItem, Boolean(editingSite));
      onClose();
    } catch {
      setErrorMsg("网络请求异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="custom-site-modal"
      role="dialog"
      aria-modal="true"
      aria-label={editingSite ? "编辑自定义网址" : "添加自定义网址"}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div onClick={onClose} className="fixed inset-0 bg-black/50" />
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "var(--bg-elevated)",
          borderColor: "var(--border-strong)",
          boxShadow: "var(--shadow-flyout)",
        }}
        className="relative z-10 w-full max-w-lg rounded-lg border overflow-hidden"
      >
        <div className="h-12 px-5 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {editingSite ? "编辑自定义网址" : "添加自定义网址"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭窗口"
            className="p-1 rounded hover:bg-[var(--bg-subtle)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div
              id="custom-site-error"
              style={{
                backgroundColor: "var(--danger-bg)",
                borderColor: "var(--danger-border)",
                color: "var(--danger-fg)",
              }}
              className="p-2.5 rounded border"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="site-name-input"
                className="block font-medium mb-1"
              >
                网站名称 *
              </label>
              <input
                id="site-name-input"
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：Rust Crates.io"
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="w-full h-9 px-3 rounded-md border text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="site-category-select"
                className="block font-medium mb-1"
              >
                所属分类 *
              </label>
              <select
                id="site-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as SiteCategory)}
                style={{ backgroundColor: "var(--bg-canvas)" }}
                className="w-full h-9 px-2.5 rounded-md border text-xs"
              >
                {SITE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {SITE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="site-url-input" className="block font-medium mb-1">
              完整访问链接 (仅限 HTTPS / HTTP) *
            </label>
            <input
              id="site-url-input"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://crates.io"
              style={{ backgroundColor: "var(--bg-canvas)" }}
              className="w-full h-9 px-3 rounded-md border font-mono text-xs"
            />
          </div>

          <div>
            <label htmlFor="site-desc-input" className="block font-medium mb-1">
              网站简介说明 *
            </label>
            <textarea
              id="site-desc-input"
              required
              rows={3}
              maxLength={240}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简明描述该网站的主要用途或核心资源..."
              style={{ backgroundColor: "var(--bg-canvas)" }}
              className="w-full p-2.5 rounded-md border text-xs resize-none"
            />
          </div>

          <div>
            <label htmlFor="site-tags-input" className="block font-medium mb-1">
              检索标签（使用逗号分隔，最多 6 个）
            </label>
            <input
              id="site-tags-input"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="例如：Rust, 包管理, 开源库"
              style={{ backgroundColor: "var(--bg-canvas)" }}
              className="w-full h-9 px-3 rounded-md border text-xs"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: "var(--bg-subtle)" }}
            className="h-8 px-3.5 rounded-md border font-medium"
          >
            取消
          </button>
          <button
            type="submit"
            id="site-submit-btn"
            disabled={submitting}
            style={{
              backgroundColor: "var(--accent-primary)",
              color: "var(--accent-foreground)",
            }}
            className="h-8 px-4 rounded-md font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : editingSite ? (
              <Save className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>{editingSite ? "保存修改" : "确认添加"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
