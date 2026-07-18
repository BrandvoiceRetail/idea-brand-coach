# Hands-Off Mode

**Operator presence:** ABSENT. Cannot answer questions. Cannot resolve HALTs in real time.

Hard gates below are non-negotiable. They exist because the operator's judgment is unavailable; the gates substitute for it by refusing to proceed where judgment would be required. Mode is declared via `/build` (or by a Phase-2 spawn). There is no auto-trigger — a session is hands-off only when `/build` says so.

This mode applies to: overnight/walk-away queues, and **every subagent Phase 2 of `/build` spawns** (operator-absent by definition, regardless of the main session's mode).

Verification angle definitions live in `verification-techniques.md` — this file references the §H rigor ladder and the §A–§L angles by name and does not restate them.

---

## Pre-Flight (the one gate before launch)

Walk all **25 checks across 5 phases** (~15 min first time, 8–12 after) — **~11 are automated by `preflight.py`; the other ~14 are MANUAL and you confirm them by hand.** A clean `preflight.py` run is *not* "cleared to launch" — it only proves the environment checks; the behavioral gates (Phase 3) are not machine-verifiable. If any check fails and you can't fix it in 5 minutes: **do not start** — run manual mode instead, or defer.

- **Phase 1 — Environment:** Karpathy CLAUDE.md/AGENTS.md present + hands-off appendix (below); repo at a clean, known commit; working branch isolated (not main/master/staging); backup taken (`git tag pre-handsoff-<date>` or tarball).
- **Phase 2 — Task Atomization:** every queued task matches a Safe Task Catalog pattern (below); each atomized to a `PLAN_N_M.md` with ≤3 sub-steps; concrete DoD checkboxes; documented rollback; declared `Depends-on`.
- **Phase 3 — Hard Gates:** all gates below active (TDD, design-approval, protected-path, destructive-op, network-egress for tests).
- **Phase 4 — Slack HALT:** webhook/bot token configured + tested; phone notifications on; routing table loaded; **`--hard-stop` declared** (never run open-ended); severity prefixes (🛑 / ‼️) active.
- **Phase 5 — State & Resumption:** `.agent-build/` initialized + writable; `RESUME.md` written; prior session notes loaded; **cost cap declared**.

Run the auto-checker for the environment-verifiable subset (it automates ~11 of the 25 and prints PASS/FAIL/MANUAL; exits non-zero on any FAIL):

```bash
python3 .claude/agent-build/preflight.py --hard-stop <ISO-timestamp> --cost-cap <dollars>
```

**FINAL AUTHORIZATION** — once the ~11 automated checks PASS *and* you have confirmed the ~14 MANUAL checks by hand, say:
`authorize hands-off run, queue from .agent-build/objectives/, hard-stop <ISO-time>, Slack HALT to <recipient>` — then walk away.

---

## Task Atomization (GSD `PLAN_N_M.md` pattern)

Upstream source: the operator's `.agent-build/trajectories.md` routing table (schema in `trajectories.template.md`). `/build` Phase 2 selects the top hands-off trajectories and **decomposes each into the `PLAN_N_M` files below** — one trajectory becomes one or more PLANs. PLANs may also be authored directly without a trajectory.

Each task is small enough to fit in ~50% of a fresh subagent's context: **≤3 sub-steps, ≤500 LOC, ≤10 files.** Bad atomization = bad overnight outcomes. Template (file: `.agent-build/objectives/<obj>/plans/PLAN_<n>_<m>.md`):

```markdown
# PLAN_N_M — <one-line task title>
## Objective       <2–3 sentences: what changes, why.>
## Depends-on      <None | PLAN_<n>_<m>>
## Sub-steps (≤3)  1. <concrete action + files to touch>  2. …  3. …
## Definition of Done (concrete checkboxes — agent must pass ALL)
- [ ] <verifiable check>  - [ ] No new files outside <allowed-paths>  - [ ] PR opened (NOT merged), reviewer @<human>
## Rollback         <concrete commands: git stash / git reset --hard <pre-task-tag> / drop branch / revert PR>
## Verification     <tool receipt · file:line spot-check · test re-run · mutation sanity · which BMAD specialist>
## HALT triggers    <sub-step fails DoD · protected-path edit · destructive op · file/module ambiguity · angle disagreement>
```

Rules: every DoD checkbox independently verifiable (not "looks good"); rollback is concrete commands; if you can't write a specific DoD the task is under-defined — don't queue it; if it touches a protected path it's a manual-mode task.

---

## Safe Task Catalog (pre-vetted for hands-off)

Safe tasks share three properties: bounded scope · rollback in <30 min · no protected-path edits. **If your task doesn't match a SAFE pattern, it's a manual-mode task — do not queue it.**

| SAFE pattern | Example | Required gates |
|---|---|---|
| Failing-test → make pass | Make a red test green without changing the test | TDD + protected-path |
| Test coverage expansion | 60% → 80% on module Y, no behavior change | protected-path + cost-cap |
| Lint / type fix | Fix mypy/eslint in module Z, no runtime change | protected-path + characterization snapshot |
| Documentation generation | Docstrings for module W, no positioning statement/behavior change | protected-path + Karpathy #3 (surgical) |
| CI failure investigation (no fix) | Read CI log, propose 1–3 causes w/ file:line; DO NOT apply | design-approval (output is a doc) |
| Spec / plan generation for review | Draft a spec; operator reviews before code | design-approval |
| Slack notifier event addition (Path B) | One `CHANNEL_BY_EVENT` row + test, per skill `017` | TDD + protected-path |
| Bug fix with explicit reproducer | Write failing test for the repro, then fix | TDD + design-approval if new file |

**NOT-SAFE (manual mode only):** first-pass feature implementation · cross-module refactor · auth/payments/billing edits · Supabase migrations / RLS-affecting schema · production deploy · customer-data flows without classification review · PR merges · new package/dependency. Quick test: "If this goes wrong at 2am, can I recover in <30 min without waking anyone?" No/maybe → manual mode.

---

## The Per-Task Loop

The queue is the `PLAN_N_M` files decomposed from the selected `.agent-build/trajectories.md` entries (or directly-authored PLANs). For each `PLAN_N_M.md` in the queue:

```
1. LOAD       — read the PLAN (Depends-on satisfied? DoD checkboxes present?)
2. SPAWN      — fresh dev-agent subagent per task (GSD: no cross-task context carryover)
3. EXECUTE    — send the plan; agent works the sub-steps
4. GATE-CHECK — at every sub-step boundary: check all hard gates
5. CAPTURE    — extract every load-bearing CLAIM from agent output
6. VERIFY     — prove/disprove each claim, ≥2 independent angles (verification-techniques.md)
7. DECIDE     — PROCEED (next task) / PRESS (if-gap branch) / HALT (gate or decision point)
8. LOG        — append event to .agent-build/objectives/<obj>/<task>/state.md; write verifications/ + halts/
9. ADVANCE    — next PLAN, or HALT cleanly at end-of-queue / hard-stop
```

The conductor/dev-agent separation and the "do not do the dev work yourself" rule are absolute — the runner conducts and verifies; the spawned dev agent does the work.

---

## Hard Gates (unified — non-negotiable)

Each gate: a trigger, a response, a severity for Slack routing. When a gate fires: HALT + Slack.

**What actually enforces the irreversible ones.** These gates are prose the dev agent is told to honor — that is a *first* line, not the *only* line. The real, unconditional backstop for the hard-block gates is the always-on security hook (`.claude/hooks/security-check.sh`, ADR-030), which hard-blocks `git push --force`, `git reset --hard`, `aws rds delete-*`, `scripts/deploy-staging.sh`, and force-asks on the rest **regardless of whether the agent honored the gate prose**, and regardless of whether `/build` was even run. Two consequences, stated honestly: (1) Gates 3/4/5 (protected paths / destructive ops / self-merge) substantially **overlap** the hook — the gate is the agent's intent, the hook is the enforcement; (2) the gates the hook does *not* cover (1 TDD, 2 design-approval, 6 evidence-chain, 7 scope) are honor-system on the dev agent and are exactly what the autonomous-verification below exists to catch. Do not treat a green pre-flight as proof these prose gates held — that is demonstrated by verification, not asserted by the gate table.

| Gate | Trigger | Response | Bypass |
|------|---------|----------|--------|
| **1 — TDD iron law** (🛑) | Production code about to be added without a failing test written first | HALT; do not write the code. If code preceded the test: delete it, start from the test | None |
| **2 — Design-approval** (🛑) | New module created · API surface changed · data model changed | HALT; write a design doc to `.agent-build/objectives/<obj>/designs/<name>.md` and wait for operator `approved: true` | Operator approves before resume |
| **3 — Protected paths** (🛑) | Edit attempted under `supabase/migrations/` · `supabase/config.toml` · `src/integrations/supabase/` (client + generated types) · auth-flow code (sign-in/sign-up/session) · billing/Stripe code · `.env*` | HALT immediately; do not edit; do not route around the protected dir | None — defer to manual mode (edge-fn changes under `supabase/functions/` are ask-first per AGENTS.md unless the operator's queue prompt pre-authorizes the specific change) |
| **4 — Destructive ops** (‼️) | `git reset --hard` / `push --force` on shared branch · `git rebase` off your task branch · `DROP TABLE` · delete >10 files · any `rm -rf` outside the task dir | HALT with ‼️; include reflog excerpt in the HALT file | None |
| **5 — Self-merge** (🛑) | Attempt to merge own PR; push to `main`/`master`/`staging` | HALT; humans review and merge | Never |
| **6 — Evidence chain** (🛑) | Task about to be marked DONE without `command → output → file:line → DoD checkbox` | HALT; produce the chain for every DoD bullet first | None |
| **7 — Karpathy scope** (🛑) | A change touches code outside the task's declared file/module list | Treat as a protected-path violation; HALT on scope uncertainty | None |
| **8 — Cost cap** (🛑) | Token spend exceeds the declared cap (default: 25% of the monthly $200 budget). **Note: the cap is *declared*, not yet *measured* — real per-objective spend metering is unbuilt (TLP-2), so today this gate is wall-clock-adjacent, not a true spend tripwire.** | HALT | Operator authorizes top-up |
| **9 — Hard-stop time** (🛑) | Wall-clock exceeds the declared `--hard-stop` | HALT cleanly; commit state; close out | None |

### CLAUDE.md / AGENTS.md hands-off appendix (paste when starting a run)

```markdown
## Hands-Off Mode Appendix
When the runner indicates `mode: handsoff`, the hard gates below are absolute blocks, not suggestions.
1. TDD iron law — no production code without a failing test first; if you wrote code first, delete it and restart from the test.
2. Design-approval — before a new module / API surface / data-model change, write a design doc and HALT; proceed only on `approved: true`.
3. Protected paths — never edit supabase/migrations, supabase/config.toml, src/integrations/supabase/ (client + generated types), auth-flow code, billing/Stripe code, .env*. HALT. (supabase/functions/ is ask-first unless the queue prompt pre-authorizes the specific change.)
4. Destructive ops — never git reset --hard / push --force / rebase shared branches / DROP TABLE / delete >10 files. HALT + ‼️.
5. Self-merge — never merge own PRs or push to main/master/staging. HALT for Matthew.
6. Evidence chain — before DONE, produce command → output → file:line → DoD checkbox. No chain = not done.
7. Karpathy scope — changes outside the task's declared scope are treated as protected-path violations.
```

The appendix lists 7 of the 9 gates on purpose: it is pasted for the **dev agent**, and Gates 8 (cost cap) and 9 (hard-stop time) are enforced by the **runner** (it owns the token budget and the wall-clock), not by the dev agent doing the work. The full 9 still apply to the run — the dev-agent appendix only carries the 7 the dev agent can self-enforce.

---

## Autonomous Verification

The runner invokes BMAD specialists **without operator prompting**, based on what the agent claims. Angles (§A–§L) and the §H ladder are defined in `verification-techniques.md`. Hands-off default rigor = **load-bearing minimum (≥2 angles)**; never less.

| Trigger in agent output | Specialist | Angles | Verdict gate |
|-------------------------|------------|--------|--------------|
| "tests pass" / "all green" | QA | Test re-run §A·F + mutation sanity §C | UNVERIFIED or SHALLOWLY-VERIFIED → HALT |
| Cites a file:line / ADR / API spec | Architect | file:line spot-check §D (3–5 refs) + multi-angle RCA §D | Any citation HALLUCINATED → HALT |
| "this is the root cause" | Architect | 6-path RCA with disconfirming evidence §D | SYMPTOM-ADDRESSED → HALT |
| "no regressions" / "no other code affected" | QA + DevOps | Sibling-suite meta-test §C + git diff scan | Pre-existing tests broken / unexpected files → HALT |
| Printed a PASS/FAIL ledger | QA | PASS-ledger cross-check §D | ≥1 false-PASS → HALT |
| Committed or pushed code | DevOps | Git log/reflog §A·C + destructive-op classifier §G | Destructive op or self-merge → ‼️ HALT |
| "design is ready" | Architect (blind replay §B/H) | Subagent sees only the design doc + task spec | Major gaps flagged → HALT |
| Reports a deviation from spec | PM | Restate constraints + honest-deviation density §F | Low density (no user-observable consequences cited) → HALT |

**Irreversible-claim turns** (any turn producing a PR ready for merge, any `TASK-DONE` state write, any turn the runner is about to declare complete) get **more rigor than the ≥2-angle default — but not a fixed 13-agent fleet.** Default escalation: run **`bmad-code-review`** (its 3 orthogonal reviewers — Blind Hunter / Edge-Case / Acceptance Auditor) plus a §B blind-replay; if ≥1 contradicts → HALT. This is the boring, proven tool for verifying one PR.

A broader per-behavioral-code fan-out (one verifier subagent per code, ~$3–7/turn on Opus) is **opt-in, not the default** — reach for it only once calibration data from real runs shows the 3-reviewer escalation missed something a wider net would catch. Don't pay for 13 angles of rigor before the basic gates are demonstrated to hold. (The 13-code taxonomy in `verification-techniques.md` is a model-*evaluation* rubric; it is a menu to draw from, not a required PR gate.)

---

## State recording (MANDATORY)

`.agent-build/` MUST exist before hands-off work begins. Structure:

```
.agent-build/
├── sessions/<timestamp>/         # phase1/phase2-scan/spawns/handoff (from /build)
├── objectives/<objective>/<task>/
│   ├── context.md   # what you knew when you started (includes subagent_id)
│   ├── state.md     # append-only event log
│   ├── designs/     # design docs awaiting operator approval (Gate 2)
│   ├── verifications/  # specialist verdicts + evidence chains
│   ├── halts/       # any HALTs that fired (append-only)
│   └── output.md    # what got produced
├── routing.md       # HALT routing index (append-only)
├── RESUME.md        # where the runner is, how to pick up
└── README.md
```

`state.md` entry (append-only; flush after every event — never buffer):

```markdown
## <ISO timestamp> · PLAN_<n>_<m> · <event-type>
<event-type ∈ START | SUB-STEP | GATE-CHECK | SPECIALIST-VERDICT | TASK-DONE | HALT | RESUME>
Detail: <2–5 lines>
Artifacts: <file:line refs, command output paths, PR links>
Verdict: <PASS | FAIL | HALT | N/A>
---
```

`.agent-build/` is gitignored — runtime state, not committed work.

---

## HALT handling

When a gate fires: (1) write the HALT file per `halt-template.md` to `.agent-build/objectives/<obj>/<task>/halts/HALT-<id>.md`; (2) append to `.agent-build/routing.md` (ID, task, mode, timestamp, status=open, path); (3) send the Slack DM; (4) **stop** — no auto-resume, no workarounds, no next task.

```
🛑 Runner halted (hands-off): <task name>
HALT ID: HALT-<id>
Reason: <gate name + one-line category>
Last action: <agent's last claim or tool call>
Evidence: <one quote / file:line / command output>
Last green state: <git tag or commit SHA>
Need: approve | redirect | escalate | kill
Resume command: <exact command to resume from last green>
HALT file: .agent-build/objectives/<obj>/<task>/halts/HALT-<id>.md
Session: <subagent_id>
```

For ‼️ destructive-op HALTs, prepend `Reflog (last 5):` with the un-reverted reflog lines and CC both Andrew and Brian. Routing (cause → recipient): gate failure → Matthew 🛑 (destructive → +Andrew +Brian ‼️); protected-path attempt → Matthew + Andrew; ADR-016/`notifier.py` → Matthew + Brian; PostHog/App-Review/scope → Matthew + Andrew. Budget: ≤2 DMs/day — if a gate fires repeatedly on one task, re-atomize it, don't send more DMs.

**Fire-and-halt, not fire-and-poll:** the runner sends the DM and HALTS. It does not poll Slack, does not auto-resume on a reaction. The HALT ID + `routing.md` + `resume_payload` exist so a future Slack-reply mechanism can look up and dispatch — we build the addressability now, not the reply mechanism. **Be honest about what this means for v1:** there is no reply→resume loop yet (TLP-3). The Slack DM is a *notification*, not a control — replying to it does nothing. Resuming a halted run means **returning to a terminal and re-authorizing**. So hands-off v1 is "walk away and come back to the terminal," not "answer from your phone and it picks back up." Plan your away-time accordingly.

---

## Return-from-Walk — 8-step audit

When you return, do these **in order**. Do NOT look at the code first — `state.md` is the source of truth; code is downstream.

1. **Check Slack for HALTs** — read any 🛑/‼️ in order received; don't act yet.
2. **Read `.agent-build/RESUME.md`** — the runner's "where I stopped" map.
3. **Read `state.md` bottom-up** — last ~20 entries; reconstruct the timeline.
4. **Read `halts/*`** — one file per HALT (DM + local block + resume command).
5. **Read `verifications/*`** — scan for any FAIL or contradict.
6. **THEN look at the code** — `git diff`, `gh pr list`, `git log`. By now you know what should be there.
7. **Decide per HALT** — approve+resume / redirect (amend a PLAN) / kill / escalate.
8. **Update the Decision Log** (workbook A): every HALT decision + every task that completed without HALT.

**Red flags — stop the audit, escalate:** `state.md` missing/empty (runner crashed — consider the run failed) · HALT count > task count (HALT loop — kill + re-atomize) · any ‼️ HALT (destructive op — audit `git reflog` first) · unexpected protected-path change (gate failed — stop, audit how) · unexpected commits (possible self-merge gate failure — investigate first).

---

## What hands-off mode does NOT do
Auto-resume after a HALT · decide ambiguous calls without operator input · continue past `--hard-stop` · skip any gate · send a follow-up Slack reminder if the first wasn't answered · edit `halts/` files after writing them (append-only).

## What hands-off mode IS for
Overnight queues of bounded, atomic Safe-Catalog tasks · walk-away batch work where the operator returns to read `state.md` · the subagents Phase 2 of `/build` spawns · any session where the operator is unreachable for >30 min.
