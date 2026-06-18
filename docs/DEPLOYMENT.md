# Deployment — ideabrandcoach.icodemybusiness.com

The app is a static Vite/React SPA. The backend (Supabase: Auth, Postgres, Edge
Functions) is already cloud-hosted and unchanged by this deployment.

## Hosting: Lightsail + Caddy (NOT GitHub Pages)

The site is served by **Caddy `file_server` on the mango Lightsail box**
(`54.243.53.44`) from `/opt/ideabrandcoach`, at
**https://ideabrandcoach.icodemybusiness.com**. GitHub Pages is **disabled at the
org level** (the old `deploy-pages.yml` failed on every run because
`configure-pages` can't create a Pages site), so Pages is not the deploy path.

### How a deploy happens (CI/CD)

`.github/workflows/deploy-frontend.yml` runs on **push to `main`** (or manual
**workflow_dispatch**). It:

1. `npm ci && npm run build` → `dist/`
2. `cp dist/index.html dist/404.html` — SPA fallback (BrowserRouter deep links).
3. **rsyncs `dist/` to `ubuntu@54.243.53.44:/opt/ideabrandcoach/`** over SSH, then
   verifies the live bundle hash matches the build.

One-time setup (Settings → Secrets and variables → Actions):
- Variable **`FRONTEND_AUTODEPLOY` = `true`** — opt-in switch (no-op until set).
- Secret **`LIGHTSAIL_SSH_KEY`** — private key for `ubuntu@<box>` (shared with `deploy-mcp.yml`).

Manual fallback (what to run if CI is off): `npm run build` then
`rsync -az --delete -e "ssh -i ~/.ssh/lightsail-mango.pem" dist/ ubuntu@54.243.53.44:/opt/ideabrandcoach/`.

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
