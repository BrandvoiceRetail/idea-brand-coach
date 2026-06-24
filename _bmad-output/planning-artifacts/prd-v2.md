# IDEA Brand Coach — PRD v2 (Asset-Centric, Evidence-Grounded)

- **Status:** Draft for review (strategic rewrite)
- **Date:** 2026-06-16
- **Supersedes:** `_bmad-output/planning-artifacts/prd.md` (v1 — field-centric, manual-refinement model)
- **Related:** `docs/v2/architecture/adr/ADR-UNIFIED-COACH-CAPABILITY-LAYER.md`, `brand-coach-mcp-planning/OUTPUT_CONTEXT_MANIFEST.md` (gold-workbook output bar)

---

## 0. Why this rewrite

v1 framed the product as a **chat-assisted form**: a 30–45 minute guided flow that populates 35 fields across 11 chapters, with a *mandatory manual-refinement pause after every stage*. That model optimizes the wrong thing. Data entry is cheap; the expensive, defensible thing in brand strategy is **applying expert method to the brand's own customer evidence**. v1 makes the human do the work and the AI assist. v2 inverts it: **the tool does the expert work, grounded in evidence, and the human steers and approves assets.**

The one-line bet:

> **Domain expertise incorporated into brand assets, managed as easily as possible — so the user contributes judgment and evidence, never data entry.**

---

## 1. Vision — where the puck is going

A brand owner connects their real customer evidence (their reviews, their listing, a few business facts). The tool — carrying a senior brand strategist's method (the IDEA framework, forensic avatar work, Trust Gap diagnosis, behavioral science) — produces a **library of grounded brand assets**: a forensic customer avatar, a Signature, a Brand Canvas, an Export Brief, a marketing-investment audit, on-brand copy. Each asset traces every claim back to the brand's own evidence. The owner reviews at the **asset level** — approve, regenerate, or steer — and exports to the two gold workbooks or pushes assets downstream. No form to fill, no field-by-field editing required.

The product is a **system of record for a brand's strategy**, not a one-shot generator: assets have versions, status, lineage, and grounding labels, and improve as more evidence arrives.

The moat is two-sided: **(a) encoded expertise** competitors can't cheaply replicate, and **(b) grounding in the brand's private customer evidence** that generic LLM tools structurally cannot match.

---

## 2. The strategic shift (from → to)

| Dimension | v1 — where the puck is today | v2 — where we skate to |
|---|---|---|
| **Unit of value** | 35 fields across 11 chapters | **Brand assets** (avatar, signature, canvas, brief, audit, copy, workbooks) |
| **Human role** | Fill and manually edit every field | **Provide evidence + steer/approve assets** |
| **AI role** | Suggest field values to accept/reject | **Expert practitioner**: gather evidence → apply method → produce grounded assets |
| **Interaction** | Form-fill chat w/ mandatory refinement pauses | **Agentic conversation** that runs the method and surfaces only real decisions |
| **Grounding** | AI suggestions (can fabricate) | **Evidence-grounded**: verbatim customer language; never-fabricate gate |
| **Manual editing** | Required at every stage | **Optional override** (authoritative when used; not a required step) |
| **Output** | A strategy document | **The two gold workbooks + a managed asset library** |
| **Management** | Single avatar, ad-hoc | **Asset ledger**: versions, status (draft→approved), lineage, export |

---

## 3. Product principles

1. **Asset-centric, not field-centric.** The user creates, reviews, versions, and exports *assets*. Fields are an implementation detail of an asset, not the surface.
2. **Evidence-grounded by default.** Every asset carries a grounding label (`evidence` with verbatim references, or `inference`). The never-fabricate gate blocks invented product claims and customer language — the agent asks (`needs_input`) rather than guesses.
3. **Expertise embedded, applied consistently.** The IDEA framework (Insight-Driven, Distinctive, Empathetic, Authentic), the forensic avatar method (vocabulary → jobs → triggers → objections), and Trust Gap diagnosis run deterministically where possible — the method doesn't vary by prompt luck.
4. **Approve, don't edit.** The default loop is approve / regenerate / steer at the asset level. Manual field editing is an opt-in escape hatch, treated as authoritative and tracked — never a mandatory gate.
5. **Ask only for what's genuinely needed.** Human time goes to judgment (pick a Signature, confirm a product claim, supply missing revenue) — not transcription.
6. **Export-first / parity.** The bar is reproducing the two Trevor-approved gold workbooks. Export is a read-only render of approved assets — no regeneration at export time.
7. **One capability layer for every surface.** The in-house chat and any external agent (MCP) use the *same* tools and internal data (per the ADR), so capability never forks.

---

## 4. Target user & jobs-to-be-done

**Primary:** ecommerce / Amazon-FBA brand owners (the "Marcus" persona) who have real customer evidence (reviews, listings, sales) but lack the time or expertise to turn it into a coherent, differentiated brand strategy.

**Core JTBD:**
- "Tell me the truth about my brand's trust gap and what's costing me." → Trust Gap diagnostic.
- "Turn what my customers actually say into a customer avatar I can act on." → forensic avatar.
- "Give me a distinctive way to say who I am." → Signature.
- "Hand me strategy assets I can actually use and hand to a team/agency." → Canvas, Brief, gold workbooks.
- "Tell me where to invest next." → marketing-investment audit.

Each job maps to an **asset**, produced by expert method over the user's evidence.

---

## 5. The asset model (the heart of v2)

**Asset taxonomy** (each is grounded, versioned, status-tracked):

| Asset | What it is | Grounded in |
|---|---|---|
| **Trust Gap diagnostic** | Scorecard across the 4 IDEA pillars + the gap narrative | Self-assessment + (optionally) evidence |
| **Forensic Avatar (S1–S4)** | Vocabulary, Job Map, Decision Triggers, Objections | The brand's own + competitor reviews (verbatim) |
| **Signature** | The distinctive one-line positioning options | Avatar S1–S4 |
| **Brand Canvas** | The synthesized brand strategy | Signature + avatar + owner intent |
| **Export Brief** | The hand-off brief (claims-gated) | Canvas + confirmed product claims |
| **Audit × IDEA map** | Cross-map of activities to the framework | Canvas + brief |
| **Marketing-Investment Audit** | Tiered investment matrix + 90-day rollout (Workbook B) | Business facts (revenue gated) |
| **Copy / assets** | On-brand drafts, publish-filter-checked | Canvas + avatar |
| **Gold Workbooks A & B** | The two Trevor-approved deliverables | Read-only render of the approved chain |

**Asset lifecycle (uniform):**
- **States:** `draft → in_review → approved` (+ `superseded` on re-generate).
- **Versions:** every regenerate creates a new version; prior versions retained (lineage).
- **Grounding label:** `evidence` (with verbatim references) or `inference`, shown on the asset.
- **Provenance:** which evidence + which upstream assets produced it (the chain).
- **Override:** any asset (or a field within it) can be manually overridden; overrides are authoritative and never silently regenerated over.

**Management surface:** an **asset library** per brand/avatar — filter by type/status, see grounding, diff versions, approve, regenerate, export. This replaces the v1 "11-chapter field form" as the primary surface.

---

## 6. The redone critical journey (replaces "Zero to First Avatar")

**"From evidence to an approved brand asset."** Target: first approved asset in **< 10 minutes**, near-zero typing of strategy content.

1. **Diagnose (hook).** Trust Gap from a few quick inputs → shows the gap and what it's costing. (Free, no account.)
2. **Ground.** The user supplies *evidence*, not strategy: paste/auto-pull their reviews, add their ASIN/listing, drop in a couple of business facts (revenue, prices). This is the only required "input," and it's data they already have.
3. **Generate (the method runs).** The agent runs the forensic avatar pipeline (S1→S4) + Signature, grounded in that evidence, narrating the method for transparency. It pauses **only** at genuine decisions: pick a Signature option, confirm a product claim the never-fabricate gate flagged, or supply a missing required fact.
4. **Approve & manage.** Assets land in the library with grounding shown. The user approves, regenerates, or steers — at the asset level. Manual edits available but optional.
5. **Export / activate.** One click → the gold workbooks; approved assets feed downstream (copy generation, publish-filter, marketing audit).

**Explicit non-goal:** there is **no mandatory field-by-field review pause.** v1's "manual refinement after every stage" is removed; correction is opt-in at the asset level.

---

## 7. The agent & capability layer

The flow above is driven by an **agentic coach** with a real tool loop and the full capability surface (diagnostics, evidence intake, forensic pipeline, generation, publish-filter, ledger, export) — the in-house chat and external MCP agents share **one** capability layer. Architecture, runtime seam (HTTP, Node↔Deno), and phasing are specified in `ADR-UNIFIED-COACH-CAPABILITY-LAYER.md`. This PRD assumes that layer; it is the mechanism by which "the tool does the expert work."

---

## 8. Requirements (by capability area)

**FR1 — Evidence intake.** Paste/auto-pull reviews (own + competitor), listing/ASIN ingest, business-facts capture. Parsed, deduped, stored per brand/avatar, RLS-scoped. The agent reports what evidence it has and what's missing (no guessing).

**FR2 — Expert generation (grounded).** Run Trust Gap, forensic avatar S1–S4, Signature, Canvas, Brief, Audit×IDEA, marketing audit — each validated against its contract, each carrying a grounding label, each blocking on `needs_input` rather than fabricating.

**FR3 — Asset library & lifecycle.** Create/list/view/version/approve/regenerate/override assets; show grounding + lineage; diff versions. This is the primary product surface.

**FR4 — Approve-don't-edit loop.** Asset-level approve / regenerate / steer as the default. Field-level manual override available and authoritative; never a required step.

**FR5 — Export & activation.** One-click render of approved chain → gold Workbook A & B; downstream activation (copy, publish-filter).

**FR6 — Multi-avatar.** Multiple grounded avatars per brand (see existing multi-avatar surface); each its own asset chain.

**Explicitly NOT building (v2 anti-scope):**
- Mandatory field-by-field entry/review as the spine.
- A "fill the 11 chapters" form as the primary UI.
- Ungrounded generation (no asset ships without a grounding label).

---

## 9. Where the puck is today (current state, honestly)

- **Built (MCP capability layer):** the full forensic pipeline, diagnostics, generation, publish-filter, ledger, and gold-workbook export already exist as ~28 MCP tools over a 3-layer service architecture, grounded + identity-gated. The output bar (two gold workbooks) is defined and reproducible.
- **The gap:** the **app-side experience is still v1** — field-centric, manual-edit-heavy; and the **in-house chat is a single-turn RAG consultant** (one extraction tool, no tool loop), so it can't yet drive the asset flow. Evidence tiers in the live KB are largely empty (users haven't been asked for evidence the right way).
- **So:** the *engine* for v2 largely exists; v2 is mostly about **changing the surface and the interaction model** (asset-centric, agent-driven, approve-don't-edit) on top of the capability layer — not building the strategy engine from scratch.

---

## 10. Roadmap (the skate path)

1. **Agent tool loop (ADR Phase 1–3).** Give the in-house chat the capability layer so it can run evidence-intake → forensic pipeline → assets.
2. **Asset library surface.** Replace the field-form primary UI with the asset library (list/version/approve/grounding). Keep field override as an escape hatch.
3. **Evidence-first onboarding.** Replace the 11-chapter form intro with the "drop your reviews" grounding step + Trust Gap hook.
4. **Approve-don't-edit loop + export.** Asset-level approve/regenerate; one-click gold-workbook export.
5. **Activation loop.** Downstream copy + publish-filter from approved assets; marketing-audit.

(Sequencing respects the existing Alpha→Beta gates and the deploy/merge order in `docs/DEPLOY_AND_OPS_PLAN.md`.)

---

## 11. Success metrics (asset-centric)

- **Time-to-first-approved-asset** (target < 10 min) — replaces v1's "complete the form."
- **% of asset content auto-generated vs manually edited** (want manual edits to be the rare exception — the inverse of v1's intent).
- **Grounding coverage:** % of shipped assets labeled `evidence` (vs `inference`).
- **Assets approved per brand**, and **export rate** (approved → gold workbook).
- **Evidence-intake completion:** % of users who connect real reviews/business facts.
- Retention/expansion: returning to manage/version assets over time.

---

## 12. Risks & open strategic questions

**Risks**
- **Trust vs automation:** doing the work *for* the user risks "black box." Mitigation: narrate the method + show grounding/evidence on every asset.
- **Evidence cold-start:** the model is only as good as the evidence; if users won't paste reviews, grounding degrades. Mitigation: auto-pull from ASIN, make intake the hook, degrade transparently to `inference` (labeled).
- **Over-automation backlash:** some owners *want* control. Mitigation: the override escape hatch (authoritative, tracked).

**Open questions for you (the strategic forks I took a position on — confirm or redirect):**
1. **Editing in Alpha vs Beta:** v2 demotes manual editing to an opt-in override *now*. Acceptable for Alpha, or keep field-edit prominent until Beta?
2. **"Watch the method run" vs "just give me the asset":** I've assumed transparency (narrate the pipeline) as a trust device. How much process visibility vs pure outcome?
3. **Packaging:** how does this map to the £97 / Decision-Trigger premise and Alpha/Beta tiers? (Affects whether the asset library is the paid surface.)
4. **Segment breadth:** lock to Amazon-FBA owners, or design the asset model for DTC/other ecommerce from day one?
5. **Scope of "Zero to First Avatar":** is the consumer onboarding journey fully replaced by the evidence-first flow above, or retained as a guided mode?
