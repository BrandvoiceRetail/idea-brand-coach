# Sprint Status — IDEA Brand Coach (week of 2026-05-25)

Living status, maintained by the coordinator thread. Tracks v3 sprint plan (`~/Downloads/IDEA_Brand_Coach_This_Week_Plan_v3_2026-05-25.md`) + roadmap v2 Alpha gate. Last updated **2026-05-26**.

## Sprint 1 task board (v3)

| Task | What | Status | Evidence |
|------|------|--------|----------|
| T1 | Trust Gap™ 4-dim scorecard + interpretation | ✅ **done, committed** | `f5bf287`; `diagnostic-interpretation` deployed (Haiku 4.5) |
| T8 | Reviews-paste + tightened Layer 1 + Reveal CTA | ✅ **done, committed** | part of `9de686f` |
| T3 | Signature edge fn (3–4 options, Sonnet, no-parroting) | ✅ **done, committed** | `reveal-signature` deployed live (v1 ACTIVE); `9de686f` |
| T4 | Signature display (selectable cards, gold accent) | ✅ **done, committed** | `9de686f` |
| **Bridge** (F-059) | Connect scorecard → Layer 1/Signature into one journey | 🟡 **in progress** (Goal A, `c0b387fe`) | hit auth blocker — see below |
| T6 | `feedback_events` table + write path | ⬜ **not started** (Goal B, not yet launched) | — |
| T5 | Moment 1 feedback modal | ⬜ **not started** (Goal B) | — |
| T7 | BetaWelcome polish | 🟨 page exists (`src/pages/BetaWelcome.tsx`); polish unverified | — |
| T9 | E2E self-walk + 1 friend tester | ⬜ blocked on bridge + feedback | — |

## Active goals (live — observed via JSONL/worktree state, ~13:54)

- **Goal A — journey continuity**: ✅ **DONE, committed `5d4221c`** on `feat/feature-status-tracker`. Journey wired: scorecard "go deeper on <gap>" → bridge (F-059) → `/v2/coach` opens on `?gap=` (guest-safe through `/auth`) → Reveal → pick. Self-E2E passed in browser.
- **Goal B — feedback loop** (`feat/feedback-moment-1` @ `6130fc7`): ✅ done. **Ready to merge** into `feat/feature-status-tracker` (disjoint files; clean). Watch: anon-write rate-limit = tracked follow-up before public Beta.
- **Goal C — observability (RF-02)** (`worktree-obsv`, session `42ed7d9d`): ⚠️ **STALLED** — transient API 500 ~13:34 mid-regression-fix; WIP safe in `stash@{0} (obsv-wip2)`; 11 test failures to resolve. **Corrective `/goal` sent to resume** (pop stash → green the suite → commit).

## Integration state (branch: feat/feature-status-tracker @ 5d4221c)

Has: Trust Gap (`f5bf287`) + Signature (`9de686f`) + Bridge (`5d4221c`).
- **Next merge:** `feat/feedback-moment-1` (`6130fc7`) → feature branch. Looks clean.
- **Then:** `worktree-obsv` once green/committed.

## Work log

- **2026-05-26 ~12:00** — Trust Gap (`f5bf287`) + Signature (`9de686f`) committed.
- **2026-05-26 ~13:00** — Goal B feedback loop committed (`6130fc7`); `save-feedback-event` deployed + hardened.
- **2026-05-26 ~13:1x** — Goal A built JourneyBridge (auth-gate at the bridge, QA-account E2E); Goal C rebased + building observability sink.

## 🙋 Manual UX verification checkpoints (human, not an agent)

Automated E2E proves it *works*; only a human can judge whether it *lands*. Verify in-app when:
1. **NOW — the full journey, once Goal A commits the bridge** (`/v1/diagnostic` → scorecard → "Let's go deeper" → **sign-up gate** → `/v2/coach` → reviews-paste → Reveal → pick). Judge: does the sign-up gate kill momentum? does the bridge feel like a coach handing off, or an abrupt jump?
2. **Signature output quality** — do the 3–4 options actually *surprise* (Trevor's bar: "true, and they'd never said it themselves"), or do they parrot the reviews? Paste real InfinityVault reviews and read them as Trevor would.
3. **Trust Gap interpretation voice** — does the per-pillar copy read as Trevor (not generic AI) across low/mixed/high score sets?
4. **After all three merge** — walk diagnostic→signature→**feedback modal** as one flow, with Supabase **paused once** to confirm the observability seam surfaces the failure (not a silent hang).

## Next steps / queue

1. **Integration merge** (near-term coordination): Goal A (main), B (`feat/feedback-moment-1`), C (`worktree-obsv`) are on 3 branches — once each commits, merge onto `feat/feature-status-tracker` and run the full E2E together.
2. The Decision Trigger™ capture (F-058) — Trevor's flagged "most important field"; next feature `/goal`.
3. RF-01 typed LLM edge-fn client (thin slice) — pairs with the landed RF-02 for Sprint +1.
4. Branch C — broaden to 3–5 testers (after flow + feedback + observability merge + the manual UX pass above).

## 🔴 Decision needed — Goal A auth boundary

`/v2/coach` (where Signature lives) hard-redirects guests to `/auth` (`useBrandCoachV2State.ts:382`) and is behind a `FeatureGate`. The coach depends on authed, DB-backed sessions. So "guest, no-login, end-to-end" (Goal A's original DONE WHEN) is **a rebuild, not wiring.**
**Recommended resolution:** change the flow to an **intentional sign-up gate at the bridge** ("create your free account to build your Signature"), then verify authed E2E with `docs/TEST_ACCOUNT.md`. This matches the roadmap's eventual "anonymous→authenticated migration" GA gate and avoids a guest-ephemeral-coach rebuild this sprint. Steer the Goal A agent toward this if it leans toward rebuilding guest support.

## Roadmap v2 Alpha pre-launch gate

| Gate | Status |
|------|--------|
| Layer 1 conversation | ✅ exists |
| Trust Gap™ Score screen (F-057) | ✅ shipped |
| The Signature (F-060) | ✅ shipped |
| Diagnostic→Signature journey continuous | 🟡 Goal A |
| Feedback capture (Moment 1) | ⬜ Goal B |
| **Error monitoring** | ⬜ **unbuilt — next workstream** |
| Tester onboarding (BetaWelcome) | 🟨 T7 |

> Note: v3 deliberately narrowed Alpha to Trust Gap + Signature + Moment 1 (a pre-alpha hypothesis test per Trevor Decision 1). Full Avatar Builder / Forensic Canvas remain deferred.

## Refactor backlog woven in (from `_bmad-output/refactor_build_plan_v1`)

Governing constraint: refactor spend **≤20–30% of a 20h sprint (≤6h)**; v1 is FROZEN, not deleted; v2 is canonical. Sequencing (BMad plan):

| Sprint | Refactor items (≤6h) | Note |
|--------|----------------------|------|
| v3 (this wk) | 0h — frozen ship week | Trust Gap + Signature on critical path |
| +1 (06-01) | **RF-02** reportError sink + Result<T> (2–3h) + **RF-01** typed LLM edge-fn client thin slice (3–4h) | **Observability first** — it's an Alpha gate AND high-leverage |
| +2 (06-08) | RF-04 finish `useBrandCoachV2State` extraction (3–5h) | stabilise live `/v2/coach` |
| +3 (06-15) | RF-03 Field Repository converge pt1 (4h) + RF-06 FeedbackMoment primitive (2h) | |
| +4 (06-22) | RF-03 pt2 (3h) + RF-05 unify field-extraction (3h) | |
| Always-on | RF-07 DI touches, RF-08 cosmetic dupes | boy-scout |

**Synergies with the live sprint:**
- **RF-02 = the Observability workstream** (next, below) — cheap Alpha-gate satisfier; ties to the SSE-200-wrapping-error envelope (`feedback_sse_stream_capture`) + Supabase auto-pause detection (`project_supabase_pauses`). **Don't install Sentry** — build the seam (Sentry deferred to Beta).
- **Goal A ↔ RF-04 + v1 freeze:** the scorecard CTA points at `/v1/idea/*` which is **FROZEN/superseded by v2 coach** — re-pointing into `/v2/coach` is both the bridge fix and the v1-disposition direction. Goal A is editing `useBrandCoachV2State` (the RF-04 target); keep its touch minimal so it doesn't fight the later extraction.
- **Goal B ↔ RF-06:** build the reusable `<FeedbackMoment moment={1|2|3}>` primitive reusing the existing `BetaFeedbackWidget` → feedback write path — Moments 1/2/3 recur Alpha→Beta→GA. Don't build a throwaway Moment-1 modal.

## Next workstreams (queue)

1. **Goal B — feedback loop** (ready; refine to build the RF-06 FeedbackMoment primitive).
2. **Observability seam = RF-02** (Alpha-gate-required; independent; goal generated this cycle).
3. **RF-01 typed LLM edge-fn client (thin slice)** — pairs with RF-02 for the Sprint +1 "massive-impact exception" (~5–7h); base for Create-mode generators.
4. The Decision Trigger™ capture (F-058) — Trevor's flagged "most important field"; post-bridge.
5. Branch C — broaden to 3–5 testers (after flow + feedback + observability land).
