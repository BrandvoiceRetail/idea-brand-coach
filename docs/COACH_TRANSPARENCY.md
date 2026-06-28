# Coach Transparency — "show what the coach is doing"

**Status:** Spec (build target for the mcp-analytics + v4-surface worktrees)
**Scope:** Two coordinated pieces — (1) **server-side narration** so the MCP coach announces
each tool it runs and *why*, and (2) the **in-app build-theatre** Loop-1 reflection timeline that
shows each agentic step + a real finding, never fabricated.
**Guardrail floor:** no Tier-C internal leaks; no fabrication; mobile-first.

---

## 1. Why this exists

The coach already *runs* tools (Trust Gap, avatar build, evidence ingest, diagnostics) but the
process is opaque to the user. Two known failure modes:

- **MCP surface (`claude.ai` connector):** the host-Claude owns voice/thinking, so it either
  silently calls a tool then dumps a result, or narrates in its own generic register. There is no
  instruction telling it to *pre-announce* the tool and the reason, and no conformance check that
  it does. (See `[[project_coach_surface_parity_adr]]` — persona + hard rules live only in the
  in-app prompt; the connector has generic `SERVER_INSTRUCTIONS`.)
- **In-app surface (/v4 Loop 1):** the "read-it-back" onboarding run is the product's build-theatre
  moment, but there is no component that renders the live step list with a real per-step finding.

This spec makes the *process* a first-class, visible artifact on both surfaces.

---

## 2. Where the coach prompt / instructions live (MCP worktree)

Verified locations in `/.claude/worktrees/mcp-analytics/src`:

| Concern | File | Symbol |
|---|---|---|
| **Server instructions (the ONE prompt the connector gets)** | `src/mcp/config.ts` | `SERVER_INSTRUCTIONS` (lines 17–42), guarded by `assertServerInstructions` (49–54) |
| Where instructions are advertised | `src/mcp/server.ts` | server build passes `SERVER_INSTRUCTIONS` into the `McpServer` |
| Tier-C leak guard (runtime + scan) | `src/mcp/terminologyGuard.ts` | `findTierViolations`, `scanResultForViolations`, `registerTerminologyGuard(server)` |
| Tier-C leak conformance tests | `src/mcp/__tests__/terminologyGuard.test.ts` | — |
| Two-surface / parity replay | `src/test/integration/mcp-conversation-replay.test.ts` | the existing two-surface harness to extend |
| Server tool-set assertion (e2e over InMemoryTransport) | `src/mcp/__tests__/server.test.ts` | — |

> There is **no** separate `prompt.ts` or "coach charter" file in this worktree. The connector's
> entire steer is `SERVER_INSTRUCTIONS` in `config.ts`. The richer in-app persona (Trevor voice,
> one-question/<100-word rules) lives in the consultant edge function, **out of this worktree's
> scope** — see the parity ADR. This spec only edits the MCP `SERVER_INSTRUCTIONS` and adds a
> conformance check; it does **not** restate the in-app persona here.

---

## 3. Server-side narration — exact edits

### 3.1 Add a `NARRATION` block to `SERVER_INSTRUCTIONS`

In `src/mcp/config.ts`, insert a new block into the `SERVER_INSTRUCTIONS` array **immediately
after the `POSTURE` lines and before the `Brand-Coach MCP gateway.` sentence** (i.e. after current
line 24, the `lacks inputs, ASK…` line). Keep the existing `.join(' ')` — these are appended as
array elements:

```ts
  // NARRATION — make the coach's process visible. Announce BEFORE every tool, explain AFTER.
  'NARRATION: Before you run any tool, tell the user in one short plain-English line WHAT you are',
  'about to do and WHY — e.g. "Let me pull your Trust Gap now to see where buyers hesitate…" or',
  '"Reading your reviews back to you so we work from your customers\' own words…". Use the tool\'s',
  'everyday name (Trust Gap, avatar build, review read-back, funnel audit), never the internal tool',
  'id or argument names. After the tool returns, state the ONE concrete thing it found in a sentence',
  'before moving on — grounded only in what the tool actually returned. If a tool returns no data or',
  'errors, SAY so plainly and ask for what is missing; never narrate a finding you did not get.',
  'Keep narration to process + real findings only: never expose internal stage labels, buyer-state',
  'names, scoring internals, neuroanatomical framing, raw tool ids, or argument schemas.',
```

**Rationale / constraints encoded:**
- *Announce-before / explain-after* is the core behaviour change.
- *Everyday names, never tool ids/args* keeps the narration user-facing and re-uses the Tier-A
  vocabulary the rest of the product already speaks.
- The final line is a **Tier-C restatement** so the narration instruction can't be read as license
  to surface internals — it stays inside the existing 3-tier policy.
- *No fabricated findings* mirrors the existing POSTURE no-fabrication rule, applied to narration.

### 3.2 Per-tool "why" registry (optional but recommended, deterministic)

To make narration consistent and testable (Layer-3 determinism rather than relying on the model to
improvise the "why" each turn), add a tiny lookup the tools' descriptions can draw on. Two options;
pick **A** for this run (smaller surface, no tool-registration churn):

- **Option A (descriptions only):** ensure each user-facing tool's `description` (in
  `src/mcp/tools/*.ts`) opens with an everyday-name + purpose clause the model can echo, e.g.
  `run_trust_gap`: *"Trust Gap — score where buyers hesitate on this brand…"*. No new code; just a
  description audit. The narration instruction then has consistent material to quote.
- **Option B (explicit map):** add `src/mcp/narration.ts` exporting
  `export const TOOL_NARRATION: Record<string, { everydayName: string; why: string }>` keyed by
  tool id, plus a `narrationFor(toolId)` helper. Wire nothing into runtime; it exists so the
  two-surface eval can assert the announced name matches the registry. Defer to a later run unless
  the eval (3.3) needs the assertion target.

### 3.3 Conformance check — extend the two-surface harness

Extend `src/test/integration/mcp-conversation-replay.test.ts` (the existing two-surface harness)
with a **narration conformance** case rather than creating a parallel test:

1. Drive a scripted multi-tool turn (e.g. ingest reviews → run Trust Gap) through the in-memory
   MCP client used by `server.test.ts`.
2. Assert, on the assistant-visible text for each tool call:
   - a **pre-announcement** exists before the tool result (a sentence containing the tool's everyday
     name from the registry/description and a "why" cue), and
   - a **post-finding** exists after it (a sentence referencing a value actually present in the tool
     result payload — guards against fabricated findings).
3. Run **every** announced/finding string through `findTierViolations` (from `terminologyGuard.ts`)
   and assert **zero** Tier-B/C violations — this reuses the existing guard so narration can't
   become a leak vector.

Keep the assertion **shape-based, not exact-string** (presence of everyday name + presence of a
result-derived token) so it doesn't ossify the coach's wording. The Tier-C zero-leak assertion is
the hard gate.

---

## 4. In-app build-theatre — Loop-1 reflection timeline

### 4.1 Reuse the existing v2.2 agentic-run-timeline component

The v2.2 agentic-run timeline already exists in the **v4-surface** worktree as the forensic-build
stepper. **Reuse it; do not build a new timeline primitive.**

| Asset | Path (v4-surface) | Role |
|---|---|---|
| Stepper/dialog UI (the timeline) | `src/components/v2/forensic/ForensicAvatarBuilder.tsx` | per-stage rows with status icon + label + read-only artifact review |
| Run orchestration hook | `src/hooks/useForensicAvatarBuild.ts` | sequential→parallel stage run, per-stage `StageStatus`, `needsInput`, `runError`, persisted `artifacts` |
| Step status union (reuse verbatim) | `src/hooks/useForensicAvatarBuild.ts` | `export type StageStatus = 'pending' \| 'running' \| 'done' \| 'failed' \| 'needs_input'` |
| Status→icon map (reuse pattern) | `ForensicAvatarBuilder.tsx` lines 41–47 | `STATUS_ICON: Record<StageStatus, JSX.Element>` (Circle / spinner / CheckCircle2 / XCircle / AlertCircle) |
| Read-only artifact card | `src/components/v2/forensic/ForensicArtifactReview.tsx` | renders a stage's real, grounded output |
| Domain types | `src/types/forensicBuild.ts` | `StageRunResult` discriminated union — **`ok` carries `content`; `failed` carries `error`; `needs_input` carries demands** (the no-fabrication shape) |

The forensic builder already embodies the two hard requirements: a **live per-step timeline**
(`forensic-stage-progress`, lines 99–106) and **grounded-only output** (artifacts come from the
edge fn `StageRunResult`, never invented; `needs_input`/`failed` are surfaced rather than papered
over). The Loop-1 reflection run is the same pattern with a generalized step set.

### 4.2 New component contract — `OnboardingReflectionRun`

Build `src/components/v4/onboarding/OnboardingReflectionRun.tsx` (v4 worktree) as a **thin
reskin/generalization** of `ForensicAvatarBuilder`, reusing `StageStatus`, the `STATUS_ICON`
pattern, and the timeline layout, retokenized to the v23 palette (§Design System).

```ts
/** One step the coach runs during the read-it-back reflection. */
export interface ReflectionStep {
  /** Stable id for keys + telemetry (e.g. 'parse_megaprompt', 'run_trust_gap'). */
  id: string;
  /** User-facing everyday label — Tier-A only ("Reading your reviews", "Trust Gap"). */
  label: string;
  /** Everyday tool name announced ("Trust Gap", "review read-back"); never the raw tool id. */
  tool: string;
  /** Why this step runs — the one-line "why" shown under the label. */
  rationale: string;
  /** Live status — REUSED verbatim from useForensicAvatarBuild. */
  status: StageStatus; // 'pending' | 'running' | 'done' | 'failed' | 'needs_input'
  /**
   * The ONE real finding this step produced, grounded in the tool result.
   * MUST be null until the step returns; MUST stay null on 'failed'/'needs_input'.
   * Never a placeholder, never fabricated. (Mirrors StageRunResult: finding only on 'ok'.)
   */
  finding: string | null;
}

export interface OnboardingReflectionRunProps {
  steps: ReflectionStep[];
  /** True while the chain is in flight (drives the running spinner + disables confirm). */
  isRunning: boolean;
  /** Surfaced when a step returned needs_input (reuse NeedsInputItem shape). */
  needsInput?: NeedsInputItem[] | null;
  /** Surfaced when a step failed. */
  runError?: string | null;
  /** Confirm/edit gate — only enabled once the run resolves (all done or stopped). */
  onConfirm: () => void;   // "Sounds right ✓"
  onEdit: () => void;      // "Not quite ✏️"
}
```

**State machine (per step, reuse `StageStatus`):**
`pending` → `running` → (`done` with non-null `finding`) | (`failed`, finding stays null) |
(`needs_input`, finding stays null). The confirm/edit gate is disabled while `isRunning`; enabled
once every step is terminal.

**No-fabrication invariants (enforce in tests):**
- A step with `status !== 'done'` MUST render `finding === null` (no "Analyzing…" fake findings).
- `finding` text is only ever set from the tool/edge-fn result payload (the hook fills it; the
  component never synthesizes it).
- If a step fails or needs input, render the `runError` / `needsInput` surface (reuse the amber
  `needs_input` and destructive `runError` blocks from `ForensicAvatarBuilder` lines 108–120) —
  do **not** advance to a finding.

**Reuse, don't duplicate:**
- Status icons: lift `STATUS_ICON` (or import it if exported) — same five-state map.
- Timeline rows: same `flex items-center gap-2` row pattern; add the `rationale` + `finding` lines
  beneath each row.
- Run orchestration: model a `useOnboardingReflectionRun` hook on `useForensicAvatarBuild`
  (sequential step loop, per-step `setStatus`, terminal-reason surfacing). The reflection steps map
  to MCP/edge calls (parse megaprompt → ingest evidence → run Trust Gap → identify decision
  trigger, etc.), each returning a `StageRunResult`-shaped `{ status, content|error|needs_input }`.

### 4.3 Tier-C guard on the in-app surface

The frontend must not render Tier-C internals in step labels, rationales, or findings. Mirror the
MCP guard: import/port the `findTierViolations` patterns into a frontend unit test that scans the
strings each `ReflectionStep` carries (label/tool/rationale/finding) and asserts zero violations.
This keeps the terminology-leak test green on **both** surfaces.

---

## 5. Acceptance / done-when

- `src/mcp/config.ts` `SERVER_INSTRUCTIONS` carries the NARRATION block; `assertServerInstructions`
  still passes; `npm run typecheck:mcp` clean.
- Two-surface replay test asserts pre-announce + post-finding + **zero** Tier-C violations on
  narrated output.
- `OnboardingReflectionRun` renders the live timeline with real findings; unit tests prove the
  no-fabrication invariants (non-`done` step → `finding === null`) and zero Tier-C leaks.
- 0 horizontal overflow at 375px; the run + confirm gate reachable in ≤2 scrolls.
- No new deps; reuses shadcn-ui primitives + the existing forensic timeline.

---

## 6. Risks / open decisions

- **Model compliance vs. enforcement:** `SERVER_INSTRUCTIONS` *steers* the host-Claude on the
  connector but cannot *force* narration (host owns voice — per the parity ADR). The two-surface
  conformance test catches regressions but can't guarantee live behaviour. If narration proves
  flaky on the connector, escalate to the Coach-Charter-as-shared-asset mechanism in the parity ADR.
- **Where the "why" lives:** §3.2 Option A (descriptions only) avoids tool-registration churn but
  makes the conformance assertion fuzzier; Option B gives a hard assertion target at the cost of a
  new module. Chosen: A for this run; revisit if the eval needs an exact match.
- **Reflection steps must be real calls, not theatre:** the build-theatre is only honest if each
  step is an actual MCP/edge call returning a grounded `StageRunResult`. A stubbed/animated-only
  timeline would violate the no-fabrication guarantee — explicitly out of bounds.
- **Cross-worktree split:** the narration edits land in **mcp-analytics**; the timeline component
  lands in **v4-surface**. They share only the `StageStatus`/no-fabrication *contract*, not code —
  keep the contract in sync (this doc is the shared reference).
- **`StageStatus` import boundary:** if `OnboardingReflectionRun` reuses `StageStatus`/`STATUS_ICON`
  from the forensic hook/component, export them (the type is already exported; `STATUS_ICON` is
  module-local today and would need exporting or lifting to a shared `ui` helper).
</content>
</invoke>
