# Push-to-main auto-deploy (self-hosted runner on Lightsail)

Replaces the manual `npm run build` + `rsync --delete` deploy with **push to `main` →
auto-deploy**, running entirely on the existing Lightsail box. No new host, no DNS
change, `/mcp` stays a path on the same domain.

## Why this shape

CI couldn't deploy because the box firewalls **inbound** SSH to a home IP. So instead of
CI reaching *in*, the box runs a **self-hosted GitHub Actions runner** that polls GitHub
**outbound** over HTTPS and deploys locally. The workflow (`.github/workflows/deploy.yml`)
always builds from `main`'s tip, so the stale-branch `--delete` clobber (which rolled prod
back 25 commits' worth once) **cannot happen**.

**Cost: $0.** Self-hosted runners consume zero GitHub-hosted minutes (free even on free
plans for private repos) and run on the box you already pay for.

## Pre-flight (do these ONCE before enabling, or the first deploy can surprise you)

1. **The change must be on `main`.** The runner deploys `main` — nothing else. (Work in
   flight on feature branches only ships once merged.)
2. **Reconcile the static HTML.** `landing.html` / `onboard.html` were historically
   EXCLUDED from the old rsync, so the box may hold hand-edited copies. The new deploy
   serves the **repo** versions with `--delete`. Before the first run, diff the live box
   copies against the repo and pull any box-only edits back into the repo:
   ```bash
   for f in landing.html onboard.html; do
     ssh -i ~/.ssh/lightsail-mango.pem ubuntu@54.243.53.44 "cat /opt/ideabrandcoach/$f" \
       | diff - public/$f && echo "$f: in sync" || echo "$f: DIFFERS — reconcile before deploy"
   done
   ```
3. **First-run safety valve (optional):** for the very first auto-deploy, drop `--delete`
   from the `Deploy frontend` step, confirm the result, then re-add it.

## One-time box setup

SSH in as `ubuntu` (`ssh -i ~/.ssh/lightsail-mango.pem ubuntu@54.243.53.44`), then:

**1. Install the runner as a service.** Get the registration token + exact version from
GitHub: repo → **Settings → Actions → Runners → New self-hosted runner (Linux x64)**. Then:
```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
# use the URL/version/token GitHub shows you:
curl -o runner.tar.gz -L https://github.com/actions/runner/releases/download/vX.Y.Z/actions-runner-linux-x64-X.Y.Z.tar.gz
tar xzf runner.tar.gz
./config.sh --url https://github.com/BrandvoiceRetail/idea-brand-coach \
  --token <REGISTRATION_TOKEN> --labels self-hosted,lightsail --name lightsail-mango --unattended
sudo ./svc.sh install ubuntu      # run as the ubuntu user
sudo ./svc.sh start               # persists across reboots
```

**2. Grant the runner what it needs.**
```bash
sudo usermod -aG docker ubuntu            # MCP rebuild needs docker; then: sudo ./svc.sh stop && sudo ./svc.sh start
sudo chown -R ubuntu /opt/ideabrandcoach  # runner writes the served dir without sudo
# git, rsync, curl are already present. Node is provided per-run by actions/setup-node.
```

**3. Provide the build env (the `VITE_*` vars).** The workflow copies this into the build
as `.env.production.local`. Populate it from your current prod `.env`:
```bash
mkdir -p ~/ibc-deploy && nano ~/ibc-deploy/.env.production
```
It must contain every build-time var the app reads:
```
VITE_SUPABASE_URL=…
VITE_SUPABASE_PUBLISHABLE_KEY=…
VITE_POSTHOG_KEY=…
VITE_POSTHOG_HOST=…
VITE_FORCE_V4=true
VITE_ADMIN_EMAILS=…
VITE_DEPLOYMENT_PHASE=…
VITE_ENABLE_BETA_FEEDBACK=…
VITE_ENABLE_FIGMA=…
VITE_COMPETITOR_AGENTS=…
VITE_CONTENT_GENERATION=…
VITE_VIDEO_GENERATION=…
```
(Keep it off the repo — it lives only on the box. Non-`VITE_` runtime secrets stay where
they are: Supabase secrets for edge fns, box env for the MCP container.)

That's it. Merge the workflow to `main`; the next push to `main` deploys. (Before the
runner exists, the workflow just queues — harmless.)

## Everyday use

- **Deploy:** merge to `main`. Watch it in the repo's **Actions** tab.
- **Manual re-deploy / rollback:** Actions → *Deploy to prod (Lightsail)* → **Run workflow**,
  pick a branch/tag/older SHA. (Or the existing `index.html.bak.*` on the box.)
- **What it does each run:** build from main → deploy SPA (incl. landing/onboard) → rebuild
  the MCP container *only if* `src/mcp`/`deploy/mcp` changed → smoke-check the live bundle
  hash + MCP `/healthz`.

## Optional upgrade: atomic releases (zero-downtime + instant rollback)

The v1 above rsyncs into `/opt/ideabrandcoach` in place (a sub-second update window, fine
for now). To make releases atomic and rollback a one-liner, switch to symlinked releases:
deploy into `/opt/ideabrandcoach/releases/<sha>/`, then `ln -sfn` a `current` symlink and
point Caddy's `root` at `/opt/ideabrandcoach/current`. Rollback = repoint the symlink at a
prior release. (Requires a one-time Caddy `root` change + moving the current files into an
initial release dir.)

## Security

- **Private repo only** (this one is). Self-hosted runners on public repos are an RCE risk
  (fork PRs could run arbitrary code on the box).
- The runner executes any workflow on `main` with box access — keep `main` protected and
  limit who can merge.

## Edge functions + DB migrations (added 2026-07-19)

`deploy.yml` now also **deploys changed edge functions** (a `supabase functions deploy` step,
path-filtered on `supabase/functions/**`; a `_shared/` change redeploys all). `migrate.yml`
**applies DB migrations behind a manual-approval gate**. To enable them:

1. **Runner needs the Supabase CLI:** `curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar xz -C ~/.local/bin` (or `brew`/`npm i -g supabase`), then confirm `supabase --version` in the runner's PATH.
2. **Secrets** (repo → Settings → Secrets and variables → Actions):
   - `SUPABASE_ACCESS_TOKEN` — personal access token (management API; used by both steps).
   - `SUPABASE_DB_PASSWORD` — the project DB password (`supabase db push` in `migrate.yml`).
3. **Environment** `production-db` (repo → Settings → Environments): add yourself as a
   **Required reviewer** — this is the approval gate that makes migrations pause for a human.
4. **⚠️ Before trusting the edge-fn step:** reconcile EVERY function repo-from-deployed
   (some deployed fns were hand-hardened; the repo can lag). A stale repo version would
   regress that hardening on the next automated deploy. 4 were verified 2026-07-19
   (reveal / save-feedback / gdpr×2); sweep the rest first.

**Ordering note:** for a coordinated schema+code change, approve the `migrate.yml` run FIRST
so the schema lands before the renamed code — see the header comment in `migrate.yml`.

## Follow-ups (from the deploy-cleanup review)

- Bring the **Caddyfile into the repo** (`deploy/caddy/Caddyfile`) and let the workflow
  reload it on change — today it's hand-edited on the box and drifts.
- Delete the superseded `deploy-frontend.yml` / `deploy-mcp.yml` (now inert manual-dispatch stubs).
- One `docs/CONFIG.md` table of every secret/env and where it lives (the URL constants in
  `src/config/urls.ts` + `supabase/functions/_shared/appUrl.ts` are the first rows).
