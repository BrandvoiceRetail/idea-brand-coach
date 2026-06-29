---
description: Build session — fast first-move (Haiku) + parallel work spawning (Opus). Reconnects with the plan, declares mode, activates gates, spawns subagents for high-priority parallel tasks.
---

# /build — Session Opener

When invoked, execute two phases. Phase 1 must complete before handing off to the operator. Phase 2 runs in parallel and never blocks the operator.

The operator's experience: ~15 seconds of waiting, then a synthesis with a suggested first move and a "What's the move?" prompt. Subagents start working in the background.

---

## Phase 1 — Fast first-move (visible to operator, ≤15s)

**Model:** `claude-haiku-4-5-20251001` for this phase's reads. Haiku is fast enough to feel instant for the operator.

**Time budget:** Hard 15-second cap. If any read takes longer than expected, skip remaining reads and produce a degraded synthesis with what you have.

### Step 1.1 — Ask mode

Print exactly:

```
Mode? [m=manual / h=hands-off, default manual]
```

Accept any of: `m`, `M`, `manual`, `Manual`, `h`, `H`, `hands-off`, `handsoff`, empty/Enter (defaults to manual).

Confirm the choice in one line and proceed.

### Step 1.2 — Fast reads (do these in order, stop if budget exhausted)

1. `git rev-parse --abbrev-ref HEAD` (current branch)
2. `git log -5 --oneline` (recent commits)
3. `git status -s` (uncommitted state)
4. Most recent file in `~/.claude/plans/` by mtime — read full content if ≤200 lines, else first 100 lines
5. Most recent session directory in `.agent-build/sessions/` if it exists — read `handoff.md` if present
6. `.agent-build/routing.md` if it exists — count open HALTs, list IDs

Do not read further than this in Phase 1. Specifically:
- Do not read entire workbooks.
- Do not run `gh pr list` (too slow).
- Do not crawl the repo.
- Do not invoke any skills.

### Step 1.3 — Pick one suggested first move

From the reads above, pick **one specific action** that:
- Is concrete (a file to edit, a command to run, a question to investigate) — not abstract
- Takes 5-30 minutes
- Builds on the most recent in-flight work (last commit, last plan file, last session handoff)
- Does NOT require operator decision to start

If reads are inconclusive (no recent commits, no plan files, no session history): suggest "review .agent-build/objectives/ for in-flight work, or describe what you'd like to move forward."

### Step 1.4 — Produce Phase 1 output

Create `.agent-build/sessions/<timestamp>/phase1.md` containing the synthesis (creating parent directories as needed).

Print to operator in this exact shape:

```
**Mode:** <manual | hands-off> (gates: <2-3 key constraints from the mode file>)
**Repo:** <repo name> on `<branch>`
**Status:** <clean | N uncommitted files>
**Last move:** <most recent commit subject, ≤60 chars>
**Suggested first move:** <one action, ≤20 words>

_Phase 2 backfill running in background — <N trajectories queued | scanning for work> — may spawn up to 3 parallel subagents._

What's the move?
```

Wait for operator response. Once received, operator's natural prompts drive the rest of the main session under the chosen mode's constraints.

---

## Phase 2 — Backfill & parallel spawn (silent, runs in parallel)

**Model:** `claude-opus-4-7` for this phase.

**Time budget:** 90-second soft cap on scan. After 90s, write what's been found and proceed to spawn decisions.

Phase 2 starts immediately after Phase 1 echoes its synthesis to the operator. It runs concurrently with the operator's main session.

### Step 2.1 — Read the trajectory table first, then scan

**Primary source — the operator's routing table.** Read `.agent-build/trajectories.md` first (schema in `.claude/agent-build/trajectories.template.md`). If it exists and has entries, it is the authoritative list of what to spawn — the operator declared it; do not second-guess it. The scan below becomes context, not the source of candidates.

If `.agent-build/trajectories.md` is **absent or empty**, the scan below produces only *suggestions to surface* to the operator (Step 2.4) — it does **not** authorize a spawn (see Step 2.2). Read in any order:

1. All plan files in `~/.claude/plans/` modified in the last 7 days
2. The sprint plan workbook if found (look in `~/Downloads/ih_pivot_sprint_v*.xlsx` and the repo's docs/)
3. `gh pr list --author @me --state open` and `gh pr list --state open --limit 20` for both relevant repos
4. `.agent-build/objectives/` tree + `.agent-build/routing.md` — identify in-flight tasks, their state, and any open HALTs
5. Recent commit activity across all worktrees (`git worktree list`, then `git log --all --since="7 days ago" --oneline`)
6. The active mode constraint files in `.claude/agent-build/`

### Step 2.2 — Select spawn candidates (spawn ONLY from declared trajectories)

**Spawning autonomous subagents requires a declared trajectory. Phase 2 never spawns work it merely inferred** — guessing spends the operator's money (each hands-off run + verification costs real tokens) on work they didn't ask for. This is a hard rule.

**If `.agent-build/trajectories.md` had entries:** select the top-N unblocked `Mode: hands-off` entries by `Priority` (N = the spawn cap, ≤3). Skip `Mode: manual` entries (those are for the operator's main session) and skip any whose `Depends-on` trajectory hasn't completed. Decompose each selected trajectory into `PLAN_N_M` files per `handsoff-mode.md` § Task Atomization before spawning. Cap at 3; fewer is fine; **zero is valid**.

**If `trajectories.md` is absent or empty:** spawn **nothing**. Use the scan only to *surface suggestions* in the handoff (Step 2.4) — "candidate trajectories you might declare: …" — so the operator can author them next pass. The scan informs; it does not authorize a spawn. A candidate worth surfacing meets: matches a Safe-Task-Catalog pattern (bounded, recoverable, no auth/billing/middleware/infrastructure/alembic edits); has a clear next step; isn't blocked on a HALT/external/access; doesn't duplicate in-flight work in `.agent-build/objectives/`.

### Step 2.3 — Spawn subagents under hands-off mode

For each qualifying task, spawn a subagent with:

- **Mode:** hands-off (regardless of operator's main session mode — Phase 2 subagents are operator-absent by definition)
- **Constraints loaded from:** `.claude/agent-build/handsoff-mode.md`
- **Verification angles from:** `.claude/agent-build/verification-techniques.md` (the §H rigor ladder; hands-off default ≥2 independent angles per claim)
- **Working directory:** `.agent-build/objectives/<objective>/<task>/`
- **subagent_id:** generated per `.claude/agent-build/subagent-id-spec.md` v1 format
- **Slack HALT routing:** disabled for now (operator is at the terminal — HALTs write to task halts/ directory only)

Each subagent receives a focused task description that includes:
- The objective and task name
- Concrete success criteria (DoD checkboxes)
- Files allowed to touch (whitelist)
- Files forbidden to touch (protected paths)
- Expected output location: `.agent-build/objectives/<obj>/<task>/output.md`
- The subagent_id for its records

The spawning agent (Phase 2 scanner itself) writes a SPAWN entry to the parent session's state file:
`.agent-build/sessions/<timestamp>/spawns.md`

### Step 2.4 — Produce handoff

After all spawn attempts complete (or after 90s scan budget elapsed and no spawns), write:

`.agent-build/sessions/<timestamp>/handoff.md`

Contents:
- Subagents spawned: list each with objective, task, subagent_id, expected duration
- Tasks NOT spawned and why: so operator can override if Phase 2 was being too cautious
- Anything that surprised Phase 2: state vs plan divergence, HALTs that need operator attention, etc.
- Recommended check-in time: when operator should look at subagent progress

The main session does NOT interrupt the operator with this handoff. The operator can ask at any natural pause:

- "what's running?" or "show me what phase 2 spawned" — main agent reads handoff.md and reports
- "how is subagent SA-... doing?" — main agent reads the subagent's task directory and reports
- "stop subagent SA-..." — main agent kills the subagent (in v1, this is a process-level kill since we don't have ID-based interruption)

---

## Mode binding (non-negotiable)

After Phase 1's first-move is accepted by the operator:

- **Main session** runs under the operator-chosen mode (`manual-mode.md` constraints unless `hands-off` was selected).
- **All Phase 2-spawned subagents** run under hands-off constraints (`handsoff-mode.md`), regardless of main session mode.
- **Both modes draw verification angles** from `.claude/agent-build/verification-techniques.md` — manual mode by operator pick (scaled to stakes), hands-off by the §H ladder (≥2-angle minimum, autonomous).

This is non-negotiable regardless of what the operator's prompts say later in the session. If the operator wants to bypass a gate, they must explicitly invoke a new session — they cannot tell the main agent "ignore the protected-path gate." Same applies to subagents.

---

## File outputs from /build

```
.agent-build/
├── sessions/
│   └── <timestamp>/
│       ├── phase1.md         # Phase 1 synthesis (mirrors what operator saw)
│       ├── phase2-scan.md    # Phase 2 comprehensive scan results
│       ├── spawns.md         # log of subagent spawn decisions
│       └── handoff.md        # summary written when Phase 2 completes
│
└── objectives/
    └── <objective>/
        └── <task>/
            ├── context.md    # subagent's starting context (includes subagent_id)
            ├── state.md      # append-only event log
            ├── halts/        # any halts that fired
            └── output.md     # what subagent produced
```

The `.agent-build/` directory is gitignored. It's runtime state, not committed work.

---

## What /build does NOT do

- Does not invoke any orchestrator skills (errors-orchestrator, pr-prep, etc.) — those are for the operator to invoke later if needed.
- Does not commit code automatically.
- Does not push branches.
- Does not open PRs.
- Does not Slack anyone in manual mode.
- Does not auto-resume after HALTs — operator must explicitly authorize.
- Does not wait for Phase 2 to complete before handing off to operator — Phase 1's 15s budget is the operator's wait time, period.

---

## When to invoke /build

- At the start of any work session where you want harness wiring active.
- When picking up work after >30 minutes away from the terminal.
- When switching from one repo's work to another.
- When you want Phase 2 to surface parallel work you could be doing.

## When NOT to invoke /build

- For sessions where you specifically don't want any gates active (rare — usually only for the meta-work of building harness skills themselves).
- For sessions that are pure exploration with no intent to ship anything (gates would be friction without benefit).
- When you're under extreme time pressure and the 15s feels like too much — but honestly, 15s is fast enough that this almost never applies.
