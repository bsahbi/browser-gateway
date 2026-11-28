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

# Copy all packages (required for workspace resolution)
COPY packages/contracts ./packages/contracts
COPY packages/router ./packages/router
COPY packages/control-plane ./packages/control-plane
COPY packages/session-manager ./packages/session-manager
COPY packages/capacity-manager ./packages/capacity-manager
COPY packages/distributed-system ./packages/distributed-system
COPY packages/providers/firecrawl ./packages/providers/firecrawl
COPY packages/providers/http ./packages/providers/http
COPY packages/providers/playwright ./packages/providers/playwright
COPY packages/providers/mobile ./packages/providers/mobile

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:4000/health/live || exit 1

CMD ["node", "apps/api/dist/apps/api/src/index.js"]
