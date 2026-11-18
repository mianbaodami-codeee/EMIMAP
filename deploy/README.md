# 生产部署与自托管配置目录 (Deploy)

本目录用于存放自建服务器生产部署配置，将在**第五阶段（系统集成、部署、测试和优化）**交付全套可验证部署方案，包括：
- 多阶段生产优化 `Dockerfile`
- `docker-compose.yml`（`web` + `postgres:17` + `redis:7` + 反向代理）
- `Caddyfile`（自动 Let's Encrypt HTTPS）与 `nginx.conf` 反向代理配置模板
- PostgreSQL 数据库初始化、定时备份与灾难恢复脚本
- 零停机滚动更新与版本回滚操作手册
