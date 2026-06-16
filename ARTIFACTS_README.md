# IDEA Brand Coach — Session Artifacts (2026-06-14)

Three deliverables, all built this session on the `skill-architecture` worktree.

## 1. The IDEA Skill Library (`skills/`)
The book *What Captures The Heart Goes In The Cart* (Trevor Bradford) decomposed into an atomic, fully-traceable coaching skill library.
- `skills/idea/` — **158 atomic skills** under `framework/` (5 categories), `README.md` (navigable map), `_coverage.md` (book↔skill traceability matrix), `_source/` (full book text + section inventory). ≤5 children per folder, recursively.
- `skills/idea-bonus-pack/` — 7 "beyond-the-book" skills packaged as a paid add-on (not loaded by the launch coach).

## 2. Skill-Architecture Knowledge Graph (`graphify-out/`)
- `graph.html` — interactive graph (open in a browser): **198 nodes, 312 edges, 12 communities** that recover the book's structure bottom-up.
- `graph.json` — GraphRAG-ready data. `GRAPH_REPORT.md` — audit report (god nodes, surprising connections).

## 3. Brand-Coach MCP Test Architecture + Traceability Matrix (`_bmad-output/`, `src/test/`, `mcp-coach-tests/`)
Proves the chain `book → skills → MCP tools → user (2 ICPs)`, both directions.
- `_bmad-output/test-artifacts/test-design/brand-coach-mcp-test-design.md` — test architecture (13-tool surface, 5 layers + parity, risk register, decisions).
- `_bmad-output/test-artifacts/traceability/` — `traceability-matrix.csv` (**127 rows**) + `brand-coach-mcp-traceability.md` (BMAD trace + quality gate = CONCERNS, with what flips it to PASS).
- `src/test/fixtures/conversations/` — **102 recorded golden-fixture conversations** (2 ICPs × journeys × variants + uniqueness + edge/isolation) + `loader.ts` + `README.md`.
- `src/test/integration/mcp-conversation-replay.test.ts` — replay harness (Tier-0: **516 passed, 0 failed, 11 todo**).
- `mcp-coach-tests/` — tool-agnostic foundations (personas, test layers, oracle taxonomy, scenario/edge catalog).

All artifacts are uncommitted working-tree files for review.
