# 第一阶段技术调研、设计方向比较与独立审查记录

> **真实性声明**：本文档仅记录第一阶段实际完成的公开官方文档查阅、开源许可证核对、设计方向原型对比及基于无头 Chromium（Playwright）执行的桌面端、移动端与无障碍实测结果，未虚构任何未开展的用户访谈或未执行的外部商业接口压测。

---

## 一、调研来源与核心技术选型依据

### 1.1 实际参考的官方规范与开源文档来源

| 领域 | 调研来源与官方链接 | 核实结论与在本项目中的落点 |
| :--- | :--- | :--- |
| **同构 PostgreSQL 数据层** | ElectricSQL PGlite 官方文档（`https://pglite.dev/docs/about`）与 `node-postgres` / Drizzle ORM 文档 | PGlite 将真实 PostgreSQL 编译为单用户 WASM，与外部 PostgreSQL 17 共享同一套 SQL DDL（`apps/web/drizzle/0000_initial_schema.sql`），实现「生产 Docker 标准 PG + 本地/CI 免守护进程测试」100% 语法一致。 |
| **开源矢量地图许可（阶段二前置选型）** | MapLibre GL JS 仓库许可证（`https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt`）与 Mapbox GL JS v2 闭源变更说明（`https://github.com/mapbox/mapbox-gl-js/issues/10162`）、OSM Nominatim 使用政策（`https://operations.osmfoundation.org/policies/nominatim/`） | Mapbox GL JS 自 v2 起转为专有计费许可；MapLibre GL JS 采用宽松 `BSD-3-Clause` 开源许可且支持 GPU WebGL2 矢量瓦片，适合私有化独立部署；调用 OSM 公共地理编码需携带合规 `User-Agent` 并做服务端缓存限流（已在 `.env.example` 与缓存层预置）。 |
| **跨平台桌面宿主（阶段三/四前置选型）** | Tauri v2 安全与 Capabilities 文档（`https://v2.tauri.app/security/`、`https://v2.tauri.app/security/capabilities/`） | Tauri v2 通过细粒度 Capability 权限清单隔离前端 WebView 与底层 Rust 命令层，安装包体积显著小于 Electron，适合承载「基米大师」与「玩机器」受控本地系统操作。 |
| **大模型连通性与模型核验接口** | OpenAI API Reference — Models List/Retrieve（`https://developers.openai.com/api/reference/resources/models/methods/list`）、Google Gemini API Reference（`https://aistudio.google.com/api-reference`） | OpenAI `GET /v1/models` 返回 `{ data: [{ id }] }` 可同时检查端点鉴权与模型 ID 是否在列（辅以 `GET /v1/models/{model}` 兜底）；Gemini 支持 `GET /v1beta/models/{model}` 配合 `x-goog-api-key` 请求头鉴权，避免将密钥暴露在 URL 查询串中。 |
| **模态抽屉键盘可访问性规范** | W3C WAI-ARIA Authoring Practices Guide (APG) — Dialog (Modal) Pattern（`https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/`）及 WCAG 2.2 AA（SC 1.4.3 / SC 2.1.1 / SC 2.4.3） | 模态抽屉必须具备 `role="dialog"`、`aria-modal="true"`、`aria-labelledby`，打开时自动将焦点移入内部，限制 `Tab`/`Shift+Tab` 在抽屉内部循环，支持 `Escape` 关闭，并在关闭后将焦点还原至原触发控件。 |

### 1.2 核心架构技术选型对比表

| 决策维度 | 选定方案 | 备选方案 A | 备选方案 B | 选型依据总结 |
| :--- | :--- | :--- | :--- | :--- |
| **工程组织** | `pnpm` Workspace Monorepo | 多仓库拆分（Web 与桌面端独立仓库） | 单包扁平目录 | 前后端及后续桌面端需共享统一的 Zod Schema、API 响应信封与模块元数据（`packages/shared`），Monorepo 可消除跨端类型漂移。 |
| **Web 全栈网关** | Next.js App Router (Node.js Runtime) + TypeScript Strict | 纯静态 SPA + 独立 Python/Go 后端 | 纯前端直连第三方 API | 纯前端直连会暴露服务端 API Key 并受跨域限制；Next.js Node Runtime 可在同一工程内提供 SSR 首屏、服务端密钥隔离、SSRF 拦截与流式接口。 |
| **持久化数据库** | PostgreSQL 17 (`pg`) + 嵌入式 `PGlite` 双驱动适配 | SQLite (`better-sqlite3`) | 仅支持外部云托管数据库 | SQLite 与生产 PostgreSQL 存在数据类型与 SQL 方言差异；仅连外部库则无法在无守护进程环境中一键运行完整集成测试。`pg + PGlite` 兼顾生产可靠性与开发可测性。 |
| **缓存与速率限制** | Redis 7 (`ioredis`) + 进程内 TTL-LRU 自动降级 | 强依赖外部 Redis | 无缓存与限流层 | 生产多实例通过 Redis 共享缓存与窗口计数；单机开发或尚未挂载 Redis 时自动降级为内存 LRU，避免启动阻塞。 |

---

## 二、三种视觉设计方向比较与选型决策

项目涵盖平台工作台、常用网址导引、全球交互地图、AI 资源寻找、Windows 硬件跑分、基米大师、Andmore 与玩机器共七大业务板块。第一阶段围绕「现代简洁、高可读性、避免浮夸渐变与毛玻璃堆砌」评估了以下三种设计方向：

| 对比维度 | 方向 A：精密仪器台（Precision Instrument）【选定】 | 方向 B：极客终端台（Terminal Telemetry） | 方向 C：现代编辑部卡片流（Editorial Modular） |
| :--- | :--- | :--- | :--- |
| **视觉隐喻与参考** | 现代工程控制台（参考 Linear、Vercel Geist、Cloudflare Radar 的结构线布局） | 命令行与硬件监控屏（参考 HWiNFO、Grafana 纯黑高密终端） | 内容阅读与消费级卡片门户（参考大留白圆角卡片流） |
| **色彩与表面层级** | 中性灰白/深岩蓝分层表面 + 单一工业青蓝主强调色 + 四类语义状态徽章，深浅双主题均衡 | 纯黑背景 + 高饱和荧光绿/琥珀字，浅色模式对比生硬 | 暖白背景 + 大面积柔和投影卡片，缺乏严谨工程感 |
| **字体排印策略** | 正文采用 `Inter` + `Noto Sans SC` 保障中文阅读舒适度；坐标、延迟、跑分、版本号强制采用等宽字体 + `tabular-nums` | 全局大量使用等宽字体，长段 AI 分析与排障说明阅读易疲劳 | 偏重标题装饰与宽松行距，多列硬件参数与排行榜纵向对齐差 |
| **边框与空间效率** | `1px` 低对比度实线分割替代厚重阴影与毛玻璃，配合 `60px ↔ 260px` 悬停弹出侧栏最大化画布视野 | 密集网格线框，视觉压迫感强，对网址导航等日常高频入口不够友好 | 大圆角与宽外边距占用大量视口，在地图叠层与多维筛选场景下有效信息面积不足 |
| **跨模块适配度** | **高**：可同时承载高密度参数表、全屏地图画布、流式检索卡片与网址网格 | **偏窄**：仅适合硬件监控，不适合地图浏览与通用导引 | **偏窄**：适合静态文章阅读，不适合专业诊断与多条件检索工具 |

### 选择「方向 A：精密仪器台」的核心原因

1. **跨异构模块的统一骨架能力**：同一套 `1px` 结构线容器与紧凑顶栏既能服务第一阶段的 24+ 网址分类导引，也能在后续阶段无缝衔接全屏地图侧边卡与硬件检测表格，避免多板块拼凑割裂感。
2. **数据真实性的视觉表达**：通过语义化的 `ProvenanceBadge`（实测数据 / 公开核验信源 / AI 综合推断 / 原生客户端专属）配合「图标 + 文字 + 颜色」三重编码，从界面层杜绝将 AI 推断或浏览器受限值误导为实测硬件数据。
3. **主画布空间零抖动最大化**：左侧导航栏默认回缩为 `60px` 紧凑图标轨，桌面端鼠标悬停时以 `260px` 浮层平滑展开且不挤压主内容区宽度（`Zero Layout Shift`），契合地图与工程工作台对大视野的需求。
4. **深色与浅色双主题同等可用**：不依赖暗色背景发光特效，户外或明亮办公环境下切换浅色主题依然具备高对比度清晰层级。

---

## 三、桌面端、移动端与可访问性独立审查记录

### 3.1 桌面端视口审查记录（Chromium `1440×900` 实测）

- **悬停可回缩侧边栏行为**：默认加载宽度实测为 `60px`（`data-expanded="false"`）；鼠标移入后宽度平滑过渡至 `260px`（`data-expanded="true"`），右侧布局占位槽保持 `60px` 不触发主内容重排；鼠标移出至主画布后自动回缩回 `60px`；点击右上角固定按钮可常驻锁定 `260px` 并持久化至 `localStorage`。
- **布局溢出与信息密度**：首页工作台、`/hub` 常用网址导引（三列网格）及 `/map` 等阶段占位页均通过 `document.documentElement.scrollWidth <= clientWidth + 1` 无水平溢出断言。
- **双主题切换**：顶栏切换深色/浅色主题时通过临时挂载 `html.theme-switching` 禁用过渡闪烁，卡片、边框与徽章即时同步。

### 3.2 移动端视口审查记录（Chromium Pixel 7 `390×844` 实测）

- **单手抽屉导航转换**：`< 768px` 视口下自动隐藏桌面 `60px` 固定侧轨，由顶栏左上角 `#mobile-menu-trigger` 唤起模态抽屉 `#mobile-nav-drawer`（最大宽度 `85vw`），点击导航项路由跳转后自动收起抽屉。
- **响应式防挤压检查**：`/hub` 搜索框、收藏/官方源过滤按钮与分类胶囊自动换行排布，网址卡片转为单列纵向流式布局，实测 `scrollWidth <= clientWidth + 1` 无横向滚动条溢出。

### 3.3 可访问性（WCAG 2.2 AA 与键盘操作）审查及整改闭环记录

#### （1）双主题文本与交互控件对比度实测（基于 `apps/web/src/app/globals.css` 相对亮度公式核算）

在独立审查中对深/浅双主题核心语义色进行了 WCAG 2.2 相对亮度对比度核算，并针对两处临界值完成了调优：

| 颜色组合场景 | 整改前色值与对比度 | 整改后色值与实测对比度 | WCAG 2.2 AA 判定（正文 `>= 4.5:1`） |
| :--- | :--- | :--- | :---: |
| 浅色主文本 `--fg-primary` / `--bg-surface` | `#0f172a` / `#ffffff` (`17.85:1`) | `#0f172a` / `#ffffff` (**`17.85:1`**) | 通过（AAA） |
| 浅色次级文本 `--fg-secondary` / `--bg-surface` | `#475569` / `#ffffff` (`7.58:1`) | `#475569` / `#ffffff` (**`7.58:1`**) | 通过（AAA） |
| 浅色辅助文本 `--fg-muted` / `--bg-surface` | `#64748b` / `#ffffff` (`4.76:1`) | `#64748b` / `#ffffff` (**`4.76:1`**) | 通过（AA） |
| **浅色主按钮 `--accent-foreground` / `--accent-primary`** | `#ffffff` / `#0284c7` (`4.10:1`，`12px` 小字略低于 `4.5:1`) | `#ffffff` / `#0369a1` (**`5.93:1`**) | **整改后通过（AA）** |
| 深色主文本 `--fg-primary` / `--bg-surface` | `#f1f5f9` / `#0f1623` (`16.53:1`) | `#f1f5f9` / `#0f1623` (**`16.53:1`**) | 通过（AAA） |
| 深色次级文本 `--fg-secondary` / `--bg-surface` | `#94a3b8` / `#0f1623` (`7.06:1`) | `#94a3b8` / `#0f1623` (**`7.06:1`**) | 通过（AAA） |
| **深色辅助文本 `--fg-muted` / `--bg-surface`** | `#64748b` / `#0f1623` (`3.81:1`，偏暗) | `#8395ad` / `#0f1623` (**`5.93:1`**，在 `--bg-subtle` `#1a2436` 上亦达 **`5.09:1`**) | **整改后通过（AA）** |
| 深色主按钮 `--accent-foreground` / `--accent-primary` | `#082f49` / `#38bdf8` (`6.48:1`) | `#082f49` / `#38bdf8` (**`6.48:1`**) | 通过（AA） |

#### （2）模态抽屉键盘可访问性审查与整改记录

- **初版遗留缺陷（提交 `364036b` 审核发现）**：`AISettingsDrawer` 虽声明了 `role="dialog"` 与 `aria-modal="true"`，但打开时未主动转移键盘焦点、未拦截 `Tab`/`Shift+Tab` 防止逃逸至背景页面、未绑定 `Escape` 关闭快捷键，且关闭后未将焦点归还至触发按钮。
- **整改措施（对照 W3C APG Dialog Modal 规范落地）**：
  1. 在 `AppProviders.setAiDrawerOpen(true)` 触发瞬间同步记录当前激活入口元素（如 `#header-ai-trigger` 或 `#sidebar-settings-btn`）；
  2. 抽屉挂载时立即将焦点移入 `#ai-drawer-close` 并锁定背景滚动，补充 `aria-labelledby="ai-drawer-title"`；
  3. 通过捕获阶段键盘监听与 `focusin` 守卫实现 `Tab` 正向与 `Shift+Tab` 反向内部循环焦点陷阱；
  4. 支持 `Escape` 一键关闭抽屉，并在抽屉卸载后自动将焦点精确恢复至原入口按钮（若原入口所在浮层已卸载则安全回退至顶栏入口）；
  5. 已在 `apps/web/tests/e2e/phase1.spec.ts` 中新增桌面端与移动端真实浏览器键盘回归测试覆盖上述完整链路。

#### （3）非颜色单一编码与动态减弱支持

- 全站状态徽章均包含图形符号/图标与明确中文标签，不依赖单一红绿颜色区分状态。
- `globals.css` 已内置 `:focus-visible` `2px` 高对比度焦点外框及 `@media (prefers-reduced-motion: reduce)` 动画降级规则。
