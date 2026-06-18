# Deploy — Brand-Coach MCP gateway

Make `https://ideabrandcoach.icodemybusiness.com/mcp` live by running the gateway on
the **mango Lightsail box** (`54.243.53.44`) bound to `127.0.0.1:8787`, and adding a
**Caddy path route** to the existing `ideabrandcoach.icodemybusiness.com` vhost. No new
DNS, no new subdomain — the domain's TLS cert already exists.

```
Claude (Code / Desktop / claude.ai)
        │  HTTPS
        ▼
Caddy  ideabrandcoach.icodemybusiness.com
   ├── handle /mcp*  → reverse_proxy 127.0.0.1:8787   (this gateway)
   └── handle        → file_server  /…/ideabrandcoach (static site, unchanged)
```

The gateway is a single self-contained file (`dist-mcp/server.mjs`, ~2.5 MB) — no tsx,
no `node_modules`. It has no coupling to the SPA, so it can later move to its own repo.

---

## A. Build the image (local — already done by the developer)

The box is **linux/amd64** — build for that arch (use `--platform` if you're on an
Apple-Silicon/arm64 machine, or just build on the box).

```bash
# from the repo root
npm run typecheck:mcp          # type-check the gateway
npm run test                   # MCP suites in src/mcp/__tests__
npm run mcp:bundle             # -> dist-mcp/server.mjs

# build the runtime image for the box arch, tagged :latest (what compose expects)
docker build --platform linux/amd64 -f deploy/mcp/Dockerfile -t brand-coach-mcp:latest .

# export the image for the box (no registry needed)
docker save brand-coach-mcp:latest | gzip > brand-coach-mcp.tar.gz
```

Then copy `brand-coach-mcp.tar.gz` and this `deploy/mcp/` directory to the box, e.g.
`/opt/brand-coach-mcp/`:

```bash
scp -i ~/.ssh/lightsail-mango.pem brand-coach-mcp.tar.gz deploy/mcp/{docker-compose.yml,.env.example} \
    <user>@54.243.53.44:/opt/brand-coach-mcp/
```

## B. Bring it up on the box (privileged — run over SSH)

```bash
cd /opt/brand-coach-mcp

# 1. env (the anon key in .env.example is the public SPA key — safe to use as-is)
cp .env.example .env            # edit only if pointing at a different Supabase project

# 2. load + start (bound to 127.0.0.1:8787)
docker load -i brand-coach-mcp.tar.gz
docker compose up -d
docker compose ps

# 3. local smoke test (should print {"status":"ok"})
curl -s http://127.0.0.1:8787/healthz
```

## C. Add the Caddy path route

Edit the `ideabrandcoach.icodemybusiness.com { … }` block in the box's Caddyfile
(`/etc/caddy/Caddyfile` or an included snippet). Put the `/mcp*` handle **before** the
static `handle`:

```caddy
ideabrandcoach.icodemybusiness.com {
    encode gzip

    handle /mcp* {
        reverse_proxy 127.0.0.1:8787 {
            flush_interval -1        # do NOT buffer — MCP uses streamable HTTP
        }
    }

    # (optional) expose liveness for monitoring
    handle /mcp-health {
        rewrite * /healthz
        reverse_proxy 127.0.0.1:8787
    }

    handle {
        root * /opt/ideabrandcoach        # <-- confirm the actual static root on the box
        try_files {path} /index.html
        file_server
    }
}
```

Apply:

```bash
caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy     # or: caddy reload --config /etc/caddy/Caddyfile
```

## D. Verify it's live

```bash
# initialize handshake over the public URL — expect a JSON-RPC result, NOT 405
curl -s -X POST https://ideabrandcoach.icodemybusiness.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
# → {"result":{... "serverInfo":{"name":"brand-coach-mcp","version":"0.1.0"} ...}}
```

## E. Connect from Claude

- **Claude Code:** `claude mcp add --transport http brand-coach https://ideabrandcoach.icodemybusiness.com/mcp`
- **Claude Desktop / claude.ai:** Settings → Connectors → Add custom connector →
  `https://ideabrandcoach.icodemybusiness.com/mcp`
- Then start a new chat and run the **`onboard`** prompt.
- Power-user fallback (stdio-only setups): `npx mcp-remote https://ideabrandcoach.icodemybusiness.com/mcp`

---

## Env reference (`.env`)

| Var | Required | Notes |
|-----|----------|-------|
| `MCP_PORT` | no (8787) | Container listens here; keep in sync with the compose port + Caddy upstream. |
| `SUPABASE_URL` | yes | Supabase project for `auth.getUser()` JWT verification. |
| `SUPABASE_ANON_KEY` | yes | Public anon key (same as the SPA). |
| `IVOS_MCP_URL` / `IVOS_MCP_TOKEN` | no | IV-OS ledger reads; unset ⇒ reads degrade gracefully. |
| `POSTHOG_API_KEY` / `POSTHOG_HOST` | no | Analytics; no-op if unset. |

## Automated deploy (CI) — preferred

`.github/workflows/deploy-mcp.yml` does steps A–B automatically **on merge to `main`**
when gateway code changes (`src/mcp/**`, `deploy/mcp/**`, `scripts/build-mcp.mjs`,
`tsconfig.mcp.json`), or on manual **workflow_dispatch**. It type-checks + runs the MCP
test suite, builds the amd64 image, ships it to the box, `docker load && docker compose
up -d --force-recreate`, and verifies `tools/list` over the public URL.

One-time setup (repo Settings → Secrets and variables → Actions):
- **Variable `MCP_AUTODEPLOY` = `true`** — the opt-in switch. Until set, the job is a no-op
  (so merges never produce a failing deploy run before setup is finished).
- **Secret `LIGHTSAIL_SSH_KEY`** — the full private key for `ubuntu@<box>` (the contents of
  `~/.ssh/lightsail-mango.pem`).
- (optional) **Variable `MCP_DEPLOY_HOST`** (default `54.243.53.44`), **`MCP_DEPLOY_USER`** (default `ubuntu`).

After that, the gateway ships like the frontend — no hand-deploys.

## Updating (manual fallback)

Rebuild + re-export (step A), copy the new tarball to `~ubuntu/brand-coach-mcp/`, then on the box:
```bash
docker load -i brand-coach-mcp.tar.gz && docker compose up -d --force-recreate
```

## Notes / not-yet-done
- The two onboarding paths (`onboard_choose`) are walking-skeleton **stubs** today — they
  describe what's coming; the diagnostic/upload engines aren't wired. See
  `docs/MCP_CONNECT_GAPS.md` (#2–#5: paths, brain, persistence, hardening).
- Public anonymous endpoint: add rate-limiting / cost caps before wide release (GAPS #5).
