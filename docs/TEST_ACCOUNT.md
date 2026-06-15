# Test Account & Browser QA Credentials

> Canonical credentials for coding agents (and humans) running in-browser
> verification of authenticated features. Referenced from the top-level
> `CLAUDE.md` "Testing & QA" section.

⚠️ **This is a throwaway QA account on a non-production / beta project.** It holds
no real customer data. Do NOT reuse this password anywhere else, and do not treat
this account as privileged. If the account is ever compromised, rotate it (see
"Rotating / recreating" below).

---

## Credentials

| Field | Value |
|-------|-------|
| Email | `signatureqa20260526@gmail.com` |
| Password | `Sig-QA-Test-2026!` |
| Supabase user id | `1e8d7602-c19d-4d5d-9dea-1f7ecf8d3d11` |
| Display name | Signature QA |

## Environment

| Thing | Value |
|-------|-------|
| Dev server | `npm run dev` (Vite). App serves at `http://localhost:8080`, or the next free port — currently `http://localhost:8081`. Check the Vite banner. |
| Supabase project ref | `ecdrxtbclxfpkknasmrw` (live/remote — the frontend points here by default; see `src/integrations/supabase/client.ts`) |
| Login route | `/auth` → "Sign In" tab |

## How to log in (Playwright / manual)

1. Start the dev server and confirm the port.
2. Navigate to `/auth`, Sign In tab, enter the credentials above, click "Let's go!".
3. You'll land on `/`. Then navigate to the authenticated route you want to test
   (e.g. `/v2/coach`). The session persists in `localStorage`.

## Gotchas (learned the hard way)

- **The Supabase project auto-pauses (free tier).** If reads/SQL time out, or a
  function deploy returns `status 'INACTIVE'`, the project is paused — restore it
  in the dashboard (https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw →
  Restore) and wait ~1–3 min. Auth comes up first, then the database
  (`the database system is starting up`). See `[[project_supabase_pauses]]` memory.
- **The live project requires email confirmation.** A brand-new sign-up returns a
  user but NO session (`INITIAL_SESSION null`), so protected routes bounce to
  `/auth`. The account above is already confirmed. If you create a *new* test user,
  confirm it before first login, e.g. via the Supabase MCP / SQL:
  ```sql
  update auth.users set email_confirmed_at = now()
  where email = '<the-new-test-email>' and email_confirmed_at is null;
  ```
- **Full-page `goto` right after sign-up can race auth hydration.** Sign in first,
  then navigate.

## Rotating / recreating

If you need a fresh account: sign up at `/auth` (Sign Up tab), then confirm the
email via the SQL above, then update the credentials in this file. The signup flow
is open (`enable_signup = true`) and email confirmations are off in local
`supabase/config.toml` but ON in the live project.
