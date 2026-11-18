# 开发者技术架构文档

## 1. 设计哲学与核心准则

1. **真实性优先**：严禁使用静态模拟假分数或虚构数据冒充真实测量结果。全站通过 `ProvenanceBadge`（`measured` / `web_verified` / `ai_inferred` / `native_only`）强制区分数据出处与执行边界。
2. **密钥零泄漏与可信端点绑定**：所有服务器端第三方密钥（`OPENAI_API_KEY`、`GEMINI_API_KEY` 等）仅由 Node.js 服务端路由读取，绝不添加 `NEXT_PUBLIC_` 前缀，且**严格绑定管理员配置的可信端点**（OpenAI 绑定 `OPENAI_BASE_URL` 默认 `https://api.openai.com/v1`，Gemini 绑定 `https://generativelanguage.googleapis.com` 并使用 `x-goog-api-key` 请求头传输）。任何用户自定义 Base URL 或 `openai_compatible` 模式均强制要求用户自带密钥（BYOK），防止服务端密钥向第三方地址外泄。
3. **同构 PostgreSQL 数据层**：`apps/web/src/lib/db/client.ts` 同时支持标准外部 `postgresql://` 连接池（`pg`）与零守护进程内嵌原生 PostgreSQL（`@electric-sql/pglite`），共享完全一致的 `drizzle/0000_initial_schema.sql` 迁移脚本与 Drizzle Schema。

## 2. 第一阶段 API 接口契约

所有接口均返回统一的 `ApiResponse<T>` JSON 信封格式（附带 `meta.requestId`、`meta.timestamp` 与 `meta.durationMs`）：

- `GET /api/health`：深度健康检查，实测 PostgreSQL 查询延迟、预置站点数、缓存驱动连通性与服务端 AI 密钥配置布尔状态。
- `GET /api/hub/sites`：支持 `?q=`、`?category=`、`?official=true`、`?favorites=true` 多条件查询当前工作区可见网站（合并系统预置与当前会话自定义条目）。
- `POST /api/hub/sites`：新增用户自定义网址（内置速率限制、`http/https` 协议强制校验与凭据剥离检查）。
- `PATCH /api/hub/sites/:id`：切换任意站点收藏状态，或编辑当前用户创建的自定义网址（系统内置官方站点受写保护，篡改基础属性将返回 `403 FORBIDDEN_OPERATION`）。
- `DELETE /api/hub/sites/:id`：删除用户自定义网址（系统内置站点禁止删除）。
- `GET /api/hub/export` & `POST /api/hub/export`：导出与按 URL 自动去重导入自定义书签 JSON。
- `GET /api/ai/status` & `POST /api/ai/status`：查询服务端大模型网关就绪状态及执行**服务端点连通性检查**（强制公网 HTTPS、禁止自动跟随重定向、校验域名全部解析 IP 并锁定 Socket 建连目标，返回 `endpointReachable` 与三态模型结果 `modelStatus: confirmed | not_found | unverifiable`）。

## 2.1 第二阶段 API 接口契约（统一 AI 网关、全球地图与自主资源检索）

- `POST /api/ai/chat`：统一大模型文本推理接口，适配 `openai`、`gemini` 与 `openai_compatible`，复用 `safe-upstream.ts` 全部公网 DNS IP 绑定、无重定向与可信端点密钥隔离规则。
- `GET /api/geo/search?q=`：全球城市、国家、地标与坐标检索（融合 OpenStreetMap Nominatim 实时检索与内置权威空间基准索引）。
- `GET /api/geo/reverse?lat=&lon=`：全球任意 WGS84 坐标逆地理编码、半球/太阳时区带计算与周边参考要素 Haversine 距离排序。
- `GET /api/geo/places`、`POST /api/geo/places`、`DELETE /api/geo/places/:id`：按客户端会话隔离的收藏地点 PostgreSQL（`saved_places` 表）持久化接口。
- `POST /api/geo/analyze` & `GET /api/geo/history`：针对选中地点执行三源严格隔离的空间问答（`measured` 实测地理要素 / `web_verified` 公开百科与 OSM 信源 / `ai_inferred` 模型推理或无密钥优雅降级），并持久化至 `geo_query_history` 表。
- `POST /api/discover/search`：AI 自主资源寻找代理接口，内置正版与安全合规拦截门禁，输出四步执行轨迹（需求拆解 → 多源检索 → 官方域名核验 → 选型综述）及包含可验证依据与注意事项的结构化资源清单。

## 3. 可回缩悬停弹出导航栏与模态抽屉无障碍实现

- **可回缩侧边栏 (`apps/web/src/components/shell/collapsible-sidebar.tsx`)**：
  - **默认回缩模式 (`isPinned = false`)**：主布局左侧仅保留 `60px` 占位槽，导航栏平时呈现紧凑图标导轨；鼠标移入 (`onMouseEnter`) 时导航栏平滑扩展至 `260px` 并悬浮于左侧边缘，**不触发右侧主画布内容重排（Zero Layout Shift）**；鼠标移出 (`onMouseLeave`) 自动回缩至 `60px`。
  - **固定展开模式 (`isPinned = true`)**：点击导航栏右上角固定按钮可将导航栏常驻锁定在 `260px`，偏好持久化于 `localStorage`。
  - **移动端适配 (`< 768px`)**：自动隐藏桌面侧轨，改为顶部按钮唤起全高模态抽屉菜单。
- **AI 设置抽屉 (`apps/web/src/components/shell/ai-settings-drawer.tsx`)**：遵循 W3C WAI-ARIA APG Dialog (Modal) 规范，打开时自动将焦点移入抽屉控件，限制 `Tab` / `Shift + Tab` 在抽屉内部循环，支持 `Escape` 关闭，并在关闭后自动将焦点还原至原触发入口按钮。

## 4. 关联决策记录

- 技术调研来源、三种设计方向对比及桌面/移动/无障碍审查记录详见：[research-and-design-decisions.md](./research-and-design-decisions.md)。

## Phase 3 浏览器跑分

`POST /api/bench/challenge` 创建会话绑定、三分钟有效的 CPU 负载。客户端运行统一版本的整数负载后，可向 `POST /api/bench/leaderboard` 显式提交。服务器复算校验值，以挑战 UUID 为主键拒绝重放，并将模式和版本、操作系统及逻辑线程数同成绩写入。公开榜单只返回浏览器 CPU 版本的前 20 条。客户端计时和硬件字段仍可伪造，因此不授予硬件认证。

WebGL2、内存和 OPFS 使用浏览器实测并保存在本机。测速默认请求当前站点，可通过 `BENCH_LATENCY_ENDPOINTS` 添加最多五个同口径的 HTTPS 节点。远程节点须允许从本站发出的 CORS 请求，节点 URL 会发送到浏览器。每个请求使用独立超时，按成功样本中位数排序。
