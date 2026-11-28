# Browser Gateway MCP Server Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY apps/mcp/package*.json ./apps/mcp/
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/router/package*.json ./packages/router/
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

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built artifacts
COPY --from=builder /app/apps/mcp/dist ./apps/mcp/dist
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/router/dist ./packages/router/dist
COPY --from=builder /app/packages/providers/firecrawl/dist ./packages/providers/firecrawl/dist
COPY --from=builder /app/packages/providers/http/dist ./packages/providers/http/dist
COPY --from=builder /app/packages/providers/playwright/dist ./packages/providers/playwright/dist

ENV NODE_ENV=production
ENV MCP_PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:3001/health || exit 1

CMD ["node", "apps/mcp/dist/index.js"]
