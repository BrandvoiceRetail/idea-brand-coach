# Canva Connect Integration

Operator + developer guide for the Canva Connect integration in IDEA Brand Coach.
It lets a signed-in user link their Canva account, browse their Canva designs in-app,
and import selected designs into the Brand Coach.

> **Status (this build):** Code-complete, **not yet live**. No real Canva
> credentials exist yet. The integration becomes functional the moment the four
> Canva secrets are set and the functions + migration are deployed (see
> [Secrets / wiring](#secrets--wiring) and [Deploy](#deploy)). Until then, the
> Integrations page renders but "Connect Canva" cannot complete OAuth.

---

## Overview

The integration uses **OAuth 2.0 Authorization Code + PKCE** against Canva Connect.
Access/refresh tokens live **server-side only** (Supabase Edge Functions, service
role) and are never readable by the browser.

The user click-through:

1. User opens **Integrations** (`/v1/integrations`) — a nav item gated behind auth.
2. User clicks **Connect Canva** on the Canva connection card.
3. The app calls `canva-oauth-start`, which mints a `state` + PKCE pair and returns
   the Canva authorize URL; the browser is redirected to Canva.
4. User reviews the requested scopes and approves on **Canva's consent screen**.
5. Canva redirects the browser back to `canva-oauth-callback`, which exchanges the
   code for tokens, stores them, then redirects **back into the app** at
   `/v1/integrations?canva=connected`.
6. The app shows a success toast, displays the connected Canva **display name**, and
   lists the user's Canva designs. The user can **Add to Brand Coach** any design or
   **Disconnect** at any time.

---

## Architecture

OAuth 2.0 Authorization Code flow with PKCE (S256). All token handling is
server-side; the frontend only ever sees connection *status*, never tokens.

```
 Browser (React app)                 Supabase Edge Functions            Canva Connect
 ───────────────────                 ───────────────────────            ─────────────
        │                                     │                              │
        │  1. click "Connect Canva"           │                              │
        │  POST canva-oauth-start (JWT) ─────▶ │                              │
        │                                     │  mint state + PKCE verifier  │
        │                                     │  INSERT canva_oauth_states   │
        │  ◀──── { url } ─────────────────────│  (expires in 10 min)         │
        │                                     │                              │
        │  2. window.location = url ───────────────────────────────────────▶ │
        │                                     │             3. consent screen │
        │                                     │                  (scopes)     │
        │  4. Canva 302 → canva-oauth-callback?code&state ──────────────────▶ │
        │                  (browser redirect, no app JWT)                     │
        │                                     │                              │
        │                                     │  validate state + expiry     │
        │                                     │  POST token (Basic auth +    │
        │                                     │  code_verifier) ────────────▶ │
        │                                     │  ◀──── access/refresh token ─ │
        │                                     │  GET profile + identity ────▶ │
        │                                     │  UPSERT canva_connections    │
        │                                     │  DELETE state row            │
        │  ◀── 302 /v1/integrations?canva=connected ──────────────────────── │
        │                                     │                              │
        │  5. POST canva-status (JWT) ──────▶ │ read connection (no tokens)  │
        │  ◀──── { connected, displayName }   │                              │
        │  6. POST canva-list-designs (JWT) ▶ │ refresh token if expired ──▶  │
        │                                     │ GET /designs ──────────────▶  │
        │  ◀──── { designs[], continuation? } │                              │
        │  7. POST canva-imports (add) ─────▶ │ INSERT canva_imported_designs│
        │  ◀──── { design }                   │                              │
```

### Security posture (non-negotiable)

- **Tokens are service-role-only, never client-readable.** `canva_oauth_states` and
  `canva_connections` have **RLS enabled with no policies**, so only the service role
  (edge functions) can read/write them. The browser learns connection status only
  through the `canva-status` function — never by querying the tables.
- **Identity comes from the verified JWT.** Each JWT-protected function derives the
  user via `userClient.auth.getUser()`; the user id is never trusted from the request
  body.
- **`state` is opaque + expiring.** The callback validates the returned `state`
  against `canva_oauth_states` and enforces a 10-minute expiry. The PKCE
  `code_verifier` is stored in that row and never sent to the browser.
- **`return_url` is allowlisted.** The post-callback redirect target must match
  `CANVA_ALLOWED_RETURN_ORIGINS`, preventing open-redirect.

---

## Prerequisites / Canva developer-app setup

Done once by a human in the Canva Developer portal (https://www.canva.com/developers/).
Only Canva can issue the client id/secret.

1. **Create a Canva integration** (Connect API app) in the Developer portal.
2. **Configure scopes** — the integration requests exactly:

   ```
   profile:read design:meta:read design:content:read asset:read
   ```

3. **Register the redirect URL.** Add the public URL of the `canva-oauth-callback`
   function as an allowed redirect URL. This is the same value you set as
   `CANVA_REDIRECT_URI`:

   ```
   https://ecdrxtbclxfpkknasmrw.functions.supabase.co/canva-oauth-callback
   ```

   The URL registered in Canva must match `CANVA_REDIRECT_URI` **byte-for-byte** —
   any mismatch fails the token exchange with `redirect_uri` errors.

4. Copy the generated **Client ID** and **Client Secret** for the wiring step below.

---

## Secrets / wiring

This is the step that makes the integration functional. All four are **server-side
Supabase Edge Function secrets** — never `VITE_`-prefixed and never bundled into the
client. Set them with the Supabase CLI (or the Dashboard → Project Settings → Edge
Functions → Secrets).

```bash
# 1. Canva app Client ID (from the Developer portal)
supabase secrets set CANVA_CLIENT_ID=<your-client-id>

# 2. Canva app Client Secret (from the Developer portal) — keep private
supabase secrets set CANVA_CLIENT_SECRET=<your-client-secret>

# 3. Public URL of the canva-oauth-callback function.
#    MUST match the redirect URL registered in the Canva app exactly.
supabase secrets set CANVA_REDIRECT_URI=https://ecdrxtbclxfpkknasmrw.functions.supabase.co/canva-oauth-callback

# 4. Comma-separated allowlist of app origins allowed as post-callback redirect targets.
supabase secrets set CANVA_ALLOWED_RETURN_ORIGINS=https://ideabrandcoach.icodemybusiness.com,http://localhost:5173,http://localhost:8080
```

| Secret | Purpose |
|--------|---------|
| `CANVA_CLIENT_ID` | OAuth client id; identifies the app to Canva on authorize + token requests. |
| `CANVA_CLIENT_SECRET` | OAuth client secret; sent as HTTP Basic auth (`base64("<client_id>:<client_secret>")`) on the token endpoint. Server-side only. |
| `CANVA_REDIRECT_URI` | Public URL of `canva-oauth-callback`. Must be registered in the Canva app and passed identically on authorize + token exchange. |
| `CANVA_ALLOWED_RETURN_ORIGINS` | Open-redirect guard. The `Origin` of the `canva-oauth-start` request, and the final post-callback redirect, must match one of these. Include every app origin you serve from (production + local dev ports). |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
auto-present in every function — you do **not** set them.

> **Never** prefix these with `VITE_` and never reference them in `src/`. They are
> function-environment secrets read via `Deno.env.get(...)`. `.env.example` carries a
> commented Canva section that documents this.

---

## Deploy

Run from the repo root with the Supabase CLI linked to the project
(`ecdrxtbclxfpkknasmrw`). The project is on the free tier and auto-pauses — if you
hit `INACTIVE` / NXDOMAIN / read-timeout errors, restore it in the Dashboard first.

```bash
# 1. Apply the migration (creates the three Canva tables + RLS).
supabase db push

# 2. Deploy all six Canva edge functions.
#    verify_jwt per-function flags live in supabase/config.toml; canva-oauth-callback
#    is the one public (verify_jwt=false) function — config.toml carries that flag.
supabase functions deploy canva-oauth-start canva-oauth-callback canva-status canva-disconnect canva-list-designs canva-imports

# 3. Regenerate the typed Supabase schema AFTER the migration is live.
supabase gen types typescript --project-id ecdrxtbclxfpkknasmrw > src/integrations/supabase/types.ts
```

> **`src/integrations/supabase/types.ts` is auto-generated — never hand-edit it.**
> Regenerate it with the command above whenever the schema changes. The frontend
> reaches the new tables only through the edge functions, so the app stays fully typed
> without touching this file by hand.

Set the four secrets ([above](#secrets--wiring)) **before** the first real OAuth
attempt — the functions read them at request time.

---

## Database

One migration — `supabase/migrations/20260616120000_canva_integration.sql` — creates
three tables:

| Table | What it holds | RLS |
|-------|---------------|-----|
| `canva_oauth_states` | Short-lived `state` + PKCE `code_verifier` + `return_url`, with `expires_at` (10-min TTL). Consumed once by the callback. | **Enabled, no policies** (service-role only). |
| `canva_connections` | Per-user Canva tokens (`access_token`, `refresh_token`, `token_expires_at`) + `canva_user_id`, `canva_team_id`, `display_name`, `scopes`. Keyed by `user_id`. | **Enabled, no policies** (service-role only). |
| `canva_imported_designs` | Imported design references (no tokens): `canva_design_id`, `title`, `thumbnail_url`, `edit_url`, `view_url`. Unique per `(user_id, canva_design_id)`. | **Enabled.** Owner (`auth.uid() = user_id`) may SELECT + DELETE; INSERT is done by the edge function via service role. |

**Why the token tables have no RLS policies:** RLS-enabled-with-no-policies means
*every* client-key request is denied — there is no policy that ever returns a row.
Only the service role (used by the edge functions) bypasses RLS. This guarantees the
browser can never read `access_token` / `refresh_token` / `code_verifier`, even with a
valid user session. `canva_imported_designs` holds no secrets, so it gets a normal
owner-scoped read/delete policy; writes still go through the function.

---

## Data flow into the Brand Coach

1. `canva-list-designs` reads the user's **live** Canva designs (refreshing the access
   token first if it's expired), returning a normalized list with thumbnail / edit /
   view URLs.
2. When the user clicks **Add to Brand Coach**, the app calls `canva-imports` with
   `{ action: 'add', design }`, which inserts a row into `canva_imported_designs` (via
   service role).
3. Imported designs are read back with `canva-imports` `{ action: 'list' }` and
   surfaced in-app. Removing one calls `{ action: 'remove', designId }` (owner DELETE).

The frontend never queries `canva_imported_designs` directly — it always goes through
the `canva-imports` function, which keeps the wire shapes typed without editing the
generated `types.ts`.

---

## Verifying it works

End-to-end manual checklist (requires the secrets set + functions/migration deployed,
and a real Canva account):

1. Sign in, open `/v1/integrations`. The Canva card shows the **disconnected** state.
2. Click **Connect Canva** → redirected to Canva → approve the scopes.
3. Land back on `/v1/integrations?canva=connected`; a success toast fires and the URL
   param is stripped.
4. The card now shows **connected** with your Canva **display name**.
5. The designs list populates (thumbnails + titles). Paginate if a `continuation`
   token is returned.
6. Click **Add to Brand Coach** on one design → it appears in the imported list.
7. Click **Disconnect** → card returns to the disconnected state.

Confirm in Supabase (Dashboard → Table Editor, or SQL with the service role):

```sql
-- A connection row exists after step 4 (do NOT expose token columns to clients):
select user_id, canva_user_id, display_name, scopes, token_expires_at
from public.canva_connections;

-- An imported design row exists after step 6:
select user_id, canva_design_id, title, imported_at
from public.canva_imported_designs;

-- State rows are short-lived and should be empty/expired between connects:
select state, expires_at from public.canva_oauth_states;
```

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| **`redirect_uri` mismatch** on the Canva consent or token exchange | The redirect URL registered in the Canva app does not exactly match `CANVA_REDIRECT_URI`. They must be byte-for-byte identical, including scheme, host, and path (`https://ecdrxtbclxfpkknasmrw.functions.supabase.co/canva-oauth-callback`). |
| **`origin_not_allowed`** (401/403 from `canva-oauth-start`) | The request `Origin` is not in `CANVA_ALLOWED_RETURN_ORIGINS`. Add the origin you're serving from (e.g. `http://localhost:5173`) to the allowlist secret and re-set it. |
| **`not_connected`** (409 from `canva-list-designs`) | No `canva_connections` row for the user — they haven't connected yet, or were disconnected. Run the Connect flow first. |
| **Designs stop loading after a while / token expired** | Access tokens are short-lived (`expires_in`). `canva-list-designs` refreshes automatically using the stored `refresh_token`. Refresh tokens **rotate** — the new one is persisted each refresh. If refresh fails (revoked/expired refresh token), the user must reconnect. |
| **`canva=error&reason=...` on return** | The callback failed (token exchange, profile fetch, or state validation). The `reason` slug indicates the cause. Re-attempt the connect; if `state` had expired (>10 min between start and approval), just start again. |
| **State expiry** | `canva_oauth_states` rows expire after 10 minutes. If the user lingers on Canva's consent screen too long, the callback rejects the stale `state` — start the connect again. |
| **Function returns INACTIVE / NXDOMAIN / read timeout** | The free-tier Supabase project auto-paused. Restore it in the Dashboard, then retry. |

---

## Status note

As of this build, **no real Canva credentials exist yet**. The integration is
code-complete (migration, six edge functions, frontend route/page/service/hook/
components, tests). It becomes live once a human:

1. Registers the Canva app and obtains a real client id/secret,
2. Sets the four secrets ([above](#secrets--wiring)),
3. Deploys the functions and applies the migration to the live Supabase project,
4. Regenerates `src/integrations/supabase/types.ts`.

These four steps are intentionally out of scope for the code build — only a human can
perform them against the shared live project.
