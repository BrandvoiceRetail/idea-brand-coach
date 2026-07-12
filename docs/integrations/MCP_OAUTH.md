# MCP OAuth — Brand-Coach connector authentication

Lets a Claude (or any MCP) client authenticate the IDEA Brand Coach connector so it can
reach the identity-gated tools (avatars, ledger, coach conversations) as the signed-in
user. Before this, the connector could only connect **anonymously** — every private read
came back "authentication required," which the model surfaced as *"the connector needs
you to approve/authorize it."*

## Architecture

The gateway is an **OAuth 2.0 protected resource**; **Supabase Auth is the authorization
server** (it owns `/authorize`, `/token`, Dynamic Client Registration, PKCE, consent, and
refresh). The gateway only:

1. advertises the AS via RFC 9728 protected-resource metadata, and
2. returns a `401` + `WWW-Authenticate` challenge on unauthenticated `/mcp`, which starts
   the client's OAuth flow.

Token validation is unchanged — `context/identity.ts` still calls `auth.getUser` against
the same Supabase project, so the only tokens accepted are this project's own.

```
Claude --POST /mcp (no token)--> gateway --401 WWW-Authenticate: resource_metadata=…-->
Claude --GET /.well-known/oauth-protected-resource--> gateway --{authorization_servers:[supabase]}-->
Claude --GET supabase/.well-known/oauth-authorization-server--> Supabase --metadata-->
Claude --DCR /oauth/clients/register--> client_id
Claude --/oauth/authorize (PKCE, resource)--> 302 ideabrandcoach.../oauth/consent?authorization_id=…
  user approves on the app-hosted consent page (src/pages/OAuthConsent.tsx)
Claude --/oauth/token (code+verifier)--> access_token (a normal Supabase JWT)
Claude --POST /mcp (Bearer access_token)--> authenticated tools
```

## The four pieces

### 1. Gateway (this repo) — `src/mcp/oauth.ts`, `http.ts`, `config.ts`
- `GET /.well-known/oauth-protected-resource[/mcp]` → metadata (`resource`,
  `authorization_servers`, `scopes_supported`).
- Unauthenticated `/mcp` → `401` + `WWW-Authenticate: Bearer resource_metadata="…",
  scope="email"` when `MCP_OAUTH_REQUIRE_AUTH=true`.
- Env: `MCP_PUBLIC_URL`, `MCP_OAUTH_REQUIRE_AUTH` (kill switch), `MCP_OAUTH_SCOPE`.

### 2. Consent page (this repo) — `src/pages/OAuthConsent.tsx`, route `/oauth/consent`
Supabase delegates the user-facing approve/deny step to an app-hosted page. It requires a
signed-in Supabase session (bounces to `/auth?redirect=…`), fetches
`GET /auth/v1/oauth/authorizations/{id}`, and on approve/deny POSTs
`/auth/v1/oauth/authorizations/{id}/consent {action}` then follows the returned
`redirect_url`.

### 3. Supabase project config (Management API or dashboard)
`PATCH /v1/projects/{ref}/config/auth`:
- `oauth_server_enabled: true`
- `oauth_server_allow_dynamic_registration: true`  (Claude uses DCR)
- `oauth_server_authorization_path: "/oauth/consent"`
- `uri_allow_list` += `https://claude.ai/api/mcp/auth_callback` (+ `http://localhost/callback`,
  `http://127.0.0.1/callback` for Claude Code)

### 4. Caddy (prod box `/opt/mango/Caddyfile`)
Add **before** the SPA catch-all, inside the `ideabrandcoach…` block:
```
handle /.well-known/oauth-protected-resource* {
    reverse_proxy brand-coach-mcp:8787
}
```
The Caddyfile is bind-mounted single-file → `docker restart mango-caddy-1` to apply
(reload no-ops). `/oauth/consent` needs no Caddy change (SPA try_files serves it).

## Deploy (prod)
- **Gateway:** `npm run mcp:bundle` → scp `dist-mcp/server.mjs` to
  `/home/ubuntu/brand-coach-mcp/build/dist-mcp/` → `docker build -f deploy/mcp/Dockerfile
  -t brand-coach-mcp:latest .` (in `build/`) → `docker compose up -d --force-recreate`.
  Set the `MCP_OAUTH_*` vars in `/home/ubuntu/brand-coach-mcp/.env`.
- **Frontend:** `npm run build` → `rsync dist/ → /opt/ideabrandcoach/`.

## Known limitation — the `openid` scope
The project has **no asymmetric JWT signing key** (empty JWKS, legacy HS256 only), so
requesting `scope=openid` makes Supabase's `/oauth/token` 500 with *"Error generating ID
token."* We sidestep this by advertising `scope="email"` in the challenge + metadata
(Anthropic's documented control point). If a client ever ignores that and requests
`openid`, the fix is to add an asymmetric signing key and promote it to in-use
(`/v1/projects/{ref}/config/auth/signing-keys`) — a **project-wide** auth change (affects
all token signing), so weigh it against any in-flight auth migration before doing it.

## Rollback
- Disable enforcement: set `MCP_OAUTH_REQUIRE_AUTH=false` + recreate the container (metadata
  stays; `/mcp` serves anonymously again — instant).
- Full disable: `PATCH config/auth {oauth_server_enabled:false}` (AS metadata 404s again).
