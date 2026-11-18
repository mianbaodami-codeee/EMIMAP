/**
 * 全站模块注册表与阶段规划元数据
 * 统一驱动可回缩导航栏、全局命令面板 (Cmd/Ctrl+K)、首页工作台矩阵与阶段架构蓝图页。
 */

export type ModuleDomainGroup = "workspace" | "ai_explore" | "hardware_cross";

export type DeliveryPhase = 1 | 2 | 3 | 4;

export type ModuleStatus = "active" | "planned";

export interface PlatformModuleMeta {
  id: string;
  href: string;
  name: string;
  englishTag: string;
  group: ModuleDomainGroup;
  phase: DeliveryPhase;
  status: ModuleStatus;
  iconName:
    | "LayoutGrid"
    | "Compass"
    | "Globe2"
    | "Sparkles"
    | "Cpu"
    | "ShieldCheck"
    | "Smartphone"
    | "Cable";
  executionBoundary: "Web 全功能" | "Web + 本地客户端协同" | "Windows 原生端核心";
  summary: string;
  webCapabilities: string[];
  nativeCapabilities: string[];
  techStackNotes: string[];
}

export const MODULE_DOMAIN_LABELS: Record<ModuleDomainGroup, string> = {
  workspace: "枢纽与导引",
  ai_explore: "AI 空间与资源",
  hardware_cross: "硬件检测与跨端",
};

export const PLATFORM_MODULES: PlatformModuleMeta[] = [
  {
    id: "overview",
    href: "/",
    name: "平台工作台",
    englishTag: "Console",
    group: "workspace",
    phase: 1,
    status: "active",
    iconName: "LayoutGrid",
    executionBoundary: "Web 全功能",
    summary:
      "全站运行健康遥测、7 大工程模块能力矩阵、数据可信度规范与快捷工具入口。",
    webCapabilities: [
      "PostgreSQL / 缓存 / AI 网关实时健康状态监测",
      "可回缩悬停弹出式导航栏与 Cmd/Ctrl + K 全局命令调板",
      "常用权威站点一键速达与深浅色精密仪器主题切换",
    ],
    nativeCapabilities: ["支持检测本地「基米大师」桥接守护服务在线状态"],
    techStackNotes: ["Next.js App Router", "Tailwind CSS v4", "Drizzle ORM"],
  },
  {
    id: "hub",
    href: "/hub",
    name: "常用网址导引",
    englishTag: "Navigator Hub",
    group: "workspace",
    phase: 1,
    status: "active",
    iconName: "Compass",
    executionBoundary: "Web 全功能",
    summary:
      "覆盖游戏平台、开发社区、大模型与官方技术文档的可搜索、分类、收藏与自定义导航中心。",
    webCapabilities: [
      "预置 Steam、PlayStation、Xbox、Epic、GitHub、OpenAI、Gemini 等 24+ 权威站点",
      "多维度实时搜索、分类过滤、官方来源筛选与星标收藏置顶",
      "支持用户新增/编辑/删除自定义网址及 JSON 书签导入导出",
    ],
    nativeCapabilities: ["桌面客户端共享同一套云端/本地书签Schema"],
    techStackNotes: ["PostgreSQL 持久化", "URL 协议安全校验", "JSON 备份恢复"],
  },
  {
    id: "map",
    href: "/map",
    name: "全球地图与 AI 分析",
    englishTag: "Geo Intelligence",
    group: "ai_explore",
    phase: 2,
    status: "active",
    iconName: "Globe2",
    executionBoundary: "Web 全功能",
    summary:
      "基于 MapLibre 矢量瓦片的全屏全球交互地图，融合精确逆地理编码、周边识别与多源隔离 AI 空间问答。",
    webCapabilities: [
      "全球无级缩放平移、关键词搜索、任意坐标点击拾取与行政区识别",
      "接入 OpenAI / Gemini 支持针对选中地点进行自然语言提问",
      "地点收藏、查询历史、多点对比矩阵与 GeoJSON/Markdown 导出",
    ],
    nativeCapabilities: ["无需安装客户端，浏览器 WebGL2 硬件加速直出"],
    techStackNotes: [
      "MapLibre GL JS (BSD-3)",
      "OpenFreeMap / OSM (ODbL)",
      "Nominatim + Photon + Overpass",
    ],
  },
  {
    id: "discover",
    href: "/discover",
    name: "AI 资源寻找",
    englishTag: "Resource Agent",
    group: "ai_explore",
    phase: 2,
    status: "active",
    iconName: "Sparkles",
    executionBoundary: "Web 全功能",
    summary:
      "自主规划检索步骤的 AI 搜索代理，精准定位正版游戏购买渠道、开源项目、开发工具与权威文档。",
    webCapabilities: [
      "展示「需求拆解 → 多源检索 → 官方性核验 → 综合结论」完整轨迹",
      "输出资源名称、原始链接、版本时间、官方认证依据与安全注意事项",
      "支持多轮追问、来源类型筛选与 SSRF 安全抓取防护",
    ],
    nativeCapabilities: ["严格遵循合法公开访问原则，绝不绕过付费或授权门禁"],
    techStackNotes: ["Unified AI Adapter", "Multi-Source Search Agent", "SafeFetch SSRF Guard"],
  },
  {
    id: "windows-bench",
    href: "/windows-bench",
    name: "Windows 测试",
    englishTag: "Win Benchmark",
    group: "hardware_cross",
    phase: 3,
    status: "active",
    iconName: "Cpu",
    executionBoundary: "Web + 本地客户端协同",
    summary:
      "浏览器 CPU、图形、内存、存储实测，查看历史对比、节点延迟和 CPU 成绩榜。",
    webCapabilities: [
      "Web Worker 单线程和并行计算、WebGL2、内存复制与 OPFS 存储测试",
      "当前站点和已配置区域节点的 HTTP 延迟排名",
      "本机测试历史与同类结果对比，基于一次性挑战的浏览器 CPU 榜单",
    ],
    nativeCapabilities: [
      "使用基米大师读取 CPU 与 GPU 型号、驱动及物理磁盘并执行原生测试",
    ],
    techStackNotes: ["Web Workers + WebGL2", "OPFS", "服务端运算结果校验"],
  },
  {
    id: "jimi-master",
    href: "/jimi-master",
    name: "基米大师",
    englishTag: "Jimi Master",
    group: "hardware_cross",
    phase: 3,
    status: "active",
    iconName: "ShieldCheck",
    executionBoundary: "Windows 原生端核心",
    summary:
      "Windows 原生设备检测与系统管理工具，支持性能实测、网络诊断和受控配置。",
    webCapabilities: [
      "提供 Windows x64 客户端测试包、版本和 SHA-256 校验值",
      "说明设备检测、网络诊断、开发环境检查和本地操作历史",
    ],
    nativeCapabilities: [
      "CIM 硬件信息、IPv4 DNS 与网络适配器配置、开发环境检查与受控 winget 安装",
      "PowerShell/CMD 内置诊断，修改前确认，DNS 快照可恢复，按需请求 UAC",
    ],
    techStackNotes: [".NET 8 WinForms", "Windows CIM / PowerShell", "DNS 快照与回滚"],
  },
  {
    id: "andmore",
    href: "/andmore",
    name: "Andmore",
    englishTag: "Android & IP Lab",
    group: "hardware_cross",
    phase: 4,
    status: "planned",
    iconName: "Smartphone",
    executionBoundary: "Web + 本地客户端协同",
    summary:
      "Android 设备参数检测、屏幕刷新率实测、公网 IP 归属/ASN/代理风险多源循证分析与网络测速中心。",
    webCapabilities: [
      "基于 User-Agent Client Hints 识别真实机型/系统版本，rAF 实测屏幕刷新率",
      "公网 IP、地理归属、ASN 运营商、代理/VPN 特征、DNS 出口与网络延迟速度实测",
      "透明列出各第三方 IP 情报源依据，拒绝伪造绝对纯净度分数",
    ],
    nativeCapabilities: [
      "SoC 详细频率簇、电池健康循环、传感器明细等浏览器受限字段支持客户端扩展读取",
    ],
    techStackNotes: ["UA Client Hints", "Multi-Source IP & ASN Telemetry", "DoH DNS Check"],
  },
  {
    id: "wanjiqi",
    href: "/wanjiqi",
    name: "玩机器",
    englishTag: "Cross-Device Bridge",
    group: "hardware_cross",
    phase: 4,
    status: "planned",
    iconName: "Cable",
    executionBoundary: "Web + 本地客户端协同",
    summary:
      "面向 Windows 与 Android / iPhone / iPad 的跨设备 USB 连接引导、驱动检查、文件互传与投屏协同中心。",
    webCapabilities: [
      "分步骤交互式 USB 连接向导、常见连接故障树诊断与 AI 辅助排查",
      "桌面 Chromium 浏览器可选 WebUSB 设备连接状态预检",
    ],
    nativeCapabilities: [
      "本地客户端执行 ADB 环境配置、Android 设备识别、文件传输与 scrcpy 低延迟投屏",
      "本地检测 Apple Mobile Device 驱动状态，基于 libimobiledevice/AFC 管理受支持文件",
    ],
    techStackNotes: ["Android ADB + scrcpy", "Apple AMDS + libimobiledevice", "一键排障向导"],
  },
];
