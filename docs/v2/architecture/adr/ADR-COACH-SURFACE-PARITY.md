# ADR: Coach Surface Parity — the MCP/Claude-connector coach and the in-app coach chat

- **Status:** Accepted (2026-06-25)
- **Date:** 2026-06-25
- **Deciders:** Matthew Kerns (eng)
- **Relates to:** `ADR-UNIFIED-COACH-CAPABILITY-LAYER.md` (Proposed — extends it from *capability* parity to *full-surface* parity), `ADR-CLAUDE-AGENT-SDK-MIGRATION.md`, `ADR-CONVERSATION-MEMORY.md`. Companion runbook: `docs/integrations/MCP_OAUTH.md` (the connector is now an authenticated, first-class surface).

## Context

The IDEA Brand Coach is now reachable through **two surfaces** that users experience as "the same coach":

1. **In-app coach chat** — the `idea-framework-consultant-claude` Deno edge function. It owns a **full system prompt** (`prompt.ts`): an explicit Trevor persona (`<persona>You are Trevor… author of the IDEA framework</persona>`), the framework identity, and **hard behavioural rules** (`<conversation-style>`: *"Ask ONE focused question per response", "Keep responses under 100 words (3–4 sentences max)", "Never provide multiple recommendations at once", "guide discovery through questions, not lectures"*). It runs on a pinned model (Claude Sonnet 4.6) and, since 2026-06-17, drives the MCP capability layer through a real tool loop (`mcpClient.ts` + `registry.ts` + `mcpTools.ts`, gated by `CONSULTANT_TOOL_LOOP_ENABLED` + PostHog `coach-mcp-tool-loop`).

2. **MCP / Claude-connector coach** — the `src/mcp` gateway, now authenticated via OAuth (see `MCP_OAUTH.md`) and used directly from claude.ai / Claude Desktop. Here the **host Claude model is the agent**; the gateway supplies only `SERVER_INSTRUCTIONS` (`src/mcp/config.ts`) + tool/skill descriptions. `SERVER_INSTRUCTIONS` is a **generic posture** ("coach, not a form; gather one piece at a time; never evaluate before context") — **no Trevor persona, and no length/one-question constraint.**

**The asymmetry this ADR addresses is no longer capability — it is voice, posture, and behaviour.** `ADR-UNIFIED-COACH-CAPABILITY-LAYER` already made the MCP the single capability layer and the chat its client, so both surfaces reach the **same tools, same internal data, same guardrails**. What is *not* yet governed is everything that shapes how the coach *behaves and sounds* — and that has already drifted:

- **Observed drift (2026-06-25, live connector test):** the connector produced multi-paragraph consultant essays with the decision buried at the bottom — because it carries **none** of the in-app coach's `<100 words / one question / not-lectures` rules. The in-app coach is constrained to be Socratic and terse; the connector is not.
- **Persona drift:** "Trevor" exists only in the edge function's `prompt.ts`. The connector is, in the user's words, *"Opus wearing a thin framework coat."*
- **Steering is duplicated, not shared:** `SERVER_INSTRUCTIONS` (Node) and `prompt.ts` (Deno) are two independently-edited strings. Nothing keeps them in sync. The edge fn does **not** import or derive from `SERVER_INSTRUCTIONS`.
- **Framework-definition drift:** `prompt.ts` still expands IDEA as *Identify/Discover/Execute/Analyze*; the corrected canon (`AGENTS.md`, the book) is *Insight-Driven/Distinctive/Empathetic/Authentic*. The two surfaces can literally describe the framework differently.

**The hard constraint that makes this an architecture decision, not a prompt tweak:** on the connector you control **neither the system prompt nor the thinking display** — both belong to the host model. So some dimensions of parity are *achievable* (you fully control them on both sides) and some are only *influenceable* on the connector (you steer, the host model decides). Pretending the connector can be made byte-identical to the in-app coach is the trap; refusing to govern it at all is the other. This ADR draws that line explicitly and defines the mechanism that keeps the governable dimensions in sync.

This is also the cross-runtime problem from the prior ADR, in a new place: shared *steering* (like shared *capability*) cannot be an `import` across the Node↔Deno split — it must be a shared **asset/contract** that both runtimes consume.

## Decision Drivers

- **One coach, two doors.** Users must experience the same brand, framework, posture, and (as far as possible) voice regardless of surface.
- **No silent drift.** Two hand-edited prompts guarantee divergence; parity must be enforced by a single source + a check, not by discipline.
- **Honesty about control.** The connector's base voice/thinking are the host model's. Govern what we can; don't promise what we can't.
- **Reuse the seam we already have.** Capability parity already rides the MCP-as-registry HTTP seam; steering parity should ride an analogous shared-asset seam, not a new import path.
- **Measurable, not asserted.** Parity must be observable (an eval bench scoring both surfaces on the same cases), not a claim in a doc.

## The parity contract (tiers)

Parity is defined per dimension, each tagged **ENFORCED** (single source of truth, fully controlled on both surfaces) or **STEERED** (host-model-controlled on the connector — we influence, we do not control).

| # | Dimension | Tier | Single source of truth | Mechanism |
|---|-----------|------|------------------------|-----------|
| 1 | **Capabilities / tools / internal-data access** | ENFORCED | MCP gateway (`src/mcp`) | Chat is an MCP client (prior ADR). Add a capability once → both inherit. |
| 2 | **Calculations / scoring** | ENFORCED | The Deno edge fns / TS services the MCP wraps | "Gen-3 verbatim lock": MCP tools wrap engines byte-identically. Cross-surface replay test (`idea-framework-consultant-claude/__tests__/mcp-loop-live.test.ts` spawns the real host). |
| 3 | **Identity / RLS / write-gating / PII redaction** | ENFORCED | MCP (`runWithIdentity`/`gateWrite`/`safeLog`) | JWT forwarded from chat → MCP; one guardrail model. |
| 4 | **Skill grounding** (`skills/idea`) | ENFORCED | `src/mcp/skills/skillLoader` | Grounds MCP tool descriptions; the chat receives it *through* the tools. (Gap: the chat's own base prompt is not yet sourced from `skills/idea` — see Decision.) |
| 5 | **Coaching posture & behaviour** (Socratic, one-question, length, "never score before context", terminology policy) | ENFORCED | **NEW: a shared Coach Charter** (see Decision) | One asset, inlined into both `SERVER_INSTRUCTIONS` and `prompt.ts`. |
| 6 | **Framework definition** (what IDEA *is*) | ENFORCED | The shared Coach Charter | Same source ends the Identify/Discover-vs-Insight-Driven split. |
| 7 | **Persona / voice** ("Trevor") | **STEERED** on connector / ENFORCED in-app | The shared Coach Charter (persona block) | In-app: full control via `prompt.ts`. Connector: charter steers the host model; it will not be byte-identical. |
| 8 | **Base model** | ACCEPTED DIVERGENCE | n/a | In-app pins Sonnet 4.6; connector uses the host model the user selected (e.g. Opus 4.8). Behaviour must not *depend* on a specific model. |
| 9 | **Thinking display / response chrome** | NOT A PARITY LEVER | n/a | Host-controlled on the connector; out of scope. |

## Decision

**1. Capability, calculation, identity, and grounding parity are governed by `ADR-UNIFIED-COACH-CAPABILITY-LAYER` and are re-affirmed here.** The MCP gateway is the single capability layer; the chat is its client. New tools/skills/calculations are added to the MCP **once**; both surfaces inherit them. This is the reason capability parity is *structural*, not maintained by hand. **Caveat:** the chat→MCP loop ships behind a flag (`CONSULTANT_TOOL_LOOP_ENABLED` + PostHog `coach-mcp-tool-loop`); with the flag **off** the chat falls back to a single-shot RAG call and reaches **none** of the MCP tools — i.e. capability parity is *real only when the loop is enabled*. The drift guard (point 5) therefore treats loop-enablement as a parity precondition, not an implementation detail.

**2. Introduce a single Coach Charter as the source of truth for shared steering (dimensions 5–7).** A versioned, plain-text/Markdown asset (e.g. `skills/idea/coach-charter.md`, alongside the existing book corpus) that defines: the Trevor persona, the IDEA framework definition (canonical *Insight-Driven/Distinctive/Empathetic/Authentic*), the coaching posture, and the hard behavioural rules (one focused question, brevity, "diagnose before prescribe", terminology policy A/B/C). Because Node (`config.ts`) and Deno (`prompt.ts`) **cannot share an import**, the charter is consumed as an **asset both build/deploy paths inline** — the same "shared asset, not shared import" pattern the capability layer uses for HTTP. `SERVER_INSTRUCTIONS` and `prompt.ts` become *thin renderers* over the charter (plus surface-specific framing), never independent rewrites.

**3. Govern voice honestly by tier.** The **in-app coach is the persona-faithful surface** (full system-prompt control). The **connector is steered, not controlled**: the charter's persona + behaviour rules are injected via `SERVER_INSTRUCTIONS`, accepting the host model will approximate, not reproduce, the voice. We do **not** chase byte-identical voice on the connector, and we do **not** treat the connector's longer, host-flavoured prose as a defect to "fix" in tooling — only as a target the charter nudges. Crucially, the charter's **behavioural** rules (one question, brevity, diagnose-first) *are* expected to materially improve connector behaviour, which is the highest-value parity win (it directly addresses the observed essay-drift).

**4. Make parity measurable.** Extend the existing eval bench (`src/mcp/evals`, Trevor on the allowlist) to run the **same cases against both surfaces** and score: capability coverage, calculation equivalence, posture adherence (one-question / brevity / diagnose-first), and a "sounds-like-Trevor" persona criterion. Parity is a dashboard, not a doc claim.

**5. Add a drift guard.** A lightweight check (CI or a test) that fails when: (a) a tool is exposed on one surface but not the other; (b) `SERVER_INSTRUCTIONS` or `prompt.ts` define posture/persona/framework text that does **not** derive from the charter; (c) the framework definition strings diverge. The rule for contributors: **edit the charter, never one surface's prompt directly.**

## Consequences

**Positive**
- One coach, two doors: capability + calculation + grounding are structurally identical; posture/persona/framework are single-sourced; voice is governed honestly per tier.
- The observed connector essay-drift is addressed at its root (behavioural rules now reach the connector via the charter) without pretending we control the host model's voice.
- Framework-definition drift (Identify/Discover vs Insight-Driven) is closed.
- Parity becomes observable and regression-guarded, not aspirational.

**Negative / risks**
- **Connector voice will never be byte-identical** to the in-app coach (tier-7 STEERED). This is accepted and documented, not solved.
- **Cross-runtime asset duplication at build time:** the charter is inlined into two runtimes; the build/deploy steps must both re-inline on change (mitigated by the drift guard failing if they diverge).
- **Net-new work:** the charter, the two thin renderers, the two-surface eval, and the drift guard are new. Sequence them; don't block the (already-live) capability parity on them.
- **Prompt-cache sensitivity:** `prompt.ts` is structured around cache breakpoints; folding in the charter must preserve the static-block cache contract (`generateSystemPrompt` stays the static, cross-user block).

**Neutral**
- Model divergence (tier 8) is intentional; do not "fix" it by pinning the connector — you can't.
- Conversation memory and embeddings parity ride their own accepted ADRs; don't re-litigate here.

## Implementation sketch (phased — not yet executed)

1. **Charter v1** — extract the shared persona + framework + posture + behaviour rules into `skills/idea/coach-charter.md`. Reconcile the IDEA definition to canon.
2. **Thin renderers** — `SERVER_INSTRUCTIONS` (Node) and `prompt.ts` (Deno) re-expressed as charter + surface framing. Preserve `prompt.ts`'s cache layout.
3. **Drift guard** — test/CI asserting tool-set symmetry + charter-derivation + framework-string equality.
4. **Two-surface eval** — same cases vs both surfaces in `src/mcp/evals`; add posture + persona criteria.
5. **(Optional) ground the chat base prompt in `skills/idea`** so dimension 4 is single-sourced on both sides, not just via tool descriptions.

Each step is additive and independently shippable; none blocks the live capability-parity path.

## Open questions

- **Charter location:** `skills/idea/coach-charter.md` (co-located with grounding, already shipped into the MCP image) vs a top-level `docs/` asset both build steps read. Lean: `skills/idea/` so it travels with the grounding the connector already loads.
- **Per-surface framing budget:** how much surface-specific text (e.g. the connector reminding the host model it is a tool host) is allowed on top of the charter before it counts as drift?
- **Comprehensive vs conversational modes:** `prompt.ts` has a comprehensive variant; does the connector need an equivalent, or is mode a purely in-app concern?
