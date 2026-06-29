# Manual Mode

**Operator presence:** present at the terminal, reachable for questions, can resolve HALTs inline.

This mode applies to the primary session the operator is driving via `/build`. Subagents spawned by Phase 2 (the parallel backfill) always run under hands-off mode regardless of this file — see `handsoff-mode.md`. Mode is declared via `/build`; there is no auto-trigger.

Manual mode treats **operator presence as the verification engine.** In hands-off mode hard gates are the only backstop because nobody is watching; here, *you* are the backstop, so gates relax and judgment tightens. The runner never advances silently — every turn ends waiting on your explicit DECIDE. The failure mode is not crashing; it's **skimming**: advance without reading the full dev-agent response and you've thrown away the reason to be in manual mode.

Verification angle definitions live in `verification-techniques.md` — referenced here by name (§A–§L, §H ladder), not restated.

---

## The Triangle — Operator · Runner · Dev Agent

The three actors never collapse into one. That separation is how independent judgment survives.

| Actor | Owns | Does NOT do |
|-------|------|-------------|
| **Operator (you)** | Pick mode + methodology · approve amendments · resolve HALTs · close the DoD | Type the prompts the runner pastes · auto-merge PRs · skip pre-flight |
| **Runner (this session)** | Drive turns · paste prompts verbatim · run verification angles · print a per-turn verdict · HALT on gate failure | Invent turns · amend the plan without ≥2 angles agreeing · auto-resume after a HALT · advance silently |
| **Dev Agent (separate session)** | Do the work in the repo · produce auditable output · respect CLAUDE.md + AGENTS.md | Self-merge · edit auth/payments without review · skip Karpathy principles |
| **BMAD specialists (subagents)** | Single-angle verdict on one claim, fresh context | Drive turns · merge · cross-talk in shared context |

The runner conducts and verifies; it does not do the dev work itself.

## The Stack — five layers (always-on → invoked-deliberately)

| Layer | Role | When it fires |
|-------|------|---------------|
| **Karpathy CLAUDE.md / `karpathy-skills` plugin** | Personality | 4 principles (think-before-coding, simplicity-first, surgical-changes, goal-driven) on every dev-agent message. |
| **BMAD specialists** | Verification arm | Operator invokes per turn when a load-bearing claim needs an independent angle (roster below). |
| **Runner** | Workflow engine | Whenever you advance a turn — pastes prompts, runs the amend gate, prints a verdict, **waits** on DECIDE. |
| **`verification-techniques.md`** | Technique catalog | Per claim — operator picks angles scaled to stakes via the §H ladder. |
| **`/build` Phase 2** | Parallel backfill | Spawns hands-off subagents for safe parallel work while you focus on the main thread. |

Hard gates and GSD context-isolation are **available but not foregrounded** in manual mode — you're present, so they matter less. Invoke a specific gate only if it closes a real gap on a specific turn.

---

## Pre-Flight (before you start)

~5 min, three phases. **Environment:** Karpathy guidelines present; repo at a clean, known commit (you need a clean baseline to attribute changes); the task/plan readable. **Context:** DoD readable in one screen; top 2–3 watch items reviewed (that's how you pick angles); the 6 operating constraints loaded (≤2 Slack alerts/day · no self-merge · no auth/payments/security without human review · top-tier model first, optimize cost only >$200/mo · post back if the time-box runs out · output is auditable — files-touched + `[UNVERIFIED]` markers). **Operator readiness:** time-box + hard stop declared; Decision Log open; no competing work.

---

## The Operator Loop — the per-turn rhythm

Steps 1–4 are runner work you watch; **step 5 is yours alone, and the runner waits on it.**

```
1. READ        — runner shows the dev agent's FULL response (not a summary). Read all of it. Skim is the failure mode.
2. PICK ANGLES — runner suggests 1–3 angles from the turn's "Surfaces/verifies" + claim type. Approve or override.
3. PROBE       — runner runs the picked angles; may invoke BMAD specialists or spawn a blind-replay subagent.
4. REPORT      — runner prints the verdict: claims verified · gaps · advance/branch/halt. Ask "does this match what I read in step 1?"
5. DECIDE      — operator-only. Runner waits. Pick: ADVANCE · BRANCH · HALT · AMEND.
```

| Decision | When | Action |
|----------|------|--------|
| **ADVANCE** | Verdict matches your read; angles passed; no surprises. | "advance to turn N+1." |
| **BRANCH** | Verdict found the gap the path's "If gap → branch" row anticipated. | "apply branch from turn N's if-gap row." |
| **HALT** | Destructive op · verifier itself failed · angle disagreement unresolvable · you need someone else. | Halt → § Manual HALT below; decide local vs Slack. |
| **AMEND** | Ground Truth / prompt / plan wrong. **Requires ≥2 independent angles agreeing (§H gate).** | Edit the plan; re-load; log the 2+ angles that agreed. |

**Rhythm calibration:** target read→decide of 5–10 min (cheap), 15–25 (load-bearing), 30–45 (irreversible). Consistently faster than the lower bound → you're skimming, slow down. After every 3 turns, pause 60s: "am I still tracking the DoD?"

## Verification — match rigor to stakes

Scale rigor to stakes **per the §H ladder in `verification-techniques.md`** (cheap → load-bearing → irreversible/one-way-door; the irreversible tier is also the bar to AMEND). The ladder is the single source of truth for the tier→angle mapping — don't restate it here. Always **falsification-first** (run the command that would prove the claim FALSE). The angle picker and the full §A–§L menu live in `verification-techniques.md`.

### BMAD roster — who you invoke when
- **PM** — instruction-following + scope discipline (#1).
- **Architect** — root cause + hallucination (#7, #10, #2): "for every cited file/ADR/API, open and quote the bytes that justify the claim."
- **QA** — verification + laziness + false claims (#3, #4, #5, #6): "name every step in the evidence chain; what's still incomplete?"
- **Code Reviewer** — docs + verbosity + style drift (#9, #11, #12): "every file touched — necessary? created docs nobody asked for? improved adjacent code?"
- **DevOps** — destructive ops + file location (#8, #9): "walk git log + reflog — anything force-pushed/reset/deleted? files outside the project root or in protected dirs?"

---

## Behavioral expectations beyond AGENTS.md

These extend AGENTS.md; they replace nothing in it.

- **Communication:** when the operator's objective is reached, summarize what shipped and **stop** — no speculative continuation, no unprompted adjacent work. Mark `[UNVERIFIED]` for anything not confirmed via tool use, `[UNKNOWN]` for anything undeterminable. End a substantive change set with a files-touched enumeration + one-line justification each.
- **Decisions:** ambiguous choices AGENTS.md doesn't resolve → ask the operator, don't guess. When citing files/ADRs/APIs, quote real bytes — never paraphrase a citation.
- **Gates inherited from AGENTS.md (reminders):** protected paths need operator confirmation before edits; never merge own PRs (tag Andrew/Brian); never push to `main`/`staging`; no destructive ops on shared branches without explicit instruction.

---

## Manual HALT — local first, Slack only when you need someone else

Manual default: **HALT is LOCAL.** You read it, decide, resume. DMing yourself is useless — you're here. Reserve Slack for when you need **someone else.**

- **Local (handle yourself, no Slack):** verifier-broken (your check failed — fix + re-run) · angle-disagreement (synthesis read or a §B independent angle) · plan-amendment-needed (edit, re-load, log) · anti-rubber-stamp tripwire (LGTM in 5s, zero findings — re-run, never accept the stamp).
- **Slack (DM the owner):** Andrew for product/scope/App-Review/PostHog-access/storage-policy; Brian for ADR-016 / `notifier.py` / IH-architecture. **Destructive op detected** → ‼️ to **both**, with the un-reverted reflog excerpt. Budget ≤2 alerts/day.

HALT file format is identical to hands-off (`halt-template.md`); only `notification_sent` differs (`inline` here vs `slack`). Fire-and-halt — even a Slack HALT doesn't poll for a reply; you return and issue the resume command explicitly.

---

## Decision Log — record as you go

Log every **ADVANCE-with-notes, BRANCH, HALT, AMEND** to the workbook's 08 Decision Log (skip raw ADVANCEs — they flood it). Logging-from-memory after the session is unreliable. Columns: `Timestamp · Track · Turn · Decision · Why (1–2 sentences) · Evidence/specialists · Followup`. An AMEND row must cite the ≥2 independent angles that agreed (the §H gate — no amendment on a single claim).

## End of Session — 7 steps (land in a known state)

1. Confirm the last turn's verdict matches your read; if not, log a HALT — don't close on a discrepancy. 2. File Issue Log entries for every DISPROVED/HALLUCINATED/SYMPTOM-ADDRESSED verdict. 3. Update Ground Truth with anything new you learned; stamp the date. 4. Note next-turn intent if you ended mid-path. 5. Commit or stash — never leave the repo dirty. 6. Send the day's Slack update to Andrew (≤2/day): `<shipped> · Blocked on: <…/nothing> · Next: <intent>`. 7. Close the runner deliberately ("session complete") so it writes session-end state — don't just Ctrl+C.

---

## State recording (optional in manual mode)

The operator drives state via their own attention + the Decision Log. If `.agent-build/` already exists, log session-start events to `.agent-build/sessions/<timestamp>/session.md` for traceability. Do not create `.agent-build/` if it doesn't exist — manual mode shouldn't impose state machinery on lightweight sessions.

## What manual mode is for
Driving a specific feature where you want to make calls in real time · exploratory debugging where the path isn't known · pair-programming-like sessions where you read every response · anything touching a one-way door (auth, payments, deploy, prod data, a plan amendment) where you want maximum verification depth with your judgment in the loop.

## What manual mode is NOT for
Overnight queues · walk-away batch work · multi-hour autonomous runs · anything where the operator is unreachable for >30 min — use hands-off mode.
