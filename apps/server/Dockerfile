FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS builder

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy all packages and apps
COPY packages ./packages
COPY apps/server ./apps/server

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build dependencies first
RUN pnpm --filter @chunkflow/protocol build
RUN pnpm --filter @chunkflow/shared build
RUN pnpm --filter @chunkflow/upload-server build

# Build server
RUN pnpm --filter @chunkflow/server-app build

FROM base AS runner

WORKDIR /app

# Copy package files
COPY --from=builder /app/apps/server/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy built server
COPY --from=builder /app/apps/server/dist ./dist

# Copy built dependencies
COPY --from=builder /app/packages/protocol/dist ./node_modules/@chunkflow/protocol/dist
COPY --from=builder /app/packages/protocol/package.json ./node_modules/@chunkflow/protocol/
COPY --from=builder /app/packages/shared/dist ./node_modules/@chunkflow/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@chunkflow/shared/
COPY --from=builder /app/packages/upload-server/dist ./node_modules/@chunkflow/upload-server/dist
COPY --from=builder /app/packages/upload-server/package.json ./node_modules/@chunkflow/upload-server/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Create storage directory
RUN mkdir -p /app/storage && chmod 777 /app/storage

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main.js"]
