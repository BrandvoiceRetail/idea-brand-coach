# ADR-output-engine: Gold-Workbook Output Engine

## Status
Accepted — decisions locked by Matthew 2026-06-05 (export-first · both workbooks · shared engine, MCP-first). Build in flight via gated workflow `wf_67be119f-136` (P0 ✅, P1 in progress at time of writing).

## Context
Trevor approved two hand-made workbooks as the product bar ("These are the kind of outputs we need from the Idea app", 5/18): `IDEA BrandCoach InfinityVault Mockup.xlsx` (Trust Gap → Avatar 2.0 → Signature → Brand Canvas → Export Brief → Audit×IDEA) and `InfinityVault Marketing Investment Audit.xlsx` (tiered investment matrix + 90-day phasing). They were compiled by Matthew with Claude from accumulated conversational memory + inference — **not** by the app.

The app today produces conversational moments (chat coach, a 6-question self-report score, an ephemeral Signature). The gold outputs are a **compounding chain of persisted, evidence-grounded artifacts**. The architectural decision: how to add that chain so outputs are reliable (grounded, gated) and consistent (deterministic where possible), serving both the MCP/agent surface and (later) the app UI from one engine.

Spec inputs: `brand-coach-mcp-planning/OUTPUT_CONTEXT_MANIFEST.md` (reverse-engineered 18-slot context manifest, resolver design, fabrication gates) and `brand-coach-mcp-planning/WORKFLOW_PROMPT_output-engine.md` (phased build plan P0–P7).

## Current Architecture (relevant parts)
- **MCP gateway** `src/mcp/` — 3-layer TS (service → tools/register → `server.ts` factory), `EdgeFnClient` seam, AsyncLocalStorage identity, `gateWrite()` write gating, never-fail IV-OS auto-record, 12 tools, 39 vitest specs. Calculation-parity precedent: `run_trust_gap` imports `src/lib/trustGap.ts` in-process.
- **Edge functions** — `reveal-signature` (gold prompt skeleton: no-parroting, evidence-vs-inference flags), `diagnostic-interpretation` (generic-by-band, fabrication-forbidden), `generate-brand-strategy-*`, scrapers.
- **Persistence** — `avatar_field_values` (lockable field chain), `user_knowledge_base` (versioned, 5 categories), `diagnostic_submissions`, RAG chunks. Evidence tier (`user_products`, `user_product_reviews`) exists live but empty; no business-facts store.
- **Export** — client jsPDF + `MarkdownExportService` (batch/dependsOn/retry orchestration); no xlsx capability in TS.

## Decision
Build the output engine **inside the existing MCP gateway + new Supabase edge functions**, with seven structural commitments:

1. **Contracts as the domain core** (`src/mcp/contracts/`): one zod module per artifact kind exporting `{kind, outputSchema, requiredContext: Slot[]}`. Single source of truth imported by tools, resolver, pipeline, and assemblers.
2. **Artifact-chain persistence** (additive migration): `artifacts` (append-only, `superseded_by` versioning, one-current-per-kind partial index), `evidence_snapshots` (frozen grounding), `signatures` (satisfies the Alpha local-persistence decision), `marketing_audits`. RLS owner-only; MCP host writes through a per-request **JWT-bound client** (RLS-honoring; no service-role).
3. **Context resolver** (`service/contextResolver.ts`): KB-first never-ask-twice resolution (artifacts → evidence → field values → KB incl. new `business_facts` category → diagnostics → chat-mining → ask), 6 fill statuses, store-on-answer write-back. Generators return `needs_input` instead of fabricating.
4. **LLM legs as edge functions** cloned from the `reveal-signature` skeleton (Avatar S1–S4, evidence diagnostic, canvas, brief, audit-map, marketing-audit prose); thin MCP tools wrap them verbatim via `EdgeFnClient`.
5. **Deterministic where numbers matter** (humble-object split): Output B's tiering/calibration/phasing computed in `service/auditCalibration.ts` (pure TS); the LLM writes prose only and the host verifies numbers pass through unchanged. Workbook assembly (`exceljs`, Node host) is a pure function over persisted artifacts — **no regeneration at export**.
6. **Fabrication gates** (`service/claimGate.ts`): PRODUCT-TRUTH/policy claims (capacity, compatibility, guarantees) blocked unless evidence-filled or owner-confirmed; violations surface as questions.
7. **Grounding provenance on every artifact**: `grounding: evidence|inference` + `evidence_refs[]`, generalizing reveal-signature's `usedReviews`/`inference` discipline.

## Rationale
- **SRP (actors lens)** — each module changes for exactly one actor: contracts ← product-spec changes; resolver ← memory/ask policy; generators ← coaching content; calibration ← pricing/ROI model; assemblers ← deliverable format. Without the split, one "outputs" module would change for five unrelated reasons (divergent change, CRITICAL smell). (`03-clean-architecture/SOLID_PRINCIPLES.md`, `99-reference/SOLID_QUICK_REFERENCE.md`)
- **DIP / Dependency Rule** — tools and pipeline depend on contracts (pure zod) and the `EdgeFnClient`/`artifactStore` seams, never on the Anthropic SDK or exceljs directly; LLM and spreadsheet libs live at the infrastructure edge. Dependencies point inward. (`03-clean-architecture/DEPENDENCY_RULE.md`)
- **Humble Objects** — separating deterministic calibration/assembly from LLM prose makes the business-meaningful numbers unit-testable against gold fixtures and immune to model drift. (`03-clean-architecture/HUMBLE_OBJECTS.md`)
- **Calculation Parity (house precedent)** — same engine serves MCP now and app later; tools wrap edge fns verbatim so the app can call identical functions (`run_trust_gap`/`generate_concepts` precedent).
- **Reliability bar** — "reliably and consistently" is achieved structurally: contracts (schema-valid), resolver (no silent gaps), gates (no fabrication), determinism (stable numbers), persisted chain (reproducible exports), gold fixtures (measurable target).

## Alternatives Considered
| Alternative | Rejected because |
|---|---|
| In-app UI first, MCP later | Contradicts locked export-first/MCP-first decision; the gold outputs were agent-made — agents are the fastest path to the bar |
| One mega edge fn for the whole chain | No per-stage artifacts/retry, untestable stages, no resolver checkpoint between stages |
| Python FastMCP sidecar (IV-OS pattern) | Loses in-process TS parity with `src/lib` + existing gateway/tests; two hosts to operate |
| Service-role DB writes from host | Violates RLS posture; repo history (MF-1 confused-deputy RPCs) shows the risk class |
| xlsx generation in a Deno edge fn | MCP host is Node — exceljs is mature there; export needs filesystem access for agent-returnable paths |
| Regenerate content at export time | Nondeterministic exports, LLM cost per export, untestable vs fixtures |

## Consequences
- **Enables:** workbook-grade deliverables from a single MCP session; Alpha Signature persistence (side effect); Beta MCP surface (the parked tools now exist); IV-OS `log_asset` echo of produced assets; future paid-tier gating around outputs worth paying for.
- **Constrains:** generators must declare context up front (contracts), so ad-hoc "just generate something" paths are intentionally harder; export only reflects persisted state.
- **New debt (accepted, recorded):** edge fns can't import the zod contracts (Deno/Node boundary) — output validation happens host-side, prompts duplicate the shape (drift risk; mitigated by contract validation rejecting bad fn output). ~10 new edge fns + 4 tables to operate. `ingest_evidence` ASIN-scrape is a stub pending the proven `/dp/` parser port.

## Dependency Graph

### Blocked By (must ship first)
- Gold fixtures (P0) — **done**, committed under `src/mcp/__tests__/fixtures/`
- **D2/R-015 operator sign-off** — context-bundle Signature grounding implemented per manifest argument; Matthew must ratify the R-015 reading before the pipeline auto-feeds S5 (flagged in workflow report)
- MF-1 RPC hardening lineage — merged to `main` (PR #2); **verify present on `feat/alpha-instrumentation`** before exposing any KB-search tool (MF-2 trigger ships via our own P3 migration)
- Supabase live project awake (free-tier auto-pause) — operational, recurring

### Blocks (features waiting on this)
- Beta MCP tool surface (`run_diagnostic`, `build_avatar`, `generate_signature`, `export` — were parked, now being built here)
- In-app artifact views / app consumption of the shared engine (post-export phase)
- IV-OS echo of produced workbooks as ledger assets
- Pricing/paywall around outputs; Trevor case-study deliverable automation

### Critical Path Position
- **Yes — this is the critical path** to the Trevor-validated product bar (the outputs ARE the product per 5/18 chat). Alpha instrumentation (PostHog/feedback) proceeds in parallel on the same branch and is not blocked by this work.
- Next on the path after this: operator commit/PR strategy per phase → D2 sign-off → in-app consumption of the engine.

### External Dependencies
- Supabase live project (available; auto-pauses), Anthropic key in edge env (available — existing fns use it), `exceljs` (added P6), gold workbooks in `~/Downloads` (available; fixtures committed), IV-OS MCP (optional/deferred — slot source for IV tenant only)

## Pre-Implementation Refactoring
- `context/identity.ts` raw-JWT retention for the RLS-bound client — scoped to a minimal, noted change inside P1 (done via `supabaseUser.ts` accessor; identity.ts itself only touched if unavoidable).
- Deliberately **none** elsewhere: the existing `diagnostic-interpretation` fn is NOT edited (new `-evidence` fn instead); existing tables are not altered (additive-only).

## Affected Modules
- `src/mcp/contracts/**` (new domain core) · `src/mcp/service/{artifactStore,contextResolver,contextWriteback,avatarPipeline,claimGate,auditCalibration,workbook/*}.ts` (new) · `src/mcp/tools/{generateSignature,persistSignature,getContextStatus,provideContext,ingestEvidence,buildAvatarStage,runDiagnosticEvidence,generateCanvas,generateBrief,generateAuditIdeaMap,runMarketingAudit,exportWorkbook}.ts` (new) · `src/mcp/supabaseUser.ts` (new) · `src/mcp/server.ts` + `src/mcp/__tests__/server.test.ts` (registrar-only edits) · `src/mcp/data/marketingMoves.ts` (new)
- `supabase/functions/{avatar-vocabulary,avatar-jobmap,avatar-triggers,avatar-objections,diagnostic-interpretation-evidence,brand-canvas,export-brief,audit-idea-map,marketing-audit}/**` (new)
- `supabase/migrations/20260605000000_create_output_engine_tables.sql` (+ MF-2 trigger migration in P3)
- `package.json` (exceljs)

## Long-Term Vision Alignment
Implements the project's 3-layer doctrine literally: directives (contracts + manifest) / orchestration (resolver + pipeline deciding what to ask vs. generate) / execution (deterministic calibration, assemblers, edge fns). Completes the MCP-surface reframe (chat → agent-callable tools) with the chain that makes those tools worth calling, and feeds the IV case-study flywheel (IV is the first tenant whose memory fills the manifest). The app UI becomes a consumer of the same engine — no second implementation when Beta adds in-app views.

---
*Build tracking: workflow `wf_67be119f-136` (resumed 2026-06-06 after P1-C structured-output failure; P0 gate PASS, P1-A/B cached). Multi-PR updates append below per Feature Factory lifecycle.*
