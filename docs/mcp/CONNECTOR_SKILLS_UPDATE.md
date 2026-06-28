# MCP Tool-Surface Update — Connector Skill Behaviour (IDEA-APP-SKILLS-002)

> **Status:** Determination locked via step-by-step interview with Matthew (2026-06-28).
> Build not yet started. Final sign-off on the consolidated list pending.
> **Source of direction:** Trevor Bradford, two Slack messages in `#brand-coach-skills`
> (2026-06-27 06:23 + 06:48 PDT) + `IDEA-APP-SKILLS-002 v1.0` + the 5 connector skill `.md`
> files (skills 01, 02, 03, 09, 10).

## 1. What Trevor delivered

The 20-skill library has **two contexts**, not one:

- **App pipeline** — a skill is loaded into a system prompt, runs against *structured* data,
  emits *formatted UI* output. (Unchanged; already how our skills are written.)
- **Connector (Claude)** — the brand owner is in a *conversation*. Inputs are pasted/partial,
  outputs are natural language, and the voice must hold under live pressure.
  `IDEA-APP-SKILLS-002` adds a **connector section** to each skill describing this mode.

**The governing standard (Trevor's words):** *"The connector is not a chatbot. It is Trevor
Bradford in a working session with a brand owner who has a specific commercial problem. Every
response must leave them with either a finding, an action, or a question that moves them forward.
A response that produces only reflection is a wasted turn."* A session never ends without one of
three outputs: a **Trust Gap Score** (+ plain explanation), a **Decision Trigger** (+ placement
instruction), or a **brief they can hand off today**.

### Tier structure (Trevor's two messages)

| Tier / skills | Role | Connector treatment |
|---|---|---|
| **01, 02, 03** (foundation) | The lens on every turn | Connector sections delivered now |
| **09, 10** (output/action, Alpha-critical) | Trigger + brief | Connector sections delivered now |
| **04–08** (diagnostic pipeline) | Runs in app sequence 07→04→05→06→08 | Connector = partial-input, **not** a forced sequence; connector sections in Trevor's *next* doc |
| **11, 13, 14** (output, **Beta**) | Not surfaced to Alpha testers | Connector *may* run them early from pasted input, on request (intentional) — deferred this round |
| **12 Listing Analysis** (output, **Alpha**) | **Paid-tier entry point** (listing upload) | New tool this round |
| **15–20** (science) | Internal engine only | Background grounding; **never tools, never user-facing** |

**Hard terminology rule (IDEA-POLICY-TERM-001):** the buyer-state names *Assessor, Protector,
Expresser, Connector* must never appear in user-facing output. Already enforced by
`terminologyGuard.ts` (detection).

## 2. The interview — decisions made with Matthew

Each was an explicit choice; the recommended option was taken in every case.

1. **Approach (Step 1):** *Grounding + instructions first.* Most tools already exist but are
   grounded in **app** behaviour; the gap is teaching them the **conversational** behaviour —
   not a pile of new tools. Plus the one genuinely missing tool (`listing_analysis`) and a
   `generate_brief` tightening. The core reframe: connector tools must **operate from whatever
   partial input the user pasted** and **never end a turn in pure reflection**.
2. **Enforcement (Step 2):** *Two layers.* The connector's final voice is owned by the **host
   Claude** (per `ADR-COACH-SURFACE-PARITY` — why it "rambled"): `SERVER_INSTRUCTIONS` only
   *influences* it. So we put the standard in `SERVER_INSTRUCTIONS` **and** make every
   diagnostic/trigger/brief tool **return its mandated output as a hard artifact** in
   `structuredContent` — the host can drift in prose but the substance still moves the owner forward.
3. **`listing_analysis` scope (Step 3):** *Thin + composable.* It does only Skill 12's
   distinctive deliverable — the element→pillar read + the one-sentence "which buyer the page
   serves vs neglects" gap — from pasted listing (+reviews if present), partial-input OK, then
   **hands off** to `assess_idea_dimensions` (scores) and `identify_decision_trigger` (the fix).
   No duplication of the scoring/trigger logic.
4. **`generate_brief` claim-gate (Step 4):** *Broad compliance net.* Detect + flag (as a
   `needs_confirmation` artifact, before the claim ships) not just warranties but health/medical
   claims (clinically proven / FDA / cures / treats) and unverifiable superlatives
   (#1 / best-selling / award-winning / doctor recommended).
5. **Gating + science tier (Step 5):** Ship only Skill 12 for Alpha; defer 11/13/14 connector
   tools (when built: run-on-pasted-input, available-on-request, *not* app-flag-gated). Science
   tier (15–20) = background grounding only.

## 3. Consolidated determination — the MCP tool-surface updates

| # | Update | Type | Source |
|---|--------|------|--------|
| 1 | Fold the **connector sections** of skills 01, 02, 03, 09, 10 into `appSkills` grounding so connector tools inherit conversational behaviour | grounding | SKILLS-002 |
| 2 | Lift the **connector-wide standard** into `SERVER_INSTRUCTIONS` — finding/action/question every turn; never end without Trust Gap / Trigger+placement / hand-off brief; one question per turn; the framing question ("What's the number you look at every morning…"); voice-under-pressure | instructions | both msgs |
| 3 | **Tool-level enforcement**: every diagnostic/trigger/brief tool *returns* its mandated output artifact (score+explanation, trigger+placement, or the one next question) in `structuredContent` | extend | Step 2 |
| 4 | **NEW `listing_analysis`** tool (Skill 12, paid entry) — thin: element→pillar read + one-sentence gap, partial-input, hands off to `assess_idea_dimensions` + `identify_decision_trigger`. **DEFERRED this round** (gated on Trevor's authoritative Skill 12 doc — don't build the paid entry twice) | build-new (deferred) | Skill 12 |
| 5 | **Tighten `generate_brief`** — addressed-to-designer + single-component (grounding) + **broad compliance claim-gate** as `needs_confirmation` artifact | extend | Skill 10 |
| 6 | **Science tier (15–20)** loaded as background grounding only; never tools/user-facing | grounding | msg 2 |
| 7 | Confirm `terminologyGuard` covers the buyer-state hard rule across the new/changed tools | guard | both |
| 8 | Beta skills 11/13/14 connector tools **deferred** (next round; run-on-pasted-input when built) | defer | msg 2 |

## 3a. Build status — branch `feat/mcp-connector-skills` (2026-06-28)

BUILT + verified (typecheck:mcp + full MCP vitest green; design + adversarial-verify workflows):
- **#2** WORKING SESSION block in `SERVER_INSTRUCTIONS`, plus a distilled **VOICE** line carrying Skill 02's
  output red-lines (UK English, **no em dashes**, prose-not-bullets, one recommendation) and a no-fabrication
  harmonisation (asking for the one missing input is itself a valid move; never invent a score/trigger/brief).
- **#3** `run_trust_gap` now returns a deterministic plain-language `explanation` (no em dash, no over-assertion
  on strong inputs); `identify_decision_trigger` / `assess_idea_dimensions` / `generate_brief` already returned
  their mandated artifact (verified, no change).
- **#5** `generate_brief` claim-gate extended (`detectClaims` / `detectBriefClaims`): warranty/guarantee/lifetime/
  money-back, clinically/FDA/dermatologist, #1/no.1/best-selling/award-winning/doctor-recommended — surfaced as
  `needs_confirmation` and **filtered against the confirmed allowlist** (no double-prompt). Bare *treats/cures*
  deliberately excluded (false-positive prone). Addressed-to-designer + single-component grounding added.
- **#6 / #7** verified already-enforced (science tier 15–20 internal-only; `terminologyGuard` wraps every tool).
- Grounding map fixed: `assess_idea_dimensions` / `identify_decision_trigger` / `onboard_status` now cite their
  skills (the first was a silent no-op; the trigger grounded via the wrong key; onboard never called the preamble).

**#1 — honest mechanism (scope clarified after adversarial review):** the 5 connector `.md` sections were appended
verbatim (canon / SSOT), but at MCP runtime **nothing inlines skill bodies into the host context** — so those rich
tables feed the in-app consultant + evals, NOT the live connector. The connector behaviour that reaches the host
travels via **#2 (the WORKING SESSION standard) + per-tool description specifics (`generate_brief` carries Skill 10)
+ the tool-output artifacts (#3)**. The earlier generic per-tool connector sentence was removed (it overpromised
"pasted" for slot-reading tools and polluted app-pipeline tool descriptions).

**#4 `listing_analysis` — DEFERRED:** not built this round; gated on Trevor's authoritative Skill 12 doc so we
don't build the paid entry twice. Tracked as the next task.

## 4. Proposed build sequence

1. **Connector skill content** — add the connector sections to the 5 skill `.md` files
   (01, 02, 03, 09, 10) per Trevor's `.docx`-is-authoritative / `.md`-regenerated rule; extend
   `appGroundingPreamble` to emit the connector section when grounding a connector tool. *(#1, #6)*
2. **`SERVER_INSTRUCTIONS`** — add the connector-wide standard + the three-outputs rule +
   one-question-per-turn + voice-under-pressure. *(#2)*
3. **Tool-output artifacts** — audit `run_trust_gap`, `identify_decision_trigger`,
   `assess_idea_dimensions`, `generate_brief` to guarantee each returns its mandated output
   in `structuredContent`. *(#3)*
4. **`listing_analysis`** — new service + tool (thin, partial-input, hand-off), grounded in
   Skill 12; drift-guard + tests; register in `server.ts`. *(#4)*
5. **`generate_brief`** — addressed-to-designer grounding + the claim-detection gate. *(#5)*
6. **`terminologyGuard`** — confirm coverage over the new/changed tool outputs. *(#7)*

Each step: `npm run typecheck:mcp` + targeted vitest + the `server.test.ts` drift-guard before deploy.

## 5. Open items / dependencies

- **Pending from Trevor:** the *next* document with connector sections for skills **04–08 and
  11–20** (incl. Skill 12's detailed/authoritative spec). `listing_analysis` is scaffolded from
  the existing app-skill 12 content + Trevor's description; **confirm against his detailed doc when
  it lands.**
- **Message to Trevor** (drafted, awaiting Matthew's send): the host-Claude-owns-the-final-experience
  point — same engine/skills, different control model on the last mile; tool-output artifacts are
  our strongest lever. (See conversation / Slack draft.)
- **Authoritative format:** `.docx` is the human source of truth; `.md` is regenerated from it.
  Do not hand-edit a skill `.md` ahead of its `.docx`.

## 6. Proposed `SERVER_INSTRUCTIONS` addition (determination #2) — FOR REVIEW

A new `WORKING SESSION` block to add after `POSTURE` in `src/mcp/config.ts`. Slots into the
existing capitalized-section style; drops in as array lines joined with `' '`. **Not yet applied —
this is the wording for Matthew to shape before any build.**

> **WORKING SESSION (connector):** You are not a chatbot — you are the brand owner's coach in a
> live working session on a specific commercial problem. Every reply must leave them with one of:
> a specific **FINDING**, a specific **ACTION**, or a single **QUESTION** that moves them forward —
> a reply that is only reflection is a wasted turn. Never end a session without producing at least
> one of three concrete outputs: a **Trust Gap Score** with a plain-language explanation, a
> **Decision Trigger** with a one-line placement instruction, or a **brief they can hand to their
> designer/VA today**. Ask at most **ONE clarifying question per turn**; when the commercial problem
> is unclear, ask the one that frames everything — *"What's the number you look at every morning
> that's telling you something is wrong?"* — and anchor every later reply to that number. **Hold the
> finding under pressure:** if the user pushes back, don't fold — explain what produced it and ask
> for the specific evidence that would change it; if they want reassurance the listing doesn't earn,
> say so plainly (warmth without honesty isn't coaching); reframe any general brand-strategy question
> back to the conversion problem. **PARTIAL INPUT:** work from whatever the user has pasted — a
> listing alone, a few review lines, or just a number — name the most likely read at the right
> confidence and ask for the one input that would sharpen it; never require the full pipeline before
> you give them something.

Notes for review:
- This deliberately echoes Trevor's exact framing question and the three-outputs rule verbatim, so
  the connector voice is steered by his language, not a paraphrase.
- It reinforces (does not contradict) the existing `POSTURE` no-fabrication rule — "name the most
  likely read at the right confidence" pairs with `assess_idea_dimensions`' honesty floor.
- The buyer-state terminology hard rule already lives in `NARRATION` ("never expose … buyer-state
  names"); no duplication needed.
