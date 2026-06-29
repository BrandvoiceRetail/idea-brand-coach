# Trajectories — Layer-2 routing table for autonomous runs

**This is the template.** Copy it to `.agent-build/trajectories.md` (gitignored runtime state) and fill it in for the session/day. `/build` Phase 2 reads `.agent-build/trajectories.md` and spawns work from it instead of inferring candidates from a repo scan.

This is the harness's **Layer-2 routing table** (folder-as-workspace model): the operator declares, in plain language, "here is what I want moved today, and the tactic for each." Phase 2 routes to those instead of guessing. If `.agent-build/trajectories.md` is absent or empty, Phase 2 falls back to its inference scan (`build.md` Step 2.1).

---

## How `/build` Phase 2 consumes this file

1. Read `.agent-build/trajectories.md`.
2. Select the top-N **unblocked**, **hands-off** entries by `Priority` (N = Phase 2's spawn cap, ≤3 today).
   - Skip entries with `Mode: manual` (those are for the operator's main session, not background spawns).
   - Skip entries whose `Depends-on` trajectory has not completed.
3. Decompose each selected trajectory into `PLAN_N_M` files per `handsoff-mode.md` § Task Atomization, then spawn one hands-off subagent per PLAN.
4. If the file is absent/empty → fall back to the inference scan.

The **schema below is canonical** — `build.md` and `handsoff-mode.md` reference this file rather than restating it.

---

## Entry schema

```markdown
## T-<id> — <one-line objective>
Tactic:        <which Safe-Task-Catalog pattern + the approach>
Mode:          hands-off | manual
DoD:           <concrete, checkable outcomes — each independently verifiable>
Allowed paths: <whitelist of files/dirs this trajectory may touch>
Priority:      <integer; lower = sooner>   Depends-on: <T-id | none>
```

Field notes:
- **Tactic** must name a pattern from `handsoff-mode.md` § Safe Task Catalog (failing-test→pass, coverage expansion, lint/type fix, doc generation, etc.). If it doesn't match a SAFE pattern, set `Mode: manual` — it's not a walk-away task.
- **Mode:** `hands-off` = Phase 2 may spawn it in the background under the 9 hard gates. `manual` = surfaced to you, not auto-spawned.
- **DoD** must be checkable (the Evidence-chain gate, Gate 6, refuses "looks good").
- **Allowed paths** is the spawn's whitelist; anything outside is a Karpathy-scope (Gate 7) / protected-path (Gate 3) violation → HALT.
- **Depends-on** lets you sequence: a blocked trajectory is skipped until its dependency completes.

---

## Worked example (delete when you author your own)

```markdown
## T-1 — Raise coverage on backend/utils/pii_scrubber to 90%
Tactic:        Test coverage expansion — add cases, no behavior change
Mode:          hands-off
DoD:           - [ ] coverage report shows pii_scrubber >= 90%
               - [ ] no edits outside backend/tests/ and the module's test file
               - [ ] all pre-existing tests still pass
Allowed paths: backend/tests/unit/test_pii_scrubber.py
Priority:      1   Depends-on: none

## T-2 — Fix the 3 ruff F401 warnings in backend/services/jungle_scout
Tactic:        Lint fix — remove unused imports, no runtime change
Mode:          hands-off
DoD:           - [ ] ruff check backend/services/jungle_scout passes clean
               - [ ] characterization: jungle_scout tests unchanged + green
Allowed paths: backend/services/jungle_scout/
Priority:      2   Depends-on: none

## T-3 — Decide whether to split ProductSettings off the pipeline table
Tactic:        Spec/plan generation for review (output is a doc, not code)
Mode:          manual
DoD:           - [ ] a one-page recommendation doc in docs/developer/kerns/active/
Allowed paths: docs/developer/kerns/active/
Priority:      3   Depends-on: none
```

In this example Phase 2 (cap 3) would spawn **T-1 and T-2** in the background (both hands-off, unblocked), and leave **T-3** for your main session (it's `manual`).
