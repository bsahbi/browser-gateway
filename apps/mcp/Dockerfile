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

# Copy workspace packages to node_modules/packages (matches relative symlinks from npm workspaces)
RUN mkdir -p node_modules/packages && \
    cp -r packages/contracts node_modules/packages/ && \
    cp -r packages/router node_modules/packages/ && \
    cp -r packages/control-plane node_modules/packages/ && \
    cp -r packages/session-manager node_modules/packages/ && \
    cp -r packages/capacity-manager node_modules/packages/ && \
    cp -r packages/distributed-system node_modules/packages/ && \
    cp -r packages/providers/firecrawl node_modules/packages/ && \
    cp -r packages/providers/http node_modules/packages/ && \
    cp -r packages/providers/playwright node_modules/packages/ && \
    cp -r packages/providers/mobile node_modules/packages/

# Copy built artifacts
COPY --from=builder /app/apps/mcp/dist ./apps/mcp/dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1

CMD ["node", "apps/mcp/dist/apps/mcp/src/index.js"]
