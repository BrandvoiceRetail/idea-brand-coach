# /build Harness — Installation Guide

Bundle v2 — the `/build` harness is now the single source of truth. The `run-handsoff` / `run-manual` skills are **superseded**; their procedural depth (operator loop, per-task loop, hard gates, autonomous-verification table, rigor ladder, return-from-walk) is folded into the mode files below. ~15 minutes to install. Then one calibration run.

## File inventory

| # | File in this bundle | Goes to | Purpose |
|---|---------------------|---------|---------|
| 1 | `build.md` | `~/.claude/commands/build.md` (also committed in `.claude/agent-build/` as source) | The `/build` slash command (user-global) |
| 2 | `manual-mode.md` | `<repo>/.claude/agent-build/manual-mode.md` | Manual mode: Triangle · 5-layer stack · operator loop · decision log · end-of-session (committed) |
| 3 | `handsoff-mode.md` | `<repo>/.claude/agent-build/handsoff-mode.md` | Hands-off mode: pre-flight · atomization · safe-task catalog · per-task loop · 9 hard gates · autonomous-verification table · HALT · return-from-walk (committed) |
| 4 | `verification-techniques.md` | `<repo>/.claude/agent-build/verification-techniques.md` | Rigor ladder + §A–§L angle catalog; both mode files reference it (committed) |
| 5 | `halt-template.md` | `<repo>/.claude/agent-build/halt-template.md` | HALT file format reference (committed) |
| 6 | `subagent-id-spec.md` | `<repo>/.claude/agent-build/subagent-id-spec.md` | Subagent ID interface contract + v2 upgrade plan (committed) |
| 7 | `preflight.py` (+ `test_preflight.py`) | `<repo>/.claude/agent-build/` | Stdlib-only pre-flight auto-checker (~11 of the 25 checks) + its stdlib `unittest` suite. Run tests with `python3 .claude/agent-build/test_preflight.py` (no pytest needed). Committed. |
| 8 | `trajectories.template.md` | `<repo>/.claude/agent-build/trajectories.template.md` | Layer-2 routing-table template; copy to `.agent-build/trajectories.md` (runtime) to declare a session's trajectories for Phase 2 (committed) |
| 9 | `workflows-design.md` | `<repo>/.claude/agent-build/workflows-design.md` | **Design doc, NOT live config** — nothing loads it. Spec for the future `/workflows` deterministic-spine conversion (GA-gated; committed for reference) |
| 10 | `README.md` | `<repo>/.claude/agent-build/README.md` | This install guide (committed alongside the bundle) |

Two further edits are made directly to existing repo files (no standalone file ships for these — see Steps 4–5):
- **`AGENTS.md`** gets a three-line `## Harness Mode` pointer.
- **`.gitignore`** gets a one-line `.agent-build/` entry.

## Installation sequence

### Step 1 — Create `~/.claude/commands/` if it doesn't exist

```
mkdir -p ~/.claude/commands
```

### Step 2 — Drop `/build` slash command

```
cp build.md ~/.claude/commands/build.md
```

This makes `/build` available in every Claude Code session, in any repo. User-global.

### Step 3 — Create `.claude/agent-build/` in inventory_manager

```
cd /path/to/inventory_manager
mkdir -p .claude/agent-build
cp manual-mode.md handsoff-mode.md verification-techniques.md halt-template.md subagent-id-spec.md preflight.py test_preflight.py trajectories.template.md workflows-design.md .claude/agent-build/
```

### Step 4 — Add the AGENTS.md three-line pointer

Open `inventory_manager/AGENTS.md`. Insert this `## Harness Mode` section early in the file (between `## On Startup` and `## Boundaries`, so it lands in the agent's initial context):

```markdown
## Harness Mode

This repo runs under a harness mode declared per session via `/build`.
Default: manual mode (constraints in `.claude/agent-build/manual-mode.md`).
Hands-off mode constraints in `.claude/agent-build/handsoff-mode.md`.
Mode files extend, never override, the Boundaries below.
```

### Step 5 — Add `.agent-build/` to .gitignore

Open `inventory_manager/.gitignore` and add one line (runtime state; the committed `.claude/agent-build/` config dir stays tracked):

```
.agent-build/
```

### Step 6 — Commit the harness wiring

```
cd /path/to/inventory_manager
git checkout -b feature/agent-build-harness-v1
git add .claude/agent-build/ AGENTS.md .gitignore
git commit -m "feat(harness): add /build slash command + agent-build harness v1"
```

(Do NOT merge this commit yet — operator should run a calibration test first.)

### Step 7 — Calibration run

In a fresh Claude Code session in `inventory_manager`:

```
/build
```

Expected experience:
1. Prompt: "Mode? [m=manual / h=hands-off, default manual]"
2. You press Enter (defaults to manual)
3. ~15 seconds of silent reading
4. Synthesis paragraph with mode, repo, branch, status, last move, suggested first move
5. "What's the move?" prompt
6. Background: Phase 2 starts in parallel

Then describe a real task (e.g., the T3 one-row fix, or the T2 untangle) and let the session proceed. Watch what the agent does.

After the calibration run, check `.agent-build/sessions/<timestamp>/` for the four output files (phase1.md, phase2-scan.md, spawns.md, handoff.md).

## What to look for in the calibration run

Four behavioral signals tell you whether the harness wiring actually reaches the agent:

1. **Did the agent enumerate files touched at the end?** (Manual mode communication expectation)
2. **Did the agent mark anything `[UNVERIFIED]` or `[UNKNOWN]`?** (Manual mode communication expectation)
3. **Did the agent ask before touching protected paths?** (Boundary check — but only triggers if your task naturally approaches one)
4. **Did Phase 2 spawn anything sensible?** (Phase 2 effectiveness)

If 1 and 2 are yes — the mode constraints are reaching the agent's behavior. That's the structural win.

If 4 is yes and the subagents did real work — Phase 2's parallel-work model is viable.

If any of these fail — adjust the relevant file. Most likely culprit: the mode constraints aren't being read because the agent is operating off stale AGENTS.md context. Fix by ensuring the AGENTS.md pointer is high enough in the file to be in the agent's initial context.

## Cleanup if it doesn't work

The harness is fully reversible. If you decide to abandon:

```
cd /path/to/inventory_manager
git checkout staging
git branch -D feature/agent-build-harness-v1
rm -rf .claude/agent-build/ .agent-build/
# manually revert AGENTS.md and .gitignore
rm ~/.claude/commands/build.md
```

No lock-in. No persistent state outside the harness directories.

## After successful calibration

If the calibration run shows the harness is working:

1. Merge `feature/agent-build-harness-v1` to `staging` (after operator review, not self-merge). Per the repo's `feature/* → staging → main` workflow, never merge a feature branch directly to `main`.
2. Repeat steps 3–6 for `mcf-amz-tiktok` once PR #11 lands. (Don't add to mcf-amz-tiktok before PR #11 merges — the Karpathy work on that branch sets up CLAUDE.md/AGENTS.md correctly for the harness to extend.)
3. Use `/build` at the start of every coding session going forward. Trust the muscle memory to develop over 5-10 sessions.

## After 5-10 sessions of use

Pull `.agent-build/sessions/*/handoff.md` to review Phase 2 effectiveness:

- How often did Phase 2 spawn subagents?
- Of the spawns, how often did they produce useful output?
- Did Phase 2 ever change the operator's direction in useful ways?

This data tells you whether the Phase 1 → Phase 2 calibration is right. Adjust the Safe Task Catalog or Phase 2's spawn criteria based on what you see.
