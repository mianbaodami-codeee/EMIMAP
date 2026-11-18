import type { SiteCategory } from "@omnikit/shared";

export interface BuiltinSiteSeed {
  slug: string;
  name: string;
  url: string;
  category: SiteCategory;
  description: string;
  tags: string[];
  isOfficial: boolean;
  verifiedNote: string;
  sortOrder: number;
}

/**
 * 系统预置的 24 个权威站点种子库
 * 前 10 项严格对应项目需求指定的初始必备网站，其余为精选扩展的游戏、开发、AI 与硬件技术官方网站。
 */
export const BUILTIN_SITE_SEEDS: BuiltinSiteSeed[] = [
  // === 需求指定 10 大初始站点 ===
  {
    slug: "steam",
    name: "Steam",
    url: "https://store.steampowered.com",
    category: "gaming",
    description:
      "Valve 旗下全球最大的 PC 数字游戏发行平台，提供正版游戏购买、创意工坊模组、社区评测与云存档服务。",
    tags: ["PC游戏", "数字商店", "Valve", "创意工坊"],
    isOfficial: true,
    verifiedNote: "Valve 官方商店主域名",
    sortOrder: 1,
  },
  {
    slug: "playstation",
    name: "PlayStation",
    url: "https://www.playstation.com",
    category: "gaming",
    description:
      "索尼互动娱乐官方网站，涵盖 PS5 主机生态、PlayStation Store 数字商店、PS Plus 会员服务与第一方游戏资讯。",
    tags: ["主机游戏", "PS5", "Sony", "官方商店"],
    isOfficial: true,
    verifiedNote: "Sony Interactive Entertainment 官方网站",
    sortOrder: 2,
  },
  {
    slug: "xbox",
    name: "Xbox",
    url: "https://www.xbox.com",
    category: "gaming",
    description:
      "微软游戏品牌官方网站，集成 Xbox 主机与 PC Game Pass 订阅库、云游戏及跨平台联机生态。",
    tags: ["主机游戏", "Game Pass", "Microsoft", "PC游戏"],
    isOfficial: true,
    verifiedNote: "Microsoft Xbox 官方网站",
    sortOrder: 3,
  },
  {
    slug: "epic-games",
    name: "Epic Games",
    url: "https://store.epicgames.com",
    category: "gaming",
    description:
      "Epic Games 官方数字游戏商城与虚幻引擎（Unreal Engine）生态入口，定期提供正版限时免费游戏领取。",
    tags: ["PC游戏", "Unreal Engine", "每周限免", "官方商店"],
    isOfficial: true,
    verifiedNote: "Epic Games Store 官方入口",
    sortOrder: 4,
  },
  {
    slug: "github",
    name: "GitHub",
    url: "https://github.com",
    category: "dev",
    description:
      "全球核心开源代码托管与软件协作工程平台，汇聚海量开源仓库、Release 发行包、Actions CI/CD 与安全公告。",
    tags: ["开源托管", "Git", "CI/CD", "Release下载"],
    isOfficial: true,
    verifiedNote: "GitHub 官方主站",
    sortOrder: 5,
  },
  {
    slug: "openai",
    name: "OpenAI",
    url: "https://openai.com",
    category: "ai",
    description:
      "GPT 系列推理与多模态大模型研发机构官网，提供 ChatGPT、API 开发者平台、模型能力技术报告与安全规范。",
    tags: ["LLM", "GPT", "API平台", "AI研究"],
    isOfficial: true,
    verifiedNote: "OpenAI 官方主站",
    sortOrder: 6,
  },
  {
    slug: "google-gemini",
    name: "Google Gemini",
    url: "https://gemini.google.com",
    category: "ai",
    description:
      "Google 原生多模态人工智能助手，支持长上下文文档理解、代码工程分析、多语言推理与实时信息协作。",
    tags: ["多模态AI", "Google", "长上下文", "智能助手"],
    isOfficial: true,
    verifiedNote: "Google Gemini 官方Web端",
    sortOrder: 7,
  },
  {
    slug: "google-developers",
    name: "Google Developers",
    url: "https://developers.google.com",
    category: "platform_docs",
    description:
      "Google 官方开发者门户，提供 Web 平台规范、Chrome DevTools、Cloud、Maps 与 Gemini API 权威技术文档。",
    tags: ["官方文档", "Web标准", "Chrome", "API参考"],
    isOfficial: true,
    verifiedNote: "Google 官方开发者中心",
    sortOrder: 8,
  },
  {
    slug: "microsoft",
    name: "Microsoft",
    url: "https://www.microsoft.com",
    category: "platform_docs",
    description:
      "微软官方网站，提供 Windows 操作系统支持、系统镜像下载、开发工具链、Azure 云平台与硬件驱动服务。",
    tags: ["Windows", "系统官方", "开发者", "驱动与支持"],
    isOfficial: true,
    verifiedNote: "Microsoft 官方主站",
    sortOrder: 9,
  },
  {
    slug: "android-developers",
    name: "Android Developers",
    url: "https://developer.android.com",
    category: "platform_docs",
    description:
      "Android 官方开发者大本营，提供 Android Studio、SDK Platform-Tools (ADB)、Kotlin 指南与硬件兼容性规范。",
    tags: ["Android", "ADB工具", "Kotlin", "官方SDK"],
    isOfficial: true,
    verifiedNote: "Android 官方开发者文档与 Platform-Tools 下载源",
    sortOrder: 10,
  },

  // === 精选扩展站点（覆盖正版游戏、开源工程、AI 平台与硬件/地理设施） ===
  {
    slug: "gog",
    name: "GOG.com",
    url: "https://www.gog.com",
    category: "gaming",
    description:
      "CD PROJEKT 旗下坚持无数字版权加密（DRM-Free）的正版 PC 游戏商店，提供独立离线安装包与经典老游戏兼容维护。",
    tags: ["DRM-Free", "正版离线包", "经典游戏"],
    isOfficial: true,
    verifiedNote: "CD PROJEKT 官方商店",
    sortOrder: 11,
  },
  {
    slug: "nintendo",
    name: "Nintendo",
    url: "https://www.nintendo.com",
    category: "gaming",
    description:
      "任天堂官方网站，涵盖 Nintendo Switch 硬件支持、eShop 数字游戏信息与官方系统更新说明。",
    tags: ["主机游戏", "Switch", "eShop"],
    isOfficial: true,
    verifiedNote: "Nintendo 官方网站",
    sortOrder: 12,
  },
  {
    slug: "steamdb",
    name: "SteamDB",
    url: "https://steamdb.info",
    category: "gaming",
    description:
      "知名第三方 Steam 数据库工具，透明追踪全球各区历史价格波动、在线人数峰值、应用 Depot 更新记录与配置参数。",
    tags: ["价格史低", "在线统计", "版本追踪"],
    isOfficial: false,
    verifiedNote: "公开权威社区数据库（非 Valve 官方）",
    sortOrder: 13,
  },
  {
    slug: "mdn-web-docs",
    name: "MDN Web Docs",
    url: "https://developer.mozilla.org",
    category: "dev",
    description:
      "Mozilla 联合 W3C 及主流浏览器厂商维护的 Web 标准百科全书，涵盖 HTML、CSS、JavaScript、WebGPU 与 WebUSB 接口兼容性。",
    tags: ["Web标准", "API手册", "浏览器兼容"],
    isOfficial: true,
    verifiedNote: "Mozilla 开发者文档官方站",
    sortOrder: 14,
  },
  {
    slug: "rust-lang",
    name: "Rust Programming Language",
    url: "https://www.rust-lang.org",
    category: "dev",
    description:
      "Rust 系统级编程语言官方网站，提供 rustup 工具链安装、Cargo 生态指南与内存安全并发编程标准库文档。",
    tags: ["Rust", "系统编程", "Cargo"],
    isOfficial: true,
    verifiedNote: "Rust Foundation 官方网站",
    sortOrder: 15,
  },
  {
    slug: "tauri",
    name: "Tauri",
    url: "https://v2.tauri.app",
    category: "dev",
    description:
      "基于 Rust 与系统原生 WebView 构建极轻量、高安全跨平台桌面与移动客户端的开源框架官网（「基米大师」底层技术栈）。",
    tags: ["Tauri v2", "桌面客户端", "Rust", "安全权限"],
    isOfficial: true,
    verifiedNote: "Tauri 官方文档站",
    sortOrder: 16,
  },
  {
    slug: "maplibre",
    name: "MapLibre",
    url: "https://maplibre.org",
    category: "dev",
    description:
      "开源 GPU 加速矢量瓦片地图渲染引擎社区官网，支持 WebGL2 与原生移动端高性能地图可视化。",
    tags: ["GIS地图", "WebGL", "开源矢量瓦片"],
    isOfficial: true,
    verifiedNote: "MapLibre Organization 官方网站",
    sortOrder: 17,
  },
  {
    slug: "huggingface",
    name: "Hugging Face",
    url: "https://huggingface.co",
    category: "ai",
    description:
      "全球最大的开源机器学习模型权重、数据集与推理演示协作社区，提供安全 Safetensors 格式模型分发。",
    tags: ["开源模型", "Datasets", "Safetensors"],
    isOfficial: true,
    verifiedNote: "Hugging Face 官方平台",
    sortOrder: 18,
  },
  {
    slug: "google-ai-studio",
    name: "Google AI Studio",
    url: "https://aistudio.google.com",
    category: "ai",
    description:
      "面向开发者的 Gemini 模型快速原型测试与 API Key 管理控制台，支持多模态提示词调试与结构化输出构建。",
    tags: ["Gemini API", "API密钥", "提示词调试"],
    isOfficial: true,
    verifiedNote: "Google 官方 Gemini API 控制台",
    sortOrder: 19,
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    url: "https://www.anthropic.com",
    category: "ai",
    description:
      "人工智能安全与研究公司官网，提供 Claude 系列模型技术文档、MCP 协议规范与开发者工程指南。",
    tags: ["LLM", "MCP协议", "AI安全"],
    isOfficial: true,
    verifiedNote: "Anthropic 官方网站",
    sortOrder: 20,
  },
  {
    slug: "microsoft-learn",
    name: "Microsoft Learn",
    url: "https://learn.microsoft.com",
    category: "platform_docs",
    description:
      "微软官方技术文档中心，提供 PowerShell 命令参考、Win32/WMI 硬件接口文档、winget 包管理器与 Windows 网络排障指南。",
    tags: ["PowerShell", "WMI接口", "Windows运维", "winget"],
    isOfficial: true,
    verifiedNote: "Microsoft 官方技术文档库",
    sortOrder: 21,
  },
  {
    slug: "openstreetmap",
    name: "OpenStreetMap",
    url: "https://www.openstreetmap.org",
    category: "hardware_net",
    description:
      "由全球社区共建、遵循 ODbL 开放许可的自由世界地理数据库，为本平台全球地图提供底层真实地理要素。",
    tags: ["开放地理数据", "ODbL", "全球地图"],
    isOfficial: true,
    verifiedNote: "OpenStreetMap Foundation 官方站",
    sortOrder: 22,
  },
  {
    slug: "cloudflare-radar",
    name: "Cloudflare Radar",
    url: "https://radar.cloudflare.com",
    category: "hardware_net",
    description:
      "全球互联网流量、ASN 自治系统路由状态、DNS 趋势与网络安全态势公开观测中心。",
    tags: ["ASN路由", "网络态势", "BGP", "DNS观测"],
    isOfficial: true,
    verifiedNote: "Cloudflare 官方公开网络观测平台",
    sortOrder: 23,
  },
  {
    slug: "scrcpy-github",
    name: "scrcpy (Genymobile)",
    url: "https://github.com/Genymobile/scrcpy",
    category: "hardware_net",
    description:
      "开源免 Root 高帧率低延迟 Android 屏幕镜像与键鼠控制工具官方仓库（「玩机器」投屏模块核心集成组件）。",
    tags: ["Android投屏", "ADB", "开源工具", "低延迟"],
    isOfficial: true,
    verifiedNote: "Genymobile 官方 GitHub 仓库",
    sortOrder: 24,
  },
];
