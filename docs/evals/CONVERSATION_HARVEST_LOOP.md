# Conversation → Eval Harvest Loop

Turn real coach conversations into evals over time: **log → weekly sweep → candidate test cases → failures = feature ideas → ICP grows.** This is how the eval suite (and the ICP definitions) stay grounded in what real customers actually do, not just what we imagined.

## The loop

```
log conversations (MCP + in-app chat)
        │  weekly
        ▼
  npm run evals:harvest            classify by ICP · propose candidate cases · screen pass/fail
        │
        ├── PASS  → promote to src/mcp/evals/cases/catalog.ts (a new regression case we keep green)
        ├── FAIL  → a feature idea (a real customer ask the coach can't yet serve)
        └── ICP signal → grow src/mcp/evals/icp/profiles.ts (new vocabulary / problems per ICP)
```

- **Code:** `src/mcp/evals/harvest/` — `harvest.ts` (the deterministic sweep: `harvestSweep`, `classifyConversation`), `types.ts`, `sampleConversations.ts`. CLI: `src/mcp/evals/runHarvest.ts`.
- **Run:** `npm run evals:harvest [dir]` — `dir` is a folder of conversation `.json` files; with no dir it uses the bundled sample. Writes `harvest/out/{candidates,feature-ideas,icp-signals}.json` for review.

## What the sweep does (deterministic, no model, no DB)

1. **Classify** each conversation → ICP (P1 busy brand owner / P2 operational VA) from the same detection signals as `icp/profiles.ts`; detect tools engaged, whether it ended on an action, and risk flags (prompt-injection / fabrication ask).
2. **Propose a candidate case** (`status: 'candidate'`) — the opening user ask becomes the query; observed tools + persona are filled in.
3. **Screen** pass/fail against the governing checks: ended-with-action, ICP identified, tools engaged, and (for risk conversations) handled-safely (refused).
4. **Failing → feature idea** — a real customer ask the coach couldn't serve, with a suggested capability. This is the product-discovery output: failures point to what to build next.
5. **ICP signal** — aggregate per-ICP vocabulary + problems to grow the canonical profiles.

> Optional LLM enrichment can layer on top of the deterministic pass (e.g. a judge to draft the candidate's `expected` block), but the core sweep stays deterministic so it runs in CI and produces clean diffs.

## Wiring the real source (the one seam)

The sweep takes `Conversation[]`. Today the CLI reads JSON files or the bundled sample. To wire the real source, add an adapter that pulls:

- **In-app chat:** `chat_sessions` + `chat_messages` (`chatbot_type = idea-framework-consultant`), RLS-scoped, via the existing service client. (The MCP already reads these for `list_coach_conversations` / `get_coach_conversation`.)
- **MCP transcripts:** the per-avatar coach conversations surfaced by the MCP reads.

Map each to `Conversation { id, source, avatarId?, turns[], toolCalls?, capturedAt }` and pass the batch to `harvestSweep`.

**Guardrails for the real source:** redact PII before persisting candidates (reuse `src/mcp/logging/redact.ts`); never store raw prompts/keys; the harvest output is internal/admin-only (same allowlist as the eval bench). The weekly cadence can be a scheduled job (cron) or a manual admin action.

## The weekly ritual

1. `npm run evals:harvest <export-dir>` (or run the scheduled job).
2. Review `harvest/out/candidates.json` — promote the good PASS cases into `cases/catalog.ts` (they become permanent regression cases).
3. Triage `harvest/out/feature-ideas.json` — these are real-customer feature signals; route to the backlog.
4. Fold `harvest/out/icp-signals.json` new vocabulary/problems into `icp/profiles.ts` + `docs/ICP.md`.
5. Re-run `npm run evals` so the dashboard reflects the grown suite.

## Status

Built: the deterministic sweep + CLI + sample + outputs. **Remaining (seams, noted):** the Supabase/MCP source adapter, PII redaction on persisted candidates, an admin review/promote UI, and the scheduled cadence. See `docs/evals/EVALS_GAP_ANALYSIS.md`.
