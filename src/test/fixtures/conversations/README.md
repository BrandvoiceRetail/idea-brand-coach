# Brand-Coach MCP — Recorded Conversation Corpus

102 **golden-fixture conversations**: a user (one of two ICPs) interacting with the Brand-Coach MCP in ways that uniquely use our owned (§1a) tools, which are powered by the IDEA skills, powered by the book. Each fixture is one row in the traceability matrix and a replayable test case.

- **Matrix:** `_bmad-output/test-artifacts/traceability/traceability-matrix.csv` (+ the BMAD trace doc + gate)
- **Architecture / risks / decisions:** `_bmad-output/test-artifacts/test-design/brand-coach-mcp-test-design.md`
- **Harness:** `src/test/integration/mcp-conversation-replay.test.ts` · **Loader:** `./loader.ts`
- **Tool-agnostic foundation (personas, layers, oracle taxonomy):** `mcp-coach-tests/00-test-foundations.md`

## The two ICPs (personas)
- **P1 "Maya" — Busy Brand Owner:** knowledgeable, time-poor, terse, pushes back, wants done-for-you drafts. Coach adapts: answer-first, compressed, fills work FOR her.
- **P2 "Rico" — Operations VA:** trainable, time-rich, asks for definitions/examples/steps. Coach adapts: teaches the why, worked examples, step-by-step + checklists.

The *same* skills delivered two visibly different ways — `[persona-adapt:Px]` is a first-class oracle in every fixture.

## Layout
| Folder | Layer | What | Count |
|---|---|---|---|
| `J1-diagnose-avatar/` … `J8-research-avatar/` | L2/L3 | 8 multi-tool journeys × 2 ICPs × 5 product variants (supplements/apparel/home/beauty/pet) | 80 |
| `uniqueness/` | L5 | 6 "only-our-tools-do-this" cases × 2 ICPs (Rufus+triggers, Canvas→BrandGPT, Signpost messaging, Difference-vs-Distinctiveness, Match2Me, trust-gap reframe) | 12 |
| `edge/` | L4 | 10 negative / edge / isolation cases (empty-input decline, scope-guard, prompt-injection, MF-1 cross-tenant, bad-ASIN, fabrication-trap, manipulation-refusal, health-claim compliance, bonus-gating, persona-drift) | 10 |

The owned critical-path chain (`generate_concepts → publish_filter_check → draft_asset → design_test`) is the **J3-owned-chain** journey.

## Golden-fixture format
YAML front-matter = the matrix row (`tc_id, layer, persona, tools, skills, book_ref, type, priority, status`). Body = an alternating transcript with inline provenance tags — `⟦tool: …⟧` (MCP tool invoked), `⟦skill: …⟧` (skill grounding the claim), `⟦iv-os: …⟧` (mocked IV-OS dependency) — then `### Artifact produced` and `### Assertions (oracle)`.

## Running it
```bash
npx vitest run src/test/integration/mcp-conversation-replay.test.ts
```
- **Tier-0 (runs now):** fixture integrity — every fixture is well-formed, declares the tools it exercises and tags them inline, grounds the coach in cited skills, produces an artifact + machine-checkable assertions, and carries its persona-adaptation oracle. Plus coverage invariants (both ICPs present, every chain tool exercised, isolation/negative/uniqueness present).
- **Tier-1 (gated `BRAND_COACH_MCP_HOST=1`):** live replay through the MCP gateway — each fixture's Assertions block becomes the executable oracle. `it.todo` until `feat/brand-coach-mcp-host` is importable here.
- **Calculation-parity (gated):** each wrapped-engine tool == direct engine output.

Current: **516 passed, 0 failed, 11 todo** (the gated Tier-1/parity placeholders).
