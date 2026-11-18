import React from "react";

export interface SiteBrandSpec {
  key: string;
  gradient: string;
  accentHex: string;
  renderGlyph: (cls: string) => React.ReactNode;
}

function resolveBrandKey(slug?: string, domain?: string): string {
  const s = (slug || "").toLowerCase().trim();
  if (s && BRAND_SPECS[s]) return s;

  const d = (domain || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");

  if (!d) return s || "custom";
  if (d.includes("steampowered.com") || d === "steamcommunity.com") return "steam";
  if (d.includes("steamdb.info")) return "steamdb";
  if (d.includes("playstation.com")) return "playstation";
  if (d.includes("xbox.com")) return "xbox";
  if (d.includes("epicgames.com") || d.includes("unrealengine.com")) return "epic-games";
  if (d.includes("gog.com")) return "gog";
  if (d.includes("nintendo.com")) return "nintendo";
  if (d === "github.com" && s.includes("scrcpy")) return "scrcpy-github";
  if (d.includes("github.com") || d.includes("githubusercontent.com")) return "github";
  if (d.includes("openai.com") || d.includes("chatgpt.com")) return "openai";
  if (d.includes("aistudio.google.com")) return "google-ai-studio";
  if (d.includes("gemini.google.com")) return "google-gemini";
  if (d.includes("developers.google.com") || d.includes("web.dev")) return "google-developers";
  if (d.includes("developer.android.com") || d.includes("android.com")) return "android-developers";
  if (d.includes("learn.microsoft.com")) return "microsoft-learn";
  if (d.includes("microsoft.com") || d.includes("visualstudio.com")) return "microsoft";
  if (d.includes("mozilla.org")) return "mdn-web-docs";
  if (d.includes("rust-lang.org") || d.includes("crates.io")) return "rust-lang";
  if (d.includes("tauri.app")) return "tauri";
  if (d.includes("maplibre.org")) return "maplibre";
  if (d.includes("huggingface.co")) return "huggingface";
  if (d.includes("anthropic.com") || d.includes("claude.ai")) return "anthropic";
  if (d.includes("openstreetmap.org") || d.includes("openfreemap.org")) return "openstreetmap";
  if (d.includes("cloudflare.com")) return "cloudflare-radar";
  if (d.includes("npmjs.com")) return "npm";
  if (d.includes("wikipedia.org") || d.includes("wikidata.org")) return "wikipedia";
  if (d.includes("playwright.dev")) return "playwright";
  if (d.includes("docker.com")) return "docker";
  if (d.includes("python.org") || d.includes("pypi.org")) return "python";
  if (d.includes("nodejs.org")) return "nodejs";
  return d;
}

const BRAND_SPECS: Record<string, SiteBrandSpec> = {
  steam: {
    key: "steam",
    gradient:
      "radial-gradient(circle at 82% 18%, rgba(102,192,244,0.42), transparent 58%), linear-gradient(135deg, #0b172a 0%, #1b2838 52%, #2a475e 100%)",
    accentHex: "#1b4f72",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <circle cx="15.5" cy="8.5" r="3.6" stroke="#ffffff" strokeWidth="1.9" />
        <circle cx="15.5" cy="8.5" r="1.4" fill="#66c0f4" />
        <circle cx="8.2" cy="16.2" r="2.7" stroke="#ffffff" strokeWidth="1.8" />
        <path
          d="M13.2 11.2L9.9 14.5M3.5 13.8L6.8 15.4"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  playstation: {
    key: "playstation",
    gradient:
      "radial-gradient(circle at 80% 15%, rgba(96,165,250,0.38), transparent 55%), linear-gradient(135deg, #00246b 0%, #00439c 54%, #0070d1 100%)",
    accentHex: "#00439c",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M10.5 4.8V19.2M10.5 5.2C14.2 5.2 16.5 6.8 16.5 9.3C16.5 11.7 14.4 13 10.5 12.6"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.2 16.8C6.8 15.8 8.7 15.7 10.2 16.3M13.6 17.5C15.5 18.2 17.8 18 19.2 16.9"
          stroke="#93c5fd"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  xbox: {
    key: "xbox",
    gradient:
      "radial-gradient(circle at 78% 18%, rgba(134,239,172,0.35), transparent 56%), linear-gradient(135deg, #0b4f14 0%, #107c10 55%, #22c55e 100%)",
    accentHex: "#107c10",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" stroke="#ffffff" strokeWidth="1.8" />
        <path
          d="M7.6 6.8C10.4 9.1 13.6 12.6 16.2 17.1M16.4 6.8C13.6 9.1 10.4 12.6 7.8 17.1"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  "epic-games": {
    key: "epic-games",
    gradient:
      "radial-gradient(circle at 80% 15%, rgba(255,255,255,0.2), transparent 55%), linear-gradient(135deg, #111318 0%, #232730 58%, #3b4252 100%)",
    accentHex: "#27272a",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M6.5 4.8H17.5V14.8L12 19.4L6.5 14.8V4.8Z"
          stroke="#ffffff"
          strokeWidth="1.85"
          strokeLinejoin="round"
        />
        <path
          d="M9.7 8.5H14.3M9.7 11.4H13.5M9.7 8.5V14.2H14.3"
          stroke="#e2e8f0"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  github: {
    key: "github",
    gradient:
      "radial-gradient(circle at 80% 18%, rgba(148,163,184,0.28), transparent 58%), linear-gradient(135deg, #0d1117 0%, #1f2937 56%, #334155 100%)",
    accentHex: "#1f2937",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls} aria-hidden="true">
        <path
          fill="#ffffff"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 3.2a8.8 8.8 0 00-2.78 17.15c.44.08.6-.19.6-.42v-1.5c-2.44.53-2.96-1.05-2.96-1.05-.4-1-.98-1.27-.98-1.27-.8-.55.06-.54.06-.54.88.06 1.35.9 1.35.9.78 1.34 2.05.95 2.55.73.08-.57.31-.95.56-1.17-1.95-.22-4-.98-4-4.35 0-.96.34-1.75.9-2.36-.09-.22-.39-1.12.09-2.33 0 0 .74-.24 2.42.9a8.4 8.4 0 014.4 0c1.68-1.14 2.42-.9 2.42-.9.48 1.21.18 2.11.09 2.33.56.61.9 1.4.9 2.36 0 3.38-2.06 4.12-4.02 4.34.32.27.6.81.6 1.64v2.43c0 .23.16.5.61.42A8.8 8.8 0 0012 3.2z"
        />
      </svg>
    ),
  },
  openai: {
    key: "openai",
    gradient:
      "radial-gradient(circle at 80% 16%, rgba(110,231,183,0.36), transparent 56%), linear-gradient(135deg, #064e3b 0%, #0d9488 54%, #10a37f 100%)",
    accentHex: "#0d9488",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <polygon
          points="12,4.2 18.7,8.1 18.7,15.9 12,19.8 5.3,15.9 5.3,8.1"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <polygon
          points="12,8.1 15.4,10.1 15.4,13.9 12,15.9 8.6,13.9 8.6,10.1"
          stroke="#a7f3d0"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  "google-gemini": {
    key: "google-gemini",
    gradient:
      "radial-gradient(circle at 82% 18%, rgba(125,211,252,0.45), transparent 58%), linear-gradient(135deg, #1d4ed8 0%, #2563eb 48%, #06b6d4 100%)",
    accentHex: "#2563eb",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M12 3.4C12.6 8.2 15.8 11.4 20.6 12C15.8 12.6 12.6 15.8 12 20.6C11.4 15.8 8.2 12.6 3.4 12C8.2 11.4 11.4 8.2 12 3.4Z"
          fill="#ffffff"
        />
      </svg>
    ),
  },
  "google-developers": {
    key: "google-developers",
    gradient:
      "linear-gradient(135deg, #1a73e8 0%, #0284c7 52%, #0d9488 100%)",
    accentHex: "#0284c7",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M8.8 8.2L4.6 12L8.8 15.8M15.2 8.2L19.4 12L15.2 15.8M13.2 6.8L10.8 17.2"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  microsoft: {
    key: "microsoft",
    gradient:
      "radial-gradient(circle at 80% 18%, rgba(56,189,248,0.25), transparent 58%), linear-gradient(135deg, #0f172a 0%, #1e293b 58%, #334155 100%)",
    accentHex: "#0284c7",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <rect x="5" y="5" width="6.2" height="6.2" rx="1" fill="#f25022" />
        <rect x="12.8" y="5" width="6.2" height="6.2" rx="1" fill="#7fba00" />
        <rect x="5" y="12.8" width="6.2" height="6.2" rx="1" fill="#00a4ef" />
        <rect x="12.8" y="12.8" width="6.2" height="6.2" rx="1" fill="#ffb900" />
      </svg>
    ),
  },
  "android-developers": {
    key: "android-developers",
    gradient:
      "radial-gradient(circle at 80% 18%, rgba(167,243,208,0.38), transparent 56%), linear-gradient(135deg, #047857 0%, #059669 52%, #10b981 100%)",
    accentHex: "#059669",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M5.5 15.8C5.5 11.9 8.4 9 12 9C15.6 9 18.5 11.9 18.5 15.8V17H5.5V15.8Z"
          stroke="#ffffff"
          strokeWidth="1.85"
          strokeLinejoin="round"
        />
        <path
          d="M8.2 9.4L6.4 6.5M15.8 9.4L17.6 6.5"
          stroke="#ffffff"
          strokeWidth="1.85"
          strokeLinecap="round"
        />
        <circle cx="9.6" cy="13.4" r="1" fill="#ffffff" />
        <circle cx="14.4" cy="13.4" r="1" fill="#ffffff" />
      </svg>
    ),
  },
  gog: {
    key: "gog",
    gradient:
      "linear-gradient(135deg, #3b0764 0%, #6d28d9 52%, #be185d 100%)",
    accentHex: "#7e22ce",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <rect
          x="5.2"
          y="5.2"
          width="13.6"
          height="13.6"
          rx="3.4"
          stroke="#ffffff"
          strokeWidth="1.85"
        />
        <circle cx="12" cy="12" r="3.1" stroke="#fbcfe8" strokeWidth="1.8" />
      </svg>
    ),
  },
  nintendo: {
    key: "nintendo",
    gradient:
      "radial-gradient(circle at 80% 18%, rgba(254,202,202,0.34), transparent 55%), linear-gradient(135deg, #991b1b 0%, #dc2626 52%, #ef4444 100%)",
    accentHex: "#dc2626",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <rect
          x="5"
          y="5.5"
          width="5.8"
          height="13"
          rx="2.8"
          stroke="#ffffff"
          strokeWidth="1.85"
        />
        <rect
          x="13.2"
          y="5.5"
          width="5.8"
          height="13"
          rx="2.8"
          fill="#ffffff"
        />
        <circle cx="7.9" cy="9.5" r="1.1" fill="#ffffff" />
        <circle cx="16.1" cy="13.8" r="1.2" fill="#dc2626" />
      </svg>
    ),
  },
  steamdb: {
    key: "steamdb",
    gradient:
      "linear-gradient(135deg, #0f172a 0%, #155e75 55%, #0891b2 100%)",
    accentHex: "#0891b2",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <ellipse cx="12" cy="6.8" rx="6.2" ry="2.5" stroke="#ffffff" strokeWidth="1.8" />
        <path
          d="M5.8 6.8V16.8C5.8 18.2 8.6 19.3 12 19.3C15.4 19.3 18.2 18.2 18.2 16.8V6.8"
          stroke="#ffffff"
          strokeWidth="1.8"
        />
        <path
          d="M5.8 11.8C5.8 13.2 8.6 14.3 12 14.3C15.4 14.3 18.2 13.2 18.2 11.8"
          stroke="#67e8f9"
          strokeWidth="1.7"
        />
      </svg>
    ),
  },
  "mdn-web-docs": {
    key: "mdn-web-docs",
    gradient:
      "linear-gradient(135deg, #0f172a 0%, #1e3a8a 52%, #0284c7 100%)",
    accentHex: "#1d4ed8",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M5.2 16.5V7.5L9.2 13.2L13.2 7.5V16.5M15.8 16.5H19.4"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  "rust-lang": {
    key: "rust-lang",
    gradient:
      "radial-gradient(circle at 80% 18%, rgba(253,186,116,0.34), transparent 56%), linear-gradient(135deg, #7c2d12 0%, #c2410c 54%, #ea580c 100%)",
    accentHex: "#c2410c",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="6.6"
          stroke="#ffffff"
          strokeWidth="1.9"
          strokeDasharray="2.4 1.6"
        />
        <path
          d="M9.6 15V9.2H12.7C13.9 9.2 14.6 9.9 14.6 10.9C14.6 11.9 13.9 12.5 12.7 12.5H9.6M12.5 12.5L14.8 15"
          stroke="#ffffff"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  tauri: {
    key: "tauri",
    gradient:
      "linear-gradient(135deg, #0f766e 0%, #0284c7 54%, #eab308 100%)",
    accentHex: "#0284c7",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <circle cx="10" cy="10.5" r="4.6" stroke="#ffffff" strokeWidth="1.85" />
        <circle cx="14" cy="13.5" r="4.6" stroke="#fef08a" strokeWidth="1.85" />
      </svg>
    ),
  },
  maplibre: {
    key: "maplibre",
    gradient:
      "linear-gradient(135deg, #1e3a8a 0%, #2563eb 52%, #14b8a6 100%)",
    accentHex: "#2563eb",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M12 20C12 20 17.5 14.8 17.5 10.2C17.5 7.1 15 4.6 12 4.6C9 4.6 6.5 7.1 6.5 10.2C6.5 14.8 12 20 12 20Z"
          stroke="#ffffff"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10.2" r="2.2" fill="#99f6e4" />
      </svg>
    ),
  },
  huggingface: {
    key: "huggingface",
    gradient:
      "linear-gradient(135deg, #b45309 0%, #d97706 48%, #f59e0b 100%)",
    accentHex: "#d97706",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <circle cx="12" cy="12" r="7.4" stroke="#ffffff" strokeWidth="1.85" />
        <circle cx="9.5" cy="10.4" r="1.1" fill="#ffffff" />
        <circle cx="14.5" cy="10.4" r="1.1" fill="#ffffff" />
        <path
          d="M8.8 13.8C9.6 15.2 11 15.9 12 15.9C13 15.9 14.4 15.2 15.2 13.8"
          stroke="#ffffff"
          strokeWidth="1.85"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  "google-ai-studio": {
    key: "google-ai-studio",
    gradient:
      "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 52%, #38bdf8 100%)",
    accentHex: "#1d4ed8",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <rect
          x="4.8"
          y="5.2"
          width="14.4"
          height="13.6"
          rx="2.8"
          stroke="#ffffff"
          strokeWidth="1.8"
        />
        <path
          d="M12 8.2L13.2 10.8L15.8 12L13.2 13.2L12 15.8L10.8 13.2L8.2 12L10.8 10.8L12 8.2Z"
          fill="#bae6fd"
        />
      </svg>
    ),
  },
  anthropic: {
    key: "anthropic",
    gradient:
      "linear-gradient(135deg, #7c2d12 0%, #9a3412 52%, #d97706 100%)",
    accentHex: "#b45309",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M6.2 17.6L10.4 6.4L14.6 17.6M7.6 14.2H13.2M15.2 6.4L18.6 17.6"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  "microsoft-learn": {
    key: "microsoft-learn",
    gradient:
      "linear-gradient(135deg, #0c4a6e 0%, #0284c7 54%, #38bdf8 100%)",
    accentHex: "#0284c7",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M5 6.8C7.4 6.2 9.8 6.6 12 7.8C14.2 6.6 16.6 6.2 19 6.8V17.4C16.6 16.8 14.2 17.2 12 18.4C9.8 17.2 7.4 16.8 5 17.4V6.8Z"
          stroke="#ffffff"
          strokeWidth="1.85"
          strokeLinejoin="round"
        />
        <path d="M12 7.8V18.4" stroke="#bae6fd" strokeWidth="1.7" />
      </svg>
    ),
  },
  openstreetmap: {
    key: "openstreetmap",
    gradient:
      "linear-gradient(135deg, #065f46 0%, #059669 52%, #34d399 100%)",
    accentHex: "#059669",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <circle cx="11" cy="11" r="5.5" stroke="#ffffff" strokeWidth="1.9" />
        <path
          d="M15.2 15.2L19 19M8.2 11H13.8M11 8.2V13.8"
          stroke="#ffffff"
          strokeWidth="1.85"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  "cloudflare-radar": {
    key: "cloudflare-radar",
    gradient:
      "linear-gradient(135deg, #9a3412 0%, #ea580c 52%, #fb923c 100%)",
    accentHex: "#ea580c",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <circle cx="12" cy="12" r="7.4" stroke="#ffffff" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.6" stroke="#fed7aa" strokeWidth="1.6" />
        <path
          d="M12 12L17.2 6.8"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  "scrcpy-github": {
    key: "scrcpy-github",
    gradient:
      "linear-gradient(135deg, #115e59 0%, #0d9488 52%, #2dd4bf 100%)",
    accentHex: "#0d9488",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <rect
          x="7.2"
          y="4.4"
          width="9.6"
          height="15.2"
          rx="2.2"
          stroke="#ffffff"
          strokeWidth="1.85"
        />
        <path
          d="M10.4 16.8H13.6M10 9.6L14 12L10 14.4V9.6Z"
          stroke="#ccfbf1"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  npm: {
    key: "npm",
    gradient: "linear-gradient(135deg, #991b1b 0%, #cb3837 55%, #ef4444 100%)",
    accentHex: "#cb3837",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <rect x="5" y="7" width="14" height="10" rx="1.5" stroke="#ffffff" strokeWidth="1.9" />
        <path d="M9.5 17V10.5H12.5V17" stroke="#ffffff" strokeWidth="1.9" />
      </svg>
    ),
  },
  wikipedia: {
    key: "wikipedia",
    gradient: "linear-gradient(135deg, #1e293b 0%, #334155 55%, #475569 100%)",
    accentHex: "#334155",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M5 7.5L8.4 16.8L12 9.4L15.6 16.8L19 7.5"
          stroke="#ffffff"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  playwright: {
    key: "playwright",
    gradient: "linear-gradient(135deg, #14532d 0%, #16a34a 55%, #dc2626 100%)",
    accentHex: "#16a34a",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M6.5 6.5H17.5V13.2C17.5 16.4 15 18.8 12 18.8C9 18.8 6.5 16.4 6.5 13.2V6.5Z"
          stroke="#ffffff"
          strokeWidth="1.85"
        />
        <path d="M9.2 11.2H10.8M13.2 11.2H14.8" stroke="#ffffff" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
  docker: {
    key: "docker",
    gradient: "linear-gradient(135deg, #0369a1 0%, #0284c7 55%, #38bdf8 100%)",
    accentHex: "#0284c7",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M4.8 13.2H18.5C18.2 16.6 15.4 18.4 11.4 18.4C7.6 18.4 5.2 16.5 4.8 13.2Z"
          stroke="#ffffff"
          strokeWidth="1.8"
        />
        <rect x="7" y="9.4" width="2.5" height="2.5" fill="#ffffff" />
        <rect x="10.3" y="9.4" width="2.5" height="2.5" fill="#ffffff" />
        <rect x="10.3" y="6.3" width="2.5" height="2.5" fill="#bae6fd" />
        <rect x="13.6" y="9.4" width="2.5" height="2.5" fill="#ffffff" />
      </svg>
    ),
  },
  python: {
    key: "python",
    gradient: "linear-gradient(135deg, #1d4ed8 0%, #0284c7 54%, #eab308 100%)",
    accentHex: "#2563eb",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <path
          d="M9 6.2H14C15.4 6.2 16.4 7.2 16.4 8.6V11.5H9.6C8 11.5 6.8 12.7 6.8 14.2V15.4M15 17.8H10C8.6 17.8 7.6 16.8 7.6 15.4V12.5H14.4C16 12.5 17.2 11.3 17.2 9.8V8.6"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  nodejs: {
    key: "nodejs",
    gradient: "linear-gradient(135deg, #14532d 0%, #15803d 55%, #22c55e 100%)",
    accentHex: "#15803d",
    renderGlyph: (cls) => (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden="true">
        <polygon
          points="12,4.6 18.4,8.3 18.4,15.7 12,19.4 5.6,15.7 5.6,8.3"
          stroke="#ffffff"
          strokeWidth="1.85"
          strokeLinejoin="round"
        />
        <path d="M10 14.5V9.5L14 14.5V9.5" stroke="#bbf7d0" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

const FALLBACK_PALETTES = [
  {
    gradient: "linear-gradient(135deg, #0f4c81 0%, #0284c7 58%, #38bdf8 100%)",
    accentHex: "#0284c7",
  },
  {
    gradient: "linear-gradient(135deg, #065f46 0%, #0d9488 58%, #2dd4bf 100%)",
    accentHex: "#0d9488",
  },
  {
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 58%, #60a5fa 100%)",
    accentHex: "#2563eb",
  },
  {
    gradient: "linear-gradient(135deg, #7c2d12 0%, #c2410c 58%, #fb923c 100%)",
    accentHex: "#c2410c",
  },
  {
    gradient: "linear-gradient(135deg, #1f2937 0%, #334155 58%, #64748b 100%)",
    accentHex: "#334155",
  },
];

function hashSeed(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function resolveSiteBrandAppearance(params: {
  slug?: string;
  domain?: string;
  name: string;
}): {
  brandKey: string;
  gradient: string;
  accentHex: string;
  spec: SiteBrandSpec | null;
} {
  const key = resolveBrandKey(params.slug, params.domain);
  const spec = BRAND_SPECS[key] ?? null;
  if (spec) {
    return {
      brandKey: spec.key,
      gradient: spec.gradient,
      accentHex: spec.accentHex,
      spec,
    };
  }
  const palette =
    FALLBACK_PALETTES[
      hashSeed(`${params.domain || ""}:${params.name}`) %
        FALLBACK_PALETTES.length
    ]!;
  return {
    brandKey: "custom",
    gradient: palette.gradient,
    accentHex: palette.accentHex,
    spec: null,
  };
}

export function SiteBrandMark({
  slug,
  domain,
  name,
  size = "md",
  className = "",
}: {
  slug?: string;
  domain?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { brandKey, gradient, spec } = resolveSiteBrandAppearance({
    slug,
    domain,
    name,
  });

  const boxClass =
    size === "sm"
      ? "w-7 h-7 rounded-lg"
      : size === "lg"
        ? "w-11 h-11 rounded-xl"
        : "w-10 h-10 rounded-xl";
  const iconClass =
    size === "sm"
      ? "w-4 h-4"
      : size === "lg"
        ? "w-6 h-6"
        : "w-5 h-5";

  const monogram =
    name
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "")
      .slice(0, 2)
      .toUpperCase() || "OK";

  return (
    <span
      data-brand-mark={brandKey}
      style={{
        backgroundImage: gradient,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.26), 0 4px 10px -3px rgba(15,23,42,0.24)",
      }}
      className={`${boxClass} relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none transition-transform duration-200 group-hover:scale-[1.04] ${className}`}
    >
      {spec ? (
        spec.renderGlyph(iconClass)
      ) : (
        <span className="font-mono text-[11px] font-bold tracking-tight text-white">
          {monogram}
        </span>
      )}
    </span>
  );
}
