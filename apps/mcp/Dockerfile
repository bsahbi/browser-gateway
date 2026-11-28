# Browser Gateway MCP Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package.json with workspace configuration
COPY package*.json ./
COPY tsconfig.json ./

# Copy all workspace package.json files (required for npm to recognize workspaces)
COPY apps/mcp/package*.json ./apps/mcp/
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/router/package*.json ./packages/router/
COPY packages/control-plane/package*.json ./packages/control-plane/
COPY packages/session-manager/package*.json ./packages/session-manager/
COPY packages/capacity-manager/package*.json ./packages/capacity-manager/
COPY packages/distributed-system/package*.json ./packages/distributed-system/
COPY packages/providers/firecrawl/package*.json ./packages/providers/firecrawl/
COPY packages/providers/http/package*.json ./packages/providers/http/
COPY packages/providers/playwright/package*.json ./packages/providers/playwright/
COPY packages/providers/mobile/package*.json ./packages/providers/mobile/

# Install all dependencies (including workspaces)
RUN npm install

# Copy source code
COPY . .

# Build all packages
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
COPY packages/providers/mobile/package*.json ./packages/providers/mobile/

# Copy node_modules from builder (includes all dependencies and workspace symlinks)
COPY --from=builder /app/node_modules ./node_modules

# Copy workspace packages dist folders from builder (matches relative symlinks from npm workspaces)
COPY --from=builder /app/packages/contracts/dist ./node_modules/packages/contracts/dist
COPY --from=builder /app/packages/router/dist ./node_modules/packages/router/dist
COPY --from=builder /app/packages/control-plane/dist ./node_modules/packages/control-plane/dist
COPY --from=builder /app/packages/session-manager/dist ./node_modules/packages/session-manager/dist
COPY --from=builder /app/packages/capacity-manager/dist ./node_modules/packages/capacity-manager/dist
COPY --from=builder /app/packages/distributed-system/dist ./node_modules/packages/distributed-system/dist
COPY --from=builder /app/packages/providers/firecrawl/dist ./node_modules/packages/providers/firecrawl/dist
COPY --from=builder /app/packages/providers/http/dist ./node_modules/packages/providers/http/dist
COPY --from=builder /app/packages/providers/playwright/dist ./node_modules/packages/providers/playwright/dist
COPY --from=builder /app/packages/providers/mobile/dist ./node_modules/packages/providers/mobile/dist

# Copy package.json files for workspace packages
COPY packages/contracts/package*.json ./node_modules/packages/contracts/
COPY packages/router/package*.json ./node_modules/packages/router/
COPY packages/control-plane/package*.json ./node_modules/packages/control-plane/
COPY packages/session-manager/package*.json ./node_modules/packages/session-manager/
COPY packages/capacity-manager/package*.json ./node_modules/packages/capacity-manager/
COPY packages/distributed-system/package*.json ./node_modules/packages/distributed-system/
COPY packages/providers/firecrawl/package*.json ./node_modules/packages/providers/firecrawl/
COPY packages/providers/http/package*.json ./node_modules/packages/providers/http/
COPY packages/providers/playwright/package*.json ./node_modules/packages/providers/playwright/
COPY packages/providers/mobile/package*.json ./node_modules/packages/providers/mobile/

# Copy built artifacts
COPY --from=builder /app/apps/mcp/dist ./apps/mcp/dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1

CMD ["node", "apps/mcp/dist/apps/mcp/src/index.js"]
