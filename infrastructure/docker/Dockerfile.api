# syntax=docker/dockerfile:1.4
# Multi-stage Dockerfile for @vynor/api
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
COPY apps/api/package.json ./apps/api/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma Client
RUN pnpm --filter @vynor/database db:generate

# Build dependencies and API application
RUN pnpm --filter @vynor/api... build

# Stage 2: Production Runner
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat openssl wget
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Security: Create non-root system group and user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 -G nodejs vynor

# Copy built artifacts and necessary node_modules
COPY --from=builder --chown=vynor:nodejs /app/package.json ./package.json
COPY --from=builder --chown=vynor:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=vynor:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=vynor:nodejs /app/packages ./packages
COPY --from=builder --chown=vynor:nodejs /app/apps/api ./apps/api

# Switch to non-root user
USER vynor

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health/live || exit 1

CMD ["node", "apps/api/dist/main.js"]
