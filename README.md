# Browser Gateway

Workplane Browser Gateway - A production-ready browser acquisition and automation gateway with multi-tenant support, provider abstraction, and distributed capacity management.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   REST   │  │   MCP    │  │  Admin   │  │  Mobile  │   │
│  │   API    │  │  Server  │  │   UI     │  │  Apps    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
┌───────┴─────────────┴─────────────┴─────────────┴──────────┐
│                   Gateway Router                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Provider Selection • Load Balancing • Validation    │  │
│  └──────────────────────────────────────────────────────┘  │
└───────┬─────────────┬─────────────┬─────────────┬──────────┘
        │             │             │             │
┌───────┴─────────────┴─────────────┴─────────────┴──────────┐
│                   Provider Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Firecrawl │  │   HTTP   │  │Playwright│  │  Mobile  │   │
│  │ Provider │  │ Provider │  │ Provider │  │ Provider │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
browser-gateway/
├── packages/
│   ├── contracts/              # Shared interfaces and schemas
│   ├── router/                 # Provider routing logic
│   ├── providers/
│   │   ├── firecrawl/          # Firecrawl adapter
│   │   ├── http/               # Simple HTTP fetch
│   │   ├── playwright/         # Browser automation
│   │   └── mobile/             # Mobile device emulation
│   ├── control-plane/          # Multi-tenant management
│   ├── session-manager/        # Stateful browser sessions
│   ├── capacity-manager/       # Distributed capacity
│   └── distributed-system/     # Multi-host orchestration
├── apps/
│   ├── api/                    # REST API server
│   └── mcp/                    # MCP server
└── infra/
    └── firecrawl/              # Firecrawl deployment
```

## Phases

### P0: Firecrawl Standalone ✅
- Firecrawl deployment with MCP bridge
- Basic scraping and crawling

### P1: Gateway Foundation ✅
- Router with provider abstraction
- REST API with health, scrape, crawl endpoints
- Firecrawl adapter

### P2: MCP Interface ✅
- Streamable HTTP MCP transport
- HTTP fetch provider
- Playwright provider
- MCP tools: browser_scrape, browser_crawl, browser_job_status, browser_job_cancel

### P3: Commercial Control Plane ✅
- Tenant management
- API keys with scopes
- Plans and entitlements
- Usage tracking and billing ledger
- Session management with profiles
- Admin UI

### P4: Stateful Browser Sessions ✅
- Session CRUD operations
- Navigation, click, screenshot commands
- Session profiles (user-agent, viewport, cookies)
- Expiry and reaper

### P5: Mobile Environments ✅
- Android Chrome emulation (Pixel 5, Galaxy S20, etc.)
- iOS Safari emulation (iPhone 14 Pro, iPad Pro, etc.)
- Device-specific viewport and user-agent

### P6: Distributed Capacity ✅
- Multi-host provider registration
- Health-aware scheduling
- Capacity reservations
- Load balancing strategies

## Quick Start

### Prerequisites
- Node.js 20+
- Redis (for distributed mode)
- Docker (optional, for Firecrawl)

### Installation

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start API server
npm run dev:api

# Start MCP server
npm run dev:mcp
```

### Configuration

Environment variables:
- `PORT` - API server port (default: 4000)
- `MCP_PORT` - MCP server port (default: 3001)
- `FIRECRAWL_API_URL` - Firecrawl API URL
- `REDIS_URL` - Redis connection string (for distributed mode)

## API Endpoints

### Health
- `GET /health/live` - Liveness check
- `GET /health/ready` - Readiness check

### Browser Operations
- `POST /v1/scrape` - Scrape a URL
- `POST /v1/crawls` - Crawl a website
- `GET /v1/jobs/:id` - Get job status
- `POST /v1/jobs/:id/cancel` - Cancel job

### Admin
- `POST /admin/tenants` - Create tenant
- `POST /admin/users` - Create user
- `POST /admin/api-keys` - Create API key
- `GET /admin/tenants/:id/usage` - Usage report

### Sessions
- `POST /sessions` - Create session
- `POST /sessions/:id/navigate` - Navigate
- `POST /sessions/:id/click` - Click element
- `POST /sessions/:id/screenshot` - Screenshot

## MCP Usage

Configure MCP client:

```json
{
  "mcpServers": {
    "browser-gateway": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Basic base64-credentials"
      }
    }
  }
}
```

Available tools:
- `browser_scrape` - Scrape URL content
- `browser_crawl` - Crawl website
- `browser_job_status` - Check job status
- `browser_job_cancel` - Cancel job

## Provider Selection

Requests can specify a provider explicitly:

```json
{
  "url": "https://example.com",
  "provider": "playwright",
  "formats": ["markdown", "html"]
}
```

Or let the router auto-select based on capabilities and health.

## Load Balancing

Strategies:
- `round_robin` - Simple round-robin
- `least_loaded` - Select least loaded provider
- `weighted` - Weight-based selection
- `sticky` - Session-affine routing

Configure in `capacity-manager`:

```typescript
setLoadBalancerConfig({
  strategy: 'least_loaded',
  healthCheckInterval: 30000,
  unhealthyThreshold: 3,
});
```

## Security

- API key authentication with scopes
- Tenant isolation
- SSRF protection via provider validation
- Rate limiting (per-tenant quotas)
- BasicAuth for MCP endpoint

## Deployment

See `infra/firecrawl/` for Docker Compose deployment examples.

### Production Checklist

- [ ] Enable Redis for distributed mode
- [ ] Configure health checks
- [ ] Set up monitoring and alerting
- [ ] Enable request logging
- [ ] Configure rate limiting
- [ ] Set up backup for tenant data
- [ ] Enable SSL/TLS
- [ ] Configure network policies

## License

MIT
