# MCP `onboard` Orchestrator — Design

**Status:** Proposed · 2026-06-28
**Goal:** Turn `onboard` from a two-choice stub into the **one efficient pass that grabs all
available data, derives what it can, and ends on the single next action** — while keeping the
low-friction multiple-choice diagnostic as the cold-start rung.

Grounded in a real onboarding session (2026-06-28) that dead-ended, the
`MCP_TOOL_SURFACE_PLAN_2026-06-25` backlog, and two product calls from Matthew:
1. **Keep the multiple-choice diagnostic** — it's deliberately low-friction to guarantee click-through.
2. **Once onboarded, use ALL available context** — derive scores from real evidence instead of blocking.

---

## The problem (from the live transcript)

A tester ran "onboard my brand: read what you know, pull my 30-day funnel metrics, store them
against each funnel piece, then give me my Trust Gap and weakest piece." It became a **30+ step
manual choreography** and then **dead-ended**:

- *"no tool exposes those four [IDEA] numbers to me, and the scoring tool explicitly forbids inventing them"* → **Trust Gap unreachable** despite the coach having gathered reviews, a 5.48% CVR, dead paid-social, and a deck-box-vs-binder positioning gap.
- *"the connector can create avatars but can't edit or delete"* → ended with **6 avatars, 3 stale placeholders**.
- *"the metric-storage tools require a campaign to attach to"* → had to create a **throwaway campaign** to store funnel metrics.
- *"the write came back needing your approval (that tool is gated)"* → derived positioning/voice (slots 12/13) **couldn't persist**.

Root cause: we have **one** path to the IDEA scores (manual self-report) plus a **firewall** that
says "never infer." When rich context exists, the firewall blocks the *good* inference too.

---

## Design principle: derive-from-context with confirmation (not block)

Two scoring paths that **compose**, chosen by context availability (`get_context_status` already
knows the 18-slot fill map):

| Rung | When | Path | Friction |
|------|------|------|----------|
| **Cold start** | anonymous / no evidence loaded | multiple-choice self-report (`run_trust_gap`) — unchanged | lowest; guarantees click-through |
| **Onboarded** | account + reviews/funnel/docs present | **`assess_idea_dimensions`** derives provisional scores from real evidence | none — user confirms, doesn't author |

**The firewall is preserved, not weakened.** Derivation ≠ fabrication when:
- every dimension score **cites the real evidence** behind it (provenance),
- a **confidence floor** (plan rank 8) returns *"not enough signal on X — the one input that unlocks it is …"* rather than a fabricated number,
- the score is **provisional → user confirms/adjusts**, never asserted as fact,
- output opens on the **commercial wound**, not a brand-questionnaire (Trevor: CONVERSION FIXER),
- a shared **Tier-C redaction test** wraps the returned text/structuredContent.

---

## The optimized `onboard` tool

Authenticated orchestrator. The **service** layer runs the other **services** in-process (parallel
where independent) — one fast pass, no tool-to-tool network hops:

```
onboard (service)                          composes (existing service → new where noted)
├─ 1. READ what we know   (parallel)
│    ├─ context fill map ............... getContextStatus
│    ├─ avatars ........................ listAvatars
│    ├─ funnel inventory + coverage .... listFunnelInventory / getFunnelCoverage
│    ├─ assets / prior diagnostic ...... listAssets / getDiagnosticScores  (NEW read)
│    └─ coach history (flags only) ..... listCoachConversations
├─ 2. PULL connected analytics ........ returns a structured "pull plan" the host drives via the
│       (last-30d funnel metrics,        analytics connector (Windsor/Amazon SP), then writes back
│        "—" where unconnected)          via upsert_funnel_touchpoint metrics  (NEW: bind to piece,
│                                         no campaign container)
├─ 3. DERIVE provisional IDEA scores .. assessIdeaDimensions  (NEW) — evidence + confidence + floor
│       + Trust Gap + weakest piece       (commercial-wound framing; provenance-stamped)
└─ 4. RETURN unified onboarding state .. {known, missing, the ONE next input that unlocks most,
                                          provisional Trust Gap + weakest piece, single next action}
```

P1 "Maya" delivery: **answer-first, ends on ONE action, never homework.** P2 "Rico": same substance,
scaffolded. Cost: the derive step is LLM-backed → sits **behind the per-user cost guardrail** (plan rank 9).

---

## Supporting tool updates `onboard` depends on

| # | Update | Type | Unblocks (transcript) |
|---|--------|------|----------------------|
| 1 | **`assess_idea_dimensions`** — derive 4 IDEA scores from loaded context; evidence + confidence + floor | build-new | the dead-end ("no path but give me 4 numbers") |
| 2 | **`get_diagnostic_scores`** — read prior diagnostic's 4 scores | build-new (read) | "no tool exposes those four numbers" |
| 3 | **`update_avatar` / `delete_avatar`** | build-new | 6 avatars / 3 stale placeholders |
| 4 | **Avatar→KB write-through** (fold into `create_avatar`) | extend | built avatars invisible to in-app coach (0/1384 KB rows) |
| 5 | **Funnel metrics bind directly to funnel pieces** | extend | throwaway-campaign requirement |
| 6 | **Provenance-stamped onboarding write** for `provide_context` | extend | slots 12/13 stalled on approval gate |

Each is small and independently useful; `onboard` composes them.

---

## Architecture fit & build location

- Three-layer (`service` → `tools` → `server`). New logic lands as **pure services** first
  (testable, no I/O surprises), wrapped by `register*Tool`, advertised in `server.ts`.
- `onboard` service **orchestrates services, not MCP tools** → one in-process pass = "efficient and quick."
- **Prod MCP builds from the `mcp-oauth` branch** (live container). Build on a worktree off `mcp-oauth`
  so the deploy path is clean; the live consultant lesson (deployed ≠ repo) applies.
- Guardrails: `safeLog` redaction (MF-5), `gateWrite` on writes, `requireOwnedAvatar` on avatar-scoped
  work, shared Tier-C redaction test on all derive output.

---

## Build sequence (best-first)

1. **`assess_idea_dimensions` service + tool** (with confidence floor + provenance + redaction test) — the keystone; unblocks the dead-end.
2. **`get_diagnostic_scores`** read — cheap, pairs with #1.
3. **`onboard` service v1** — orchestrate the READ pass (step 1) + call #1/#2; return unified state + ONE next action.
4. **`update_avatar` / `delete_avatar`** + **avatar→KB write-through**.
5. **Funnel-metric direct bind** + **onboard analytics pull-plan** (step 2).
6. **Provenance onboarding write** (step 6).

---

## Open decisions (Matthew / Trevor)

1. **Confidence-floor policy** for `assess_idea_dimensions`: below what confidence does a dimension return "need input X" vs a labelled-range score?
2. **Derive cost ceiling**: per-user credit count / hard cap / soft warn — and does it gate the authenticated onboard derive in Alpha, or only anonymous?
3. **Analytics pull**: does `onboard` return a pull-plan the host executes via the Windsor connector (keeps onboard connector-agnostic), or do we add a first-party analytics-ingest service?
4. **Worktree**: confirm building on a worktree off `mcp-oauth` (prod build branch).
