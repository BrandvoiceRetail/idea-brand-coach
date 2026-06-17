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
- [x] **P2 SKILL LOADER** — load skills/idea/ and ground the MCP coach surface in the relevant skills;
      test asserts a tool cites its book skill. (Grounding is applied to the 4 TOOL-HANDLER descriptions
      via groundingPreamble — NOT config.ts SERVER_INSTRUCTIONS, which stays static global posture.)
- [x] **P3 TOOL LOOP** — VERIFIED (already built in Phase-1, no new code needed). loop.ts does the real
      tool_use->execute->tool_result->continue round-trip, routes through registry.ts behind
      CONSULTANT_TOOL_LOOP_ENABLED, keeps SSE streaming across iterations, answers every tool_use id, has
      the forced-text/single-shot fallback. agentic-loop.test.ts (15 tests) covers it. The registry today
      only holds built-in tools (memory continue + extraction terminal) — MCP-backed 'continue' entries
      are added by P4. ENV FIX (2026-06-16): replaced the node_modules symlink with a real npm install so
      the already-declared @modelcontextprotocol/ext-apps resolves; the 5 src/mcp suites collect again
      (server/onboard/assetChain verified 33/33). Not a new dep.
- [x] **P4 MCP CLIENT** — DONE. mcpClient.ts: `callMcpTool({name,args,jwt,mcpUrl?})` POSTs a single
      JSON-RPC `tools/call` to the host (default `MCP_URL` env / http://localhost:8787/mcp), forwarding
      `Authorization: Bearer <jwt>`; parses JSON or SSE response, extracts content[].text; never throws
      (errors → is_error result). Host is the STATELESS streamable-HTTP server (http.ts:
      sessionIdGenerator undefined, enableJsonResponse true). mcpTools.ts: 3 read-only Anthropic tool
      defs (get_context_status, list_assets, run_trust_gap; run_trust_gap cites framework/00-foundations/
      02-idea-framework). registry.ts: ToolContext gained `jwt`; 3 MCP-backed 'continue' entries call
      callMcpTool. loop.ts + stream.ts: added an `mcpToolUses` bucket to BOTH categorizers, dispatch by
      name via the registry, shouldContinue + force-text guards include MCP uses. index.ts: hoisted `jwt`
      to outer scope → loopConfig.jwt; advertises MCP_TOOL_DEFS only when CONSULTANT_TOOL_LOOP_ENABLED &&
      authenticated. Test __tests__/mcp-tools.test.ts (3 groups): registry exposes >=3 continue tools +
      grounding; callMcpTool POST shape (URL/Bearer/tools-call/params); end-to-end loop run_trust_gap ->
      MCP HTTP call w/ JWT -> tool_result fed into 2nd Anthropic call -> final answer. app tsc exit 0;
      consultant suite 34/34 (threads). NO new dep. **P5 must validate the live stateless handshake**
      (whether the host needs an initialize before tools/call) against a real local host.
- [x] **P5 VERIFY** — DONE. Live integration proof `__tests__/mcp-loop-live.test.ts` (3 tests, spawns the
      real Node MCP host via tsx on :8787, detached process-group teardown). HANDSHAKE VERDICT: the
      stateless host accepts a BARE `tools/call` — NO `initialize` needed → mcpClient.ts required NO fix
      (P4's open question resolved). Proof: (1) callMcpTool run_trust_gap → live host → real computed result
      (overall/bands); (2) runAgenticLoop (flag ON) emits tool_use for 3 MCP tools → only /mcp hits the real
      host (real fetch), Anthropic mocked → >=3 distinct tools dispatched with `Authorization: Bearer` →
      3 tool_results fed into the 2nd Anthropic call (run_trust_gap's = live engine output) → final answer;
      (3) run_trust_gap advertised with skills/idea grounding. run_trust_gap fully live; list_assets returned
      ok; get_context_status returned an auth-gated error tool_result (fake JWT, no live Supabase) — handled,
      as expected. tsc exit 0; consultant suite 37/37; FULL suite 1643 passed / 1 failed / 11 todo.
      The 1 failure = `src/lib/__tests__/posthogClient.test.ts` "default host" — PRE-EXISTING + env-dependent
      (the worktree's symlinked .env.local sets VITE_POSTHOG_HOST=EU; the test doesn't stub it), fails in
      isolation too, P5 touched no PostHog code. NOT a regression.

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
  **RESOLVED 2026-06-16:** replaced the node_modules symlink with a real `npm install` in this worktree
  (declared dep, not a new one); the 5 suites collect again.

- **REVIEW (2026-06-16) — security-auditor + technical-architect, findings APPLIED in one fix commit:**
  - [HIGH] index.ts 500 handler no longer leaks `error.message` (generic body; detail server-side only).
  - [MED] index.ts JWT extraction now anchored (`/^Bearer\s+(.+)$/i`), matching the MCP host.
  - [MED] registry.ts MCP `execute` now hard-guards on `ctx.jwt` (defense-in-depth, not just the ad-gate).
  - [MED] mcpClient.ts `resolveMcpUrl` allowlists the host (loopback + configured MCP_URL host) over http(s) — SSRF guard on the JWT destination.
  - [M2] extracted `categorizeToolUse()` in registry.ts; loop.ts + stream.ts both call it (no drift).
  - [M3] generate_concepts grounding narrowed `02-brand` → `02-brand/02-brand-voice` + `02-brand/00-authentically-human`.
  - [LOW] stream.ts parse-error logs payload SIZE only (no PII); loop.ts iteration log includes MCP count.
  - [L6/L7] front-matter key charclass widened to include `-` + documented; cwd-walk depth named MAX_CWD_WALK.
  - [M1] committed the cited ADR `docs/v2/architecture/adr/ADR-UNIFIED-COACH-CAPABILITY-LAYER.md`.
  - JWT seam, rollback posture, registry-as-extension-point all validated CLEAN by both reviewers.

## Follow-ups (deferred — not blockers)
- Adopt `safeLog`/redaction across the consultant edge fn (parity with the MCP host; currently raw console.log).
- Extract a shared MCP `textFrom` (currently mirrored in ivos/client.ts + mcpClient.ts) once a 3rd copy appears — needs a Deno-importable `_shared/` location (cross-runtime).
- skillLoader reads full skill files to extract ~5 metadata fields (fine at 158; revisit if the corpus grows).
- Phase 2 continuation: expand the MCP-backed tool set beyond the 3 read-only tools toward the full 28-tool surface (per ADR); requires the Phase 0 infra HALT (MCP hosting decision) for live prod use.
