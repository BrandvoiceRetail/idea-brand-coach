# Output Context Manifest — Reverse-Engineering the Gold Workbooks

**Date:** 2026-06-05
**Goal:** Determine the full set of context required to compile the two Trevor-approved example outputs, so the app + MCP can produce them reliably. Resolution principle: **KB-first — never ask the customer something they've already told us.** Remaining gaps, uncertainties, and fabrication risks resolve through interactive back-and-forth with the user, and every answer is stored back to memory.

**Gold artifacts (the product bar, per Trevor 5/18: "These are the kind of outputs we need from the Idea app"):**
- Output A: `IDEA BrandCoach InfinityVault Mockup.xlsx` (sent 5/17, ~/Downloads; 7 sheets)
- Output B: `InfinityVault Marketing Investment Audit.xlsx` (sent 5/17, ~/Downloads; 2 sheets)

Both were hand-assembled by Matthew with Claude web + Claude Code — i.e. **compiled from accumulated conversational memory plus inference**. The product must replicate the memory part with the user knowledge base and replace the inference part with evidence-or-ask.

---

## 1. Context classification taxonomy

Every content block in the gold workbooks resolves to one of:

| Class | Definition | Trust rule |
|---|---|---|
| **EVIDENCE** | Verbatim third-party data (reviews, listing copy, ad copy) | Quotable as-is; cite provenance |
| **PRODUCT-TRUTH** | Physical/policy facts (capacity, materials, compatibility, guarantees) | **Fabrication-critical** — never emit unconfirmed (see §6 gate) |
| **BUSINESS-FACT** | Owner-stated numbers/constraints (revenue, margins, ad spend, cash timing, channel states) | Stated once, stored, reused forever; staleness-checked |
| **OWNER-INTENT** | Strategy & preferences (positioning intent, price-anchor logic, voice do's/don'ts) | Confirmed-by-owner; lockable |
| **INTAKE** | Structured questionnaire answers | Stored per submission |
| **FRAMEWORK** | Static system knowledge (IDEA definitions, scoring rubrics, the marketing-move library) | System-side, not per-user |
| **ESTIMATE** | Model-derived numbers (benefit ranges, volume bands, lift multipliers) | Must be labeled as estimates, calibrated by BUSINESS-FACTs, user-adjustable |
| **SYNTHESIS** | Model reasoning over the above (job maps, signatures, canvas) | Valid only when upstream slots are filled; carries `grounding: evidence|inference` flag |

---

## 2. Workbook A — sheet-by-sheet context requirements

### Sheet 3 — Trust Gap™ Diagnostic
Gold self-flags its own gap: *"Mocked output. Scores reflect my best estimate from prior context — real diagnostic would derive from your reviews + intake answers."*

| Content block | Required context | Class |
|---|---|---|
| 4 dimension scores + overall | Intake answers **+ analysis of own listing copy & reviews** (not self-report alone) | INTAKE + EVIDENCE |
| Per-dimension brand-specific read (e.g. "Diamond Grain and Vintage create micro-identities") | Product line naming + positioning intent (price-anchor strategy) | OWNER-INTENT |
| "Where it shows up" evidence (e.g. "Listing bullet 1 starts with capacity, not feeling. A+ leads with material specs") | **Actual listing copy** (title/bullets/A+), ad copy | EVIDENCE |
| Authenticity read ("no documented voice guide", "support email register differs") | Voice-guide existence, support messaging samples | BUSINESS-FACT / EVIDENCE |
| Triage routing | Computed | SYNTHESIS |

### Sheet 4 — Avatar 2.0™ (5 stages)
Gold self-flags: *"populated with reasonable inference. The real version would derive every cell from forensic review analysis."*

| Stage | Required context | Class |
|---|---|---|
| S1 Vocabulary Forensics | **Own + competitor reviews, verbatim** (clusters must trace to real quotes) | EVIDENCE |
| S2 Job Map + villain | S1 output + category knowledge | SYNTHESIS |
| S3 Decision Triggers | S1/S2 + search-term knowledge; "estimated volume" = labeled band | SYNTHESIS + ESTIMATE |
| S4 Hesitations & Objections | **Low-star review verbatims**, Q&A content, price points vs competitor prices, competitor set (Ultra Pro, Vault X) | EVIDENCE + BUSINESS-FACT |
| S5 Signature | S1–S4 artifacts (+ optional conversation) | SYNTHESIS |

### Sheet 5 — Brand Canvas
Chosen Signature + S1–S4 artifacts + voice preferences (OWNER-INTENT) + brand story/origin (OWNER-INTENT, KB `canvas`/`insights` categories).

### Sheet 6 — Export Brief
| Content block | Required context | Class |
|---|---|---|
| Title formula + bullets | Canvas + **product claims** (216/432 capacity, side-loading, PSA-slab compatibility) | SYNTHESIS + **PRODUCT-TRUTH** |
| Bullet 5 "30-DAY GUARANTEE" | Return/guarantee **policy** | **PRODUCT-TRUTH** (gold likely invented this — see §6) |
| 7-slot image brief | Canvas + product visual facts + photography asset state | SYNTHESIS + BUSINESS-FACT |
| PPC keyword tiers | S3 triggers + keyword knowledge | SYNTHESIS + FRAMEWORK |

### Sheet 7 — Audit × IDEA
Cross-product of Output B's investment rows × IDEA artifacts. Requires both to exist. SYNTHESIS.

(Sheets 1–2 are narrative/product-architecture framing — FRAMEWORK + SYNTHESIS over the rest; no unique context slots.)

---

## 3. Workbook B — Marketing Investment Audit

Gold header: *"Scored against current constraints: tight cash, thin margins, ~$1K/mo Uncapped repayment starting June, May inventory order priority."* Gold notes: *"Estimates are calibrated to your business size from prior conversations."* → This workbook is **memory-powered calibration of a static move library.**

| Content block | Required context | Class |
|---|---|---|
| The ~22 investment rows themselves | Reusable marketing-move library (A+ overhaul, Vine, SBV, TikTok Shop, …) | **FRAMEWORK** (system library, not per-user) |
| Tier assignment (T1/T2/T3) + applicability | Brand Registry status, existing A+/storefront/photography state, channel states (email list, social, D2C) | BUSINESS-FACT |
| Cash cost / hours / effort | Library defaults adjusted by business size | FRAMEWORK + ESTIMATE |
| 1/3/6/12-mo benefit ranges | Monthly revenue, post-ad margin target (~10%), current ad spend ($618→$450) + ACOS targets (14%/12%) | BUSINESS-FACT → calibrated ESTIMATE |
| 90-day phasing | Cash-flow timeline (inventory order timing, repayment start), inventory risks (LTSF SKUs) | BUSINESS-FACT |

**Key implication:** Output B is *not* primarily a generation problem — it's a **business-facts memory problem**. Without a structured business-facts store, every row's calibration must be re-asked.

---

## 4. Master context manifest (deduplicated slots)

Resolution order per slot: **artifacts → evidence stores → avatar_field_values → user_knowledge_base (current) → diagnostic_submissions → chat-history mining (RAG chunks) → IV-OS MCP (IV tenant only) → ASK USER → write-back to KB.**

| # | Slot | Class | Used by | Where it lives today | Fill status today |
|---|---|---|---|---|---|
| 1 | Own product reviews (verbatim) | EVIDENCE | A:S1,S4,S5, diag | `user_product_reviews` table **exists on live, 0 rows, unwired**; paste path in reveal-signature (ephemeral) | ❌ empty |
| 2 | Competitor reviews | EVIDENCE | A:S1,S4 | `review-scraper`/`-deep` edge fns → transient chat context; `competitive_analyses`/`competitor_reviews` migrations in repo but **tables absent on live DB** | ❌ ephemeral only |
| 3 | Own listing copy (title/bullets/A+/desc) | EVIDENCE | A: diag evidence, brief baseline | Nowhere. Amazon `/dp/` scrape proven (full listing + ~8 reviews; `/product-reviews/` is login-walled) | ❌ |
| 4 | Ad copy / support messaging samples | EVIDENCE | A: diag authenticity | Nowhere | ❌ |
| 5 | Product catalog (SKUs, names, prices) | PRODUCT-TRUTH | A: diag, brief; B: tiers | `user_products` **exists on live, 0 rows**; IV-OS `get_product_catalog` (IV only) | ❌ |
| 6 | Product claims (capacity, materials, compatibility, guarantees/policies) | PRODUCT-TRUTH | A: brief bullets/images | IV-OS `get_safe_claims` (IV only); else nowhere | ❌ **gate required** |
| 7 | Brand asset states (Brand Registry, A+, storefront, photography) | BUSINESS-FACT | B: tiering; A: image brief | Nowhere structured | ❌ |
| 8 | Revenue / margins / ad metrics (spend, ACOS targets) | BUSINESS-FACT | B: calibration | Nowhere structured (at best buried in `consultant` KB entries / chat) | ❌ |
| 9 | Cash constraints & timing (repayments, inventory orders) | BUSINESS-FACT | B: phasing | Nowhere | ❌ |
| 10 | Channel states (email list size, social, D2C) | BUSINESS-FACT | B: tiers; A: funnel reads | Nowhere structured | ❌ |
| 11 | Inventory risks (LTSF SKUs) | BUSINESS-FACT | B: phasing | Nowhere (IV: IV-OS funnel) | ❌ |
| 12 | Positioning intent / price-anchor strategy / variant naming intent | OWNER-INTENT | A: diag distinctiveness, canvas | `avatar_field_values` + KB `canvas` (19 entries/8 fields) | ⚠️ partial |
| 13 | Voice preferences (do's/don'ts), brand story | OWNER-INTENT | A: canvas, brief | KB `canvas`/`insights`/`copy` categories | ⚠️ partial |
| 14 | Target-customer beliefs | OWNER-INTENT | A: avatar stages | KB `avatar` category (1,407 entries / 14 fields) + `avatar_field_values` (49) | ✅ richest store |
| 15 | Intake answers | INTAKE | A: diag scores | `diagnostic_submissions` (25 rows live) | ✅ exists (6-question; thin) |
| 16 | Competitor set + price points | BUSINESS-FACT | A:S4; B | Nowhere structured | ❌ |
| 17 | Marketing-move library | FRAMEWORK | B; A: sheet 7 | Nowhere (System-KB store is a no-op toggle — known gap) | ❌ system-side |
| 18 | IDEA definitions / rubrics | FRAMEWORK | A: diag | `src/lib/trustGap.ts` static + prompts | ✅ |

**Live memory audit (2026-06-05, production DB):** `user_knowledge_base` = 2,191 rows but only ~61 distinct fields across 5 categories (avatar 1,407 / consultant 724 / insights 23 / canvas 19 / copy 18 — heavy versioning). `user_knowledge_chunks` = 12 (chat mining barely populated). **The entire EVIDENCE + BUSINESS-FACT tier is empty or unstructured.** The memory that powered the gold workbooks (Matthew's accumulated Claude conversations) has no in-product equivalent for those classes yet.

---

## 5. The "never ask twice" resolver design

Per generator, the contract pairs an **output schema** with a **required-context manifest** (slots from §4). The resolver:

1. Attempts each slot in resolution order; every fill carries `{value, source, confidence, status}`.
2. Status ∈ `filled-evidence | filled-stated | filled-inferred | missing | conflict | stale`.
3. `filled-inferred`, `missing`, `conflict`, `stale` → **clarification queue**.
4. Clarification surfaces:
   - **In-app:** chat prompt cards (reuse the existing field-extraction/field-review UX pattern).
   - **MCP:** generator tools return a structured `needs_input: [{slot, question, why, current_guess}]` block the calling agent relays; a `provide_context` tool accepts answers.
5. **Store-on-answer:** every user answer writes back — evidence → evidence stores (`user_products`, `user_product_reviews`, snapshots); facts → KB (new `business_facts` category with `structured_data`, or dedicated table); intent → `avatar_field_values` (`field_source='manual'`, lockable). The same question is never asked twice; staleness windows (e.g. revenue: 90 days) trigger *confirm* prompts, not re-asks.
6. Generators run in `evidence` mode when slots are evidence-filled, `inference` mode otherwise — and the output artifact records which (extends reveal-signature's existing `usedReviews`/`inference` discipline).

---

## 6. Fabrication audit of the gold workbooks (the bar we must beat)

The gold examples contain inference presented at varying confidence. The real system must replace these with **evidence-or-ask**:

| Gold content | Risk | System behavior |
|---|---|---|
| Diagnostic scores ("best estimate from prior context") | Self-flagged inference | Derive from intake + evidence; label residual inference |
| S1 vocab clusters ("reasonable inference") | Self-flagged | Must trace every term to a real review quote |
| "30-DAY GUARANTEE" bullet | **Invented policy + Amazon TOS hazard** (warranty/guarantee phrasing) | Hard gate: policy claims require owner confirmation — see claim-audit protocol precedent in `Restructure-Analysis-Skills-Roadmap.xlsx` (false-claim cascade, TOS vs accuracy distinction) |
| "PSA-slab compatible on outer pockets" / "Holds 432 Cards" | Product-truth claims (gold itself hedges: "PSA-graded (if applicable)") | Hard gate: confirm with owner or `get_safe_claims` |
| "Trusted by serious card collectors" | Unverifiable authority claim | Require evidence (review count/rating) or soften |
| S3 search-volume estimates, B's benefit ranges | Estimates | Always labeled bands, calibrated by BUSINESS-FACTs, user-adjustable |

**Gate rule:** PRODUCT-TRUTH and policy claims may never appear in a generated brief/copy artifact without `filled-evidence` or explicit owner confirmation recorded in memory.

---

## 7. How this feeds the implementation plan

- **Contracts:** each artifact kind in `src/mcp/contracts/` gets `{outputSchema, requiredContext: Slot[]}` (slots = §4 numbering).
- **Resolver:** new `src/mcp/service/contextResolver.ts` implementing §5; shared by all generator tools and (later) the app.
- **Evidence layer:** wire the existing-but-empty `user_products` + `user_product_reviews` live tables as the own-evidence store; apply the competitive-analysis migrations to live; add `evidence_snapshots` for frozen grounding.
- **Business facts:** new KB category `business_facts` (structured_data JSONB) — the single unlock for Output B.
- **Clarification loop:** `needs_input` blocks in tool results + `provide_context` tool; in-app reuse of field-review cards.
- **Gold fixtures:** commit both workbooks' extracted content as JSON fixtures; eval = generated artifacts vs gold structure, with the §6 items expected to *differ* (evidence-or-ask instead of inference).

---

## 8. Learnings — 2026-06-06 (Phase 7 end-to-end build)

Captured after the P0-P7 build + the P7-A fresh-user rehearsal and P7-B repeat-user
consistency pass (self-annealing per the workflow). Full audit:
`brand-coach-mcp-planning/E2E_GAP_REPORT.md`.

### What held (the manifest was right)
- **Never-ask-twice works end-to-end.** P7-A: 0 post-answer re-asks. P7-B: every
  previously-answered slot resolved from memory; only the never-ingested EVIDENCE gaps
  {#2 competitor reviews, #4 ad/support samples} surfaced — a true gap, not a repeat.
- **The §6 fabrication gate held in live data.** All persisted `export_brief` artifacts
  contain NO guarantee/return-policy claim (slot #6 declined it). The deterministic
  `claimGate.scanBrief` backstop re-scans produced copy and does not trust the model's
  self-report. Confirmed claims (216/432 capacity) correctly pass.
- **Grounding flags + evidence-refs invariant held.** Every current artifact carries a
  `grounding` flag; zero evidence-mode artifacts have empty `evidence_refs[]`
  (`artifactStore.validateArtifact` enforces it). The reveal-signature
  `usedReviews`/`inference` discipline generalized cleanly to all 11 kinds.

### Divergences from this manifest (update §4/§5/§7 mental model)
- **§5/§7 "new KB category `business_facts`" was NOT buildable as written.**
  `user_knowledge_base`'s category CHECK constraint forbids a `business_facts` category, so
  BUSINESS-FACT and PRODUCT-TRUTH-confirmation answers land in a **dedicated `business_facts`
  table** (migration `20260606000000`), keyed by `field_identifier = <slot id>` with
  `structured_data` JSONB and KB-style `is_current`/`version` versioning. The slot table's
  `residesIn: ['business_facts', …]` is correct; only the §5/§7 prose ("KB category") is stale.
  Live-verified: 0 rows in `user_knowledge_base WHERE category='business_facts'`; all facts in
  the dedicated table (slots #6-#11,#16, single-current per field).
- **IV-OS (`ivos_mcp`) reader is deferred, not absent-by-mistake.** Slots #5/#6/#11 list
  `ivos_mcp` in `residesIn`, but the resolver omits that reader (IV-tenant-only — see
  `project_ivos_brandcoach_mcp_boundary`). Non-IV callers fall through to `ask`. IV's
  catalog/claims were supplied as role-play answers in the rehearsals, the correct non-IV path.
- **ASIN `/dp/` scrape (slots #1/#2/#3 auto-fetch) is NOT wired.** `ingest_evidence` is
  paste-only today; the proven `/dp/` parser is a future additive intake.

### New residual risks (not in the original fabrication audit)
- **Same-avatar artifact REGENERATION is blocked.** `artifactStore.saveArtifact` is
  insert-then-supersede, so a repeat run transiently violates `uq_artifacts_current_per_kind`
  ("duplicate key value") and every artifact-writing tool fails to regenerate. The DB invariant
  stays intact (failed inserts roll back; 0 duplicate-current rows), but `export_workbook` then
  silently re-renders the PRIOR chain — a stale-content hazard. Fix: supersede-before-insert (or
  a deferrable constraint). Regeneration currently requires a fresh avatar.
- **No tool-level retry on `generate_canvas`/`generate_brief`/`generate_audit_idea_map`** —
  their edge fns intermittently 500 under load; the rehearsals retried at the drive layer. Add
  bounded transient retry inside the tools (the avatar pipeline + diagnostic already retry).
- **`export_workbook` does not `mkdir` its `out_dir`** (ENOENT if absent).
- **Slot #4 (ad/support) writeback collides** — it routes into the snapshot `reviews` column,
  conflicting with brand-level reviews and flagging slot #1 `conflict`. Needs a dedicated column.
