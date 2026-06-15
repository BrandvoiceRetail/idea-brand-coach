# IDEA Brand Coach — Refactor & Architecture Build Plan (v1, 2026-05-26)
### Focus: **v2 and beyond** · v1 stays in place (no delete, no refactor)

**Author:** BMad Master · **Method:** graphify candidates re-verified against real code (grep + file reads); unverified items marked AMBIGUOUS.

## Steering constraints (Matthew, 2026-05-26)
1. **v2 is canonical.** 2. **Do not delete anything yet** — v1 (`/v1/*` legacy namespace) stays in place. 3. **Do not refactor old code** unless it supports current or planned functionality. This plan touches **v2 + the shared edge-function backend only.**

## Objective
Make v2 a **maintainable, viable** app that gives users the **best UX solving their problem**, where **technical errors are identified, logged, and fixed fast** — sequenced to serve the **Alpha -> Beta -> GA** roadmap.

## Governing constraint
Refactor spend **<=20-30% of any 20h sprint (<=4-6h)** unless an item is massive-impact (justified inline). **Sprint v3 (now) is refactor-frozen.** Everything schedules into the next sprints' buffer / Always-On.

## The insight driving the abstractions
Nearly every roadmap feature reduces to **four primitives**: (1) conversation -> structured fields; (2) local-first **edit-aware** persistence; (3) **Trevor-voiced LLM artifact**; (4) **feedback moment**. Build those four once, in v2/shared.

## Verified findings (v2 + shared)
| # | Finding | Evidence | Stakes |
|---|---|---|---|
| 1 | Routing confirms v2 is canonical | `src/config/routes.ts` namespaces all legacy under `/v1/*`; `App.tsx` `VersionGate` -> `/v2/coach` is the live entry | v1 is safely isolated — freeze, don't touch |
| 2 | Field-extraction duplicated in v2 | `v2/components/EnhancedChatInterface.tsx`, V2ChatPanel inline regex, `hooks/useFieldExtraction.ts` (474L) | Multiplies with every extracting feature |
| 3 | v2 field persistence over a good spine, but hooks duplicate it | `hooks/{useAvatarFieldSync,useFieldDatabaseSync,useSimpleFieldSync,useFieldSync}` over `lib/knowledge-base/*` (344L+429L) | **Trust foundation** — Alpha gate + QA: "manual edits never overwritten" |
| 4 | Observability partial | shared `components/ErrorBoundary.tsx`; `Result<T>` in v2; **no `reportError`/Sentry**; quota errors hide in HTTP-200 SSE bodies | Blocks Alpha gate; user's #1 goal |
| 5 | Live `/v2/coach` state hook mid-extraction | `hooks/v2/useBrandCoachV2State` + `useChatOrchestration/useFieldOrchestration/useBrandCoachUI` | Current functionality stuck "worst of both" |

## Target abstractions (v2/shared; all ACCEPTED, #7 RESOLVED -> v2)
1. **Single v2 Field-Extraction pipeline** *(RF-05)* 2. **One v2 Field Repository, edit-aware** on the knowledge-base spine *(RF-03)* 3. **Typed LLM edge-fn client** (shared) *(RF-01)* 4. **`Result<T>` + `reportError` sink** *(RF-02)* 5. **Enforce DI in v2** *(RF-07)* 6. **`FeedbackMoment` primitive** *(RF-06)* 7. **v1/v2 canonical -> RESOLVED v2;** in-scope action = finish the v2 coach extraction *(RF-04)*.

## Priority-ordered backlog (full detail in the workbook)
- **P0 RF-01** Typed LLM edge-fn client — *massive-impact exception* (Alpha gate + #1 goal + de-risks 12+ edge fns)
- **P0 RF-02** reportError sink + Result<T> propagation
- **P1 RF-03** Converge v2 Field Repository + single edit-lock (highest correctness risk)
- **P1 RF-04** Finish `useBrandCoachV2State` extraction (live coach — current functionality)
- **P2 RF-05** Unify v2 Field-Extraction · **P2 RF-06** FeedbackMoment primitive
- **P3 RF-07** Enforce DI in v2 · **P4 RF-08** Collapse v2 cosmetic dupes

## Sequencing (<=30% per sprint)
- **Sprint v3 (now):** frozen — 0h.
- **+1 (06-01):** RF-02 (2-3h) + RF-01 thin slice (3-4h).
- **+2 (06-08):** RF-04 finish coach extraction (3-5h) + RF-07 incremental.
- **+3 (06-15):** RF-03 pt1 (4h) + RF-06 (2h).
- **+4 (06-22):** RF-03 pt2 (3h) + RF-05 (3h).
- **Always-On:** RF-07 touches + RF-08, opportunistic.

## V1 disposition — **NO ACTION NOW**
**KEEP (load-bearing):** `/free-diagnostic`, `/beta*`, `/v1/canvas`. **FREEZE (leave untouched):** the rest of `/v1/*` (idea modules, dashboard, journey, avatar, copy-generator, research, conversations) + v1-only services/hooks. **FUTURE (deferred):** decommission is a real LOC win, triggered only once v2 covers the KEEP surfaces and `/v1/*` traffic ~0 — then a measured, test-guarded removal as its own task. Full table in the workbook.

## Observability plan (identify -> log -> fix)
Edge-fn envelope classification (RF-01) -> `Result<T>` at v2 boundaries -> single `reportError` sink (console + dev overlay, **Sentry-ready seam**) -> ErrorBoundary wiring at route level -> Supabase reachability ping/banner. **DoD:** walk the flow with Supabase paused AND a forced quota error; both yield a clear recoverable error + a captured report.

## Out of scope (now)
**Deleting/refactoring any v1 code** (steering), full Sentry/APM (Beta), edge-fn internal rewrites, standalone test backfill (do inline), design-system cleanup, perf work (no measured problem).

---
*Generated by `scripts/build_refactor_plan.py`. Companion workbook: `refactor_build_plan_v1_2026-05-26.xlsx`.*
