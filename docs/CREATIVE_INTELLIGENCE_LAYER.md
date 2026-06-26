# Creative Intelligence Layer (IDEA D / Distinctive)

**Status:** Built on `feat/coach-creative-intelligence` (off `mcp-oauth`, the prod MCP lineage). Verified by unit test + a controlled A/B of the connector posture. Prod deploy is gated (edge fn + MCP host rebuild).

## Why

Trevor, 2026-06-26 (replying to the `B0CJBN849W` / Infinity Vault session):

> The Coach is very literal in its response: no one is mentioning "battle ready". Of course not — that is marketing. It's something that belongs in the D pillar — it's distinctive. It is a creative expression of the protection of your assets… How can we get the coach to have a creative intelligence layer?

In that session the coach mined the reviews correctly (they cluster on *protection certainty / toploader fit*) but then **dismissed "battle ready" because customers don't say it in reviews.** That is a category error: a customer review is evidence about the **fact** plane; "battle ready" lives on the **expression** plane. They don't compete — "battle ready" is a candidate Distinctive expression *of* the protection insight, and the right response is to **test** it, not refute it with review language.

## Root cause

The coach is governed by a blanket no-invention rule (in the MCP `SERVER_INSTRUCTIONS` POSTURE and the consultant prompt): *"NEVER generate before the user has shared real context… do not infer, default, or invent inputs… never fabricate."* That rule is correct for **facts** and necessary (it stops fabricated ratings/claims). But read literally it also forbids inventing **expression** — which is exactly the creative leap the Distinctive pillar requires. The coach had the creative DNA only inside one tool (`reveal-signature`'s "vocabulary borrowed, truth newly named"); it was never a general coach behaviour.

## The principle: a FACT / EXPRESSION firewall

- **FACTS** — what the customer said, reviews, ratings, product claims. *Never invent, assume, or inflate.* If a fact is missing, ask.
- **EXPRESSION** — the words, metaphors, and names that dramatise a real benefit. *Inventing these is the job.* This is the D (Distinctive) pillar.
- Every distinctive expression is offered as a **hypothesis to TEST**, never asserted as fact, and routed to a resonance test (`design_test`).

A distinctive expression earns its place only when it is **OWNABLE · SURPRISING · TRUE** (traces to a real insight, never invented data) **· TESTABLE**.

## What changed (additive, reversible)

| File | Change |
|---|---|
| `supabase/functions/idea-framework-consultant-claude/prompt.ts` | New `buildCreativeIntelligenceInstructions()` `<creative-intelligence>` block, appended always-on to both conversational and comprehensive modes (static cached prefix). Teaches the firewall, the literal→distinctive leap with the "battle ready" worked example, the OSTT rubric, the "offer as an angle to test" discipline, and a compact sharp-human craft note. |
| `src/mcp/config.ts` | `CREATIVE INTELLIGENCE` carve-out inside the `SERVER_INSTRUCTIONS` POSTURE — scopes the no-invention rule to facts, licenses distinctive expression, routes it to `design_test`. |
| `src/mcp/service/concepts.ts` | `buildConceptPrompt` now demands the literal→distinctive leap + OSTT rubric + resonance-test framing. JSON contract `{title,hook,angle,rationale}` unchanged (parser/consumers safe). |
| `src/mcp/__tests__/creativeIntelligence.test.ts` | Conformance test pinning the discipline across all three surfaces so it can't silently regress. |

## Craft layer (from the writing-style guide)

The leap is landed in sharp human language (no AI filler: leverage, unlock, seamless, transformative, supercharge…). **One deliberate carve-out:** the Signature device "they aren't buying X, they're buying Y" is a load-bearing binary contrast and is exempt from the no-binary-contrast rule — it just must not become a verbal tic elsewhere.

## Verification

- `npm run typecheck:mcp` clean; `creativeIntelligence.test.ts` + `assetChain` + `onboard` green (37 tests).
- **Controlled A/B of the connector posture** (same model + same `B0CJBN849W` tool-evidence, only `SERVER_INSTRUCTIONS` differs): the OLD posture dismisses "battle ready" for being absent from reviews; the NEW posture affirms the protection-certainty evidence AND treats "battle ready" as a distinctive expression of it to be tested. (See the session transcript / Slack reply for the quoted outputs.)

## Deploy (gated — Ask First)

1. Consultant edge fn: `npx supabase functions deploy idea-framework-consultant-claude --project-ref ecdrxtbclxfpkknasmrw`.
2. MCP host rebuild (picks up `config.ts` + `concepts.ts`) on the box, from the `mcp-oauth` lineage.
3. Live-verify on the QA account against the `B0CJBN849W` scenario.

## Next increment (not built)

A dedicated `generate_distinctive_expressions` tool (insight → ranked distinctive expressions, each with an OSTT self-score, a literal→distinctive trace, and an auto-suggested `design_test`). The prompt-layer change above already reaches both the in-app coach and the connector's generative tools, so the tool is an enhancement, not a prerequisite.
