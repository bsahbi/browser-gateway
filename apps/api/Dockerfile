# Browser Gateway API Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/router/package*.json ./packages/router/
COPY packages/control-plane/package*.json ./packages/control-plane/
COPY packages/session-manager/package*.json ./packages/session-manager/
COPY packages/capacity-manager/package*.json ./packages/capacity-manager/
COPY packages/distributed-system/package*.json ./packages/distributed-system/
COPY packages/providers/firecrawl/package*.json ./packages/providers/firecrawl/
COPY packages/providers/http/package*.json ./packages/providers/http/
COPY packages/providers/playwright/package*.json ./packages/providers/playwright/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/router/package*.json ./packages/router/
COPY packages/capacity-manager/package*.json ./packages/capacity-manager/
COPY packages/session-manager/package*.json ./packages/session-manager/
COPY packages/control-plane/package*.json ./packages/control-plane/
COPY packages/distributed-system/package*.json ./packages/distributed-system/
COPY packages/providers/firecrawl/package*.json ./packages/providers/firecrawl/
COPY packages/providers/http/package*.json ./packages/providers/http/
COPY packages/providers/playwright/package*.json ./packages/providers/playwright/
COPY packages/providers/mobile/package*.json ./packages/providers/mobile/

# Install production dependencies only
RUN npm install && npm cache clean --force

# Manually create workspace symlinks
RUN mkdir -p node_modules/@browser-gateway && \
    ln -s /app/packages/contracts node_modules/@browser-gateway/contracts && \
    ln -s /app/packages/router node_modules/@browser-gateway/router && \
    ln -s /app/packages/control-plane node_modules/@browser-gateway/control-plane && \
    ln -s /app/packages/session-manager node_modules/@browser-gateway/session-manager && \
    ln -s /app/packages/capacity-manager node_modules/@browser-gateway/capacity-manager && \
    ln -s /app/packages/distributed-system node_modules/@browser-gateway/distributed-system && \
    ln -s /app/packages/providers/firecrawl node_modules/@browser-gateway/firecrawl && \
    ln -s /app/packages/providers/http node_modules/@browser-gateway/http && \
    ln -s /app/packages/providers/playwright node_modules/@browser-gateway/playwright && \
    ln -s /app/packages/providers/mobile node_modules/@browser-gateway/mobile

# Copy all packages (required for workspace resolution)
COPY packages/contracts/dist ./packages/contracts/dist
COPY packages/router/dist ./packages/router/dist
COPY packages/control-plane/dist ./packages/control-plane/dist
COPY packages/session-manager/dist ./packages/session-manager/dist
COPY packages/capacity-manager/dist ./packages/capacity-manager/dist
COPY packages/distributed-system/dist ./packages/distributed-system/dist
COPY packages/providers/firecrawl/dist ./packages/providers/firecrawl/dist
COPY packages/providers/http/dist ./packages/providers/http/dist
COPY packages/providers/playwright/dist ./packages/providers/playwright/dist
COPY packages/providers/mobile/dist ./packages/providers/mobile/dist

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:4000/health/live || exit 1

CMD ["node", "apps/api/dist/apps/api/src/index.js"]
