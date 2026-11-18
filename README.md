# OmniKit AI

AI 驱动的综合性跨平台工程与硬件工具网站。本项目采用长期软件工程标准建设，严格区分**真实地理/硬件实测数据**、**公开联网核验信源**、**AI 模型综合推理**与**原生客户端专属系统能力**。

---

## 一、核心模块与五阶段演进状态

| 模块名称 | 路由 | 执行边界 | 计划阶段 | 当前状态 |
| :--- | :--- | :--- | :---: | :--- |
| **平台工作台** | `/` | Web 全功能 | 第一阶段 | **已完成** |
| **常用网址导引** | `/hub` | Web 全功能 | 第一阶段 | **已完成** |
| **全球地图与 AI 分析** | `/map` | MapLibre、OSM 与统一模型接口 | 第二阶段 | 界面验收通过，外部调用待验证 |
| **AI 资源寻找** | `/discover` | 内置索引、公开接口与模型综述 | 第二阶段 | 界面验收通过，外部调用待验证 |
| **Windows 测试** | `/windows-bench` | 浏览器实测与 Windows 原生测试 | 第三阶段 | 浏览器已验证，原生待验收 |
| **基米大师** | `/jimi-master` | Windows x64 原生客户端（.NET 8 WinForms） | 第三阶段 | 测试包已构建，待 Windows 真机验证 |
| **Andmore** | `/andmore` | Web + 移动端协同检测 | 第四阶段 | 待进入第四阶段实施 |
| **玩机器** | `/wanjiqi` | Windows + Android/iOS 连接协同 | 第四阶段 | 待进入第四阶段实施 |

第二阶段界面验收覆盖地图选点、搜索、收藏、对比及导出，资源检索界面与来源展示，以及网址卡片的品牌渐变与 Logo。按当前交付范围，OpenAI、Gemini 与外部检索的实调留到最后。完整服务使用 `Admin` 登录后查看管理面板，服务器配置见 [部署手册](./deploy/README.md)。

---

## 二、技术栈与仓库目录结构

- **工程管理**：`pnpm` Workspace Monorepo + TypeScript (Strict)
- **Web 全栈框架**：Next.js (App Router, Node.js Runtime) + React 19
- **设计系统**：方向 A「精密仪器台 (Precision Instrument)」，Tailwind CSS v4 + CSS 语义变量（支持深色/浅色主题无闪烁切换、可回缩悬停弹出导航栏、`Cmd/Ctrl + K` 命令面板）
- **数据库**：PostgreSQL 17 + Drizzle ORM（生产环境连接标准 PostgreSQL，本地无守护进程开发/测试自动无缝挂载 WASM 原生 PostgreSQL `PGlite`）
- **缓存与限流**：Redis 7 (`ioredis`) + 进程内 TTL-LRU 自动回退适配器
- **自动化测试**：Vitest（单元与数据库集成测试）+ Playwright（桌面端与移动端真实 Chromium 端到端测试）

```text
omnikit-ai/
├── apps/
│   ├── web/                  # Next.js 全栈主站与统一 API 服务网关
│   └── jimi-desktop/         # 「基米大师」与「玩机器」桌面客户端目录 (第三阶段实施)
├── packages/
│   └── shared/               # 前后端与客户端共享的 Zod Schema、API 协议与模块注册表
├── deploy/                   # Docker / Caddy / Nginx 生产部署目录 (第五阶段完善)
├── docs/                     # 开发者技术文档与用户使用手册
└── .env.example              # 环境变量配置模板
```

---

## 三、快速运行说明

### 1. 环境准备

要求 Node.js `>= 20` 与 `pnpm`。

```bash
# 安装全部工作区依赖
pnpm install

# （可选）复制环境变量配置，不配置也可直接通过内置持久化 PGlite 启动
cp .env.example apps/web/.env.local

# 执行数据库迁移与 24 个权威站点种子初始化
pnpm db:init

# 启动开发服务器 (默认监听 http://localhost:3000)
pnpm dev
```

### 2. 生产构建与测试

```bash
# 全仓严格 TypeScript 类型检查
pnpm typecheck

# 运行 Vitest 单元与数据库集成测试
pnpm test

# 执行生产构建
pnpm build

# 运行 Playwright 桌面端与移动端浏览器自动化测试（需先启动服务在 3000 端口）
pnpm test:e2e
```

---

## 四、文档索引

- [第一阶段技术调研、设计方向比较与独立审查记录](./docs/research-and-design-decisions.md)
- [开发者技术架构文档](./docs/architecture.md)
- [用户使用手册](./docs/user-guide.md)
- [环境变量说明模板](./.env.example)
