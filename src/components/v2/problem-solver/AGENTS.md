# Problem-Solver Diagnostic (/v2/diagnostic) — Agent & Testing Context

Feature-local instructions. Root `AGENTS.md` applies; this adds only what's specific here.

## What this is

The React port of the Demo v2 mockup
(`_bmad-output/mockups/idea-brandcoach-DEMO-v2-trevor-spec.html`): an 8-screen
"fix the Trust Gap" flow at the route **`/v2/diagnostic`**. The flow shell is
`src/pages/v2/ProblemSolverDiagnostic.tsx`; one focused component per screen lives
here. `/v1/diagnostic` still serves the original guest `FreeDiagnostic` — untouched.

These screens use **scoped colour constants** (`theme.ts` → `PS_COLORS`) via inline
styles. As of 2026-06-28 `PS_COLORS` carries the **Trevor v23 black/gold palette**
(blk `#111111` · wrm `#F5F4F0` · gld `#FFB627` · gld-lt `#FEF5DC`) so the diagnostic
matches the dark `/v4` surface — the old Demo-v2 navy (`#1A3557`) is gone. The `navy*`
keys are retained (every screen references them) but now resolve to black/charcoal.

## Entry experience — the three movements (IDEA-APP-ENTRY-001 v1.1)

Trevor's Revised Entry Experience Brief rebuilds what precedes the diagnostic into
three movements: **1 Recognition → 2 Diagnosis → 3 Prescription**. The product's own
Decision Trigger is Recognition, so the experience must MIRROR the customer before it
says anything about itself.

- **Movement 1 — Recognition** is BUILT: `RecognitionScreen.tsx`, served on the
  **`/v3/diagnostic` review route** (`<ProblemSolverDiagnostic showRecognition />`)
  so the canonical **`/v2/diagnostic` is untouched** while Trevor reviews it. It renders
  full-screen *before* the 8-step flow, with **no Stepper/BrandBar** — acceptance
  criterion #1 forbids any product / framework / "Trust Gap" vocabulary here (also #8
  no CAPTURE names, #9 no buyer-state names; guarded by `__tests__/RecognitionScreen.test.tsx`).
  The shell gates it via the `showRecognition` prop → `entered` flag; the continue
  affordance ("Show me why") flips `entered` and enters the diagnostic. Visual brief for
  the image lives in the component's header JSDoc; drop the asset into `RECOGNITION_IMAGE`.
  Once Trevor approves, fold it into `/v2` (default `showRecognition` on, or retire `/v3`).
- **Movements 2 & 3 are NOT built** — Trevor's process gate (AC #7) is "show me
  Movement 1 before you move to Movement 2." When built, they slot between Recognition
  and the flow (before `entered` flips). The brief also revises the diagnostic instruction,
  results-screen sequence (Component 0 first), and adds the governing product descriptor
  to the nav sub-label / footer / post-CTA — all out of scope until M1 is signed off.

## Screen → engine wiring

| # | Screen | Component | Wiring |
|---|--------|-----------|--------|
| 1 | Diagnose | `DiagnoseScreen` | **LIVE** — `diagnosticQuestions.ts` mirrors FreeDiagnostic's 4 evidence-based Qs + scoring (`computeSelfReport`: pillar% = score/5·100, overall = mean). Reveal computes the real self-report via `buildTrustGap`. |
| 2 | Unlock | `UnlockScreen` | **GATE** — founding-member framing (£97 is framing only; billing stubbed). CTA = auth gate. |
| 3 | Upload | `UploadScreen` | **LIVE** — ASIN/URL via `parseAsinInput` (first ASIN). Screenshot upload is FUTURE (F2), shown but unwired + labelled. |
| 4 | Analyse | `AnalyseScreen` | **LIVE** — `run-forensic-analysis` edge fn with `{ asin, self_report_scores }`; auto-runs on arrival; 6-step perceived-progress checklist (8s timer, same pattern as `ForensicAnalysisPanel`). |
| 5 | Customer | `CustomerScreen` | **LIVE** — `forensic_scores` (→ `buildTrustGap` /25) + the `customer_profile` 4 cards + "Grounded in N reviews" badge + thin-corpus caveat. Empty profile fields render an honest placeholder, never faked. |
| 6 | Your fix | `FixScreen` | **LIVE** — `interpretation.primaryGapSummary` + `DecisionTriggerPanel` via its `result` prop (no re-call) + the trigger's `placementInstruction` as the brief framing (full `generate_brief` is FUTURE). |
| 7 | Stay ahead | `StayAheadScreen` | **STATIC** — Beta Brand-Defense showcase. Illustrative numbers, clearly labelled Beta. |
| 8 | In Claude | `InClaudeScreen` | **STATIC** — Claude Connector showcase. Illustrative panel. |

## Auth gate

The forensic run (S4) is signed-in only. S2's CTA (`handleUnlock`) and any stepper
jump to S3+ gate on `useAuth().user`: signed-in → continue; signed-out → navigate to
`/auth?redirect=/v2/diagnostic`. The shell also blocks jumps to screens whose data
isn't ready (Upload needs a self-report; Analyse+ needs an ASIN; Customer/Fix need a
completed report).

## Shared seams (single source of truth)

- `types.ts` — the `ForensicResponse` contract (mirrors the edge fn) + `isForensicResponse` guard + `ProblemSolverFlowState`.
- `forensicMapping.ts` — `mapDecisionTrigger` (snake_case → `DecisionTriggerResult`) + `forensicToInputScores` (/25 → 0-100). Mirrors `ForensicAnalysisPanel`'s mapping so S5/S6 stay calibration-identical.

## Analytics

- `problem_solver_step_viewed` ({ step, step_name, overall_score }) on each step view.
- `problem_solver_unlock_gated` ({ step }) when the auth gate redirects.
- S4 reuses `forensic_analysis_started` / `forensic_analysis_completed`.
- Scores / step-index / booleans only — never the ASIN value, review text, or PII.

## How to test manually

0. Open `/v3/diagnostic` (signed out, mobile 375px). Movement 1 (Recognition) shows first — pure customer mirror, no product chrome, fits within ~1 scroll. "Show me why" enters the flow. (Restart on S8 returns here.) `/v2/diagnostic` shows the flow directly with no Recognition (baseline).
1. Answer the 4 questions → Reveal → real score dial + per-pillar /25 rows.
2. Continue → S2. Click the CTA while signed out → routed to `/auth?redirect=/v2/diagnostic`.
3. Sign in (QA account, `docs/TEST_ACCOUNT.md`), return → S2 CTA continues to S3.
4. Paste a known ASIN (e.g. `B0CJBQ7F5C`) → S4 auto-runs the forensic engine (6-step progress, ~30-60s).
5. S5 shows real forensic scores + the customer-profile 4 cards + grounded badge (thin-corpus caveat when few reviews).
6. S6 shows the primary-problem summary + Decision Trigger panel + placement-brief framing. (Thin corpus → trigger may be absent; panel degrades to its locked teaser — that's correct, not a bug.)
7. S7 / S8 are static showcase screens; "Restart" on S8 resets to S1.
8. No console errors.

## Scope guardrails

- Don't fake S5/S6 data — render what the engine returns; honest placeholders for empty fields.
- S7/S8 are intentionally static showcase screens; keep them clearly labelled.
- Keep analytics props to scores / step-index / IDs — never PII or the ASIN value.
- Don't override global theme tokens — use `PS_COLORS` scoped to this flow.
