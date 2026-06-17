# Coach capability unification — loop state

**Goal:** in-house coach (idea-framework-consultant) becomes an MCP client whose tools are
grounded in `skills/idea/`. Per `docs/v2/architecture/adr/ADR-UNIFIED-COACH-CAPABILITY-LAYER.md`.
**Base worktree:** `.claude/worktrees/skill-architecture` (branch `worktree-skill-architecture`).

## Verification recipe (this worktree)
- App typecheck: `npx tsc --noEmit` (must be exit 0)
- Edge-fn tests: `npx vitest run supabase/functions/idea-framework-consultant-claude --pool=threads`
  (use `--pool=threads` — the symlinked node_modules trips the forks-pool startup timeout)
- Full suite at phase boundaries / DONE GATE: `npx vitest run --pool=threads`

## Phase checklist
- [x] **P1 BASE** — assembled the integration base. Merged `worktree-agent-a075e98b98356dcdd`
      (current main + ADR Phase-1: registry.ts/telemetry.ts/CONSULTANT_TOOL_LOOP_ENABLED, on the
      memory loop.ts) into this skill-architecture worktree (which already has `skills/idea/`).
      Merge `e7a6374`, clean, 0 conflicts. Verified: tsc clean, 30/30 consultant tests pass.
      Prereqs present: skills/idea/ (158) + loop.ts + registry.ts + src/mcp/server.ts.
- [x] **P2 SKILL LOADER** — load skills/idea/ and ground the MCP coach surface (config.ts
      SERVER_INSTRUCTIONS / tool handlers) in the relevant skills; test asserts a tool cites its book skill.
- [x] **P3 TOOL LOOP** — VERIFIED (already built in Phase-1, no new code needed). loop.ts does the real
      tool_use->execute->tool_result->continue round-trip, routes through registry.ts behind
      CONSULTANT_TOOL_LOOP_ENABLED, keeps SSE streaming across iterations, answers every tool_use id, has
      the forced-text/single-shot fallback. agentic-loop.test.ts (15 tests) covers it. The registry today
      only holds built-in tools (memory continue + extraction terminal) — MCP-backed 'continue' entries
      are added by P4. ENV FIX (2026-06-16): replaced the node_modules symlink with a real npm install so
      the already-declared @modelcontextprotocol/ext-apps resolves; the 5 src/mcp suites collect again
      (server/onboard/assetChain verified 33/33). Not a new dep.
- [ ] **P4 MCP CLIENT** — inverse of EdgeFnClient: tool_use -> POST /mcp with JWT, LOCAL host.
      Read-only first (get_context_status, list_assets, run_trust_gap).
- [ ] **P5 VERIFY** — mcp-conversation-replay harness proving >=3 tools fire via the loop, grounded.

## HALTs (stop + ask)
prod/edge-fn deploy · MCP-hosting/infra provisioning · branch-strategy merge to main · new npm dependency.

## Decisions / notes
- 2026-06-16: base = skill-architecture worktree (operator directive "merge all you need here").
  loop.ts already in main; Phase-1 committed on agent-a075 as `0539668` then merged.
- **P2 DONE 2026-06-16.** Loader `src/mcp/skills/skillLoader.ts` (hand-rolled front-matter parser,
  no new dep; resolves skills dir via import.meta.url + cwd-walk fallback; caches). Tool→skill map
  by framework path-prefix: run_trust_gap & run_diagnostic_evidence → 00-foundations/02-idea-framework;
  build_avatar_stage → 01-customer/00-avatar-2.0; generate_concepts → 02-brand. `groundingPreamble(tool)`
  appended to those 4 handlers' descriptions (live, model-facing). Test `src/mcp/__tests__/skillLoader.test.ts`
  (4 cases: loads >=150 w/ front-matter; >=3 tools mapped; run_trust_gap description carries a citation
  traceable to a real mapped-skill chapter; avatar+concepts grounded). App tsc clean; typecheck:mcp clean
  for all P2 files; loader test 4/4 green.
- **⚠️ PRE-EXISTING ENV-GAP BLOCKER (P5/DONE-gate risk):** the symlinked node_modules (from the main
  checkout) is MISSING the declared dep `@modelcontextprotocol/ext-apps` (^1.7.4, used by
  src/mcp/tools/onboard.ts + panel/onboardPanelClient.ts — both from the onboard/custom-ui merge, NOT P2).
  → 5 src/mcp suites (assetChain, assetTracking, autoRecord, onboard, server) can't collect, and
  typecheck:mcp errors on those 2 files. NOT a P2 regression. Fix = install the declared dep into this
  worktree's node_modules (a real `npm install` instead of the main-checkout symlink). This is an
  npm-install/env action → HALT class; flagged for the operator before the full-suite DONE gate can pass.
