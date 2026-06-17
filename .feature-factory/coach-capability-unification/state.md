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
- [ ] **P2 SKILL LOADER** — load skills/idea/ and ground the MCP coach surface (config.ts
      SERVER_INSTRUCTIONS / tool handlers) in the relevant skills; test asserts a tool cites its book skill.
- [ ] **P3 TOOL LOOP** — real tool_use->tool_result loop on registry.ts (built on loop.ts; mostly
      present from Phase-1 — verify + extend). Streaming + single-shot fallback behind CONSULTANT_TOOL_LOOP_ENABLED.
- [ ] **P4 MCP CLIENT** — inverse of EdgeFnClient: tool_use -> POST /mcp with JWT, LOCAL host.
      Read-only first (get_context_status, list_assets, run_trust_gap).
- [ ] **P5 VERIFY** — mcp-conversation-replay harness proving >=3 tools fire via the loop, grounded.

## HALTs (stop + ask)
prod/edge-fn deploy · MCP-hosting/infra provisioning · branch-strategy merge to main · new npm dependency.

## Decisions / notes
- 2026-06-16: base = skill-architecture worktree (operator directive "merge all you need here").
  loop.ts already in main; Phase-1 committed on agent-a075 as `0539668` then merged.
