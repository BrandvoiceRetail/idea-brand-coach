# ADR — Authentication provider: Supabase Auth vs Clerk

**Status:** Decided — **stay on Supabase Auth** (2026-06-29). Confidence: **high** after
live probing + primary-source verification (this revision corrects an earlier draft whose
key claims were unverified).
**Context trigger:** "Last cheap moment" to move all users to Clerk, given the new Stripe
layer and expected growth. Question: which is the better long-term foundation, weighing the
MCP connector, Stripe, RLS, and user management?

## TL;DR

**Stay on Supabase Auth.** Identity is this product's integration hub — RLS, the claude.ai
**MCP OAuth server**, and the new **Stripe** layer all bind to one Supabase uuid. Verification
made the case *stronger*, not weaker: (1) unifying on Clerk requires claude.ai-web ↔ Clerk
OAuth, which is **currently broken by an open Anthropic bug (#500)**; (2) the "less-invasive"
Supabase+Clerk path does **not** avoid re-keying identity — it's **equal-or-worse**; (3) a
hybrid (Clerk app + Supabase MCP) creates **two identity spaces**. Honest caveat: if you ever
*do* switch, **now is cheaper than later** — but there is no current driver that justifies the
cost and the active claude.ai↔Clerk breakage.

> **Separate, urgent, auth-decision-independent finding (verified live 2026-06-29):** the MCP
> connector's **OAuth discovery metadata is not served in prod** — the `/mcp` 401 advertises
> `…/.well-known/oauth-protected-resource/mcp`, but that URL (and the AS-metadata URL) return
> the SPA's HTML, because the box Caddyfile has no route for `.well-known/oauth-*`. A *fresh*
> claude.ai connection therefore fails RFC 9728 discovery; already-connected sessions keep
> working via token refresh. This is a pre-existing regression (the route is absent from the
> Caddyfile and its backup; verified e2e at launch per project history). **Fix the Caddy route
> regardless of the auth decision.**

## Verified facts (primary sources, 2026-06-29)

### MCP OAuth — the swing factor
- **Supabase OAuth 2.1 server is live and correct in prod (primitives):** AS metadata returns
  valid JSON; **DCR `registration_endpoint` works (`POST …/oauth/clients/register` → 201)**;
  `/mcp` emits a proper RFC 9728 401 challenge; consent page 200s. The MCP identity is the
  Supabase **uuid** (one identity space). It's Supabase's *recommended* MCP path (native OAuth
  server, public beta since 2025-11-26, free during beta).
- **claude.ai web ↔ Clerk is currently broken via the automatic path.** `anthropics/claude-ai-mcp`
  **#500 (OPEN, 2026-06-27, +2 confirms):** Claude's auto-DCR omits `scope` → Clerk registers
  the client without `openid` → authorization request for `openid` is rejected `invalid_scope`.
  Sibling **claude-code #67714 (OPEN)**. #164 (the earlier "works once DCR enabled" fix) is
  **superseded** for the web surface by #500. Workaround exists (manually pre-register a public
  OAuth client, paste the Client ID into the connector's Advanced settings) — reporter-attested,
  not lab-verified. **Clerk's MCP docs list Cursor/VSCode/Claude Code/Claude Desktop/Windsurf —
  not claude.ai web.**
- **Implication:** Supabase serves our exact client (claude.ai web) today via working DCR; Clerk
  does not, without a manual per-connector workaround on an open-bug surface.

### Identity re-key — bigger than the earlier draft implied
- **~140 live RLS policies across 46 tables** key on `auth.uid()` (a **uuid**). (Live prod count
  137; migration history ~174 — same surface, historical dupes.)
- **`auth.uid()` does not work with Clerk:** it casts `sub` to uuid; Clerk ids are strings
  (`user_2…`), so the cast fails. Policies must move to `auth.jwt()->>'sub'` (text).
- **The "less-invasive" Supabase third-party-auth-with-Clerk path does NOT avoid the re-key —
  it's equal-or-worse.** Clerk users get **no `auth.users` row** (the integration explicitly does
  not sync users), so every `user_id uuid REFERENCES auth.users` must become `text` + drop the FK,
  **on top of** rewriting all policies to `auth.jwt()->>'sub'`. Confirmed in Clerk's + Supabase's
  own docs. There is no supported uuid-preserving pattern.
- **Hybrid is a trap:** Clerk for app sign-in + Supabase as MCP AS ⇒ the same human has a Clerk
  string id in-app and a Supabase uuid via MCP — **two identity spaces**, RLS rows don't match
  across surfaces without a mapping layer.

### Stripe — coupled but cheap to move *now*
- `user_subscriptions.user_id` (uuid PK), the webhook, and `entitlement.isMember()` key on the
  Supabase uuid. **0 live subs**, so re-keying is free *today* — the one coupling that is cheap,
  and the one that gets *more* expensive once real subscriptions exist.
- **Clerk Billing** (still **Beta**, +0.7% of billing volume on top of Stripe, subscription
  source-of-truth moves into Clerk) could replace the hand-rolled path, but we just shipped a
  clean owned one — adopting a Beta product + revenue skim + lock-in is a downgrade today.

### Cost & migration
- Cost is ~free for both to ~50k MAU; beyond that **Supabase is far cheaper** (bundled with the
  DB; ~$25 vs ~$1,025/mo at 100k MAU). *(Cost-narrative sources include SuperTokens, a Clerk
  competitor — treat that framing with the appropriate discount; the per-MAU math itself checks out.)*
- **User migration is trivial** (15 users; Clerk imports bcrypt/scrypt/argon hashes, no forced
  resets). This is the cheapest, least important part — and the part the "do it now" instinct
  fixates on.

## Decision

**Keep Supabase Auth.** One identity space (uuid), no re-key, our exact MCP client works via
Supabase DCR, Stripe stays coherent. Invest the avoided migration effort into the Supabase gaps
we actually want (MFA, the social logins we need, account-UI polish). **Preserve** the
`feat/clerk-auth` branch as a ready-made escape hatch — do **not** delete it.

## Honest counter-arguments (why this isn't a slam dunk)
- **Status-quo bias is real:** the analysis is anchored on current coupling, which structurally
  favors not-moving. The rebuttal is that the coupling reflects genuine product surfaces (RLS,
  the connector, Stripe), and Clerk's upside (prebuilt UI, B2B orgs) is **not a current driver**.
- **Switching later is more expensive than now** (more users, live subscriptions, a higher-traffic
  connector). True. But "cheapest time to switch" ≠ "should switch": today the destination
  (Clerk-on-claude.ai-web) is itself broken (#500), so "switch now" buys an active bug.
- **"Stay" has a hidden bill:** features Clerk gives free (MFA/passkeys/orgs) we may build
  ourselves. Acknowledged — sized against the re-key + connector risk, it's the smaller cost
  unless B2B becomes core.

## The one trigger that flips this
A pivot to **B2B / multi-seat team accounts with enterprise SSO** as a core offering. Clerk's
organization model is materially ahead of anything we'd build on Supabase. This is *plausible*
for a brand tool that already models multiple brands/avatars — so revisit deliberately if the
roadmap turns B2B, rather than treating it as a footnote. Even then, weigh re-key + the
claude.ai↔Clerk OAuth state at that time.

## Liabilities to track (the "stay" path isn't risk-free)
- **Empty JWKS / HS256:** `…/jwks.json` returns `{"keys":[]}`; tokens validate server-side via
  `getUser`, which works, but OIDC `id_token`/JWKS-based validation does not. If claude.ai or the
  Supabase OAuth server later require asymmetric signing, enable Supabase asymmetric JWT keys.
- **Supabase OAuth server is beta** with unannounced post-beta pricing, and we depend on it.
- **The broken Caddy discovery route** (top of doc) — fix promptly; the connector's fresh-connect
  flow is down until then.

## Consequences
- Identity stays uuid-native; RLS, MCP OAuth, and Stripe remain coherent on one platform/bill.
- We own building any richer auth UX (the Supabase tradeoff).
- Before any future reversal, re-verify: claude.ai↔Clerk auto-DCR status (#500/#67714), Clerk
  Billing GA, and Supabase OAuth-server post-beta pricing.

_Primary sources: anthropics/claude-ai-mcp #164 (closed 2026-05-12) & #500 (open 2026-06-27);
anthropics/claude-code #67714; Clerk MCP client docs; Supabase third-party-auth-with-Clerk docs;
Clerk↔Supabase integration docs; Supabase OAuth 2.1 server + MCP-auth docs. Live probes
(2026-06-29): /mcp 401 challenge, Supabase AS metadata, DCR 201, empty JWKS, SPA-HTML on all
app-origin .well-known/oauth-* paths, Caddyfile route absence. Codebase: src/mcp/oauth.ts,
src/pages/OAuthConsent.tsx, supabase/functions/_shared/edge-auth.ts, src/lib/entitlement.ts,
supabase/migrations/*._
