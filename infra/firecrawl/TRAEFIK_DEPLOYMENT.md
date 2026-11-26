# Traefik + Portainer Deployment

This directory contains a Traefik-ready Firecrawl deployment for Portainer stack imports.

## Quick Start

### 0. Generate Secrets

Before deploying, generate two random secrets:

```bash
BULL_AUTH_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 32)
```

### 1. Import into Portainer

1. Open Portainer → Stacks → Add stack
2. Select **Web Editor**
3. Copy contents of `docker-compose.portainer.yml`
4. Set environment variables:
   - `BULL_AUTH_KEY` - generated with `openssl rand -hex 32`
   - `POSTGRES_PASSWORD` - generated with `openssl rand -hex 32`
   - `DOMAIN_NAME` - e.g. `firecrawl.example.com`
5. Deploy

## Access Points

Replace `${DOMAIN_NAME}` with your actual domain:

- **Firecrawl API**: `https://${DOMAIN_NAME}`
- **Playwright**: `https://${DOMAIN_NAME}`

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BULL_AUTH_KEY` | Redis auth key | `mysecretkey123` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `postgrespass456` |

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `firecrawl-api` | `firecrawl/firecrawl:latest` | 3002 | Main API gateway |
| `playwright` | `mcr.microsoft.com/playwright:v1.50.1-jammy` | 3000 | Headless browser |
| `redis` | `redis:7-alpine` | 6379 | Job queue |
| `postgres` | `postgres:16-alpine` | 5432 | Database |

## Health Checks

All services include health checks. Verify deployment:

```bash
curl -k https://${DOMAIN_NAME}/health
```

## Updates

The GitHub Actions workflow will:
1. Build and push the Traefik wrapper image to `ghcr.io/bsahbi/browser-gateway/firecrawl`
2. Commit the docker-compose hash for integrity verification

To deploy updates:
1. Push to `main` (deploys `latest` tag)
2. Push to `release` (deploys `release` tag)

## Security Notes

- Secrets are never committed to git
- Traefik handles TLS termination with Let's Encrypt
- Services run on private network (`firecrawl-net`)
- Only API and Playwright expose ports via Traefik
