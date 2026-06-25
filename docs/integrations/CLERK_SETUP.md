# Clerk Auth — Setup Checklist (what YOU need to do)

This is the human-gated, critical-path work that unblocks the prod cutover. The
code integration (flag-gated, additive) is built and waiting; it needs the
values you produce here. Nothing below touches prod until the very last step.

We chose the **native Clerk ↔ Supabase third-party auth** path: Clerk issues the
session token, Supabase trusts Clerk, and RLS reads the Clerk user id from
`auth.jwt()->>'sub'`. (The old "JWT template" path is deprecated — do not use it.)

---

## 1. Create the Clerk application (~5 min)

1. Go to https://dashboard.clerk.com and sign up / sign in.
2. **Create application** → name it `IDEA Brand Coach`.
3. Under **sign-in options**, enable:
   - **Email** (password + email verification) — matches today's email/password flow.
   - **Google** — matches today's "Continue with Google" button.
4. Pick the **React** framework (Vite) when prompted (this only affects the docs Clerk shows you).

## 2. Grab the publishable key

- In the Clerk dashboard: **API keys** → copy the **Publishable key**
  (starts with `pk_test_…` for the dev instance, `pk_live_…` for production).
- **Send me the publishable key.** It is NOT a secret (it ships in the frontend
  bundle), so it's safe to paste. Do **not** send the Secret key (`sk_…`) — the
  native integration doesn't need it, and we never put it in the frontend.

> Dev vs prod: Clerk gives you a **Development** instance (its own `pk_test_…`)
> and, once you add a production domain, a **Production** instance (`pk_live_…`).
> We'll build/verify against the dev instance, then swap to `pk_live_…` at cutover.

## 3. Wire Clerk → Supabase (the dashboard handshake)

This is the step that makes Supabase trust Clerk. Two dashboards, ~3 min:

**A. In the Clerk dashboard**
- Go to **Integrations** (or **Configure → Integrations**) → **Supabase** → **Activate**.
- Clerk shows you a **Clerk domain** value that looks like
  `https://<your-subdomain>.clerk.accounts.dev` (dev) or your custom domain (prod).
- Copy that **Clerk domain**.

**B. In the Supabase dashboard** (project `ecdrxtbclxfpkknasmrw`)
- Go to **Authentication → Sign In / Providers → Third-Party Auth** (a.k.a. *Add provider*).
- Add **Clerk** and paste the **Clerk domain** from step A.
- Save.

> Note: my Supabase access token is **read-only on auth config**, so I can't do
> step B for you from here — it has to be done in the dashboard by you (or paste
> me a dashboard screen-share/confirmation and I'll guide each click).

## 4. Production domain (only needed for the real prod flip)

For the `pk_live_…` production instance, Clerk needs your app domain
(`ideabrandcoach.icodemybusiness.com`) added under **Domains**, and you set the
DNS/CNAME records Clerk lists. The dev instance needs none of this — it works on
`*.clerk.accounts.dev` out of the box, which is why we build against dev first.

---

## What to hand back to me

| Item | Where it goes | Example |
|------|---------------|---------|
| **Publishable key** | `VITE_CLERK_PUBLISHABLE_KEY` (frontend env) | `pk_test_…` |
| **Clerk domain** | Supabase third-party provider (you paste it in dashboard) | `https://xxx.clerk.accounts.dev` |
| Confirmation that **Supabase → Add provider → Clerk** is saved | — | "done" |

Once I have the publishable key, I flip on the build flag locally, verify the
Clerk sign-in/sign-up renders and a real Clerk session authenticates against
Supabase, then we run the cutover runbook (`CLERK_CUTOVER_RUNBOOK.md`).

## What stays gated until cutover (so prod is untouched now)

- The `VITE_ENABLE_CLERK_AUTH` flag stays **off** in prod until we flip it.
- The **RLS / `user_id` migration** (`auth.uid()` → `auth.jwt()->>'sub'`) is
  authored but **not applied** — it's the point-of-no-easy-return and runs only
  during the scheduled cutover, with the down-migration ready.
