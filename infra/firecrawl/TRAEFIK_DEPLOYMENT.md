# Firecrawl + Traefik + Portainer

This is the supported deployment path for the internal Firecrawl instance. It
runs the Firecrawl API, Playwright, Redis, RabbitMQ, Firecrawl's NuQ PostgreSQL
image, and an official Firecrawl MCP bridge. Only the API and MCP bridge join
the Traefik network; Redis, RabbitMQ, PostgreSQL, and Playwright are never
published.

## Why the previous stack failed

The original Portainer file was not an upstream Firecrawl topology:

- it used floating `latest` images and `NUQ_BACKEND=redis`, although this
  Firecrawl release uses RabbitMQ plus NuQ PostgreSQL by default;
- it substituted plain PostgreSQL, which lacks NuQ's initialization schema and
  `pg_cron` configuration;
- it exposed a second Traefik router for Playwright under the same hostname as
  the API; and
- its local counterpart requested `v2.11.162`, but the published API image tag
  is `2.11.162` (without `v`).

`GET /` returning `Cannot GET /` is normal for the Firecrawl API: it is not a
web UI. For this pinned release the readiness probe is
`GET /v0/health/readiness`.

## Deploy in Portainer

1. On the Docker endpoint, identify the existing external network used by
   Traefik (for example `proxy` or `traefik`). The value must be an existing
   network; Portainer will not create it because it is declared as external.

2. In Portainer, create or update a stack from
   `infra/firecrawl/docker-compose.portainer.yml`. When deploying from this
   repository, select that file as the Compose path. In Web Editor mode, paste
   its contents.

   By default the stack pulls the reviewed upstream API digest. After the
   repository's release workflow publishes `ghcr.io/bsahbi/browser-gateway/firecrawl:latest`,
   set `FIRECRAWL_API_IMAGE` to that image to use the project's pinned API
   alias instead. It is still only the API service; the Compose stack supplies
   its required dependencies.

3. Add every non-comment variable from
   `infra/firecrawl/portainer.env.example` to the stack's environment-variable
   or secret UI. Generate independent URL-safe values with:

   ```sh
   openssl rand -hex 32
   ```

   `TRAEFIK_BASIC_AUTH` is an htpasswd bcrypt entry, not the plaintext password:

   ```sh
   htpasswd -nbB operator 'choose-a-long-password' | sed -e 's/\$/$$/g'
   ```

   The `sed` escaping is necessary only for the Compose value. Keep the
   plaintext password only in the operator's password manager.

4. Deploy the stack. Wait for `api` and `mcp` to become healthy. The first
   start can take a few minutes while RabbitMQ and NuQ PostgreSQL initialize.
   The pinned official MCP image currently has a `linux/amd64` manifest only.
   Use an amd64 Portainer host, or explicitly enable its Docker endpoint's
   amd64 emulation before deploying on ARM.

5. Verify through Traefik, replacing the placeholders with the operator's
   BasicAuth credentials:

   ```sh
   curl --fail --user 'operator:choose-a-long-password' \
     https://browser.example.com/v0/health/readiness

   curl --fail --user 'operator:choose-a-long-password' \
     --request POST https://browser.example.com/v2/scrape \
     --header 'Content-Type: application/json' \
     --data '{"url":"https://example.com","formats":["markdown"]}'
   ```

`/` is intentionally not a readiness check. A `Cannot GET /` response after a
healthy deployment is expected. The prior `/health/readiness` path is also not
valid for this release; use `/v0/health/readiness`.

## MCP endpoint

The stack serves authenticated Streamable HTTP MCP at:

```text
https://${DOMAIN_NAME}/mcp
```

Configure an MCP client with that URL and an `Authorization` header containing
the same Traefik BasicAuth credential:

```json
{
  "mcpServers": {
    "firecrawl-internal": {
      "type": "http",
      "url": "https://browser.example.com/mcp",
      "headers": {
        "Authorization": "Basic <base64(operator:choose-a-long-password)>"
      }
    }
  }
}
```

Store the header in the client's secret store rather than committing it. The
MCP container calls `http://api:3002` only on the private Docker network;
Traefik removes the BasicAuth header before forwarding so it cannot be mistaken
for a Firecrawl API credential.

To test protocol negotiation without a client UI:

```sh
curl --user 'operator:choose-a-long-password' \
  --request POST https://browser.example.com/mcp \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}'
```

The response must be a JSON-RPC server-initialization result, not an HTTP 404,
`Cannot GET`, or a Traefik error page. Then call `tools/list` and one bounded
`firecrawl_scrape` request from the client.

## Local operator mode

For a host-local test without Traefik:

```sh
cd infra/firecrawl
docker compose --env-file .env -f compose.yaml up -d
curl --fail http://127.0.0.1:3002/v0/health/readiness
```

The local MCP bridge is `http://127.0.0.1:3000/mcp`. Both ports bind to
loopback, so neither is externally reachable. Run
`./run-smoke-tests.sh` after the API becomes healthy.

## Upgrades and rollback

The manifests pin image digests. Upgrade all images as one reviewed change:
update the API release and every companion digest, validate a clean stack and
MCP scrape, then deploy. To roll back, redeploy the last committed compose
file. Do not remove the named volumes during a routine rollback; doing so
deletes queued work and persisted NuQ/Redis state.

For an emergency stop, stop the Portainer stack and block the Traefik router or
its external Docker network. Keep the API private until a complete replacement
authentication design is in place.
