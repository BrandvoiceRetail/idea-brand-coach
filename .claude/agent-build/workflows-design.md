# Workflows Design Spec — moving the hands-off deterministic spine onto Claude `/workflows`

> **STATUS: DESIGN ONLY — GA-GATED. Not yet built.** Claude `/workflows` is off-by-default and unannounced; `.claude/workflows/` is not honored in our current environment (the enabling env var is unset). **Do not write or commit any `.js` workflow files until the GA gate below is satisfied.** This document is the spec a future agent reads to build them without re-deriving the design. Tracked as TLP-5 in `docs/developer/kerns/active/agent-build-harness-review/`.

---

## Why this exists

Hands-off mode today uses a **model orchestrator**: the `/build` Phase 2 session spawns sub-agents, holds their intermediate results, and routes by prose-following the hard gates. That is the exact pattern Claude `/workflows` was built to replace — it incurs a token tax on every spawn (results pass back through the orchestrator's context), the orchestrator drifts as its context fills, and conditional logic (our gates, our verification fan-out) is executed by a model rather than by code.

`/workflows` provides a **code orchestrator** (`.claude/workflows/<name>.js`) that defines phases, sub-agents, schemas, loops, conditionals, and budgets. Results pass directly from one agent to the next without entering a main context window. This document maps the harness's deterministic spine onto that substrate.

## GA gate — build only when ALL are true

1. The `/workflows` feature is generally available (announced, not behind an undocumented experimental flag), OR you have deliberately enabled the experimental flag for a prototype.
2. The enabling environment variable is set and `/workflows` appears as a slash command in the session.
3. `.claude/workflows/*.js` files are recognized and runnable.

Until then this stays a design doc. Detection check at build time: confirm `/workflows` is listed and a trivial one-phase `.js` runs.

## The mapping — harness concept → `workflow.js` primitive

| Harness concept (prose, today) | `workflow.js` primitive | What it buys |
|---|---|---|
| 13-agent verification fan-out → "≥1 contradicts → HALT" | `parallel` agents + `schema` (confirm/contradict + file:line) + conditional return | Deterministic verdict aggregation; verifier outputs never bloat the orchestrator |
| Per-task loop (LOAD→SPAWN→EXECUTE→VERIFY→DECIDE→ADVANCE) | `pipeline` stages + bounded loop | Streams task→verify→next without orchestrator round-trips |
| **Gate 8 — cost cap** (declared, unenforced today) | native `budget` parameter (`while budget_remaining > N`) | Gate 8 becomes **enforced in code**, not honored in prose (delivers most of TLP-2) |
| HALT on mid-run failure; no resume (TLP-3) | automatic 3× retry + resumable stages | Transient failures self-heal; an interrupted run resumes from the failed stage |
| `state.md` + Return-from-Walk (post-hoc reconstruction) | live `/workflows` view + pause (`P`) / resume / skip (`X`) | Real-time visibility during a walk-away run |
| Safe-Task-Catalog tasks (bounded, repeatable, recoverable) | the canonical "when to reach for a workflow" criteria | The catalog is already a list of workflow candidates |

## Converts vs. stays

**Converts to `.claude/workflows/*.js`:**
- The verification fan-out (first and most contained — see below).
- The per-task loop for Safe-Task-Catalog tasks.
- Budget enforcement (Gate 8).
- Retry / resume.

**Stays prose / harness (do NOT convert):**
- **Manual mode entirely** — operator-present, exploratory, per-turn judgment is the antithesis of a deterministic repeatable workflow ("for any one-off task, just prompt manually").
- `/build` **Phase 1** opener (the 15s synthesis).
- The **gate *semantics*** and the **§A–§L verification-angle catalog** — workflow agents are *pointed at* `verification-techniques.md` as their spec; the angles do not move into code.
- The **pre-flight** (`preflight.py`) and **HALT routing / Slack templates**.

The mode files remain the source of *what* to verify and *when* to HALT. Workflows only execute the deterministic parts faster and cleaner.

## First `.js` to build when GA — `verify-fanout.js` (non-running pseudo-spec)

Pick the most contained pattern first. The verification fan-out is ideal: bounded, parallel, schema-shaped, with a single conditional.

```
workflow meta:
  name: "verify-fanout"
  description: "Run independent verifier sub-agents over an irreversible-claim turn; HALT on any contradiction."
  args: { claim_context, allowed_paths, behavioral_codes[] }

schema Verdict:
  { code: string, verdict: "confirm" | "contradict", evidence: string (file:line or command output) }

phase "fan-out":
  parallel over behavioral_codes:
    agent(code) ->
      prompt: "Verify the claim for behavioral code <code>. Use the angles in
               .claude/agent-build/verification-techniques.md (load-bearing minimum, >=2 angles).
               Return a Verdict. Touch nothing; you are read-only."
      returns: Verdict

  // plain JS aggregation — no model in the loop
  const contradictions = results.filter(v => v.verdict === "contradict");
  if (contradictions.length >= 1) {
    return HALT({
      reason: "verification fan-out: >=1 contradiction",
      evidence: contradictions.map(c => `${c.code}: ${c.evidence}`),
      // HALT file + routing.md + Slack handled per handsoff-mode.md § HALT handling
    });
  }
  return PASS({ confirmed: results.length });
```

Notes:
- The fan-out fires on **irreversible-claim turns only** (PR-ready, `TASK-DONE`, about-to-declare-complete) — same trigger as the prose version in `handsoff-mode.md` § Autonomous Verification.
- Verifier agents are **read-only** and reference `verification-techniques.md`; the `.js` does not restate angles.
- The HALT path reuses the existing `halt-template.md` + `routing.md` + Slack semantics — the workflow produces the HALT payload; delivery is unchanged.

After `verify-fanout.js` proves direct result-passing, the `budget` parameter (Gate 8), and the live view against one real task, consider porting the per-task loop. Do **not** port manual mode or Phase 1.

## Follow-up ADR

When this conversion is actually built, record it as **ADR-069** (or an amendment to ADR-068) — "Workflows substrate for the hands-off deterministic spine" — capturing which patterns moved to code, the GA dependency, and the converts-vs-stays boundary above. Noted here so the decision isn't lost.

## Related launch points

- **TLP-2** (token metering): the `budget` parameter is the enforced version of Gate 8 — building this delivers much of TLP-2.
- **TLP-3** (Slack HALT reply→resume): workflow resumability + retry covers the resume half; the Slack *reply listener* remains a separate build.
- **TLP-1** (`trajectories.md`): already built — a workflow can read the trajectory table to decide which `.js` pipeline to run.
