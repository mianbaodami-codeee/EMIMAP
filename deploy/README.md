# 生产部署与自托管配置目录 (Deploy)

本目录用于存放自建服务器生产部署配置，将在**第五阶段（系统集成、部署、测试和优化）**交付全套可验证部署方案，包括：
- 多阶段生产优化 `Dockerfile`
- `docker-compose.yml`（`web` + `postgres:17` + `redis:7` + 反向代理）
- `Caddyfile`（自动 Let's Encrypt HTTPS）与 `nginx.conf` 反向代理配置模板
- PostgreSQL 数据库初始化、定时备份与灾难恢复脚本
- 零停机滚动更新与版本回滚操作手册

## 第二阶段服务器配置

在仓库根目录复制 `.env.example` 为 `.env`，设置服务器端 `ADMIN_PASSWORD`（至少 16 字符）、`POSTGRES_PASSWORD` 和 `APP_HMAC_SECRET`，并将 `NEXT_PUBLIC_APP_URL` 改为自己的 HTTPS 域名。可用 `openssl rand -hex 32` 分别生成每一项。通过 URL 拼接连接 PostgreSQL 时，十六进制密码可以直接使用。

运行 `docker compose up -d --build`。Web 容器启动时执行数据库初始化；PostgreSQL、Redis 使用 Compose 命名卷。Compose 使用 Redis 共享登录会话。地图底图、MapLibre Worker 和品牌图形随镜像构建，无需把这些文件另传到 CDN。

企业构建网络若使用自签代理 CA，可通过 Docker BuildKit 的 `registry_ca` 构建密钥挂载证书，例如 `docker build --secret id=registry_ca,src=/path/to/ca.pem .`。Node 仅在构建时读取该文件，生产镜像不内置此证书。

使用本目录的 Caddy 或 Nginx 模板终止 HTTPS，保留 Host 与转发协议头，并将上游指向 Web 端口。默认绑定宿主机回环地址，若反向代理在另一台机器，可按网络环境设置 `WEB_BIND_HOST` 并配置访问限制。经 HTTPS 访问 `/login` 登录 Admin。公开健康探针为 `/api/health`；详细状态在登录后的 `/admin`。发布后可检查 `/atlas/world.svg` 和 `/maplibre/maplibre-gl-worker.mjs` 返回 200，再从平板打开 `/map`。

## 私测域名与访问保护

私测建议使用 `review.agentmapqa.xyz`。在有 Linux VPS 公网 IP 后，只为 `review` 新增 A 记录。如果 VPS 配置了可用 IPv6，可同时新增 AAAA。主域名 `agentmapqa.xyz` 可继续指向现有托管页面。VPS 需要允许外部连接 TCP 80 和 443，以便 Caddy 申请 HTTPS 证书。应用端口默认通过宿主机回环地址绑定。

1. 在服务器复制 `.env.example` 为 `.env`。生成独立的 `POSTGRES_PASSWORD`、`APP_HMAC_SECRET` 和 `ADMIN_PASSWORD`，设置 `NEXT_PUBLIC_APP_URL=https://review.agentmapqa.xyz` 与 `OMNIKIT_SITE_ADDRESS=review.agentmapqa.xyz`。保护 `.env` 文件权限。
2. 执行 `docker run --rm -it caddy:2-alpine caddy hash-password`，按提示输入独立的私测密码。将输出写入 `.env` 的 `OMNIKIT_PREVIEW_PASSWORD_HASH`，用单引号包住哈希以保留其中的美元符号。
3. 在仓库根目录运行 `docker compose -f docker-compose.yml -f deploy/compose.private.yml config -q`，随后使用同样的两个 `-f` 参数运行 `up -d --build`。
4. 浏览器访问 HTTPS 子域名，先输入 Caddy 私测账号和密码。再打开 `/login` 可用 Admin 进入管理面板。核验地图可读、测试包可下载、访客无法访问页面或任何 API。

私测入口的认证覆盖地图文件、安装包与 API，反向代理不会把访问密码转发给应用。Caddy 的数据卷保存 HTTPS 证书。确认无凭据的 `GET /api/health` 返回 401，并用已授权浏览器或 `curl -u review https://review.agentmapqa.xyz/api/health` 验证健康响应。curl 会交互式读取私测密码。

使用 `docker compose -f docker-compose.yml -f deploy/compose.private.yml logs --tail 100` 检查启动问题。更新前记录当前提交，并用 `docker compose exec -T postgres pg_dump -U omnikit omnikit > omnikit-backup.sql` 备份默认数据库。需要恢复旧版本时，从已记录的提交重建应用镜像，保留命名数据卷。完整恢复演练与滚动更新仍属于第五阶段。
