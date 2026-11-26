# Workplane Browser Gateway - P0 Configuration for Agents

## Overview

This P0 deployment provides Firecrawl-based browser automation for development agents.
The stack is self-contained, self-hosted, and compatible with future Workplane Browser Gateway architecture.

## Deployment Status

**Current State:** Standalone Firecrawl deployment (P0)

**Components:**
- API Gateway (Port 3002)
- Playwright Browser Service (for JS rendering)
- Redis (caching & rate limiting)
- RabbitMQ (job queue)
- PostgreSQL (NuQ queue backend, optional)

## Quick Start for Agents

### 1. Start the deployment

```bash
cd /Users/sahbibraham/react-projects/headless-browser/infra/firecrawl

# Create .env from example
cp .env.example .env

# Edit .env with secure credentials
# At minimum: POSTGRES_PASSWORD, BULL_AUTH_KEY, RABBITMQ_PASSWORD

# Deploy
./operator.sh deploy
```

### 2. Verify deployment

```bash
# Health check
curl http://localhost:3002/health/readiness

# Run smoke tests
./run-smoke-tests.sh
```

### 3. Use from your agent

**Environment variables:**
```bash
export FIRECRAWL_API_URL=http://localhost:3002
export FIRECRAWL_API_KEY=changeme
```

**Direct HTTP API calls:**

```bash
# Simple scrape
curl -X POST http://localhost:3002/v2/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "formats": ["markdown"],
    "waitFor": 2000
  }'

# Crawl job
curl -X POST http://localhost:3002/v2/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "limit": 10,
    "scrapeOptions": {
      "formats": ["markdown"]
    }
  }'

# Check job status
curl http://localhost:3002/v2/crawl/<job-id>
```

**Node.js SDK integration:**

```javascript
const { FirecrawlApp } = require('firecrawl');

const app = new FirecrawlApp({
  apiKey: 'changeme',
  apiUrl: 'http://localhost:3002',
});

// Scrape a URL
const scrapeResult = await app.scrapeUrl('https://example.com', {
  formats: ['markdown'],
  waitFor: 2000,
});

console.log(scrapeResult.data);
```

## API Reference

### Scrape Endpoint
```
POST /v2/scrape
```

**Request body:**
```json
{
  "url": "https://example.com",
  "formats": ["markdown", "html", "rawHtml", "extract"],
  "headers": {},
  "removeBase64Images": false,
  "timeout": 75000,
  "waitFor": 2000,
  "extractOptions": {
    "schema": {
      "type": "object",
      "properties": {
        "title": {"type": "string"}
      }
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "markdown": "# Example",
    "metadata": {
      "title": "Example Domain",
      "description": "...",
      "language": "en"
    }
  }
}
```

### Crawl Endpoint
```
POST /v2/crawl
```

**Request body:**
```json
{
  "url": "https://example.com",
  "limit": 100,
  "scrapeOptions": {
    "formats": ["markdown"]
  },
  "maxDepth": 3,
  "returnOnlyUrls": false,
  "allowBackwardLinks": false,
  "allowExternalLinks": false,
  "ignoreSitemap": false,
  "deduplicateSimilarURLs": true,
  "ignoreQueryParameters": false,
  "ignoreFragment": false
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "abc-123"
}
```

**Poll job status:**
```
GET /v2/crawl/{jobId}
```

**Response:**
```json
{
  "status": "completed",
  "data": [
    {
      "markdown": "...",
      "metadata": {...}
    }
  ]
}
```

## Architecture Compatibility

### Future Workplane Browser Gateway Architecture

This P0 deployment is designed to integrate seamlessly with the future architecture:

**P0 (Current):** Firecrawl standalone
- Direct API endpoint at `localhost:3002`
- Bearer token authentication (BULL_AUTH_KEY)
- Local Redis + RabbitMQ + PostgreSQL

**P1 (Planned):** Control Plane integration
- API gateway proxy (`/api/mcp/*`)
- MCP server authentication
- Router abstraction layer
- Custom browser provider registration

**P3 (Planned):** Full Workplane Gateway
- Per-tenant network isolation
- Billing engine integration
- Usage analytics
- Multi-tenant queue management

### Migration Path

When the full Workplane Browser Gateway is ready, update your agent configuration to point to the new API URL:

```bash
export FIRECRAWL_API_URL=http://localhost:3000/api/browser  # Future Workplane API
```

No code changes required - the Firecrawl SDK is compatible with both deployments.

## Security Notes

### Current P0 Security

**Authentication:**
- Simple bearer token (BULL_AUTH_KEY in .env)
- Set `USE_DB_AUTHENTICATION=false` for P0
- Token is passed in `Authorization: Bearer <key>` header

**Network:**
- API exposed on localhost only (127.0.0.1:3002)
- Internal services use Docker internal network
- Egress policy in `NETWORK_POLICY.md`

**Data:**
- No external dependencies (self-hosted)
- All data stored locally (Redis, PostgreSQL)
- Logs rotated and limited (10MB per service)

### Security Requirements

Before production use:
1. ✅ Use secure passwords (32+ chars)
2. ✅ Enable `USE_DB_AUTHENTICATION=true` with database-backed auth
3. ✅ Configure firewall rules (see `NETWORK_POLICY.md`)
4. ✅ Restrict API access via reverse proxy if needed
5. ❌ Per-tenant isolation (deferred to P3)
6. ❌ Usage-based billing (deferred to P3)

## Troubleshooting

### Services not starting
```bash
./operator.sh logs
docker compose -f /Users/sahbibraham/react-projects/headless-browser/infra/firecrawl/compose.yaml ps
```

### API not responding
```bash
# Check health endpoint
curl http://localhost:3002/health/readiness

# Check container logs
./operator.sh logs --follow
```

### Memory issues
Edit `compose.yaml` and reduce:
- `BROWSER_POOL_SIZE` (default: 3)
- `MAX_CONCURRENT_JOBS` (default: 3)
- `CRAWL_CONCURRENT_REQUESTS` (default: 5)

### Browser rendering issues
Check Playwright service logs:
```bash
docker compose -f compose.yaml logs playwright-service
```

## Next Steps

**P1 - Control Plane Integration:**
- Add Workplane API gateway proxy
- Implement MCP server authentication
- Add browser router abstraction

**P2 - Custom MCP Server:**
- Build MCP-native browser control tools
- Implement browser session management
- Add human-in-the-loop controls

**P3 - Full Workplane Gateway:**
- Multi-tenant queue management
- Per-tenant network isolation
- Billing engine integration
- Usage analytics dashboard

## Support

For issues or questions:
1. Check `operator.sh help` for management commands
2. Review `NETWORK_POLICY.md` for security configuration
3. Inspect `compose.yaml` for resource tuning
4. Run `run-smoke-tests.sh` to validate deployment

---

**Version:** 1.0.0  
**Firecrawl Version:** v2.11.162  
**Last Updated:** 2024-11-26
