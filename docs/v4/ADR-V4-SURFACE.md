# ADR-V4-SURFACE — The `/v4` Unified Brand-Coach Surface

- **Status:** Proposed
- **Date:** 2026-06-26
- **Worktree:** `.claude/worktrees/v4-surface` (off `origin/main`)
- **Scope of this run:** Foundation + Loop 1 only. Scaffold (but do not finish) Loops 2–3. **No prod deploy, no flag flip in prod.** Build + verify on this worktree only.
- **Companion ADR:** the campaign/analytics + new MCP tools land in the MCP worktree (`mcp-analytics`); this ADR owns the **frontend surface** and references those tools as backend dependencies.

---

## Context

`/v4` is to become the **only** user-facing surface. Today the app fans out across three diagnostic versions, a V1 legacy shell, and a V2 coach, selected at runtime by `VersionGate`:

- Route map today (grounded in `src/App.tsx` + `src/config/routes.ts`):
  - `/` → `VersionGate` (chooses V1/V2, persisted via `VersionContext` → `useVersionPreference`)
  - `/v1/*` → legacy `Layout`-wrapped pages (StartHere, Dashboard, IDEA pillars, Canvas…)
  - `/v2/diagnostic` → `ProblemSolverDiagnostic` (8-screen flow)
  - `/v3/diagnostic` → `ProblemSolverDiagnostic showRecognition` (latest diagnostic; adds Movement-1 Recognition)
  - `/v2/coach` → `BrandCoachV2` (gated by `FeatureGate feature="BRAND_COACH_V2"`)
  - `/v2/funnel` → `FunnelTracker`; `/v2/focus` → `FocusSurface`
- Design tokens are fragmented: the SPA `:root` uses a yellow `--accent: 47 96% 53%` (≈#FBC91B); `onboard.html` uses `#D89B0D`; the Problem-Solver flow uses a **scoped, hard-coded** navy/gold (`PS_COLORS` in `src/components/v2/problem-solver/theme.ts`, deliberately bypassing the global tokens). None match Trevor's v23 palette.

The job: stand up `/v4` as a real app shell (sidebar + mobile bottom-nav + sticky spine stepper), reskin to the v23 palette as the **single** token source, build Loop 1 (onboarding + read-it-back build-theatre + Context Card), and scaffold Loops 2–3 — **without removing any old route**; entry is gated behind `VITE_FORCE_V4`.

---

## Decision 1 — `/v4` route map + `VersionGate` repoint behind `VITE_FORCE_V4`

### 1.1 Route map (new, additive)

All `/v4` routes mount under a single shell component `V4Shell` (sidebar + bottom-nav + sticky spine stepper, see Decision 3). Old routes are **retained verbatim**.

| Route | Screen role | Component (new unless noted) |
|---|---|---|
| `/v4` | Shell entry → redirects to first incomplete spine step | `V4Shell` + `useSpineRouter` |
| `/v4/diagnose` | Loop 1 diagnostic (reuse logic) | `V4Diagnose` wrapping `ProblemSolverDiagnostic showRecognition` reskinned |
| `/v4/onboard` | Loop 1 megaprompt paste → read-it-back run → confirm/edit → Context Card | `V4Onboard` (S-03..S-06) |
| `/v4/analyse` | Loop 2 analyse run | `V4Analyse` (S-07..S-08) — **scaffold** |
| `/v4/avatar` | Loop 2 Avatar 2.0 portrait | `V4Avatar` (S-09) — **scaffold** |
| `/v4/decisions` | Loop 2 Gap + Decision Trigger + Decision Board → chosen move | `V4Decisions` (S-10..S-11) — **scaffold (Decision Board NET-NEW)** |
| `/v4/brief` | Loop 2 7-slot design brief + claim gate | `V4Brief` (S-11b) — **scaffold** |
| `/v4/funnel` | Loop 3 Funnel Map (5-stage catalog) | `V4Funnel` (S-12..S-13) — **scaffold (reuse FunnelTracker logic)** |
| `/v4/work` | Loop 3 What-Needs-Work (impact-ranked) | `V4Work` (S-14) — **scaffold** |
| `/v4/asset/:id` | Loop 3 Asset detail (image-prompt / design-brief / check-asset tabs) | `V4AssetDetail` (S-15..S-17) — **scaffold** |

Define these in `src/config/routes.ts` as a new `V4_ROUTES` const (mirroring the existing `V1_ROUTES`/`V2_ROUTES` pattern) so there is one SSOT for paths and the spine stepper can derive order from it.

### 1.2 `VersionGate` repoint

`VersionGate` (`src/components/VersionGate.tsx`) is mounted at `/` and today redirects via `VersionContext` to V1/V2. Make it `VITE_FORCE_V4`-aware **at the top of its `useEffect`**, before any V1/V2 branch:

```ts
// src/config/v4.ts (new)
export const FORCE_V4 = (import.meta.env.VITE_FORCE_V4 ?? 'true') === 'true'; // default ON in this worktree
```

```tsx
// VersionGate.tsx — first effect branch
import { FORCE_V4 } from '@/config/v4';
import { V4_ROUTES } from '@/config/routes';
useEffect(() => {
  if (FORCE_V4) { navigate(V4_ROUTES.ROOT, { replace: true }); return; }
  // …existing V1/V2 logic unchanged…
}, [...]);
```

- **Default ON in this worktree** (env var unset ⇒ `'true'`), so `/` resolves to `/v4` here, but old routes still resolve when typed directly.
- **Do not delete** the V1/V2 branches or any `<Route>` — `VITE_FORCE_V4=false` restores today's behaviour exactly (instant rollback, no redeploy of logic).
- Follow the existing env convention seen in `src/config/features.ts` (`import.meta.env.VITE_*` read through a tiny config module, not scattered inline).
- Keep `/v4/*` routes registered **unconditionally** in `App.tsx`; only the **entry redirect** is gated. This means deep links to `/v2/coach` etc. keep working for QA even with the flag on.

**Why a redirect, not a render swap:** preserves browser history/back-button semantics, keeps `ScrollToTop`/`BetaFeedbackWidget` mounts intact, and lets us A/B the gate by env without touching the route tree.

---

## Decision 2 — Design tokens: adopt the Trevor v23 palette as the single source

### 2.1 `src/index.css :root` changes

Tokens are HSL triplets (Tailwind composes them via `hsl(var(--x))`). Convert the v23 hexes to HSL and **replace** the yellow accent. Target values:

| Token | Today | New (v23) | HSL |
|---|---|---|---|
| `--background` | `0 0% 98%` | `--wrm` #F5F4F0 | `40 17% 95%` |
| `--foreground` | `220 13% 9%` | `--blk` #111111 | `0 0% 7%` |
| `--card` / `--popover` | `0 0% 100%` | `--wht` #FFFFFF | `0 0% 100%` |
| `--primary` | `220 13% 9%` | `--blk` #111111 | `0 0% 7%` |
| `--secondary` / `--accent` / `--ring` | `47 96% 53%` (yellow) | `--gld` #D4960A | `38 92% 44%` |
| `--accent` light fill | — | `--gld-lt` #FEF5DC | `46 95% 93%` |
| `--gold-warm` | `43 96% 56%` | align to `--gld` | `38 92% 44%` |

Add the IDEA-dimension tokens (used by the spine stepper + diagnostic chips) to `:root`:

```css
--idea-i: 41 86% 54%;  /* #F0B429 Insight */
--idea-d: 124 39% 49%; /* #4CAE53 Distinctive */
--idea-e: 200 67% 50%; /* #2B9FD4 Empathy */
--idea-a: 33 89% 47%;  /* #E8850A Authentic */
--gld-lt: 46 95% 93%;  /* #FEF5DC */
```

Update the gradient tokens (`--gradient-secondary`, `--gradient-hero`, `--shadow-brand`, `--shadow-glow`) that currently hard-code `47 96% 53%` to reference the new gold so the existing `bg-gradient-*` / `shadow-brand` utilities reskin automatically (these are consumed widely, e.g. `VersionGate` uses `bg-gradient-to-b from-background`).

**`.dark`:** the project ships a `.dark` block but `darkMode: ["class"]` is never toggled in the app (no theme switcher found). Decision: **leave `.dark` functionally as-is** (do not invest in a dark v23 palette this run) but re-point its `--ring`/accent to the new gold for consistency, and explicitly note dark mode is **out of scope** for `/v4` v1. Do not add a toggle.

### 2.2 `tailwind.config.ts` changes

The config already maps `primary/secondary/accent/...` to the CSS vars, so the token swap is mostly free. Add only the **net-new** named colors so components can use semantic classes instead of arbitrary hexes:

```ts
colors: {
  // …existing…
  idea: {
    i: 'hsl(var(--idea-i))', d: 'hsl(var(--idea-d))',
    e: 'hsl(var(--idea-e))', a: 'hsl(var(--idea-a))',
  },
  'gold-light': 'hsl(var(--gld-lt))',
},
fontFamily: {
  sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
},
```

Add the `fontFamily.sans` override (v23 uses Helvetica Neue stack) — there is no `fontFamily` key today, so this is additive and applies app-wide via Tailwind's `font-sans`.

### 2.3 Reconciling `onboard.html` / `landing.html` and `PS_COLORS`

- **`public/onboard.html` / `public/landing.html`** are static, standalone files (own inline `#D89B0D`/`#F08A00` palette) served outside the SPA bundle (Caddy front door per project memory). They are **not** consumers of `index.css`. Decision: **bring their hexes to v23 by hand in a follow-up** (swap `#D89B0D`→`#D4960A`, warm bg→`#F5F4F0`). Out of scope for the `/v4` SPA build but flagged as a token-drift risk (Risk R3). Do not import SPA CSS into them.
- **`PS_COLORS`** (`src/components/v2/problem-solver/theme.ts`) is a scoped navy/gold constant deliberately decoupled from global tokens. For the **reskinned `/v4` diagnostic** we will **not** mutate `PS_COLORS` (that would change `/v2`/`/v3` baselines). Instead, `V4Diagnose` passes the reskin via a thin theme prop / wrapper that maps to the v23 tokens, OR we introduce a `V4_PS_COLORS` sibling and select it inside the screens by context. Decision: **add a `theme` selector** so the same screen components render either the legacy navy/gold (`/v2`,`/v3`) or v23 (`/v4`) — surgical, keeps baselines green. (See Decision 3 reuse table.)

---

## Decision 3 — App shell + spine stepper; reuse vs net-new

### 3.1 Shell structure (NET-NEW)

```
src/components/v4/
  V4Shell.tsx          // <Outlet/> layout: desktop sidebar + mobile bottom-nav + sticky SpineStepper header
  V4Sidebar.tsx        // desktop left nav (spine sections + secondary links)
  V4BottomNav.tsx      // mobile bottom-nav (5 spine icons), fixed, safe-area aware
  SpineStepper.tsx     // sticky top stepper: Diagnose → Analyse → Fix → Re-measure → Defend
  useSpineRouter.ts    // derives current step from route + completion store; computes next-incomplete
```

- **Build on `src/components/ui/sidebar.tsx`** (shadcn sidebar primitive already vendored) rather than hand-rolling — satisfies "reuse shadcn before creating".
- **`SpineStepper`** generalizes the existing `Stepper` (`src/components/v2/problem-solver/Stepper.tsx`, props `{current, onJump}`). Reuse its interaction model; the spine has 5 stages (Diagnose/Analyse/Fix/Re-measure/Defend) mapping over `V4_ROUTES`, colored with the new IDEA tokens.
- Mobile-first hard requirement: 0 horizontal overflow at 375px, gap reachable in ≤2 scrolls — the bottom-nav + single-column content satisfies this; verify with the existing test harness conventions.

### 3.2 Reuse vs build (grounded in real paths)

| Concern | Decision | Real path |
|---|---|---|
| Diagnostic flow | **REUSE** logic; reskin via theme prop | `src/pages/v2/ProblemSolverDiagnostic.tsx` + `src/components/v2/problem-solver/*` |
| Build-theatre / agentic run timeline | **REUSE pattern, extend to per-step real findings** | `src/components/v2/problem-solver/AnalyseScreen.tsx` (6-step checklist; today perceived-progress on a timer — Loop 1 must surface a **real finding per step**, never fabricated) |
| Stepper | **REUSE → generalize** | `src/components/v2/problem-solver/Stepper.tsx` |
| UI primitives (Eyebrow/Heading/Lede/Card/Buttons) | **REUSE** | `src/components/v2/problem-solver/primitives.tsx` |
| Sidebar shell | **REUSE shadcn** | `src/components/ui/sidebar.tsx` |
| Tabs / Cards / Badges / Sheet (mobile drawer) | **REUSE shadcn** | `src/components/ui/{tabs,card,badge,sheet}.tsx` |
| Avatar 2.0 portrait | **REUSE builder logic** | `src/components/v2/forensic/ForensicAvatarBuilder.tsx`, `src/contexts/AvatarContext.tsx` |
| Funnel Map | **REUSE logic** | `src/components/v2/funnel/FunnelTracker.tsx` |
| Focus / What-Needs-Work ranking | **REUSE engine** | `src/components/v2/focus/{engine.ts,generate.ts,FocusWorkspace.tsx}` |
| Positioning Statement reveal / drift | **REUSE** | `src/components/v2/positioning-statement/PositioningStatementReveal.tsx` |
| Field edit / review (confirm-or-edit) | **REUSE** | `src/components/ui/field-editor.tsx`, `src/contexts/FieldReviewContext.tsx`, `FieldQueueContext.tsx` |
| Decision Board (2–3 criteria-scored moves) | **BUILD NET-NEW** | `src/components/v4/decisions/DecisionBoard.tsx` |
| Context Card "I won't ask twice" | **BUILD NET-NEW** (wire to existing store) | `src/components/v4/onboard/ContextCard.tsx` |
| Megaprompt paste + read-it-back | **BUILD NET-NEW** | `src/components/v4/onboard/MegapromptPaste.tsx`, `ReadItBackRun.tsx` |
| App shell / spine / nav | **BUILD NET-NEW** | `src/components/v4/*` (above) |

---

## Decision 4 — Loop 1/2/3 screen → route → component → backend map (S-01..S-21)

> This run builds S-01..S-06 fully; S-07..S-21 are scaffolded (route + placeholder component + typed props + TODO wiring), no fabricated data.

| S# | Screen | Route | Component | Backend (MCP tool / edge fn) |
|---|---|---|---|---|
| S-01 | Diagnose intro / Recognition | `/v4/diagnose` | `V4Diagnose`→`RecognitionScreen` | none (self-report) |
| S-02 | Trust Gap self-report → result | `/v4/diagnose` | `DiagnoseScreen` + `lib/trustGap` | `run_trust_gap` |
| **S-03** | Megaprompt paste box | `/v4/onboard` | `MegapromptPaste` | `provide_context` |
| **S-04** | Read-it-back agentic run (build-theatre, real finding/step) | `/v4/onboard` | `ReadItBackRun` (extends `AnalyseScreen` pattern) | `run_diagnostic_evidence`, `ingest_evidence`, `run_trust_gap`, `get_context_status` |
| **S-05** | Confirm "Sounds right ✓ / Not quite ✏️" | `/v4/onboard` | `ConfirmEdit` + `field-editor` | `provide_context` (on edit) |
| **S-06** | Context Card "I won't ask twice" | `/v4/onboard` | `ContextCard` | `get_context_status` |
| S-07 | Analyse run | `/v4/analyse` | `V4Analyse` | `run_marketing_audit`, `run_diagnostic_evidence` |
| S-08 | Analyse summary | `/v4/analyse` | `AnalyseSummary` | `run_trust_gap`, `compute_trust_gap_lift` |
| S-09 | Avatar 2.0 four-field portrait | `/v4/avatar` | `V4Avatar` (reuse `ForensicAvatarBuilder`) | `build_avatar_stage`, `create_avatar`, `get_avatar` |
| S-10 | Gap + Decision Trigger panel | `/v4/decisions` | `GapTriggerPanel` | `identify_decision_trigger`, `run_trust_gap` |
| S-11 | Decision Board (NET-NEW, criteria-scored moves) → chosen move | `/v4/decisions` | `DecisionBoard` | `generate_concepts` (seed); scoring client-side over `criteria` |
| S-12 | 7-slot design brief + claim gate | `/v4/brief` | `V4Brief` | `generate_brief`, `publish_filter_check` |
| S-13 | Funnel Map (5-stage catalog, status colors) | `/v4/funnel` | `V4Funnel` (reuse `FunnelTracker`) | `get_funnel_coverage`, `list_funnel_inventory`, `run_funnel_audit` |
| S-14 | What-Needs-Work (impact-ranked) | `/v4/work` | `V4Work` (reuse `focus/engine.ts`) | `get_funnel_audit`, `get_funnel_assets` |
| S-15 | Asset detail — image-prompt tab | `/v4/asset/:id` | `V4AssetDetail`/ImagePromptTab | `get_asset`, `generate_brief` |
| S-16 | Asset detail — design-brief tab | `/v4/asset/:id` | DesignBriefTab | `generate_brief`, `log_asset` |
| S-17 | Asset detail — check-asset tab | `/v4/asset/:id` | CheckAssetTab | `audit_asset`, `record_assessment`, `publish_filter_check` |
| S-18 | Drift banner on Positioning Statement change | (cross-cut) | `PositioningStatementDriftBanner` (reuse `PositioningStatementReveal`) | `generate_positioning_statement`, `persist_positioning_statement` |
| S-19 | Re-measure (Trust Gap lift) | `/v4/analyse` (re-entry) | `RemeasurePanel` | `compute_trust_gap_lift` |
| S-20 | Defend (Brand Defense teaser) | `/v4/funnel` (section) | `DefendTeaser` (reuse `StayAheadScreen`) | none (Beta teaser) |
| S-21 | Export workbook | (shell action) | `ExportAction` | `export_workbook` |

Backend note: **campaign/analytics tools** (`create_campaign`, `ingest_funnel_analytics`, `get_campaign_metrics`, email-sequence tools) are built in the MCP worktree and consumed by S-13/S-14/S-19 once available; until then those screens render an honest `no_data` state — **never fabricate metrics** (hard guardrail).

---

## Decision 5 — Context "never-ask-twice" store wiring

The onboarding promise ("I won't ask twice") needs a single client store that (a) holds confirmed context, (b) drives the Context Card, (c) feeds every downstream screen, (d) round-trips to the server.

- **Reuse, don't invent global state** (AGENTS.md: check `BrandContext` first). The confirmed brand/strategy context already lives in `BrandContext` (`src/contexts/BrandContext.tsx`, persisted via `SupabaseBrandService` keyed `user_id`/`brand_id`) and avatar context in `AvatarContext`. Field-level confirm/edit state lives in `FieldReviewContext` + `FieldQueueContext`.
- **Server source of truth = `provide_context` / `get_context_status`** MCP tools. The read-it-back run (S-04) writes confirmed fields via `provide_context`; the Context Card (S-06) renders `get_context_status`. This is the "won't ask twice" contract — downstream tools (`generate_brief`, `run_marketing_audit`, etc.) read the same stored context server-side.
- **Wiring rule:** `V4Onboard` consumes `BrandContext`/`AvatarContext`/`FieldReviewContext` (already in the provider tree in `App.tsx`) — **no new context provider** unless a genuine v4-only slice emerges (e.g. spine-completion). If spine-completion state is needed, add a small `V4ProgressContext` (route-completion booleans, localStorage-backed) — that is the **only** sanctioned net-new global state, and it must be justified against `BrandContext` first.
- **Confirm/edit mechanics:** reuse `field-editor.tsx` + `FieldReviewContext` so an edit re-opens the field, re-validates with the existing Zod schemas, and re-submits via `provide_context`. No bespoke edit UI.

---

## Consequences

- One token source (v23) for the SPA; `/v2`/`/v3` diagnostics keep their scoped `PS_COLORS` so baselines stay green while `/v4` renders v23 via a theme selector.
- `/` resolves to `/v4` in this worktree (flag default ON) but every legacy route still works → safe, reversible, no prod change.
- Loop 1 is real end-to-end (no fabricated findings); Loops 2–3 are navigable scaffolds with typed seams to existing engines + MCP tools.

## Risks

- **R1 — Token bleed:** swapping global `--accent` from yellow to gold restyles every legacy V1/V2 component that uses `accent`/`secondary`/`bg-gradient-*`. Mitigation: the swap is intended (one palette), but visually QA `/v1/*` and `/v2/coach` for contrast regressions; `PS_COLORS` screens are insulated by design.
- **R2 — Build-theatre honesty:** S-04 must show a **real** finding per step, but the current `AnalyseScreen` uses a timer-based perceived-progress checklist (one synchronous edge call). Surfacing genuine per-step findings needs either streamed tool results or sequential tool calls — non-trivial; risk of slipping back into fabricated/perceived progress. Hard guardrail: never fabricate.
- **R3 — Static-file drift:** `onboard.html`/`landing.html` carry their own non-v23 hexes outside the bundle (Caddy-served). They will look off-palette until hand-reconciled; flagged, not fixed this run.
- **R4 — `PS_COLORS` theme selector:** adding a `theme` path through the shared Problem-Solver screens touches files that `/v2`/`/v3` depend on. Must stay surgical + keep existing tests green (the worktree has `__tests__` under `problem-solver/`).
- **R5 — Campaign/analytics tools not yet live:** S-13/S-14/S-19 depend on MCP-worktree tools. Until merged, those screens are `no_data`; risk of a half-wired Loop 3 if the two worktrees drift. Coordinate the tool contract early.
- **R6 — Terminology leak:** new user-facing v4 copy (Context Card, build-theatre labels) must not leak Tier-C internals (no "Safety brain"/S1–S4/CAPTURE/buyer-state names). Keep the terminology-leak lint/test green.
- **R7 — Dark mode:** `.dark` block left non-v23; if a theme toggle is ever wired, dark `/v4` will be inconsistent. Explicitly out of scope; documented.

## Verification (this worktree only)

`bash -lc 'cd <v4-surface> && npx tsc --noEmit && npm run lint && npm test && npm run build'` — plus 375px mobile overflow check on `/v4/onboard` and a terminology-leak test pass.
