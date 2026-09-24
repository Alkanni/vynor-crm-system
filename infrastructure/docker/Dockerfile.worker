# syntax=docker/dockerfile:1.4
# Multi-stage Dockerfile for @vynor/worker
# FND-INF-001: Multi-stage build with non-root runtime user

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

# Stage 1: Dependencies and Build
FROM base AS builder
WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json tsconfig.package.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/database/package.json ./packages/database/
COPY packages/observability/package.json ./packages/observability/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/
COPY packages/ai/package.json ./packages/ai/
COPY packages/channel-adapters/package.json ./packages/channel-adapters/
COPY apps/worker/package.json ./apps/worker/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/

# Generate Prisma Client
RUN pnpm --filter @vynor/database db:generate

# Build dependencies and Worker application
RUN pnpm --filter @vynor/worker... build

# Stage 2: Production Runner
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production

# Security: Create non-root system group and user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 -G nodejs vynor

# Copy built artifacts and necessary node_modules
COPY --from=builder --chown=vynor:nodejs /app/package.json ./package.json
COPY --from=builder --chown=vynor:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=vynor:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=vynor:nodejs /app/packages ./packages
COPY --from=builder --chown=vynor:nodejs /app/apps/worker ./apps/worker

# Switch to non-root user
USER vynor

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

CMD ["node", "apps/worker/dist/main.js"]
