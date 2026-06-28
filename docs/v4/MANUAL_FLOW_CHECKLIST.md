# /v4 Surface — Manual Flow Checklist

Step-by-step manual QA for the new "one and only" `/v4` surface (App shell + spine +
Loop 1 onboarding build-theatre). Pairs with the automated skeleton in
`tests/e2e/v4-flow.spec.ts`. This run builds + verifies on the worktree only — **do not
deploy / flip prod from here.**

## Setup
- **Branch/worktree:** `.claude/worktrees/v4-surface` (off `origin/main`).
- **Run app:** `npm run dev` → http://localhost:8080
- **Flag:** `VITE_FORCE_V4` defaults **ON** (treat unset/empty as on). To test the
  legacy VersionGate path, set `VITE_FORCE_V4=false` and restart dev.
- **Auth (only for backend-backed steps):** shared QA account in
  [`docs/TEST_ACCOUNT.md`](../TEST_ACCOUNT.md). Sign in at `/auth`.
- **Design SSOT:** Trevor's v23 palette — blk `#111111`, wht `#FFFFFF`, warm `#F5F4F0`,
  gld `#D4960A`, gld-lt `#FEF5DC`; IDEA dims I `#F0B429` / D `#4CAE53` / E `#2B9FD4` /
  A `#E8850A`; font Helvetica Neue. NOT the old `#FFD700`.

---

## 1. Front door → forced /v4
- [ ] Visit `/`. With the flag on, you are redirected to `/v4` (VersionGate →
      `isV4Forced()` → replace-navigate). URL ends `/v4`.
- [ ] Old routes still resolve directly (entry is gated, routes are NOT removed):
      `/v2/diagnostic`, `/v3/diagnostic`, `/v2/coach`, `/v2/funnel`, `/v1/dashboard`.
- [ ] Set `VITE_FORCE_V4=false`, restart → `/` shows the legacy VersionGate choice
      (no auto-redirect). Reset to on afterwards.

## 2. App shell + spine
- [ ] Sidebar (desktop ≥1024px) shows the five spine stages in order:
      **Diagnose → Analyse → Fix → Re-measure → Defend**, each with its icon + blurb.
- [ ] Sticky spine stepper reflects the active stage as you navigate
      `/v4/diagnose`, `/v4/analyse`, `/v4/fix`, `/v4/remeasure`, `/v4/defend`.
- [ ] Stage markers are tinted with the IDEA-dimension tokens (not flat gold).
- [ ] No console errors on any stage route.

## 3. Loop 1 — megaprompt paste
- [ ] `/v4` shows heading "Tell me about your brand" + a large paste box
      (`data-testid="megaprompt-input"`) with a realistic placeholder.
- [ ] "Read it back to me" CTA (`read-it-back-button`) is **disabled** until text
      is entered; enables once you type/paste.
- [ ] Paste a real, groundable brand blurb (e.g. RestWell sleep supplement, Amazon,
      repeat orders). Click the CTA.

## 4. Loop 1 — read-it-back BUILD-THEATRE  *(needs backend/LLM)*
- [ ] A read-only agentic timeline (`reflection-run` / `reflection-timeline`) mounts
      and shows each **tool/step the coach runs** with a label of *what* + *why*.
- [ ] Each step shows a **REAL finding grounded in the paste** — quotes/derives from
      your text. **NO fabricated facts, scores, or invented numbers.**
- [ ] **No-data honesty:** paste something ungroundable (e.g. `.`). The run surfaces
      `reflection-needs-input` or `reflection-run-error` — it must NOT invent a finding.

## 5. Loop 1 — confirm gate + Context Card
- [ ] After the run, the confirm gate (`reflection-confirm-gate`) shows
      **"Sounds right ✓"** and **"Not quite ✏️"**.
- [ ] "Sounds right" promotes findings → reveals the **Context Card** ("I won't ask
      twice") with the **completeness ring** (`completeness-ring`).
- [ ] "Not quite" also reveals the Context Card so fields can be corrected.
- [ ] Context Card lists the captured facts and reflects completeness in the ring.
- [ ] "Continue to Diagnose" (`continue-to-diagnose`) is disabled until context is
      complete (`allFilled`), then routes to `/v4/diagnose`.

## 6. /v4/tools — connector trust registry
- [ ] `/v4/tools` renders the generated tool registry (own dark theme: black bg /
      gold accents). Tools grouped (Diagnose / Avatar 2.0 / Outputs / Funnel / Ledger /
      Sessions & Feedback / Coming next).
- [ ] Available vs Roadmap status badges render; totals/counts present.
- [ ] "Generated from the live MCP tool surface + git history" note is shown
      (data is generated, never hand-edited — regenerate via `npm run build:tool-registry`).

## 7. Mobile-first @ 375px  (HARD guardrail)
- [ ] Set viewport to **375px** wide (iPhone SE). On every `/v4` screen:
  - [ ] **Zero horizontal overflow** — nothing clips, no sideways scroll.
  - [ ] Desktop sidebar collapses to the **mobile bottom-nav** (5 spine stages reachable).
  - [ ] The Trust Gap / primary CTA on the diagnostic is reachable in **≤ 2 scrolls**.
  - [ ] Paste box, timeline, and Context Card stack and remain legible/tappable.

## 8. Terminology-leak spot check  (HARD guardrail — Tier-C never visible)
Scan all user-facing copy (onboarding, build-theatre findings, Context Card, stage
screens, /v4/tools). **None of these may appear anywhere a user can see:**
- [ ] No "Safety brain" / "safety brain".
- [ ] No buyer-state / brain-state codes: `S1` `S2` `S3` `S4`, "CAPTURE", internal
      buyer-state names.
- [ ] No internal engine/tier jargon leaking through the coach's read-back findings.
- [ ] Coach output uses Trevor's TOV: direct, evidence-based, commercially specific,
      warm-not-soft, **UK English** ("analyse", "recognise"), problem-solver framing.

## 9. Regression sanity
- [ ] `npx tsc --noEmit` clean.
- [ ] `npm run build` succeeds.
- [ ] `npx vitest run src/components/v4 src/lib/v4` green.
- [ ] Lint: v4/token/registry/scaffold files clean (`npx eslint src/components/v4
      src/pages/v4 src/lib/v4 src/config/v4.ts src/contexts/V4ContextStore.tsx`).
      *Note:* the repo-wide `npm run lint` has pre-existing errors in unrelated files
      (supabase functions, shadcn `ui/*`, legacy tests) — out of scope, do not fix here.

---

### Pass bar
All §1–3, §6 (render/routing/structure) pass with **zero console errors** and the §7
mobile + §8 terminology guardrails hold. §4–5 require a live backend/LLM session
(QA account) — verify when a backend is wired; until then they are `test.fixme` in the
E2E skeleton.
