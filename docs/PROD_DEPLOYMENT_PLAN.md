# Prod Deployment Plan — IDEA Brand Coach

_Compiled 2026-06-18. Baseline: `origin/main` HEAD `97f4d72`. Sources: 3 parallel audits (sprint objectives, prod-vs-merged state, worktree deploy-readiness) + this session's observability work. Anchored on `origin/main` (this worktree is 51 commits behind)._

## TL;DR

Most merged work is **already live** (prod SPA was hand-rsynced ≈ origin/main; CI auto-deploy is OFF). The opportunity is **a large amount of completed work that users cannot reach** — built features sitting behind an unset flag, a dangling route, an un-redeployed MCP container, or an unmerged worktree. The single highest-value move is **shipping what's already built**, not building more.

**Deploy hygiene blocker:** `FRONTEND_AUTODEPLOY` / `MCP_AUTODEPLOY` repo vars are `false`, so every release is a manual rsync. Fixing this de-risks everything below.

---

## 1. Ready-to-deploy releases (mapped to features / screens / tools)

Grouped by readiness + risk. Each release is independently shippable.

### R1 — Activate already-merged, already-built work (ship now, ~zero new code)
Highest ROI, lowest risk. All code is on `main` and in the live bundle; these are switches.

| Update | Maps to (screen/tool) | Action | Risk |
|---|---|---|---|
| **Brand Funnel Tracker visibility** | `/v2/funnel` screen (`FunnelTracker.tsx`, PR #23) | Add a nav link — it's a **dangling route** (zero links today; reachable only by typing the URL) | Trivial. A whole flagship Beta screen goes from invisible → usable |
| **CI auto-deploy** | ops (`.github/workflows/deploy-frontend.yml`, `deploy-mcp.yml`) | Flip repo vars `FRONTEND_AUTODEPLOY=true`, `MCP_AUTODEPLOY=true` (SSH key secret already present) | Low. Ends hand-rsync drift; makes all later releases reliable |
| **Observability** (this session) | PostHog dashboard 759005 + server relay | Already deployed + verified live (PRs #18–22; relay on `save-feedback-event` v6 + `figma-oauth-start` v3, end-to-end confirmed) | Done — folded in for completeness |

### R2 — Small cherry-picks + redeploys (high value, low effort)
| Update | Maps to | Action | Notes |
|---|---|---|---|
| **Figma auth fix** | `_shared/edge-auth.ts`, figma edge fns (`worktree-figma-integration`, 1 commit) | Cherry-pick + redeploy figma fns | Adds PAT support / hardens authed path. ⚠️ Verify still needed: my live test of `figma-oauth-start` with a real QA JWT returned 500 (`not_configured`), i.e. auth **succeeded** — so the "401 for all authed users" may already be resolved in the deployed `edge-auth`. Verify before claiming a live bug. Touches shared `edge-auth.ts` → check blast radius |
| **MCP Docker redeploy** | Funnel MCP tools (`getFunnelAssets`, `getFunnelCoverage`, `audit-asset`, `funnel-rewrite`) + this session's avatar/workbook failure events | Rebuild + redeploy the MCP container | MCP isn't continuously running; this is also what makes the committed `mcp_avatar_*`/`mcp_workbook_*` observability events go live |

### R3 — Code-complete features gated on ops/secrets (rebase + deploy)
| Update | Maps to | Blockers to ship | User value |
|---|---|---|---|
| **Canva integration** | `/v1/integrations` (nav already exposes it, "Available Now") · 7 `canva-*` edge fns (already ACTIVE in prod) · import → coach KB | Register Canva Connect app + set 4 `CANVA_*` secrets; merge/rebase `worktree-canva-integration`; regen types | High — design import into the coach. Backend is **already live**; closest to flipping on. **Currently erroring in prod** (deployed, unconfigured) → fix or disable to stop 500s |
| **Competitor agents** | `/v2/funnel` → `TouchpointCompetitorAgentPanel` · `competitor-analysis-asset`, `brand-defense-monitor` edge fns | DataForSEO account + 2 secrets; apply 6 migrations; deploy 2 fns; regen types; rebase onto main (funnel base already on main → keep only the delta); flip `VITE_COMPETITOR_AGENTS` (OFF) **last**; counsel review gates GA | High differentiation. Cleanest code state (tsc clean, 1259 tests green). Brand Defense rides a stub (3/7 modalities wired) |

### R4 — Needs work before shipping (do not ship as-is)
| Update | Maps to | Why not ready |
|---|---|---|
| **Multi-avatar** (`feat/brand-avatar-scope`) | Whole-app avatar switch (brand→avatars, scoped RAG) | ~1,790 **uncommitted** lines (newer multi-select layer); its migration is **already in prod** (repo/prod drift). Commit + re-verify first. **NOT flag-gated** → risky. 3 human-gated deploys |
| **Decision-trigger** (`feat/decision-trigger`) | Alpha `DecisionTriggerPanel` · `identify-decision-trigger` fn | Strategic **go/no-go decision** still open (proposal); 91 commits behind → heavy consultant rebase |

### Cleanup track (parallel, not user-facing)
- **Stop the prod 500s:** Canva + competitor-agent edge fns are deployed-ahead-of-merge and erroring — either complete activation (R3) or disable them.
- **Source-of-truth drift:** several ACTIVE edge fns have `entrypoint_path` pointing at local worktree paths (deployed straight from a worktree, not CI). Redeploy from `main` once CI is on.
- **Prune obsolete branches:** `worktree-feedbackData`/`main-v3` and `worktree-customer-journey-tracking` — their content is already on `main`.

---

## 2. Gap analysis vs original sprint objectives

Baseline: the June-2026 Alpha→Beta Feature Map (`_bmad-output/loop-prompts-feature-map-2026-06-11.md`), 10 feature areas.

**Alpha (all 10 areas): ✅ COMPLETE + live.** Gate passed 2026-06-12 (6 bugs fixed, output engine banked). Area 10 (Feedback & Analytics) is now *over-delivered* — this session added full feature instrumentation + a verified dashboard + server-side error relay, which was a Beta-tier item.

**Beta — the real gap surface:**

| Beta objective | Status | Gap |
|---|---|---|
| Output-engine stages (Avatar 2.0 / Canvas / Brief / export / marketing audit) | Export/workbook **built** (MCP `exportWorkbook`); not all stages surfaced in-app | Partial — needs UI surfacing |
| Multi-avatar portfolio (Area 09) | **Built** (`brand-avatar-scope`), not shipped | Ship-gap (R4) — completed work not in users' hands |
| Competitor / multiple products | **Built** (`feat/competitor-agents`), not shipped | Ship-gap (R3) |
| Doc upload, Figma/Canva import | **Built**, gated/dark | Ship-gap (R2/R3) |
| Marketing Evaluator (Area 07) | Largely **unbuilt** | True build-gap |
| Performance & ROI (Area 08) | Mostly **unbuilt** (`performance_metrics` is a thin KV per audit) | True build-gap |
| **Paid plans / monetization** | **100% unbuilt**; `learn-vs-pay` decision open | **Biggest gap** vs business metrics ("10 paying", 1000 MAU). A build effort, not a deploy |
| Tester exit gate (3–5 testers) | Operator-owned, **open** | Process gap |

**The headline gap is not missing features — it's unrealized progress.** Funnel tracker, Figma, Canva, competitor agents, multi-avatar are all built but unreachable by users. Closing the *ship* gap (R1–R3) converts existing investment into user value faster than any new build.

---

## 3. Prioritization (sprint criticality × user value ÷ effort/risk)

**P0 — do first (high value, low effort, unblocks):**
1. **Brand Funnel Tracker nav link** (R1) — unlocks a built flagship screen for ~zero effort.
2. **CI auto-deploy flip** (R1) — ends hand-rsync drift; de-risks every later release.
3. **Verify/land the Figma auth fix** (R2) — small; clears the path for Figma UI.

**P1 — high value, moderate effort:**
4. **Figma UI activation** — `VITE_ENABLE_FIGMA=true` + `FIGMA_*` secrets + rebuild (after #3).
5. **MCP Docker redeploy** (R2) — lights up funnel MCP tools + the committed observability events.
6. **Canva activation** (R3) — backend already live; register app + 4 secrets.

**P2 — valuable, more effort/decision:**
7. **Competitor agents** (R3) — rebase + DataForSEO + migrate + deploy + flag; counsel review gates GA.
8. **Multi-avatar** (R4) — commit the uncommitted layer + re-verify + 3 deploys; add a flag first.

**P3 — strategic / build, not deploy:**
9. **Decision-trigger** — needs the go/no-go decision + heavy rebase.
10. **Monetization / paid plans** — the biggest objective gap, but it's a build initiative (+ the learn-vs-pay decision), not a deployment.

**Parallel:** cleanup track (kill the erroring Canva/competitor 500s, fix worktree-deploy drift, prune dead branches).

---

## Recommended first release (R1, this week)
Smallest safe batch that converts the most built-but-dark value:
1. Add the `/v2/funnel` nav link.
2. Flip `FRONTEND_AUTODEPLOY` + `MCP_AUTODEPLOY` to `true`.
3. Confirm observability (already live).

Then sequence P0→P1 as secrets/decisions land. Nothing in R1 needs a secret, a decision, or new feature code.
