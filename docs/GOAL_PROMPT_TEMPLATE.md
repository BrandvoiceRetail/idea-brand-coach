# `/goal` Prompt Template — planned work, tooling-wired

How to generate a `/goal` prompt that makes a coding agent do **real planned work toward a
substantial, verifiable outcome** using our shared agentic tooling — instead of a thin task list.

A goal is **substantial** when it ships a user-facing outcome (or a complete, testable slice),
structured as **plan → TDD → harden → review**, not "edit these files."

---

## The 7-section structure

1. **GOAL + DONE WHEN** — one outcome, stated as an observable end state. "DONE WHEN a guest can
   go diagnostic → scorecard → … → pick, as one routed path, verified E2E and through a review gate."
2. **TOOLING** — the standard preamble (below). Always included verbatim; it's what wires the agent
   into the guide so we don't restate generic standards.
3. **CONTEXT / THE GAP** — the project-specific problem, anchored to concrete `file.ts:line` /
   route / table names. This is the part only we can supply.
4. **PLANNED WORK** — numbered: `arch` (brief decision, recorded) → `func` (TDD) → integration.
   Specify *what* + project specifics; delegate *how* (patterns, style) to the orchestrators + guide.
5. **FILE OWNERSHIP** — explicit `OWN:` / `DO NOT TOUCH:`. Mandatory whenever >1 agent shares a
   repo. Prevents the clobber the journey-bridge ↔ SignatureReveal split was designed to avoid.
6. **PROJECT GUARDRAILS** — locked decisions (e.g. "Gen 3 scope locked — Trevor Decision 2"),
   scope limits, the **base commit** the worktree must include, live-service preconditions.
7. **DONE GATE** — `verify` skill (E2E) → `initiate-team-review` with the *named* reviewer
   (frontend-architect / security-auditor / …) → fix findings → commit as its own commit.

**Hard cap: the `/goal` condition is REJECTED above 4000 characters.** Target ≤3500 to leave margin, and count before handing it over (`wc -m`). If you're near the cap you're probably restating something the guide already owns — cut it.

---

## The standard TOOLING preamble (paste verbatim)

```
TOOLING (this repo consumes the shared best-practices guide — use it, don't restate it):
- Follow the AGENTS.md hierarchy: root AGENTS.md + the local AGENTS.md in any dir you touch. Do NOT restate generic standards.
- Pull standards/checklists from the `mango-tools` MCP (get_best_practice, get_checklist, read_guide). New folder → scaffold its AGENTS.md via the MCP scaffold_agents_md tool.
- Run this as planned work via the Feature Factory: func-orchestrator (TDD red→green→refactor) for implementation, errors-orchestrator for failure modes. Capture plan + outcomes in .feature-factory/<feature>/{arch,func,errors,review}.md.
- The security-check hook force-asks on production actions (live Supabase deploy / migration) — expected; get authorization, don't bypass.
```

---

## Fill-in skeleton

```
GOAL — <one substantial outcome>. DONE WHEN <observable end state>, verified E2E and through a review gate, no console errors.

<STANDARD TOOLING PREAMBLE>

CONTEXT / THE GAP: <problem, anchored to file.ts:line / route / table>.

PLANNED WORK:
1. arch (brief): <key decision>; record in arch.md.
2. func (TDD): <what to build, tests first>.
3. <integration / reuse-don't-rebuild notes>.

FILE OWNERSHIP — you OWN: <files>. DO NOT TOUCH: <other agent's files + shared scoring/logic>.

PROJECT GUARDRAILS: <locked decisions>; <scope limit>; base your worktree on a commit that INCLUDES <prereq commit/feature> — if missing, STOP and flag; confirm <live service> before testing.

DONE GATE: run the `verify` skill over <path>; then initiate-team-review (<named reviewer>) on the diff; fix findings; commit as its own commit. No regression to <surfaces>.
```

---

## Generation rules

- **DRY against the guide.** Never restate naming/function-design/error-handling/React/voice/style
  rules — they live in `AGENTS.md` + the guide; point at the `mango-tools` MCP instead.
- **Keep only project-specific facts:** file paths, routes, table names, locked decisions, the seam
  being fixed, the base commit. Everything generic is a reference, not a paragraph.
- **Plan before code.** Every goal opens with a brief `arch` decision recorded in `.feature-factory/`,
  then TDD via `func-orchestrator`. That's what makes it "planned work," not a patch.
- **Parallel-safe by construction.** Carve `OWN` / `DO NOT TOUCH`; tell each agent to run in a
  **fresh worktree** off a base commit that already contains shared dependencies.
- **Verifiable done.** The DONE GATE must be observable (a `verify` run + a review-gate pass), never
  "looks complete."
- **One-time setup** so an agent can reach the tooling: `npm i` in the worktree (`.npmrc` →
  GitHub Packages), `mango-tools` in `claude mcp list` (user scope), `bpg-sync --global` if the
  reviewer subagents aren't in `~/.claude/agents`.

Worked references: the journey-continuity (Goal A) and feedback-loop (Goal B) prompts generated
2026-05-26 are canonical examples of this structure applied.
