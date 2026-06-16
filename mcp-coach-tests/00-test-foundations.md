# Brand-Coach MCP — Test Foundations (tool-agnostic)

Foundation for the MCP test architecture + traceability matrix. The **tool axis** is filled from the discovery sweep (`mcp-test-architecture-discovery` workflow); everything here is independent of the specific tool list and is the contract the recorded test corpus and the BMAD TEA formalization build on.

## The traceability spine
```
Book §  →  Skill (skills/idea)  →  MCP tool  →  Test case  →  Recorded conversation (golden transcript)  →  Assertions
                                                                  ⤷ conditioned by Persona (Busy Owner | Ops VA)
```
Provable both directions: every tool has ≥1 test; every test traces to a recorded conversation and back through skill → book §. Orphan tools (no test) and orphan tests (no tool/skill/book trace) are coverage defects.

---

## Personas (the two ICPs)

### P1 — "Maya" · Busy Brand Owner (knowledgeable, skilled, time-poor)
- **Context:** founder-operator of a 7-figure DTC + Amazon wellness brand; tiny team. Deeply knows her product, margins, ad accounts, customers. Branding-literate (knows positioning, value prop, avatar). Chronically time-starved.
- **Behavior / voice:** terse; "give me the 30-second version"; "I know what an avatar is — what should MINE say?"; "don't make me fill in a worksheet, just draft it and I'll edit"; pushes back on generic advice; drops real data ("repeat rate 22%, CAC creeping").
- **Detection signals (for the persona-adaptation oracle):** short messages, domain jargon used correctly, explicit time pressure, requests for done-for-you output, skips offered explainers, supplies own data.
- **Expected coach adaptation:** lead with the answer then one-line why; compress; produce done-for-you drafts she edits; use HER data; skip definitions she knows; batch questions; fill worksheet boxes FOR her from what she says; end with one clear next action.

### P2 — "Rico" · Operations Virtual Assistant (less skilled, trainable, time-rich)
- **Context:** VA executing brand/listing/marketing tasks for a busy owner. Hardworking, conscientious, organized. New to branding & behavioral science (doesn't yet know positioning vs value prop, or "distinctiveness"). Eager to learn the *why*. Abundant time.
- **Behavior / voice:** "can you explain what that means?"; "could you give me an example?"; "walk me through it step by step"; "I want to do this right for the owner"; confirms understanding; asks for checklists/templates.
- **Detection signals:** definitional questions, requests for examples/step-by-step, lower jargon density, no time pressure, asks for reusable templates, confirms understanding.
- **Expected coach adaptation:** teach foundations + define terms before applying; worked example per concept; step-by-step instructions, fill-in templates, reusable checklists; check understanding; patient, encouraging; leverage abundant time with thorough multi-step exercises.

**Persona-adaptation is a first-class test oracle:** the *same* tool/journey run as P1 vs P2 must produce visibly different delivery (compression vs scaffolding) while preserving the same underlying skill substance.

---

## Test layers (the architecture)
| # | Layer | What it asserts | Example |
|---|---|---|---|
| L1 | **Tool-level (unit)** | one MCP tool in isolation → schema-valid output AND skill-faithful (no claim beyond the book-powered skill) | call the Avatar-2.0 tool with raw inputs → 5 fields populated, each grounded in Ch3 skills |
| L2 | **Journey (integration)** | a realistic multi-tool sequence a user runs end-to-end | diagnose → Avatar 2.0 → Brand Canvas → listing rewrite → BrandGPT |
| L3 | **Persona-conditioned** | same journey for P1 and P2 → asserts adaptation (compression vs scaffolding) with identical skill substance | the Brand-Canvas journey, both ICPs |
| L4 | **Negative / edge / isolation** | missing inputs, off-topic, prompt-injection, bad-ASIN, empty KB tier, cross-tenant leakage | tenant A cannot read tenant B's saved Avatar |
| L5 | **Uniqueness / differentiation** | interactions only *our* skill-powered tools do well vs vanilla LLM | "make my listing rank in Rufus AND capture the heart" → uses Ch1 Rufus/Cosmo + Ch2 trigger table specifically |

---

## Traceability matrix schema (one row per test case)
`mcp-coach-tests/traceability-matrix.csv` (+ a rendered `.md` view):

| column | meaning |
|---|---|
| `tc_id` | `TC-<L#>-<TOOL>-<PERSONA?>-<nnn>` (e.g. `TC-L1-avatar2-P1-003`) |
| `layer` | L1–L5 |
| `tool(s)` | MCP tool(s) exercised |
| `skill(s)` | skill file path(s) powering those tools |
| `book_ref` | chapter §/pages the skill traces to |
| `persona` | P1 / P2 / none |
| `scenario` | short journey/scenario name |
| `conversation_file` | path to the recorded golden transcript |
| `preconditions` | tenant/state/inputs required |
| `expected_behavior` | what the coach/tool must do |
| `assertions` | machine-checkable oracle list (see taxonomy) |
| `type` | happy / negative / edge / isolation / uniqueness |
| `status` | draft / recorded / verified |

**Coverage rollups:** tool → #tests (no zeros allowed); skill → #tests; book § → #tests; persona balance; layer distribution; bidirectional orphan check.

---

## Recorded conversation = golden transcript (replayable fixture)
Each conversation file is both a human-readable transcript and a machine-replayable fixture. Format:

````
---
tc_id: TC-L2-journey-canvas-P1-001
layer: L2
persona: P1
tools: [diagnose_trust_gap, build_avatar_2_0, build_brand_canvas]
skills: [idea/framework/.../00-trust-is-the-deciding-factor.md, ...]
book_ref: [Intro, Ch3, Ch5]
type: journey
status: recorded
---
# <title>
<2-line setup>

**Maya (User):** ...
**Coach:** ...  ⟦tool: build_avatar_2_0⟧ ⟦skill: idea/framework/01-customer/00-avatar-2.0/...⟧
...

### Artifact produced
<the filled Avatar / canvas / rewritten listing / BrandGPT prompt>

### Assertions (oracle)
- [tool-call] build_avatar_2_0 invoked with {…}
- [schema] output has 5 avatar fields
- [skill-faithful] "buyer intent = the why behind the search" traces to 01-the-five-fields/00-buyer-intent.md
- [persona-adapt:P1] coach led with answer, produced done-for-you draft, ≤N clarifying questions
- [artifact] avatar profile present
- [safety] no cross-tenant data, no invented stats
````

The `⟦tool:…⟧` / `⟦skill:…⟧` inline tags make tool-invocation and skill-grounding checkable by the harness; the front-matter is the matrix row; the Assertions block is the oracle.

---

## Assertion / oracle taxonomy
1. **schema** — tool output conforms to its declared output schema.
2. **tool-call** — the expected MCP tool(s) were invoked (and only appropriate ones).
3. **skill-faithful** — every substantive coach claim traces to a cited skill; zero invention beyond the book-powered skills. (Adversarially checked against the skill files.)
4. **persona-adapt** — delivery matches the persona's expected adaptation; cross-persona diff is visible.
5. **artifact** — the promised deliverable (avatar/canvas/listing/journey-map/BrandGPT prompt) is actually produced.
6. **safety/isolation** — no cross-tenant leakage, no PII in logs, prompt-injection resisted, graceful on bad input.
7. **uniqueness** — the interaction demonstrably leverages our tool/skill (not reproducible by a generic prompt).

---

## Sizing (derived from coverage, target 100–300)
`L1: #tools × 2 personas × ~3 variants` + `L2: #journeys(≈5–7) × 2 personas × ~3 variants` + `L4: edge/negative/isolation catalog (≈30–60)` + `L5: uniqueness (≈10–20)`. With the discovered tool count this lands ≈150–250, scalable to 300 by adding variants. Every generated conversation is a matrix row.

---

## Open items (filled after discovery)
- [ ] **Tool axis** — concrete or designed MCP tool list (names, signatures, skill bindings) ← discovery synthesis.
- [ ] **Harness location** — where replayable tests live + runner (vitest?) ← discovery test-infra.
- [ ] **MCP status** — built vs designed-only (decides whether tests run live or are spec/golden fixtures).
- [ ] BMAD TEA formalization: `testarch-test-design` (design), `testarch-trace` (matrix + gate), `testarch-framework` (harness).
