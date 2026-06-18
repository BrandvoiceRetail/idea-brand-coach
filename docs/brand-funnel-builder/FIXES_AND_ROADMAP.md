# Brand Funnel Tracker — Fixes & Follow-up Roadmap

Synthesised from the test run ([`TEST_PLAN.md`](./TEST_PLAN.md)) + the build/gap analysis. Goal: turn a *working* feature into a *great* one. Nothing below is a regression — the tested screens/controls all pass; these are the things between "it works" and "a brand owner loves it."

## Build status — 2026-06-17 (this round)
**Built + shipped:**
- **P0 #1 grounding** — `audit-asset` v3 returns `grounding.fields_used` + falls back to `user_knowledge_base` when `avatar_field_values` is sparse; each Needs-Work row shows *"scored against N brand fields"*; a thin-avatar banner ("only N fields — audits will be generic, *Finish your avatar*") gates expectations.
- **P0 #2 failed state + retry** — `failed` status (migration); the service marks an asset `failed` on audit error instead of leaving it silently `pending`; In-Progress shows failed assets with a **Retry**.
- **P0 #3 empty-state CTA** — "Create an avatar" button on the empty funnel.
- **P1 #4 apply-rewrite** — `applyRewrite()` saves the coach's revised copy as a new asset version (supersedes prior) and **auto re-audits**; FixDialog now has *"Apply rewrite → new version + re-audit."* This closes the loop.
- **P1 #6 stale prompt** — banner when N touchpoints have drifted since the Signature changed, with one-click Re-audit-all.
- **P2 #10 loading skeletons** on the map.

**Deferred (documented, not built — larger or lower-value):** P1 #5 coach deep-link seeding (needs coach-component work), P1 #7 full In-Progress board state machine, P2 #8 channel first-run picker, P2 #11 coverage trend (needs snapshots), P2 #12 configurable threshold, P2 #13 image cache.

### Decisions taken 2026-06-17 (unblocking the deferred/gated set)
- **Merge:** PR #17 opened to `main` (review-gated), not a direct fast-forward.
- **Bulk upload + auto-touchpoint detection — BUILT.** `classify-touchpoint` edge fn (vision picks the touchpoint from the brand's applicable candidates) + `BulkUploadDialog` (multi-file → auto-classify each, editable + prefilled description → upload + audit all).
- **MCP surface — BUILT** (code-complete + green; live MCP host NOT yet deployed). Three tools in the gateway: `get_funnel_assets` (read), `audit_asset` (identity-gated; reuses the audit-asset edge fn), `get_funnel_coverage` (aggregates `brand_assets`). All via `getUserSupabase()` (RLS); registered in `src/mcp/server.ts`; `server.test.ts` asserts they're advertised + a mocked happy-path + anonymous-deny. `typecheck:mcp` + `npm test -- src/mcp` (259) + lint green. Build prompts: `MCP_TOOLS_BUILD_PROMPTS.md`. **Deploy of the live MCP host is a separate gated step.**
- **IV-OS `asset_events` reconciliation — RESOLVED (won't-do for now):** brand-coach stays system of record; revisit only if IV-OS needs to consume funnel data.

**Still gated (external):** warehouse metric auto-pull — the analytics warehouse has no live data yet (IV-OS ingestion).

## Test results in one line
UI is **functionally correct** across every screen + control (live: auth + render pass; mocked: 8/8 pass). The real upload→audit→persist pipeline and audit *quality* are **not yet verified live** (gated on a QA avatar + tokens). The findings below come from that gap + the UX seams the tests expose.

---

## P0 — Credibility (the audit has to feel right, or nothing else matters)

| # | Issue | Why it hurts UX | Fix | Effort |
|---|---|---|---|---|
| 1 | **Empty-avatar → hollow audit.** If an avatar has no `avatar_field_values`, the audit scores against "(avatar fields not yet filled in)" → a generic verdict that looks authoritative but isn't. | A new user's very first audit is meaningless → instant distrust of the whole tool. | Gate the audit behind "avatar has enough strategy fields"; if sparse, show *"Finish your avatar first"* with a link, and/or also read `user_knowledge_base`. Show a **confidence/grounding badge** on each verdict ("scored against 9 of your brand fields"). | M |
| 2 | **Silent audit failure.** On LLM error / 429, the asset stays `pending`; only a transient toast fires. | The asset looks stuck with no way forward. | Add a `failed` asset state + an inline **Retry** on the cell/row; surface the reason. | S |
| 3 | **No path from the empty state.** `/v2/funnel` with no avatar dead-ends at "Select or create an avatar." | New users hit a wall. | Add a **Create an avatar** CTA (and a 1-line "what this does") in the empty state. | S |

## P1 — Close the loop (the promise is "find → fix → prove," end to end)

| # | Issue | Why it hurts UX | Fix | Effort |
|---|---|---|---|---|
| 4 | **Rewrite isn't applied.** "Generate on-brand rewrite" shows revised copy but there's no *Apply* — the user copies it by hand; the asset isn't re-versioned or re-scored. | The loop breaks at the most satisfying moment. | **Apply rewrite** → creates a new asset version (`content_text` + supersede prior) and auto re-audits → the map flips to aligned. | M |
| 5 | **Coach deep-link is inert.** `Open coach to rewrite` passes `?fixAsset=<id>` but `/v2/coach` ignores it. | Promises a coaching hand-off that doesn't happen. | Have the coach read the param and seed the conversation with the asset + audit context. | M |
| 6 | **Signature-change re-flag is manual.** "Re-audit all" exists, but nothing prompts it after the Signature changes. | The "refine messaging → see what's now off" loop only fires if the user remembers to click. | On Signature save, banner: *"Your Signature changed — N touchpoints may have drifted. Re-audit?"* | S |
| 7 | **In-Progress board is thin.** Just a pending list; no queued/in-progress/in-review work states (the mockup's board). | "What's being worked on" doesn't reflect real work. | Wire a small work-item state machine (uses `superseded_by` + a status). | M |

## P2 — Friction & polish

| # | Issue | Fix | Effort |
|---|---|---|---|
| 8 | Channel tags default to **all** → cluttered map with non-applicable touchpoints. | First-run step to pick channels (or infer from connected products). | S |
| 9 | **One-at-a-time upload** with a manual touchpoint picker is slow across ~25 touchpoints. | Bulk/folder upload + **vision auto-touchpoint detection**. | L |
| 10 | No loading skeletons; audit feedback is a toast only. | Skeletons on load + per-cell/row spinner while auditing. | S |
| 11 | Before/after only in What-Needs-Work; no coverage **trend over time**. | Store coverage snapshots; sparkline on the meter. | M |
| 12 | Audit `aligned` threshold (≥70) is hardcoded. | Calibrate the bands with Trevor; make configurable. | S |
| 13 | Large screenshots → repeated base64 vision calls; identical assets re-audited from scratch. | Cache by image hash; cap/resize server-side. | S |

---

## Follow-up builds (new value, sequenced)

1. **Apply-rewrite + auto re-audit** (P1 #4) — the highest-delight single change; closes the loop.
2. **Avatar-grounding gate + confidence badge** (P0 #1) — makes every verdict trustworthy.
3. **Bulk upload + auto-touchpoint detection** — removes the biggest friction; the original P0 vision.
4. **Signature-change auto-sweep + prompt** — delivers the "messaging propagation" promise hands-free.
5. **Coverage trend over time** — turns a snapshot into a story of improvement (great for the ROI narrative).
6. **Warehouse metric auto-pull** — when IV-OS ingestion lands, replace manual baseline/result (the metrics seam).
7. **MCP surface** (audit from Claude chat) — once the D5 write-auth decision lands.
8. **IV-OS `asset_events` reconciliation** — per-asset history/audit trail on the canonical ledger.

## Test-coverage follow-ups
- **Live pipeline E2E:** a dedicated, disposable test avatar/account (not the shared QA one) so `@slow` upload→audit→persist runs in CI with cleanup.
- **Audit golden-set:** a few labelled screenshots → expected status band, to guard against prompt regressions (the audit is an LLM judgment — it needs a regression net).
- **Visual regression:** Playwright screenshot diffs per screen.
- **Mocked-flow expansion:** stub `storage.upload` + `functions/v1/audit-asset` to E2E the upload→toast→cell-update flow without tokens.

## The one thing to do first
**P0 #1 (avatar grounding).** Everything else is polish on a verdict the user has to trust. If the first audit a brand owner sees is generic because their avatar is thin, they won't come back — so gate/guide the audit on avatar completeness and show *what it scored against*. Pair it with **P1 #4 (apply-rewrite)** so the very first session ends with a fixed, re-scored asset — the "aha."
