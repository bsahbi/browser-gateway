# Firecrawl P0 Agent Configuration

## Supported interfaces

The deployment provides two interfaces to the same self-hosted Firecrawl API:

- native Firecrawl HTTP API at `https://${DOMAIN_NAME}`;
- Streamable HTTP MCP at `https://${DOMAIN_NAME}/mcp`.

MCP is the recommended integration for internal agents. It uses the official
`firecrawl-mcp-server` image and forwards only to the private `api` Docker
service. The public browser endpoint is an API, not a website; `GET /` may
correctly return `Cannot GET /`.

## Readiness and API smoke test

The correct readiness route for the pinned Firecrawl API is:

```sh
curl --fail --user "$FIRECRAWL_INGRESS_USER:$FIRECRAWL_INGRESS_PASSWORD" \
  "https://${FIRECRAWL_DOMAIN}/v0/health/readiness"
```

For a direct scrape:

```sh
curl --fail --user "$FIRECRAWL_INGRESS_USER:$FIRECRAWL_INGRESS_PASSWORD" \
  --request POST "https://${FIRECRAWL_DOMAIN}/v2/scrape" \
  --header 'Content-Type: application/json' \
  --data '{"url":"https://example.com","formats":["markdown"]}'
```

The native self-hosted API has no application API-key authentication with
`USE_DB_AUTHENTICATION=false`. The required Traefik BasicAuth layer is the
ingress boundary for this P0 deployment. `BULL_AUTH_KEY` only protects
Firecrawl queue-admin routes; it is not a client API key.

## MCP client configuration

Use the HTTP transport, endpoint `/mcp`, and a secret `Authorization` header:

```json
{
  "mcpServers": {
    "firecrawl-internal": {
      "type": "http",
      "url": "https://browser.example.com/mcp",
      "headers": {
        "Authorization": "Basic <base64(username:password)>"
      }
    }
  }
}
```

The connection must discover tools such as `firecrawl_scrape` and
`firecrawl_crawl`. Do not use `https://browser.example.com/` as an MCP URL.
Keep credentials in the MCP client's secret store; never commit them or place
them in an agent prompt.

For a local operator deployment, connect to `http://127.0.0.1:3000/mcp` with
no public ingress. The MCP service is configured with
`FIRECRAWL_API_URL=http://api:3002`, so a client never needs the Docker-only
address.

## Operational limits

This is a trusted-internal P0 deployment. It has fixed concurrency, CPU, memory
and log limits, but it does not implement tenant isolation, API-key lifecycle,
per-tenant billing, or complete network egress enforcement. Keep it on a
trusted network and retain the firewall/egress controls described in
`NETWORK_POLICY.md`. Do not expose Redis, RabbitMQ, PostgreSQL, Playwright, or
worker ports.

## Troubleshooting

- `api` restarting: inspect API logs first. Check that RabbitMQ and NuQ
  PostgreSQL are healthy, `NUQ_RABBITMQ_URL` has the configured credentials,
  and the stack does not set `NUQ_BACKEND=redis`.
- `Cannot GET /`: expected root API response, not a health check. Probe
  `/v0/health/readiness` through authenticated ingress instead.
- `Cannot GET /health/readiness`: obsolete path for this pinned release.
- MCP returns 403: ensure the request host equals `DOMAIN_NAME`; the MCP
  service's allowed-host setting is intentionally restrictive.
- MCP returns 401 from Traefik: use the configured BasicAuth header and ensure
  its bcrypt value was escaped when stored as a Compose environment value.
