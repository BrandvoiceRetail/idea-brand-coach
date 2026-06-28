# Agent Development Instructions — IDEA Brand Coach

## Scope

Universal rules for AI agents working on **IDEA Brand Coach** — a React/TypeScript/Vite app for
AI-powered brand consulting using the IDEA framework (Insight-Driven, Distinctive, Empathetic, Authentic), built
on Supabase (Auth, Postgres, Edge Functions) and a LangChain RAG pipeline. Area-specific rules live
in local `AGENTS.md` files (see Child Areas below); this file holds what applies everywhere.

Generic engineering standards (naming, function design, error handling, TDD, refactoring, SOLID) are
**not restated here** — consult the shared guide via the `mango-tools` MCP server
(`get_best_practice`, `get_checklist`, `read_guide`).

## The 3-Layer Operating Model

This project separates concerns so probabilistic LLM work doesn't compound errors into deterministic
business logic:

- **Layer 1 — Directive (what to do):** SOPs/instructions in Markdown (this file, skills, `docs/`).
- **Layer 2 — Orchestration (decisions):** You. Read directives, call tools in order, handle errors, ask when unclear.
- **Layer 3 — Execution (the work):** Deterministic scripts/services/edge functions. Push complexity here.

When a step can be made deterministic (a script, a typed service, a SQL function), do that instead of
doing it by hand. 90% accuracy per manual step compounds to ~59% over five steps; deterministic code doesn't.

## On Startup

- Load only this file via the `CLAUDE.md` reference.
- Load a local `AGENTS.md` when entering a covered area (see Child Areas).
- Load a skill (`.claude/skills/` or `~/.claude/skills/`) only when the task matches its description.
- Load `docs/` (IDEA framework + behavioral-science references) only when the task needs that domain knowledge.
- Never bulk-load documentation.

## Operating Principles

1. **Check for existing tools first.** Search existing components, hooks, utilities, and shadcn-ui
   primitives (`src/components/ui/`) before writing new ones. Run a duplication check (guide skill
   `dry-compliance-checker`) during planning.
2. **Self-anneal.** On a break: read the error + stack, fix, re-test, then update the relevant doc with
   what you learned (API limits, timing, edge cases). Errors make the system stronger.
3. **Update docs as you learn.** Constraints, better approaches, common errors, timing — record them.

## Boundaries

### Always Do
- Use the Supabase client from `src/integrations/supabase/client.ts`; type queries with the generated
  `src/integrations/supabase/types.ts` (auto-generated — never hand-edit).
- Handle Supabase errors gracefully: log details to console, surface a `sonner` toast with a clear,
  non-technical message.
- Validate all user input with Zod schemas; sanitize before any DB write.
- Use functional React components with explicit prop interfaces and explicit return types.
- Use the task list for work with >2 steps; run independent steps as parallel subagents.
- Run `npm run lint`, `npx tsc --noEmit`, and `npm test` before human handoff.

### Ask First
- Adding dependencies (npm).
- Adding/changing Supabase Edge Functions, auth flows, or RLS-affecting schema.
- Database schema changes (use the `database-migrator` guide agent / migrations — never ad-hoc DDL in app code).
- Introducing new global state (check `BrandContext` first).

### Never Do
- Commit secrets — use environment variables.
- Use `any` (use `unknown` + type guards).
- Hand-edit `src/integrations/supabase/types.ts` (regenerate it).
- Log sensitive user data.
- Bypass `useApiFetch`/service-layer patterns with raw `fetch` scattered in components.

## Chosen Tools

Check here before proposing a new library; run a duplication check first.

| Category | Tool | Notes |
|----------|------|-------|
| Framework | React 18 + TypeScript (strict) + Vite | functional components + hooks |
| UI components | shadcn-ui (`src/components/ui/`) | reuse before creating |
| Styling | Tailwind CSS | utility classes |
| Forms | React Hook Form + Zod | validation via Zod schemas |
| State | React Context (`BrandContext`) | avoid prop drilling; check before adding global state |
| Backend | Supabase (Auth, Postgres, Edge Functions) | client in `src/integrations/supabase/` |
| AI / RAG | LangChain in `idea-framework-consultant` edge function | Claude-based consultant + embeddings |
| Notifications | `sonner` toasts | user-facing errors only |
| Testing | Vitest + @testing-library/react | see Testing Protocol |

## Common Commands

```bash
npm run dev        # Vite dev server
npm run build      # production build
npm run lint       # ESLint
npm test           # Vitest
npx tsc --noEmit   # type check
```

## Task Management & Parallel Execution

- **RULE:** For >2 steps, create a task list before execution; keep status current.
- **RULE:** Launch independent tasks as parallel subagents; never parallelize edits to the same file.

## Git Workflow

Conventional Commits (`type(scope): subject`). Branches: `main` (production), `feature/*`, `fix/*`,
`refactor/*`. Wait for human approval before commit/merge unless told otherwise. End commit messages with:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

**`main` is the single source of truth for BOTH the frontend SPA and the brand-coach MCP gateway**
(unified 2026-06-28; the old `mcp-oauth` branch now just tracks `main` — do not reintroduce the split).
Commit MCP changes to `main`, deploy both from `main`. Deploys run **manually from a local machine**
(CI can't reach the Lightsail box) — full runbook + the `npm run typecheck:mcp` gate are in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Permission Profiles

Role profiles live in `.claude/settings/` and layer on top of `.claude/settings.json`. The
`security-check.sh` hook (from the shared guide) is always active and hard-blocks catastrophic commands.

## Testing Protocol (Before Human Handoff)

1. `npm test` (Vitest) — target ≥85% coverage for new code.
2. `npm run lint` and `npx tsc --noEmit`.
3. Verify functionality you can test (build with `npm run build` if relevant).
4. Report what requires human verification.

### Browser QA & Test Account

For any verification that needs an authenticated session (e.g. `/v2/coach`, the
Brand Coach), use the shared QA account. **Credentials and the full browser-QA
setup live in [`docs/TEST_ACCOUNT.md`](docs/TEST_ACCOUNT.md)** — start there before
driving the app with Playwright or by hand. It also documents the Supabase
auto-pause behaviour and the email-confirmation gotcha.

### Feature-local testing context lives next to the feature

Folders that own a non-trivial feature carry an `AGENTS.md` with that feature's testing steps,
acceptance bar, sample data, and guardrails. When you build or modify a feature,
add or update its folder `AGENTS.md`. Example:
[`src/components/v2/signature/AGENTS.md`](src/components/v2/signature/AGENTS.md)
covers how to test the Signature reveal engine end-to-end.

## Child Areas

| Area | Focus |
|------|-------|
| `src/components/` | Component composition, shadcn-ui usage — local AGENTS.md |
| `src/components/diagnostic/` | Trust Gap scorecard + journey bridge — local AGENTS.md |
| `src/components/v2/signature/` | Signature reveal engine, end-to-end testing — local AGENTS.md |
| `src/services/` | Service-extraction & orchestration patterns — local AGENTS.md |
| `src/mcp/` | Brand-coach MCP gateway (host, tools, guardrails) — local AGENTS.md |
| `src/mcp/contracts/` | Output-engine artifact contracts (single source of truth) — local AGENTS.md |
| `src/mcp/service/workbook/` | Gold-workbook export engine — local AGENTS.md |
| `supabase/functions/` | Edge functions (RAG consultant, interpretation, instrumentation) — local AGENTS.md |
| `docs/` | IDEA framework core + behavioral-science references. Domain knowledge — load on demand. |

## Skills

Project + shared skills live in `.claude/skills/` and `~/.claude/skills/` (synced from the guide via
`bpg-sync`). Notable shared skills:

| Skill | When to Use |
|-------|-------------|
| `dry-compliance-checker` | before implementing — find existing code to reuse |
| `refactor-pipeline` / `refactor-detector` | when a file exceeds the smells thresholds (service >300 lines, component >150) |
| `tdd-workflow-assistant` | feature work, test-first |
| `new-worktree` / `focus-worktree` / `branch-prune` | parallel dev via git worktrees |
| `initiate-team-review` | spawn the specialist reviewer roster on a diff before PR |
| `feature-factory` (+ orchestrators) | end-to-end feature builds (arch → func → errors → obsv → review → docs) |

The 60+ `.claude/commands/bmad-*` BMAD workflow commands coexist with these shared skills.

## Communication

- Show code examples over explanations.
- Comments explain *what* and *why*, not *how*.
- Surface blockers immediately; give specific test instructions before handoff.

## Meta

Migrated from the former monolithic `CLAUDE.md` to the `CLAUDE.md → @AGENTS.md` hierarchy
(originally 2026-05-25 on worktree branches; harvested into the main lineage 2026-06-07).
Convention reference: `AGENT_INSTRUCTION_HIERARCHY.md` in the shared best-practices guide
(via `mango-tools` MCP `read_guide`).
