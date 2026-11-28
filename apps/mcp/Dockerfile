# Browser Gateway MCP Server Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY apps/mcp/package*.json ./apps/mcp/
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/router/package*.json ./packages/router/
COPY packages/capacity-manager/package*.json ./packages/capacity-manager/
COPY packages/session-manager/package*.json ./packages/session-manager/
COPY packages/control-plane/package*.json ./packages/control-plane/
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
COPY apps/mcp/package*.json ./apps/mcp/
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/router/package*.json ./packages/router/
COPY packages/capacity-manager/package*.json ./packages/capacity-manager/
COPY packages/session-manager/package*.json ./packages/session-manager/
COPY packages/control-plane/package*.json ./packages/control-plane/
COPY packages/distributed-system/package*.json ./packages/distributed-system/
COPY packages/providers/firecrawl/package*.json ./packages/providers/firecrawl/
COPY packages/providers/http/package*.json ./packages/providers/http/
COPY packages/providers/playwright/package*.json ./packages/providers/playwright/

# Install production dependencies only
RUN npm install && npm cache clean --force

# Copy all packages (required for workspace resolution)
COPY packages/contracts ./packages/contracts
COPY packages/contracts/dist ./packages/contracts/dist
COPY packages/router ./packages/router
COPY packages/router/dist ./packages/router/dist
COPY packages/capacity-manager ./packages/capacity-manager
COPY packages/capacity-manager/dist ./packages/capacity-manager/dist
COPY packages/session-manager ./packages/session-manager
COPY packages/session-manager/dist ./packages/session-manager/dist
COPY packages/control-plane ./packages/control-plane
COPY packages/control-plane/dist ./packages/control-plane/dist
COPY packages/distributed-system ./packages/distributed-system
COPY packages/distributed-system/dist ./packages/distributed-system/dist
COPY packages/providers/firecrawl ./packages/providers/firecrawl
COPY packages/providers/firecrawl/dist ./packages/providers/firecrawl/dist
COPY packages/providers/http ./packages/providers/http
COPY packages/providers/http/dist ./packages/providers/http/dist
COPY packages/providers/playwright ./packages/providers/playwright
COPY packages/providers/playwright/dist ./packages/providers/playwright/dist

# Copy built artifacts
COPY --from=builder /app/apps/mcp/dist ./apps/mcp/dist

ENV NODE_ENV=production
ENV MCP_PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1

CMD ["node", "apps/mcp/dist/apps/mcp/src/index.js"]
