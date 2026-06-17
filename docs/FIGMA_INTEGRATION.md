# Figma Integration

Connect a user's Figma account via OAuth and import a file's design data
(color palette, typography, components) so the **IDEA Brand Coach** can reference
the user's real visual brand identity.

The flow is fully click-through: **Connect Figma → authorize on Figma → import a
file → the extracted design data flows into the coach's knowledge base.**

---

## User flow

1. A signed-in user opens **Settings** (coach header button / user menu → "Settings",
   route `/settings`) and selects the **Integrations** tab (`/settings/integrations`).
2. Clicks **Connect Figma** → redirected to Figma's consent screen (read-only
   file scope).
3. Figma redirects back to `/integrations/figma/callback`; the app exchanges the
   code and stores the connection.
4. The user pastes a **Figma file URL or key** and clicks **Import**.
5. The file's palette, typography, components and pages are extracted, saved, and
   written into the coach's knowledge base as a `visual_identity` summary.
6. From then on the brand coach's context includes a **"VISUAL IDENTITY (from
   Figma)"** section describing the user's actual colors and fonts.

---

## Architecture

```
Browser (React SPA)
  └─ FigmaConnectCard / useFigmaIntegration / FigmaIntegrationService
        │  supabase.functions.invoke(...)
        ▼
Supabase Edge Functions (Deno)            Postgres
  figma-oauth-start  ──────────────────►  figma_oauth_state   (service-role only)
  figma-oauth-exchange ────────────────►  figma_connections   (service-role only, tokens encrypted)
  figma-status        ─────────────────►  figma_connections / figma_imports (read)
  figma-sync  ── Figma REST API ───────►  figma_imports + user_knowledge_base(visual_identity)
  figma-disconnect ────────────────────►  figma_connections   (delete)
        │
        └─ _shared/figma.ts (OAuth + REST + AES-GCM token crypto)
           _shared/figma-extract.ts (pure palette/typography extractor — unit-tested)
           _shared/edge-auth.ts (service client + getAuthedUserId + jsonResponse)

Brand coach (idea-framework-consultant-claude/context.ts)
  reads user_knowledge_base where category = 'visual_identity'
```

### OAuth sequence

```
SPA  ── figma-oauth-start ─►  store CSRF state (10 min, single-use)  ─► return authorize URL
SPA  ── window.location ───►  https://www.figma.com/oauth?...&state=...
Figma ── redirect ────────►  /integrations/figma/callback?code=...&state=...
SPA  ── figma-oauth-exchange(code,state) ─► validate state == auth.uid()
                                           ─► POST api.figma.com/v1/oauth/token (HTTP Basic)
                                           ─► GET /v1/me
                                           ─► upsert figma_connections (tokens AES-GCM encrypted)
```

Every sensitive operation is authenticated and tied to `auth.uid()`. The callback
function is **not** a public endpoint — the code is exchanged from the SPA while
the user is signed in.

---

## Setup runbook

These steps make the feature live in an environment. The code is already in the
repo; this is the deploy/config that needs human credentials.

### 1. Create a Figma OAuth app

1. Go to <https://www.figma.com/developers/apps> → **Create a new app**.
2. Copy the **Client ID** and **Client secret**.
3. Add an **OAuth 2.0 redirect URL** for each environment, using the pattern
   `<origin>/integrations/figma/callback`:
   - `http://localhost:5173/integrations/figma/callback` (local dev)
   - `https://ideabrandcoach.icodemybusiness.com/integrations/figma/callback` (prod)
   - any Lovable preview origin you test from

### 2. Generate the token-encryption key

Tokens are encrypted at rest with AES-256-GCM. Generate a 32-byte base64 key:

```bash
openssl rand -base64 32
```

> If `FIGMA_TOKEN_ENC_KEY` is unset the functions still work but store tokens
> unencrypted (with a console warning). **Always set it in production.**

### 3. Set the Supabase function secrets

```bash
npx supabase secrets set \
  FIGMA_CLIENT_ID=<client id> \
  FIGMA_CLIENT_SECRET=<client secret> \
  FIGMA_TOKEN_ENC_KEY=<base64 32-byte key>
# optional:
#   FIGMA_OAUTH_SCOPE=files:read         (default 'files:read')
#   FIGMA_STATE_TTL_SECONDS=600          (CSRF state lifetime, default 600)
#   FIGMA_ALLOWED_ORIGINS=https://ideabrandcoach.icodemybusiness.com,http://localhost:5173
#                                        (origin allow-list for the OAuth redirect; unset = path-only check)
```

### 4. Apply the migration

```bash
npx supabase db push
# or apply supabase/migrations/20260616190000_figma_integration.sql
```

Creates `figma_connections`, `figma_oauth_state`, `figma_imports` and expands the
`user_knowledge_base.category` CHECK to allow `visual_identity`.

> The free-tier project auto-pauses — if `db push` or deploy reports INACTIVE,
> restore it in the Supabase dashboard first.

### 5. Deploy the edge functions

```bash
npx supabase functions deploy figma-oauth-start figma-oauth-exchange \
  figma-status figma-sync figma-disconnect
```

`verify_jwt = true` for all five (see `supabase/config.toml`); each also derives
`user_id` from the verified token and rejects anonymous callers.

### 6. Verify

Sign in, open `/settings/integrations`, click **Connect Figma**, authorize, then
import a file. Confirm a palette renders and, in the coach, that the visual
identity is referenced.

---

## How the data reaches the coach

`figma-sync` writes the extracted summary into `user_knowledge_base` via the
existing `update_knowledge_entry` RPC:

- `category = 'visual_identity'`
- `field_identifier = 'figma_visual_identity'`
- `content` = a readable summary (palette hexes + names, type scale, components, pages)
- `structured_data` = the raw extracted JSON

The coach's `retrieveUserContext` (in
`supabase/functions/idea-framework-consultant-claude/context.ts`) already reads
all current `user_knowledge_base` rows; the only change there is the
`visual_identity → 'VISUAL IDENTITY (from Figma)'` category label.

Re-importing the same file updates the row (versioned, `is_current = true`).

---

## Security

- **Token tables are service-role-only.** `figma_connections` and
  `figma_oauth_state` have RLS enabled with no authenticated policies, and table
  grants are revoked from `anon`/`authenticated`. Only the edge functions (service
  role) touch them. Tokens never reach the browser.
- **Tokens encrypted at rest** with AES-256-GCM (`FIGMA_TOKEN_ENC_KEY`).
- **CSRF state** is single-use, expires in 10 minutes, bound to `auth.uid()`, and
  also checked client-side via `sessionStorage`.
- **Scope** is read-only (`files:read`).
- **Disconnect** deletes the connection/tokens but keeps already-imported design
  data (it is the user's brand data, not a credential).

---

## Environment variables

| Variable | Where | Required | Default | Purpose |
|----------|-------|----------|---------|---------|
| `FIGMA_CLIENT_ID` | Supabase secret | yes | — | Figma OAuth app client id |
| `FIGMA_CLIENT_SECRET` | Supabase secret | yes | — | Figma OAuth app client secret |
| `FIGMA_TOKEN_ENC_KEY` | Supabase secret | prod | — | base64 32-byte AES-256 key for token encryption |
| `FIGMA_OAUTH_SCOPE` | Supabase secret | no | `files:read` | OAuth scope requested |
| `FIGMA_STATE_TTL_SECONDS` | Supabase secret | no | `600` | CSRF state lifetime |
| `FIGMA_ALLOWED_ORIGINS` | Supabase secret | no | — | Comma-separated origin allow-list for the OAuth redirect (defense in depth; unset = exact callback path check only) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are already
provided to all edge functions by the platform.

---

## Testing

Unit tests cover the pure extractor and the service boundary:

```bash
# The sandbox/default forks pool may fail to spawn; use the threads pool:
npx vitest run --pool=threads \
  src/__tests__/figma-extract.test.ts \
  src/__tests__/FigmaIntegrationService.test.ts
```

- `src/__tests__/figma-extract.test.ts` — `rgbaToHex`, `parseFigmaFileKey`,
  `extractDesign`, `buildDesignSummary`.
- `src/__tests__/FigmaIntegrationService.test.ts` — success/error mapping of the
  `functions.invoke` boundary.

Manual QA (needs the test account in `docs/TEST_ACCOUNT.md`):
1. `/settings/integrations` → Connect Figma → authorize.
2. Import a Figma file URL → palette swatches + typography render.
3. Open the coach → confirm it can describe your colors/fonts.
4. Disconnect → status returns to "not connected", imports remain.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `Figma integration is not configured` | `FIGMA_CLIENT_ID`/`FIGMA_CLIENT_SECRET` not set as secrets |
| Callback shows "Connection state mismatch" | Stale tab / state expired — click Connect again |
| Import error "No access to that Figma file" (`file_forbidden`) | The file key is wrong or the connected Figma account can't open it |
| Import error "Your Figma connection expired" (`reauth_required`) | Refresh failed — Disconnect and reconnect |
| `Encrypted Figma token found but FIGMA_TOKEN_ENC_KEY is not set` | The key was set when connecting but is now missing — restore the same key |
| 401 on connect/import | User isn't signed in, or the SPA session was lost during the OAuth round-trip |
