# HALT File Format

Every HALT — manual or hands-off — uses this format. Identical across modes; only the `notification_sent` field differs (`inline` vs `slack`).

The format is designed for:
1. **Human readability** — operator can read the body and understand what happened.
2. **Machine parseability** — frontmatter is YAML, parseable by future tooling.
3. **Resumability** — `resume_payload` section gives a fresh agent enough state to pick up cold, possibly hours later.
4. **Future Slack-reply routing** — `halt_id` is the stable identifier a reply mechanism would look up.

---

## Path convention

```
.agent-build/objectives/<objective>/<task>/halts/HALT-<id>.md
```

The HALT file is **append-only** once written. Resolution information goes in a separate section appended at resolution time, not by editing the original.

---

## HALT ID convention

```
HALT-<track>-<task-slug>-<YYYYMMDD>-<HHMM>-<short-hash>
```

Examples:
- `HALT-T3-route-20260525-1042-a3f7`
- `HALT-T1-deploy-20260524-2317-b912`
- `HALT-T4-storage-20260525-0830-c4e1`

- `<track>`: One of T1, T2, T3, T4, T5 if applicable; otherwise a short descriptor like `infra`, `meta`, `audit`.
- `<task-slug>`: 2-3 word slug of the task. Lowercase, hyphen-separated.
- `<YYYYMMDD>-<HHMM>`: Local timestamp at HALT creation.
- `<short-hash>`: 4-character random hex. Distinguishes simultaneous HALTs on the same task.

Stability requirement: once issued, a HALT ID never changes. Even after resolution, the ID stays in `routing.md` as historical record.

---

## File template

```markdown
---
halt_id: HALT-<track>-<task-slug>-<YYYYMMDD>-<HHMM>-<short-hash>
timestamp: <ISO-8601 UTC>
mode: manual | hands-off
objective: <objective slug, matches .agent-build/objectives/<objective>/>
task: <human-readable task name>
subagent_id: <synthetic ID — see subagent-id-spec.md>
gate: <name of gate that fired — or "ambiguity" if not gate-driven>
severity: normal | elevated
status: open | resolved | superseded
notification_sent: none | inline | slack
slack_message_ts: <Slack message timestamp if sent — empty otherwise>
---

## Why I halted

<One paragraph. What triggered the halt. Be specific about the gate or condition.>

## Evidence

<Concrete evidence the gate fired correctly. File:line citations, command output, quoted text from the spec.>

## What I need

<The specific decision or input required to resume. State it as a question if possible.>

## Resume payload

**Branch:** `<git branch name>`
**HEAD:** `<commit SHA at halt>`
**Working tree:** `<clean | N dirty files>`
**Dirty files:**
- `<file path 1>`
- `<file path 2>`

**Last command run:** `<command verbatim>`
**Last command output (last 10 lines):**
```
<output snippet>
```

**Current goal:** <one sentence — what I was trying to achieve>
**Blocked on:** <one sentence — what specifically I cannot do without operator input>

**Suggested resume command (if operator approves as-is):**
```
<exact command or next prompt to send>
```

**Suggested resume command (if operator wants to redirect):**
```
<alternative starting point>
```

## Context for resuming agent

<Any context a fresh agent picking this up cold would need. Architecture decisions made in this session. Files modified before the HALT. Constraints from the operator that aren't in CLAUDE.md/AGENTS.md.>

---

## Resolution

<This section is APPENDED when the HALT is resolved. Do not edit the sections above.>

**Resolved:** <ISO-8601 UTC timestamp>
**Resolved by:** <operator name or "agent on resume" if auto-resumed via Slack reply>
**Decision:** <what was decided>
**Follow-up:** <link to commit, PR, or follow-up HALT if the resolution spawned new work>
**Notes:** <anything worth remembering for future similar HALTs>
```

---

## Routing index (`.agent-build/routing.md`)

Every HALT file is also appended to a global routing index:

```markdown
# HALT Routing Index

This file is the lookup table for HALT IDs to file paths. Append-only.

| HALT ID | Task | Mode | Created | Status | Path |
|---------|------|------|---------|--------|------|
| HALT-T3-route-20260525-1042-a3f7 | T3 channel reroute | manual | 2026-05-25T10:42Z | open | objectives/t3-bug-reporting/t3-channel-reroute/halts/HALT-T3-route-20260525-1042-a3f7.md |
| HALT-T1-deploy-20260524-2317-b912 | T1 staging deploy | hands-off | 2026-05-24T23:17Z | resolved | objectives/t1-tiktok-deploy/t1-deploy-staging/halts/HALT-T1-deploy-20260524-2317-b912.md |
```

Status transitions: `open` → `resolved` (most common) or `open` → `superseded` (when a newer HALT replaces this one, e.g., during re-planning).

When status changes, append a new line — don't edit the existing line. Audit trail.

---

## Append-only discipline

The HALT file represents a moment of decision suspension. Once written:

- The sections above the `## Resolution` marker are **frozen**.
- Resolution is appended below, not woven into the body.
- If the HALT is later determined to have been a mistake (gate fired incorrectly), the entry stays — mark `status: superseded` in `routing.md`, write a new HALT or follow-up note explaining, but never delete or rewrite the original.

This append-only rule means:
- Future Slack-reply mechanism can trust the resume_payload it reads.
- Audit trails reconstruct history accurately.
- Operator decisions are preserved with their full context, not just their outcomes.
