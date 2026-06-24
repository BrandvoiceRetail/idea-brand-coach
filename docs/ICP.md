# Ideal Customer Profiles — IDEA Brand Coach

> **Single source of truth in code:** [`src/mcp/evals/icp/profiles.ts`](../src/mcp/evals/icp/profiles.ts) (`ICPS`, `getICP`, `icpForPersona`). This doc is the human-readable companion. Grow both via the [conversation-harvest sweep](evals/CONVERSATION_HARVEST_LOOP.md), not by scattering persona facts across the codebase.

## What the app is for (the key purpose)

The IDEA Brand Coach is **in-house, AI-powered software for managing an Amazon ecommerce brand** — purpose-built for the brand-management use case, not a generic chatbot. Its job is to **solve a specific, measurable commercial problem: low conversion.** (Confirmed in the 2026-06-19 "problem solver" pivot call and the 2026-06-18 call on AI software for Amazon sellers who lack the time or skill.)

The loop it sells: **Diagnose → Analyse → Fix → Re-measure → Defend.**
- **Free, evidence-based Trust Gap™ diagnostic** (lead magnet) — the owner scores what they can *observe* in their listing.
- **Paid forensic analysis** — reads the listing + the real review corpus, builds the Avatar 2.0™ portrait, finds the one **Decision Trigger™** to fix first, and hands back an actionable brief.
- **Brand Defence loop** — re-measures and watches competitors; the reason to keep the subscription.

The differentiator vs generic AI is the **forensic pipeline grounded in the user's own evidence** — not self-assessment, not a generic strategy doc.

## The two ICPs (same brand, two seats)

### ICP 1 — Busy Brand Owner ("Maya", persona **P1**)
- **Who:** founder-operator of a 7-figure DTC + Amazon brand, tiny team, branding-literate, chronically time-poor.
- **Problems we solve:** soft conversion with an unknown cause; generic AI output that isn't implementable; no time for forensic review analysis; brand work losing to firefighting.
- **What she wants:** a fix she can ship today — done-for-you drafts she edits, using her own data, one clear next action.
- **Coach adapts:** answer-first, compressed, fills the worksheet FOR her, ends on one action. Never homework or concepts she knows.
- **Success:** leaves in minutes with a Trust Gap™ Score, a primary Decision Trigger™, and a ready-to-hand-off brief specific to her customer.

### ICP 2 — Operational VA ("Rico", persona **P2**)
- **Who:** conscientious VA executing brand/listing tasks for a busy owner; new to branding; time-rich; lacks the skill to build expert tooling himself — the gap this app fills in-house.
- **Problems we solve:** doesn't know where to start or the vocabulary; risk of doing it "wrong" for the owner; needs structure; can't assemble the tooling alone.
- **What he wants:** to learn the *why* and produce a deliverable the owner approves, with a reusable checklist.
- **Coach adapts:** teach foundations + define terms, worked examples, step-by-step + templates + checklists, check understanding. Never compress past the why.
- **Success:** finishes with a correct deliverable AND understands why it works; gets more capable each session.

> **Persona-adaptation is a first-class eval oracle:** the *same* tool/journey run as P1 vs P2 must produce visibly different delivery (compression vs scaffolding) while preserving the same skill substance.

### Not our ICP (deprecated)
The PRD's Sarah/Marcus/Emily personas predate the problem-solver pivot and are **superseded** by the two ICPs above. Do not build evals or copy against them.

## Where the ICPs are referenced
- **Eval cases** ([`src/mcp/evals/cases/catalog.ts`](../src/mcp/evals/cases/catalog.ts)) — each case carries a `persona`; `icpForPersona()` resolves the ICP. The admin Eval Bench shows the ICP context.
- **Coach Criteria** ([`src/mcp/evals/criteria/`](../src/mcp/evals/criteria/catalog.ts)) — criteria can scope to an ICP (`icpScope`).
- **Live judge** — persona-adaptation is judged against the ICP's `coachAdapt` do/avoid.
- **Conversation harvest** ([`src/mcp/evals/harvest/`](../src/mcp/evals/harvest/harvest.ts)) — real conversations are classified by ICP and aggregated to grow these profiles over time.
- **Golden corpus** (`src/test/fixtures/conversations/`, `mcp-coach-tests/00-test-foundations.md`) — 80 journeys × P1/P2.
