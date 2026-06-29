# Deployment — ideabrandcoach.icodemybusiness.com

The app is a static Vite/React SPA. The backend (Supabase: Auth, Postgres, Edge
Functions) is already cloud-hosted and unchanged by this deployment.

## Hosting: Lightsail + Caddy (NOT GitHub Pages)

The site is served by **Caddy `file_server` on the mango Lightsail box**
(`54.243.53.44`) from `/opt/ideabrandcoach`, at
**https://ideabrandcoach.icodemybusiness.com**. GitHub Pages is **disabled at the
org level** (the old `deploy-pages.yml` failed on every run because
`configure-pages` can't create a Pages site), so Pages is not the deploy path.

## Source of truth: `main` (both the SPA AND the MCP gateway)

As of **2026-06-28, `main` is the single source for both deployables** — the Vite
SPA *and* the brand-coach MCP gateway. (Previously the MCP lived on a separate
`mcp-oauth` branch; that fork was reconciled and `mcp-oauth` now tracks `main`.
**Do not reintroduce the split** — commit MCP changes to `main`. A divergent
`mcp-oauth` is what once shipped a frontend bundle missing the `/oauth/consent`
page and 404'd the connector.)

**Whatever is on `main` is what goes live.** Merge intended production code to
`main` first, then deploy from a checkout of `main`.

## Deploys run MANUALLY from a local machine (CI can't reach the box)

`.github/workflows/deploy-frontend.yml` and `deploy-mcp.yml` exist, but the
Lightsail box firewalls SSH (port 22) to a known IP, so **GitHub-hosted runners
cannot reach it** (`ssh: connect … port 22: Connection timed out`) and the
autodeploy variables (`FRONTEND_AUTODEPLOY`, `MCP_AUTODEPLOY`) are left `false`.
Until the box accepts the runner (or a self-hosted runner is added), **deploy from
a local machine that can SSH the box**, with key `~/.ssh/lightsail-mango.pem`.

### Frontend (SPA) — build + rsync

> ⚠️ **Rebuild from the LATEST `main` immediately before you rsync.** `rsync --delete`
> mirrors your local `dist/` over prod, so a build made from a branch that's behind
> `main` will silently REVERT whatever landed on `main` since — clobbering other
> sessions' work (this has happened). Always `git fetch` + fast-forward/merge `main`,
> rebuild, *then* rsync. If multiple people deploy, coordinate so two rsyncs don't race.

From a `main` checkout:

```bash
npm run build                 # set VITE_FORCE_V4=true to force /v4; VITE_POSTHOG_* etc. as needed
cp dist/index.html dist/404.html   # SPA fallback for BrowserRouter deep links
rsync -az --delete \
  --exclude='onboard.html' --exclude='onboard-assets/' --exclude='index.html.bak.*' \
  -e "ssh -i ~/.ssh/lightsail-mango.pem" dist/ ubuntu@54.243.53.44:/opt/ideabrandcoach/
```

Then **verify over HTTP, not just on disk**: `/` serves the static `landing.html`
(Caddy front-door rewrite), so check an *app* route (e.g. `/welcome`) and confirm
the served bundle hash matches `dist/assets/index-*.js`. Rollback: an
`index.html.bak.*` is kept on the box, or rebuild the prior commit + rsync.

> `VITE_FORCE_V4` lives only in the worktree's gitignored `.env`; a clean `main`
> build WITHOUT it reverts to gate-OFF (`/v4` not forced). Set it in the build env
> (or a repo var) to keep `/v4` forced across rebuilds.

### MCP gateway — typecheck, build image, ship
Gate first: **`npm run typecheck:mcp`** (NOT just `tsc --noEmit` — only the MCP
tsconfig type-checks the MCP test files) + `npm test`. Then, from a `main` checkout:

```bash
npm run mcp:bundle            # esbuild → dist-mcp/server.mjs
docker build --platform linux/amd64 -f deploy/mcp/Dockerfile -t brand-coach-mcp:latest .
docker save brand-coach-mcp:latest | gzip > brand-coach-mcp.tar.gz
scp -i ~/.ssh/lightsail-mango.pem brand-coach-mcp.tar.gz ubuntu@54.243.53.44:~/brand-coach-mcp/
ssh -i ~/.ssh/lightsail-mango.pem ubuntu@54.243.53.44 \
  'cd ~/brand-coach-mcp && docker load -i brand-coach-mcp.tar.gz && docker compose up -d --force-recreate && rm brand-coach-mcp.tar.gz && sleep 4 && curl -fsS http://127.0.0.1:8787/healthz'
```

Compose project: `/home/ubuntu/brand-coach-mcp`, on docker net `mango_default`
(Caddy reverse-proxies `…/mcp` → `brand-coach-mcp:8787`). The box keeps
`brand-coach-mcp.prev.tar.gz` for rollback.

### Supabase migrations
Apply **additive** migrations to prod via the Supabase MCP `apply_migration` (the
`SUPABASE_ACCESS_TOKEN` PAT can). Verify the live schema afterwards; regenerate —
never hand-edit — `src/integrations/supabase/types.ts`.

## One-time setup (manual, outside this repo)

### 1. DNS — add the subdomain at Namecheap

`icodemybusiness.com` DNS is managed at Namecheap. Add:

| Type  | Host          | Value                       |
|-------|---------------|-----------------------------|
| CNAME | `ideabrandcoach` | `brandvoiceretail.github.io.` |

(Repo owner is the `BrandvoiceRetail` org, so the Pages host is
`brandvoiceretail.github.io`.) Allow a few minutes to propagate; GitHub then
provisions a Let's Encrypt cert automatically (Settings → Pages shows the
"Enforce HTTPS" state once the cert is ready).

If GitHub reports the domain is "not properly configured" / already in use:
the org may need to **verify the domain** (Org Settings → Pages → add a domain →
add the `_github-pages-challenge-brandvoiceretail` TXT record at Namecheap).

### 2. Supabase Auth — allow the new origin

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://ideabrandcoach.icodemybusiness.com`
- **Redirect URLs:** add `https://ideabrandcoach.icodemybusiness.com/**`

Otherwise email-confirmation / magic-link / OAuth redirects break on the new
domain.

### CORS

Edge functions already send `Access-Control-Allow-Origin: *`, so no backend
change is needed for the new origin.

## Notes

- `base` stays `/` (Vite default) — correct for a custom domain served at the
  subdomain root.
- Frontend config is self-contained: the Supabase URL + anon key are hardcoded
  fallbacks in `src/integrations/supabase/client.ts`, and only `VITE_`-prefixed
  vars (PostHog) are inlined at build time. Server secrets in `.env.local` are
  **not** bundled.
- Whatever is on `main` is what goes live. Merge intended production code before
  (or as) you deploy.
