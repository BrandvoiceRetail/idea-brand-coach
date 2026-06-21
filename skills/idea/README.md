# IDEA Skill Library — the coaching brain

This is the **internal genius layer** of IDEA Brand Coach. It has **two layers**:

1. **`app-skills/` — the authoritative App Skill Architecture** (Trevor Bradford, doc ref **IDEA-APP-SKILLS-001 v1.0**, 20 Jun 2026). The *operational* skill set: **20 skills across 4 tiers**. This is the authoritative version and **supersedes all previous skill lists**. It carries operational IP not in the book (the Four Buyer States engine, the Decision Trigger™ v2.20 six-type panel, the Avatar 2.0 four-field forensic portrait, the Commercial Problem Frame, Component 0, the Design Brief Generator, and the named science tier incl. Bolte Taylor). **Start here** — see [`app-skills/00-architecture.md`](app-skills/00-architecture.md) and the machine-readable contract [`app-skills/_manifest.json`](app-skills/_manifest.json).
2. **`framework/` — the book corpus.** Trevor's book *What Captures The Heart Goes In The Cart* (2025) decomposed into an atomic, fully-traceable skill library. The app skills **cite this as source material**; it is the deeper reference the coach grounds in.

> **Note on supersession:** where the two layers differ, the app-skills layer wins. e.g. the book's Avatar 2.0 is *five* fields incl. demographics (`framework/01-customer/00-avatar-2.0/`); the app's Avatar 2.0 (Skill 04 v1.1) is a *four-field* forensic portrait with demographics moved to the Brand Context profile. The `framework/` corpus is deliberately **not** rewritten — it stays faithful to the book; the app skill records the supersession via a cross-link.

## The book corpus (`framework/`)

- **158 atomic skills** across 5 categories, every one tracing to a real passage in the book.
- **Source of truth:** [`_source/book.txt`](_source/book.txt) (full pdftotext extract, 11 chapters + front/back matter) and [`_source/book_layout.txt`](_source/book_layout.txt) (table-faithful copy for the canvas, the trigger table, and the system-prompt).
- **Traceability:** every section of the book maps to ≥1 skill and every skill cites ≥1 passage — proven in [`_coverage.md`](_coverage.md). The full section map is [`_source/_inventory.md`](_source/_inventory.md).

## How a skill is shaped
Each leaf file is **one concept or one tactic**, in this format:

```
---
chapter: <n — title>      section: <verbatim book section>
source_pages: pp. X–Y     type: concept | tactic | framework | science | reference
status: complete
---
# SKILL — <Title>
## Purpose            ← what it's for in coaching
---
<body — preserves the book's detail VERBATIM: tables, formulas, canvas boxes,
 trigger→message rows, per-stage moves, scripts, brand examples>
## Coaching Application
Related: [[other-skill]]   ← cross-links
```

**Detailed tactics are preserved word-for-word, not summarized** — the genius is in the detail (the 13-row emotional-triggers table, the IDEA Brand Canvas boxes, the 5-stage Signpost map, the risk-removal / timing / friction brand lists, the MyBrand Supplements system-prompt, the 26-work reading list).

## Structure rule
**No folder holds more than 5 children**, recursively — *within the book corpus* (`framework/`). When a topic needs more than five atomic skills, it nests a subfolder. The `app-skills/` layer follows the spec's own structure (one folder per tier) rather than this rule.

The `skills/idea/` root now holds **six** entries: `README.md`, `_state.json`, `_coverage.md`, `_source/`, `framework/` (book corpus), and **`app-skills/`** (the authoritative App Skill Architecture — a deliberate addition beyond the original five, ships with the rest via the Dockerfile `COPY skills/idea`).

## The App Skill Architecture (`app-skills/`)
- **20 skills · 4 tiers**, per `app-skills/_manifest.json` (the contract the loader + tests read).
  - **Tier 1 — Foundation (01–03):** always in context every session.
  - **Tier 2 — Diagnostic pipeline (04–08):** sequential; Skill 05 (Four Buyer States Engine, *internal*) must classify before Skills 06/09 run.
  - **Tier 3 — Output & action (09–14):** Decision Trigger, Design Brief, CAPTURE (Beta), Listing Analysis, Brand Canvas (Beta), Competitor Trust Gap (Beta).
  - **Tier 4 — Science engine (15–20):** *internal only* — never named, cited, or surfaced to the user.
- **Loader:** [`src/mcp/skills/appSkills.ts`](../../src/mcp/skills/appSkills.ts) — `loadAppSkills()`, `appSkillsByTier()`, `tier1AlwaysInContext()`, `internalOnlySkills()`, `appArchitecture()`, and `appGroundingPreamble(tool)` (appended to Alpha tool descriptions alongside the book grounding). Tested in `src/mcp/__tests__/appSkills.test.ts`.
- **Content fidelity:** skills **01–10** are authored in full from Trevor's detailed skill documents. Skills **11–20** carry the authoritative master-table purpose + tier/scope metadata and cross-link to source material; they are flagged `detailed_doc_pending` where Trevor's full skill document is still to be delivered (nothing is invented beyond the spec).
- **Hard rules** (enforced as guidance + in the grounding preamble): buyer-state names (Assessor/Protector/Expresser/Connector) and all Tier-4 sources never appear in user-facing output; no confidence scores; one Decision Trigger, never a menu; "Purchase motivation" not "Jobs-to-be-done".
- **Open item:** the master doc header says "14 Alpha · 6 Beta" but the per-skill table yields **17 Alpha / 3 Beta** — this library follows the per-skill table; see `_manifest.json → scope_note`. Confirm with Trevor.

---

## The five categories

### `framework/00-foundations/` — why brands win on trust (Intro · Ch1 · Ch2) — 46 skills
The thesis and the IDEA Framework itself.
- **`00-introduction/`** — the core thesis ("what captures the heart goes in the cart"; 95% subconscious; hearts-then-minds), the trust foundations (trust as the deciding factor; the four customer questions; hesitation the silent killer), Authentically Human Branding, and who this is for.
- **`01-ecommerce-landscape/`** (Ch1) — mistrust as the default state; the **borrowed-trust trap** (influencer→UGC with the EnTribe stats, the TikTok dilemma, the four ways to own your trust); the **Amazon landscape** (uneven playing field, compliance tools); **Amazon in the age of AI** (Rufus & Cosmo, how sellers must adapt, optimize for meaning not keywords).
- **`02-idea-framework/`** (Ch2, the largest) — overview & why trust wins (incl. the **IDEA quadrant grid** and the five trust-reasons); the science of emotional buying (Zaltman 95%, Levitt's drill/hole, the brand examples); **emotional triggers** (the **13-row triggers table**, the five messaging triggers, balancing logic & emotion); and **the four pillars** — `00-insight/`, `01-distinctiveness/` (difference vs distinctiveness, salience, DBAs), `02-empathy/`, `03-authenticity/`.

### `framework/01-customer/` — who you serve (Ch3 · Ch8) — 34 skills
- **`00-avatar-2.0/`** (Ch3) — the tool and its **five fields** (buyer intent, motivation, emotional-triggers field, shopper types, demographics); **the seven emotional triggers**; **the neuroscience of shopping** (the shopper's high, the four neurochemicals, System 1/2 biochemistry); avatar + AI.
- **`01-customer-journey/`** (Ch8) — finding value in pain; the **five stages and Signposts** (per-stage emotion→move map); **removing anxiety and risk** (habit-of-the-present, the 6-category risk-removal list); **timing and friction** (10 timing messages, 10 friction fixes, 7 anticipated barriers); positioning in the journey (passive/active/deciding modes, trade-offs).

### `framework/02-brand/` — building the brand (Ch4 · Ch5 · Ch6) — 36 skills
- **`00-authentically-human/`** (Ch4) — integrating IDEA, the **four trust strategies** (Everlane/Glossier/TOMS/Netflix), and the full **Trinny London / Match2Me** case study.
- **`01-brand-canvas/`** (Ch5) — the canvas overview, the **three canvas tables** (verbatim fill-in worksheets), and the nine statement breakdowns grouped as foundational / positioning / expression — each with its 4 Key IDEA Principles + AI prompt + sample output.
- **`02-brand-voice/`** (Ch6) — voice through the four pillars; the four elements of voice (tone/language/design + the TAG Heuer case & color psychology); aligning voice with emotional triggers.

### `framework/03-apply/` — putting it to work (Ch7 · Ch9 · Ch10) — 31 skills
- **`00-custom-gpt/`** (Ch7) — custom-GPT basics; the **IDEA AI-training workflow** (incl. the verbatim **MyBrand Supplements system-instructions template**); and the OpenAI GPT-builder walkthrough.
- **`01-product-development/`** (Ch9) — customer-centric development through each IDEA pillar, with brand examples.
- **`02-personal-brand/`** (Ch10) — personal branding through IDEA, incl. the empathy map, the UVP formula, the 3-element story, and the 5-step strategy.

### `framework/04-science-and-research/` — the evidence base (Ch11 + cross-cutting) — 11 skills
- **`00-research-guide/`** (Ch11) — the detective mindset, customer-review mining, Amazon-specific research, social listening, AI research tools.
- **`01-behavioral-science/`** — the thinkers the book actually cites, grounded only in its citations: Zaltman (95%), Kahneman (System 1/2), Cialdini (influence principles), Lindstrom (emotion over logic), and the foundational thinkers (Freud, Levitt, Drucker, Ries & Trout, Moesta).
- **`02-further-reading.md`** — the book's 26-work reading list, verbatim.

---

## Provenance & maintenance
- Built from the book by a full-read inventory pass, atomic authoring, and an adversarial completeness-critic pass (all three category critics returned PASS — zero orphan sections, zero invented skills).
- **Excluded by design** (logged in `_coverage.md`): the recurring "Book A FREE Consultation" CTA, the author bio, the TOC blurbs, and the Fair-Use/Copyright disclaimer — none carry a teachable concept.
- **Superseded seed skills:** the original `skills/01-*.md … 19-*.md` are replaced by this tree. Twelve pure duplicates were removed. The seven that contained **content not in the book** were moved into a separate paid add-on, **`skills/idea-bonus-pack/`** (`11-brand-essence-dna`, `12-agentic-commerce`, `14-kahneman`, `15-cialdini`, `17-sutherland`, `18-lindstrom`, `19-cialdini-presuasion`). This launch library is **book-only**; the bonus pack is loaded separately for customers who have it.

To extend or correct a skill, edit the file and keep its frontmatter citation honest; the matrix in `_coverage.md` is the contract.
