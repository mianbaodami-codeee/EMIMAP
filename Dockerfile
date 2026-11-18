# ==============================================================================
# OmniKit AI — 生产环境多阶段 Dockerfile (Node.js 24 LTS + pnpm Workspace)
# ==============================================================================
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@12.21.0 --activate

FROM base AS builder
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/tsconfig.base.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/web ./apps/web

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "pnpm --filter @omnikit/web db:init && pnpm --filter @omnikit/web start"]
