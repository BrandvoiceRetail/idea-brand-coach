# MCP Evals — Brand Coach

A programmatic, CI-runnable suite that **scores and compares the skill/tool configurations** that power the brand-coach MCP server, and produces the **user-value scorecard** the internal admin dashboard renders.

> Built native on the proven primitives — the 102-fixture golden corpus, the skill/tool registries, the in-process server — **not** mcpjam. mcpjam is an interactive inspector, not a programmatic harness that swaps skill sets and re-scores. It's a good fit only for the **live behavioural tier** (see below) and is noted there as a pluggable option.

## What it measures

Two families, all deterministic (no model, no network, no clock → reproducible, no-op git diffs):

**1. Configuration comparison** — a configuration = which skill layer grounds the MCP tools:

| Config | Grounding |
|---|---|
| `book-grounding` | book corpus only (`skills/idea/framework`, via `skillLoader`) |
| `app-skills` | App Skill Architecture only (`skills/idea/app-skills`, via `appSkills`) |
| `app+book` **(current/live)** | both layers |

Scored on: tool-grounding coverage, grounding density, **corpus skill-resolution**, **guardrail enforcement** (hard-rule injection), **architecture integrity** (tiers/deps/internal-only). The story it tells: neither layer alone is strong (book = knowledge but no operational architecture/guardrails; app = architecture/guardrails but doesn't cover the book paths the corpus cites) — **`app+book` wins**, which is what the live coach runs.

**2. Current-coach value KPIs** (corpus-derived) — skill faithfulness, tool-call coverage, persona adaptation + balance, safety + hardening-case coverage, **actionability** (Trevor's governing promise: every session ends with a score/trigger/brief), artifact coverage, journey coverage, tool-surface reach.

Plus **static guardrail checks** of the App Skill Architecture hard rules (no buyer-state leak, internal-only set, Component 0 clean, JTBD retired, …) and **operator flags** (the scope discrepancy, ungrounded planned tool labels, skills awaiting Trevor's detailed docs, live-tier gating).

## Run it

```bash
npm run evals               # deterministic report → src/admin/coachEvals/report.generated.ts (incl. A1 live metrics)
npm run evals:live          # GATED A2 — LLM-judged replay of the cases (needs ANTHROPIC_API_KEY)
npm run evals:mcpjam        # export the cases as an mcpjam suite (optional external runner)
npm run evals:image:mcpjam  # OUTPUT-QUALITY — emit the image E2E suite (our MCP + Higgsfield in one session)
npm run evals:image         # OUTPUT-QUALITY — vision-judge the produced images vs the rubric (needs ANTHROPIC_API_KEY)
npx vitest run src/mcp/__tests__/evals.test.ts src/mcp/__tests__/evalLive.test.ts   # engine + A2 tests
```

The runner writes a **typed `.ts` literal** (not `.json`) so the SPA type-checks it without enabling `resolveJsonModule` in the app tsconfig. No timestamp → an unchanged run is a clean diff. Re-run after changing skills/tools/corpus, then commit the regenerated file.

## The dashboard

`/admin/coach-evals` (route in `src/App.tsx`) — wrapped in `<AdminGate>` (email allowlist, `VITE_ADMIN_EMAILS` + owner fallback; see `src/config/admin.ts`). Imports `EVAL_REPORT` from the generated file and renders: hero coach-value score, value KPIs by category, the configuration-comparison table, guardrails, corpus coverage, flags, and live-tier status. Page: `src/pages/admin/CoachEvalsAdmin.tsx`.

## Layout

| File | Role |
|---|---|
| `types.ts` | report contract (the dashboard imports these types) |
| `configs.ts` | the configurations + grounding-map / skill-path / guardrail-injection helpers |
| `corpus.ts` | reads the golden fixtures (`src/test/fixtures/conversations`) → structured facts |
| `metrics.ts` | config metrics, coach-value KPIs, guardrail checks, flags (all normalised [0,1]) |
| `engine.ts` | assembles the `EvalReport` |
| `liveTier.ts` | A1 server-contract checks + `runBehaviouralJudge` (A2 gate/entry) |
| `live/` | A2 internals: `serverTools.ts` (boot), `replay.ts` (pure replay+score, injectable), `anthropic.ts` (fetch model+judge) |
| `cases/` | curated eval cases for the admin Eval Bench (`types.ts` + `catalog.ts`, pure data) |
| `mcpjam/` | mcpjam suite generator + runbook (`generate.ts`, `mcpjam-suite.generated.json`, `README.md`) |
| `image/` | **output-quality tier** — scores the IMAGE deliverables the pipeline produces (our MCP + Higgsfield) against a rubric, grounded in the opted-in corpus — see [`image/README.md`](image/README.md) |
| `run.ts` / `runLive.ts` | CLIs → the deterministic report (A1 baked in) / the gated A2 behavioural run |

## Extending

- **Add a configuration:** append to `CONFIGS` in `configs.ts` (set `groundingSource`); metrics + report pick it up automatically.
- **Add a metric:** add to `scoreConfig` (config) or `buildCoachValue` (KPI) in `metrics.ts` — keep `value` in [0,1] and give it a `display`.
- **Add a guardrail:** add to `buildGuardrails` in `metrics.ts`.

## Eval Bench (admin / Trevor)

`/admin/coach-evals` → the **Eval bench** tab (`src/pages/admin/EvalBench.tsx`) is Trevor's test environment. Each curated case (`cases/catalog.ts`) bundles **supplied context + seeded memory + sample uploads + a practice conversation + expected tools/skills/trigger/outcome**. Trevor selects a case to evaluate the coach's skill/tool performance; **Run live** is gated on the live tier. Trevor is on the admin allowlist (`src/config/admin.ts`).

Add a case: append an `EvalCase` to `EVAL_CASES` in `cases/catalog.ts` (it's pure data — the bench + tests pick it up automatically). Personas: `P1` (brand owner), `P2` (ops VA — teaching register), `edge` (safety/hardening).

## Live tier

Two layers (mirrors the corpus replay-harness gating):

- **A1 — server contract (runs now, no model).** `runLiveTier()` boots the real MCP server over `InMemoryTransport`, lists its advertised tools, and scores **tool availability**, **grounding reach**, and **guardrail-in-surface** (proves the buyer-state hard rule reaches the live model-facing tool descriptions). Deterministic → baked into the committed report by `npm run evals`.
- **A2 — behavioural (implemented; gated, default OFF).** `npm run evals:live` replays each case's practice conversation through the coach — an Anthropic Messages-API **tool-use loop via `fetch`** (`live/anthropic.ts`, no SDK dep) over the live MCP tools — then scores **tool-call accuracy (F1/recall, deterministic)** + LLM-judged **skill-faithfulness / persona-adaptation / safety** + latency (`live/replay.ts`). Tool execution defaults to a synthetic stub (selection-only eval — no DB/auth). Gated on `ANTHROPIC_API_KEY`. `runBehaviouralJudge(caseId, depsOverride?)` is injectable — tests pass mock model+judge (no key). Model overrides: `ANTHROPIC_EVAL_MODEL` / `ANTHROPIC_JUDGE_MODEL`.
  - **mcpjam alternative:** `npm run evals:mcpjam` exports the same cases as an mcpjam suite — see [`mcpjam/README.md`](mcpjam/README.md).

## Output-quality tier (image deliverables)

The tiers above score the **coach** (tool selection + transcript behaviour). The **output-quality
tier** (`image/`) scores the **deliverables the coach produces** — the actual image a shopper would
see — for *how likely they are to help the seller solve their core problem*, grounded in the
**opted-in customer corpus** (Infinity Vault, owner-certified). It runs a real session through
**both connectors in one chat** — our creative-plan directors AND the Higgsfield `generate_image`
tool — then a **vision judge** rules the produced image against a rubric with hard gates (Amazon
policy / product fidelity / no fabricated claims).

- `npm run evals:image:mcpjam` emits the MCPJam E2E suite (both connectors; a tool-call pass proves
  an image was actually rendered).
- `npm run evals:image` vision-judges the produced images against the rubric and emits a scorecard
  (non-zero exit on any fail/missing, so CI can gate on deliverable quality).

Full contract, the corpus opt-in, the rubric, and the produce-then-score flow: [`image/README.md`](image/README.md).
