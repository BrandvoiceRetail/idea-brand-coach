# Deployment — ideabrandcoach.icodemybusiness.com

The app is a static Vite/React SPA. The backend (Supabase: Auth, Postgres, Edge
Functions) is already cloud-hosted and unchanged by this deployment.

## Hosting: Lightsail + Caddy (NOT GitHub Pages)

The site is served by **Caddy `file_server` on the mango Lightsail box**
(`54.243.53.44`) from `/opt/ideabrandcoach`, at
**https://ideabrandcoach.icodemybusiness.com**. GitHub Pages is **disabled at the
org level** (the old `deploy-pages.yml` failed on every run because
`configure-pages` can't create a Pages site), so Pages is not the deploy path.

## Serving the branded apex `ideabrandcoach.com`

`ideabrandcoach.com` is registered by **Trevor** at Easyspace (DNS via 34SP:
`ns.34sp.com` / `ns2.34sp.com`); the working app runs on Matthew's
`ideabrandcoach.icodemybusiness.com` (Lightsail `54.243.53.44`). To serve the app at
the apex:

1. **Trevor (DNS at Easyspace/34SP):** add `A  @  → 54.243.53.44` and
   `A  www → 54.243.53.44` (the apex can't be a CNAME). The root currently returns a
   404 "Build incomplete" placeholder, so this is non-destructive.
2. **On the box, once DNS resolves** (`dig +short ideabrandcoach.com` == `54.243.53.44`):
   add the two hostnames to the EXISTING vhost's address line in `/opt/mango/Caddyfile`
   (single-file bind-mount — edit in place to preserve the inode). Back it up first:
   `cp /opt/mango/Caddyfile /opt/mango/Caddyfile.bak.apex`. Change
   `ideabrandcoach.icodemybusiness.com {` to
   `ideabrandcoach.icodemybusiness.com, ideabrandcoach.com, www.ideabrandcoach.com {`.
   Reusing the same block guarantees identical behaviour (SPA rewrite, `/assets/*`
   immutable + `@spa_html` no-cache, `/mcp*` proxy) with **zero drift**. Reload:
   `docker exec mango-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.
   Caddy auto-issues Let's Encrypt certs for the new hostnames on first hit (needs the
   step-1 DNS live, else the HTTP-01 challenge fails — so apply this AFTER DNS propagates).
3. **Verify:** `curl -sI https://ideabrandcoach.com/welcome` → `200`, and the served
   `index-*.js` hash matches `dist/`. Optional `www`→apex canonicalisation: instead of
   adding `www` to the shared line, give it its own block —
   `www.ideabrandcoach.com { redir https://ideabrandcoach.com{uri} permanent }`.
4. **App metadata:** once live at the apex, switch the `og:image` / `twitter:image`
   absolute URLs in `index.html` from `ideabrandcoach.icodemybusiness.com` to
   `ideabrandcoach.com`.

## Source of truth: `main` (both the SPA AND the MCP gateway)

As of **2026-06-28, `main` is the single source for both deployables** — the Vite
SPA *and* the brand-coach MCP gateway. (Previously the MCP lived on a separate
`mcp-oauth` branch; that fork was reconciled and `mcp-oauth` now tracks `main`.
**Do not reintroduce the split** — commit MCP changes to `main`. A divergent
`mcp-oauth` is what once shipped a frontend bundle missing the `/oauth/consent`
page and 404'd the connector.)

**Whatever is on `main` is what goes live.** Merge intended production code to
`main` first, then deploy from a checkout of `main`.

## Deploys: push to `main` (auto) — manual is the fallback

**Primary path — auto-deploy on merge to `main`.** `.github/workflows/deploy.yml` runs on a
**self-hosted GitHub Actions runner on the Lightsail box** (the box firewalls inbound SSH, so
GitHub-hosted runners can't reach it — the runner instead polls GitHub *outbound* and deploys
locally). One run builds the SPA from main's tip, rsyncs it, rebuilds the MCP container if its
inputs changed, deploys changed Supabase edge functions, and smoke-checks the live bundle +
`/healthz`. DB migrations are a **separate, manually-approved** workflow (`.github/workflows/migrate.yml`,
gated by the `production-db` Environment) so a schema change can't auto-mutate prod without a human OK.

One-time activation (register the runner + provide the box-side build env) is in
[`docs/CICD_SELF_HOSTED_RUNNER.md`](CICD_SELF_HOSTED_RUNNER.md). **Until the runner is registered,
`deploy.yml` just queues** — fall back to the manual steps below. The old GitHub-hosted
`deploy-frontend.yml` / `deploy-mcp.yml` are **superseded** (they can't reach the box) and now
run manual-dispatch only; `git rm` them when convenient.

**Fallback — manual deploy from a local machine that can SSH the box** (key
`~/.ssh/lightsail-mango.pem`), e.g. when the runner is down. ⚠️ Build with the COMPLETE
`.env` (the canonical `VITE_*` set — a partial env silently ships a degraded bundle; this
bit us 2026-07-19 when the beta-feedback widget shipped disabled). The steps:

### Frontend (SPA) — build + rsync

> ⚠️ **Rebuild from the LATEST `main` immediately before you rsync.** `rsync --delete`
> mirrors your local `dist/` over prod, so a build made from a branch that's behind
> `main` will silently REVERT whatever landed on `main` since — clobbering other
> sessions' work (this has happened). Always `git fetch` + fast-forward/merge `main`,
> rebuild, *then* rsync. If multiple people deploy, coordinate so two rsyncs don't race.

From a `main` checkout:

```bash
npm run build                 # VITE_RELEASE_STAGE=alpha (also the default) forces the single surface; VITE_POSTHOG_* etc. as needed
cp dist/index.html dist/404.html   # SPA fallback for BrowserRouter deep links
rsync -az --delete \
  --exclude='onboard.html' --exclude='onboard-assets/' --exclude='index.html.bak.*' \
  -e "ssh -i ~/.ssh/lightsail-mango.pem" dist/ ubuntu@54.243.53.44:/opt/ideabrandcoach/
```

Then **verify over HTTP, not just on disk**: `/` serves the static `landing.html`
(Caddy front-door rewrite), so check an *app* route (e.g. `/welcome`) and confirm
the served bundle hash matches `dist/assets/index-*.js`. Rollback: an
`index.html.bak.*` is kept on the box, or rebuild the prior commit + rsync.

> ✅ **FIXED 2026-06-29 — `index.html` no-cache.** The box Caddyfile
> (`/opt/mango/Caddyfile`, `ideabrandcoach.icodemybusiness.com` block) now sets
> `Cache-Control: no-cache` on the SPA entry + all deep routes (`@spa_html` = not
> `/assets/*`, not `/mcp*`) and `public, max-age=31536000, immutable` on `/assets/*`.
> So browsers revalidate the entry HTML every load (deploys reach users immediately)
> while hashed bundles stay long-cached. Edit the Caddyfile IN PLACE (it's a
> single-file bind-mount → preserves inode), then `docker exec mango-caddy-1 caddy
> reload --config /etc/caddy/Caddyfile --adapter caddyfile`. Backup kept at
> `/opt/mango/Caddyfile.bak.sally-cachehdr`. (Pre-fix symptom: a test browser ran a
> days-old `index-*.js`.)

> ⚠️ **Deploy-race clobber is real (observed 2026-06-29):** two sessions deployed
> minutes apart; the second built from a tree missing the first's commit and its
> `rsync --delete` reverted the first's live bundle (the code stayed on `main`, just
> not served). ALWAYS `git fetch` + ff `main` and **rebuild from the latest tip**
> immediately before rsync, and re-verify the live bundle contains your change (grep
> the served `index-*.js` for a string unique to your commit).

> **Release stage — `VITE_RELEASE_STAGE` (`alpha`|`beta`|`ga`).** The single flag that
> drives both the surface gate and feature gating (it replaced the stale `VITE_FORCE_V4`
> and `VITE_DEPLOYMENT_PHASE`). It **fails forward**: unset/invalid resolves to `alpha`,
> so a clean `main` build with no `.env` correctly forces the single customer surface +
> alpha features — no more "forgot the flag → shipped the legacy chooser" footgun. Prod
> builds with `VITE_RELEASE_STAGE=alpha`; set a later stage only to unlock beta/GA
> features. Source of truth: `src/config/releaseStage.ts`.

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
