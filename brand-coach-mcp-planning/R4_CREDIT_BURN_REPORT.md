# R4 — Anthropic Credit-Burn Root Cause (2026-06-06)

**Date:** 2026-06-07
**Author:** R4 read-only forensic (output-engine fix pass)
**Scope:** Read-only. The single write is this file. No `src`, no edge fns, no config touched.
**Question:** What mechanism drained the Anthropic API credits on 2026-06-06 (the edge functions'
`ANTHROPIC_API_KEY` account)?

---

## Verdict (one line)

**Most parsimonious cause: the BUILD PROCESS itself** — on 2026-06-06 the P0–P7 workflow deployed
and smoke-tested 9 new Claude **Sonnet-4** edge functions (3× burst each) and ran TWO full
end-to-end rehearsals (~39 + ~26 chain calls), every leg a Sonnet generation at 1k–4k `max_tokens`.
That is a legitimate, self-inflicted, bounded spend — NOT a runaway loop or a retry storm. The one
genuine *latent* abuse surface (the anon-callable, control-less deployed `diagnostic-interpretation`)
is real and still live, but it runs **Haiku** and there is **no log evidence it was hammered** — it
is the thing to harden, not the thing that drained the account on 6/06.

No unbounded loop and no retry storm exists in any code path that was live that day.

---

## Evidence base & its limit

- `get_logs(edge-function)` returns **only the last 24h**. Today is 2026-06-07, so the 6/06 incident
  window is **largely outside retention**. The visible log slice is ~2026-06-07 01:00–03:00 UTC
  (epoch 1780799000–1780806962) — i.e. the CURRENT fix-pass rehearsal, not the 6/06 burn itself.
  **The 6/06 raw invocation record is gone**; the conclusion is reconstructed from (a) the code that
  was live that day, (b) the deploy timestamps, (c) the rehearsal scripts' call counts, and (d) the
  shape of the visible 6/07 run, which is structurally identical to what 6/06 ran.
- Model/token map and auth flags were read directly from deployed code (`get_edge_function`) and the
  repo working tree (`feat/alpha-instrumentation`).

---

## 1. Anthropic-calling functions, ranked by per-call burn

All chain generators run **`claude-sonnet-4-20250514`** (the expensive model). Two legacy fns run
Haiku. `max_tokens` read from source; "input" notes the dominant context driver.

| Function | verify_jwt (deployed) | Model | max_tokens (out) | Heavy input | Burn rank |
|---|---|---|---|---|---|
| `export-brief` | true | Sonnet-4 | 4096 | canvas + S1–S4 + claims | High |
| `avatar-vocabulary` | true | Sonnet-4 | 4096 | full review corpus | High |
| `idea-framework-consultant-claude` | *(no flag; app-level optional auth)* | Sonnet-4 | up to 4000 (comprehensive) | RAG context + chat history + images | High |
| `audit-idea-map` | true | Sonnet-4 | 3072 | Output-B rows × IDEA artifacts | High |
| `marketing-audit` | true | Sonnet-4 | 3000 | move library + business facts | High |
| `diagnostic-interpretation-evidence` | true | Sonnet-4 | 3000 | listing copy + reviews | High |
| `avatar-jobmap` / `-triggers` / `-objections` | true | Sonnet-4 | 2048 | S1 + reviews | Med |
| `brand-canvas` | true | Sonnet-4 | 2048 | signature + S1–S4 | Med |
| `reveal-signature` | true | Sonnet-4 | 1024 | conversation + reviews | Med |
| `diagnostic-interpretation` (legacy, public) | **false** | **Haiku** | 1200–1600 | scores (+ optional evidence) | **Low/call** |
| `brand-ai-assistant` | false | Haiku | 500 | prompt | Low |

The 11 Sonnet fns are the cost center. The two Haiku fns are cheap per call even if hammered.

## 2. Anon-callable surface (deployed reality vs config)

- `config.toml` only declares `verify_jwt` for the legacy fleet; **none** of the 11 new
  chain/avatar/Sonnet fns appear in it. Their *deployed* flags (from `list_edge_functions`) are
  authoritative: all avatar-*, brand-canvas, export-brief, audit-idea-map, marketing-audit,
  diagnostic-interpretation-evidence, reveal-signature, save-feedback-event = **`verify_jwt: true`**
  → gateway rejects unauthenticated callers (the 6/07 logs show real `401`s, confirming the gate
  fires). These are **not** an anon abuse surface.
- **`diagnostic-interpretation` (legacy) is `verify_jwt: false` AND its DEPLOYED code (version 5) has
  NO abuse controls** — no origin allowlist, no body cap, no per-IP burst limit. I read the live
  source via `get_edge_function`: it is the pre-hardening version. It only retries 2× (1.5s backoff,
  transient-only) and runs **Haiku** at ≤1600 tokens.
- **The PR #3 abuse controls were merged to the WRONG branch and never deployed.** They exist on
  `origin/feat/feature-status-tracker` (commit `fix(security): abuse controls for public
  diagnostic-interpretation (Fix 3, P1) (#3)`, 2026-06-04) with `MAX_BODY_BYTES`, `RATE_LIMIT_MAX`,
  `RATE_LIMIT_WINDOW_MS`, `ALLOWED_ORIGINS`, `x-forwarded-for` per-IP limiting. **None of that code
  is on `feat/alpha-instrumentation` and none of it is in the deployed function.** The deployed fn
  was last updated 2026-06-06 21:19 UTC but from a lineage lacking the guards, so the redeploy did
  NOT pick them up. → The latent gap the directive suspected is **confirmed real and still live**,
  but it is a Haiku endpoint and there is no evidence it was the 6/06 drain.
- `idea-framework-consultant-claude`: gateway flag could not be read from `config.toml` (absent), but
  its CODE proceeds even with **no** Authorization header (`userId` stays null, no early return) and
  it is **Sonnet up to 4000 tokens with RAG**. This is the more dangerous anon-shaped surface if its
  gateway `verify_jwt` is also false — it should be confirmed and locked. (It is the production chat
  consultant, so it is exercised by real Beta traffic, not just the build.)

## 3. Retry-storm / unbounded-loop audit (all LIVE that day)

Every retry path is **bounded, backed-off, and transient-only**. No storm, no unbounded loop:

- **Client `useSignatureReveal`** (`src/hooks/v2/useSignatureReveal.ts`): single `invoke` per user
  action; on error it sets stage back to `paste` with NO auto-retry. Callback dep `[reviews]` is
  stable. Clean.
- **Client `useTrustGapInterpretation`** (`src/hooks/useTrustGapInterpretation.ts`): one invoke per
  `(scoreSignature, attempt)` change; `retry` is a manual user click; `cancelled` + `activeSignature`
  guards prevent duplicate/stale writes; sessionStorage cache prevents re-billing identical scores.
  Targets the **Haiku** legacy fn. The documented baseline test failure ("Cannot read properties of
  undefined (reading 'then')" at `:106`) is a **test-mock gap** (the test doesn't stub `invoke` to
  return a thenable) — it is NOT a production loop and does not bill anything.
- **Client `ReviewAnalyzerModal`** (`src/components/v2/ReviewAnalyzerModal.tsx`): calls
  `review-scraper` / `review-scraper-deep` — **not Anthropic functions**. Zero credit impact.
- **Host `avatarPipeline.ts`**: `MAX_STAGE_RETRIES = 2` (≤3 attempts/stage), exponential backoff
  (`500ms · 2^n`), retries only on transient edge/validation failure.
- **Tool `runDiagnosticEvidence.ts`**: `MAX_ENGINE_RETRIES` bounded loop, `needs_input` short-circuits
  immediately (never retried, never fabricated).
- **Chain edge fns themselves**: NO server-side retry loop (grep for attempt/while in
  avatar-*/canvas/brief/audit/marketing/reveal = none). Retries happen once, at the drive layer
  (this is R2 in the gap report — *missing* retry, the opposite of a storm).
- The legacy `diagnostic-interpretation` retries max 2× with 1.5s backoff.

**No mechanism multiplies one user action into many billed calls.**

## 4. The build process as the parsimonious cause (quantified)

What demonstrably happened on 2026-06-06 (from the workflow prompt's own operational notes + the
committed rehearsal scripts + the structurally-identical 6/07 log slice):

1. **9 new Sonnet fns deployed and smoke-tested**, each run **3× for parse-stability** (the workflow
   explicitly says "re-run smoke tests (3x each for parse stability)"). The 6/07 logs show exactly
   this fingerprint: `avatar-jobmap` ×3 bursts, `avatar-vocabulary` ×repeated, etc. ≈ 27+ Sonnet
   generations just for smoke.
2. **P7-A full fresh-user rehearsal** (`scripts/rehearsal-output-engine.ts`) drives ~**39**
   edge-fn/tool calls: `generate_brief` ×8, `generate_canvas` ×7, `generate_audit_idea_map` ×6,
   `generate_signature` ×6, `run_diagnostic_evidence` ×4, `run_marketing_audit` ×4,
   `build_avatar_stage` ×3 — almost all Sonnet, several at 3–4k output tokens, with large prompt
   inputs (review corpus, prior artifacts).
3. **P7-B repeat-user consistency rehearsal** (`scripts/rehearsal-consistency.ts`) drives ~**26**
   more of the same.
4. Add iteration during the build (failed parses re-run, the documented `avatar-triggers` 500-parse
   fix loop, manual retries at the drive layer for R2's missing tool-retry).

Rough order-of-magnitude: well over **100 Sonnet-4 generations in a single day**, many at the high
end of the token range, with large inputs. That is an entirely sufficient, self-inflicted explanation
for draining a low-balance Anthropic account — no leak required. The account was **topped up** and
the SAME pattern is running again on 6/07 (visible in the logs), which is why "it can drain again
mid-run" is the standing risk, not a mystery bug.

## 5. Anthropic console hard-cap (from knowledge — not logged in)

- The **Billing → Usage limits** page (Console, Plans & Billing) historically exposes a
  **monthly spend limit / "usage limit"**. On the standard self-serve (pre-paid credits) model the
  practical hard stop is simply **running out of pre-purchased credits** — once the balance hits zero,
  calls **fast-fail** with `invalid_request_error` "credit balance is too low" (this is exactly the
  billing-shaped fast-fail the workflow notice describes; it can arrive as an HTTP-200-wrapped stream
  error). That zero-balance fast-fail IS a hard cutoff, but it is reactive (after the burn) and the
  current top-up converts it back into "burnable."
- **Auto-reload** (auto-purchase more credits when balance drops) is the *opposite* of a cap — if it
  is ON, there is effectively no ceiling; confirm it is **OFF**.
- **Spend/usage limits** and **email spend notifications** are configured under **Plans & billing →
  Cost / Usage limits** and **Settings/Limits**. What to look for in the console:
  - a **hard monthly spend limit** that *rejects* calls past a threshold (cutoff), vs. the
    notification-only "$50/mo email threshold" Matthew already set (which would NOT catch a fast burn);
  - **auto-reload toggle** → ensure OFF;
  - **per-workspace** spend limits (Console supports multiple workspaces/API-key scopes) → put the
    edge-fn key in its own workspace with its own low hard cap so a build can't drain the shared pool.
- Do not rely on the email notice as protection: a 100+ Sonnet-call day can blow past $50 inside the
  notification's evaluation lag. A **hard workspace cap** is the only true cutoff.

---

## Cause ranking (by evidence weight)

1. **Build process self-spend (PRIMARY, confirmed by deploy timing + rehearsal scripts + 6/07 echo).**
   9 Sonnet fns × 3 smoke + two ~39/~26-call rehearsals + iteration = 100+ Sonnet generations in one
   day. Legitimate, bounded, expected — but unguarded by any spend cap. **Still live**: the identical
   pattern is re-running on 6/07.
2. **No retry storm / no unbounded loop (RULED OUT).** Every retry path is bounded ≤2–3 with backoff,
   transient-only; chain fns have no server-side retry at all. Not the cause.
3. **Anon-callable `diagnostic-interpretation` without abuse controls (LATENT, real, NOT the 6/06
   drain).** Deployed version 5 lacks the PR-#3 guards (those are stranded on
   `feat/feature-status-tracker`, never deployed). But it is **Haiku** and there is no log evidence of
   a hammer. It is a hardening must-do, not the root cause.
4. **`idea-framework-consultant-claude` proceeds without auth + Sonnet 4000 + RAG (LATENT, higher
   risk than #3 if its gateway flag is false).** Confirm `verify_jwt` and lock it; it serves real
   Beta chat traffic, so abuse here would be Sonnet-priced.

## Recommended mechanical guards

- **Console (do first, ops):** set a **hard workspace spend cap** on the edge-fn key (cutoff, not the
  $50 email notice); ensure **auto-reload is OFF**; isolate the edge-fn key in its own low-cap
  workspace so a build/rehearsal can't drain the shared balance.
- **Build hygiene:** drop smoke loops from **3× → 1×** once a fn is stable; run rehearsals against a
  **cheaper model override** or a recorded-fixture mode where possible; never run two full rehearsals
  back-to-back without checking balance.
- **Deploy the stranded abuse controls:** cherry-pick PR #3's `diagnostic-interpretation` (origin
  allowlist + `MAX_BODY_BYTES` + per-IP `RATE_LIMIT_MAX`/window) onto the deploy lineage and redeploy
  — the only abuse-hardened version currently exists on a branch that was never shipped.
- **Lock `idea-framework-consultant-claude`:** confirm gateway `verify_jwt`, and require a resolved
  `userId` before the Sonnet call (today it proceeds with `userId = null`).
- **Add a per-fn daily call budget** to the Sonnet generators. NOTE: there is **no existing limiter
  pattern in `src/mcp` or `supabase/functions/_shared`** to reuse — the only limiter code in the repo
  is PR #3's in-memory per-IP window on the (un-deployed) diagnostic fn. A shared budget would be
  net-new; out of scope for this code-freeze fix pass, recommended as a fast-follow.

**This is an R4 read-only diagnosis. No code, edge fn, config, or deploy was modified.**
