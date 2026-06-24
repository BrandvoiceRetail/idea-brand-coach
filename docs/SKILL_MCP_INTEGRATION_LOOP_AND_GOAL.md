# Skill-grounded, MCP-first Coach — paired `/goal` + `/loop`

Run **`/goal` first** (sets the persistent contract), then **`/loop`** (iterates against it).
Realizes the working vision: the in-house coach becomes an MCP client whose tools are grounded
in the `skills/idea/` book library — per `docs/v2/architecture/adr/ADR-UNIFIED-COACH-CAPABILITY-LAYER.md`.

Today (verified): the two surfaces aren't unified and the skill library is wired to nothing
(`skills/idea/` is referenced only by test fixtures; neither `src/mcp/` nor the consultant edge fn
loads it). Phase-1 loop pieces (`registry.ts`, latency telemetry, `CONSULTANT_TOOL_LOOP_ENABLED`)
exist on `worktree-agent-a075e98b98356dcdd` atop the memory-loop lineage (`loop.ts`, on `main-v3`) —
unmerged.

---

## 1) `/goal` — the persistent contract (paste after `/goal `)

```
GOAL — the in-house coach drives the MCP capability layer (MCP-first) AND that layer is grounded in the skills/idea/ book library, so the coach actually USES the new skill architecture. DONE WHEN a coach turn calls >=3 MCP tools via a real tool_use->tool_result loop (user's Supabase JWT forwarded), each grounded in the relevant skills/idea/ skill(s), proven LOCALLY by the mcp-conversation-replay golden-fixture harness + tsc --noEmit clean + npm test green. HALT before any production/edge-fn deploy or the MCP-hosting (VPS-vs-AWS) infra decision — a HALT+ask is a valid stop, not a failure.

TOOLING (this repo consumes the shared best-practices guide — use it, don't restate it):
- Follow the AGENTS.md hierarchy: root AGENTS.md + the local AGENTS.md in any dir you touch. Do NOT restate generic standards.
- Pull standards/checklists from the `mango-tools` MCP (get_best_practice, get_checklist, read_guide); new folder -> scaffold its AGENTS.md via scaffold_agents_md.
- Run as planned work via the Feature Factory: func-orchestrator (TDD red->green->refactor), errors-orchestrator for failure modes. Capture plan + outcomes in .feature-factory/coach-capability-unification/{arch,func,errors,review}.md.
- The security-check hook force-asks on production actions — expected; get authorization, don't bypass.

CONTEXT / THE GAP: The MCP server (src/mcp/, 28 tools) is the canonical capability layer per docs/v2/architecture/adr/ADR-UNIFIED-COACH-CAPABILITY-LAYER.md (Option 1). The consultant edge fn (supabase/functions/idea-framework-consultant-claude/) is single-shot, one non-looping tool — no tool_result round-trip, no reach to MCP tools/data. skills/idea/ (158 skills) grounds nothing — no loader. Phase-1 loop pieces (registry.ts, CONSULTANT_TOOL_LOOP_ENABLED) sit on worktree-agent-a075e98b98356dcdd over loop.ts (main-v3); unmerged.

PLANNED WORK:
1. arch (brief): decide (a) the skill->tool grounding seam — a loader mapping skills/idea/ front-matter into MCP tool handlers / SERVER_INSTRUCTIONS (src/mcp/config.ts); (b) the chat->MCP HTTP client (inverse of src/mcp/edgeFn/client.ts), JWT-forwarded. Record in arch.md.
2. func (TDD): (a) skill loader grounding the MCP coach surface in skills/idea/; (b) a real tool_use->tool_result loop in the consultant, built ON loop.ts + registry.ts (do NOT re-fork); (c) MCP HTTP client mapping tool_use->POST /mcp, read-only first (get_context_status, list_assets, run_trust_gap). Preserve streaming + the single-shot fallback behind CONSULTANT_TOOL_LOOP_ENABLED.
3. integration: run the mcp-conversation-replay harness (golden fixtures from worktree-skill-architecture) against the looped coach; MCP client points at a LOCAL host (MCP_PORT 8787) — no prod infra.

FILE OWNERSHIP — you OWN: supabase/functions/idea-framework-consultant-claude/*, src/mcp/ (skill-loading + tool-grounding only), the test harness; skills/idea/ is READ-ONLY. DO NOT TOUCH: feat/decision-trigger, the avatar CreateAvatarDialog WIP in the main checkout, the prod deploy path.

PROJECT GUARDRAILS: ADR Option 1 is LOCKED — MCP canonical, chat=client, HTTP seam, full 28-tool surface, JWT forwarded; never re-fork guardrails (gateWrite/RLS/PII) into Deno. Base the worktree on a commit that INCLUDES loop.ts + skills/idea/ + registry.ts — if any is missing, STOP and flag the branch-strategy decision (don't guess a merge). LOCAL ONLY: do NOT deploy edge fns or provision MCP hosting (Phase 0 infra + VPS-vs-AWS are HALTs).

DONE GATE: tsc --noEmit clean + npm test green + the conversation-replay harness passing for >=3 MCP tools called via the loop with skill-grounding asserted; run the verify skill; then initiate-team-review (technical-architect + security-auditor for JWT/identity); fix findings; commit per phase. HALT-and-ask at the first prod-deploy/infra step. No regression to the single-shot chat.
```

---

## 2) `/loop` — the iterator (paste after `/loop `)

```
Build the skill-grounded, MCP-first coach integration, iterating until the paired /goal DONE GATE passes. Resume from .feature-factory/coach-capability-unification/state.md each iteration (create it on iteration 1 with the phase checklist below); never restart from scratch. Stop ONLY when the DONE GATE passes or a HALT is hit.

SCOPE: make the in-house coach (idea-framework-consultant-claude) an MCP client whose tools are grounded in skills/idea/, per docs/v2/architecture/adr/ADR-UNIFIED-COACH-CAPABILITY-LAYER.md. Karpathy-simple: smallest change per phase, no speculative abstraction.

EACH ITERATION:
1. Read state.md + the ADR (Implementation Sketch + status) + skills/idea/_coverage.md. Pick the next unchecked phase.
2. PHASES (in order):
   P1 BASE — confirm the worktree base includes loop.ts + registry.ts + skills/idea/. If any is missing, HALT: present the branch-strategy options (land the memory-loop lineage to main vs retarget) and ask. Do not guess a merge.
   P2 SKILL LOADER — load skills/idea/ and ground the MCP coach surface (tool handlers / SERVER_INSTRUCTIONS in src/mcp/config.ts) in the relevant skills; assert grounding is present (a tool's prompt cites its book skill).
   P3 TOOL LOOP — give the consultant a real tool_use->tool_result loop on registry.ts (build on loop.ts, don't re-fork); keep streaming + single-shot fallback behind CONSULTANT_TOOL_LOOP_ENABLED.
   P4 MCP CLIENT — implement the inverse of EdgeFnClient: tool_use -> POST /mcp with the user's JWT, against a LOCAL MCP host. Read-only tools first (get_context_status, list_assets, run_trust_gap).
   P5 VERIFY — run the mcp-conversation-replay harness (golden fixtures) proving >=3 tools fire via the loop and stay grounded.
3. TDD: write/extend the test FIRST (use the golden fixtures), make it pass, refactor. Push complexity into deterministic code.
4. After each phase: tsc --noEmit + npm test; update state.md (what landed, decisions, what's next); commit as its own conventional commit (Co-Authored-By trailer).
5. HALT (stop the loop, ask the operator) before ANY: production/edge-fn deploy, MCP-hosting/infra provisioning, branch-strategy merge to main, or new npm dependency. These are human decisions.

DONE GATE (stop when ALL true): tsc clean; npm test green; conversation-replay harness passes for >=3 MCP tools called via the real loop with skill grounding asserted; verify skill run + initiate-team-review (technical-architect, security-auditor) findings fixed; single-shot fallback still green; state.md marked COMPLETE. Never claim done on a partial slice.
```

---

## Notes for the operator

- **Branch strategy is the first real fork.** The base must contain three things currently on three
  different lineages (`loop.ts` on `main-v3`, `skills/idea/` on `worktree-skill-architecture`,
  `registry.ts` on `worktree-agent-a075e98b98356dcdd`). The loop HALTs at P1 to let you decide how to
  assemble that base rather than guessing a merge.
- **Two HALT classes are intentional:** (1) Phase 0 infra — the MCP host must be TLS-reachable from
  Supabase edge fns, and VPS-vs-AWS is an open empirical question (decide from `mcp_tool_latency`
  data); (2) any production deploy. The loop builds + verifies everything **locally** up to those gates.
- **Skill wiring is the net-new piece the ADR doesn't cover.** The ADR unifies the *tool* layer; this
  pairing adds the *skill→tool grounding* on top, so the coach's tools actually reflect the book.
