# ==============================================================================
# OmniKit AI — 生产镜像 (Node.js 24 LTS + pnpm Workspace)
# ==============================================================================
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN --mount=type=secret,id=registry_ca \
    export NODE_USE_ENV_PROXY=1; \
    if [ -f /run/secrets/registry_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/registry_ca; fi; \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@12.21.0 --activate

FROM base AS builder
WORKDIR /app

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=registry_ca \
    export NODE_USE_ENV_PROXY=1; \
    if [ -f /run/secrets/registry_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/registry_ca; fi; \
    pnpm install --frozen-lockfile --store-dir=/tmp/pnpm-store \
    && pnpm build \
    && rm -rf /tmp/pnpm-store apps/web/.next/cache

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "pnpm --filter @omnikit/web db:init && pnpm --filter @omnikit/web start"]
