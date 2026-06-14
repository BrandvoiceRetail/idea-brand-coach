# Deployment — ideabrandcoach.icodemybusiness.com

The app is a static Vite/React SPA. The backend (Supabase: Auth, Postgres, Edge
Functions) is already cloud-hosted and unchanged by this deployment.

## Hosting: GitHub Pages

The site is served by **GitHub Pages** from this repo, at the custom domain
**https://ideabrandcoach.icodemybusiness.com**. This matches how the rest of
`icodemybusiness.com` is hosted (the apex/`www` site runs on GitHub Pages too;
the `mango.` subdomain is a separate Lightsail box).

### How a deploy happens (CI/CD)

`.github/workflows/deploy-pages.yml` runs on **push to `main`** (and via manual
**workflow_dispatch** for a smoke test from any branch). It:

1. `npm ci && npm run build` → `dist/`
2. `cp dist/index.html dist/404.html` — SPA fallback. The app uses
   `BrowserRouter`, so deep links (e.g. `/diagnostic`) are served the app shell;
   React Router then renders the route.
3. Uploads `dist/` and deploys it to Pages.

The job's `GITHUB_TOKEN` carries `pages: write` + `id-token: write`, so it
enables and deploys Pages without anyone needing repo-admin in the GitHub UI.

`public/CNAME` (`ideabrandcoach.icodemybusiness.com`) is copied into `dist/` by
Vite and tells Pages which custom domain to bind + request a TLS cert for.

To deploy: merge to `main` (production), or run the workflow manually from the
Actions tab.

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
