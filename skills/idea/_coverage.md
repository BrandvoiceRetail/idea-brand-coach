# COVERAGE MATRIX — IDEA-book skill library

Proves traceability both directions: every book section → ≥1 skill (no orphan sections); every skill → ≥1 cited passage (no invented skills). The authoritative section map is `_source/_inventory.md`; this file is the status + mapping + decisions layer. Final 100%-both-directions certification is done by the completeness-critic pass (DONE GATE #4).

Legend: ☐ pending · ◑ in progress · ☑ written & verified.

---

## Structure decisions (≤5 rule honored literally, including root)

**The hard ≤5-children rule is enforced on EVERY folder, recursively, including the root.** To achieve this without breaking the loop spec's mandated fixed paths (`skills/idea/README.md`, `_state.json`, `_coverage.md`, `_source/`), all content categories live under a single wrapper folder `framework/`. The root therefore holds exactly **5** children: `README.md`, `_state.json`, `_coverage.md`, `_source/`, `framework/`. This is the one adjustment to the prompt's suggested layout (which placed the five categories directly at root, giving 9 root children) — made expressly to satisfy "no folder contains more than 5 children."

**Top level** (`framework/`, the 5 categories):
- `00-foundations/` — Introduction, Ch1, Ch2 (3 subfolders)
- `01-customer/` — Ch3 Avatar 2.0, Ch8 Customer Journey (2 subfolders)
- `02-brand/` — Ch4 Authentically Human, Ch5 Brand Canvas, Ch6 Brand Voice (3 subfolders)
- `03-apply/` — Ch7 Custom GPT, Ch9 Product Development, Ch10 Personal Brand (3 subfolders)
- `04-science-and-research/` — Ch11 Research Guide, behavioral science, Further Reading (3 subfolders)

Verified: `find` over the tree shows **no folder with >5 children**; max depth 6.

**Granularity rule:** one skill = one concept OR one tactic. A verbatim composite asset that is meaningless when split (the **13-row** Emotional Triggers table, the 4-column Brand Statements canvas, the 5-stage Signpost map, the risk-removal / timing / friction brand lists, the MyBrand Supplements system-prompt, the Further-Reading list) is kept as **one** skill, preserved word-for-word. Pure transitions are folded into their neighbor; recurring CTAs and bio/legal back-matter are excluded (see Exclusions).

**Inventory corrections found during authoring** (fidelity-first writers matched the book, not the inventory): the Emotional Triggers table has **13 rows, not 15**; the anticipating-barriers list has **7 brands, not 8**. The skills reproduce the book's actual counts.

---

## Coverage summary

All chapters authored and verified by the completeness-critic pass (all 3 critics PASS). Paths below are relative to `framework/`.

| Category | Chapter | Book sections | Skills | Status |
|---|---|---|---|---|
| 00-foundations | Introduction + front matter | 5 | 8 | ☑ 8/8 |
| 00-foundations | Ch1 Ecommerce Landscape | 18 | 11 | ☑ |
| 00-foundations | Ch2 IDEA Framework | 33 | 27 | ☑ |
| 01-customer | Ch3 Avatar 2.0 | 26 | 15 | ☑ |
| 01-customer | Ch8 Customer Journey | 24 | 19 | ☑ |
| 02-brand | Ch4 Authentically Human | 19 | 12 | ☑ |
| 02-brand | Ch5 Brand Canvas | 18 | 14 | ☑ |
| 02-brand | Ch6 Brand Voice | 12 | 10 | ☑ |
| 03-apply | Ch7 Custom GPT | 22 | 11 | ☑ |
| 03-apply | Ch9 Product Development | 13 | 10 | ☑ |
| 03-apply | Ch10 Personal Brand | 18 | 10 | ☑ |
| 04-science-and-research | Ch11 Research Guide | 8 | 5 | ☑ |
| 04-science-and-research | Behavioral science + Further Reading | (woven) | 6 | ☑ |
| **Total** | | **~218** | **158** | **☑ 100%** |

## Verification (DONE GATE)
1. **Coverage 100% both directions** — three adversarial completeness-critics (foundations / customer+brand / apply+science) re-read `book.txt` against the skills: **zero orphan sections, zero invented skills**. The one gap they found (the front-matter "What You'll Learn" 5-outcomes list) was closed by adding it to `00-introduction/03-who-this-is-for-and-the-trust-gap.md`.
2. **Structure** — `find` confirms no folder >5 children, root included; max depth 6.
3. **Atomicity + format + verbatim** — every file is single-concept with the frontmatter convention; all high-value verbatim assets confirmed present (quadrant grid, 13-row trigger table, 3 canvas tables + 9 element breakdowns, 5-stage Signpost map, risk-removal/timing/friction brand lists, MyBrand Supplements system-prompt, 26-work reading list).
4. **No CTA / bio / disclaimer leakage** — grep-confirmed.

---

## Section → skill mapping (forward direction)

### Introduction + front matter — ☑ COMPLETE (8 skills)
| Book section (lines) | Skill file | Type |
|---|---|---|
| Thesis (298–303) | `00-foundations/00-introduction/00-core-thesis/00-what-captures-the-heart.md` | concept |
| 95% subconscious (300–303, 321–324) | `…/00-core-thesis/01-buying-is-emotional-95-percent-subconscious.md` | science |
| Hearts-then-minds (325–327) | `…/00-core-thesis/02-capture-hearts-and-minds-in-that-order.md` | concept |
| Trust deciding factor (307–310, 360–369) | `…/01-trust-foundations/00-trust-is-the-deciding-factor.md` | concept |
| Four customer questions (412–419) | `…/01-trust-foundations/01-the-four-customer-questions.md` | tactic |
| Hesitation / without-trust symptoms (418–424) | `…/01-trust-foundations/02-hesitation-the-silent-killer.md` | concept |
| Authentically Human Branding (312–327) | `…/00-introduction/02-authentically-human-branding.md` | framework |
| Who-should-read + My-Promise symptoms (231–264, 433–446) | `…/00-introduction/03-who-this-is-for-and-the-trust-gap.md` | concept |

### Ch1 — The Evolving Ecommerce Landscape — ☑ COMPLETE (11 skills)
Dir: `00-foundations/01-ecommerce-landscape/`
| Book section (lines) | Skill file | Type |
|---|---|---|
| Chapter intro + Mistrust as the Default State (456–498) | `00-mistrust-is-the-default-state.md` | concept |
| The Shift in Consumer Trust + The Rise of Borrowed Trust (500–526) | `01-the-borrowed-trust-trap/00-the-rise-of-borrowed-trust.md` | concept |
| Why Borrowed Trust Is a Risky Strategy + Cycle of Dependency (528–608, 603–606) | `01-the-borrowed-trust-trap/01-why-borrowed-trust-is-risky.md` | concept |
| Influencer→UGC shift + Why UGC Wins + Industry Shift (547–587; stats 553–557, 569–572) | `01-the-borrowed-trust-trap/02-influencer-marketing-vs-ugc.md` | tactic |
| The TikTok Dilemma + Don't Rent Trust—Own It (610–682) | `01-the-borrowed-trust-trap/03-the-tiktok-dilemma.md` | concept |
| Four own-it moves (633–669) | `01-the-borrowed-trust-trap/04-four-ways-to-own-your-trust.md` | tactic |
| Amazon — Far from an Even Playing Field (686–701, 733–748) | `02-the-amazon-landscape/00-amazon-uneven-playing-field.md` | concept |
| Amazon safety/compliance initiatives (702–732) | `02-the-amazon-landscape/01-amazon-compliance-and-safety-tools.md` | tactic |
| Navigating Amazon in Age of AI + Rufus/Cosmo (751–774) | `03-amazon-in-the-age-of-ai/00-rufus-and-cosmo.md` | concept |
| How Sellers Must Adapt (776–807) | `03-amazon-in-the-age-of-ai/01-how-sellers-must-adapt.md` | tactic |
| Optimizing for AI + Final Thoughts (809–836) | `03-amazon-in-the-age-of-ai/02-optimize-for-ai-not-keywords.md` | tactic |

### Ch2 / Ch3 / Ch4 / Ch5 / Ch6 / Ch7 / Ch8 / Ch9 / Ch10 / Ch11 — ☐ PENDING
Per-section line ranges, pages, and verbatim assets are fully enumerated in `_source/_inventory.md`. Each chapter's forward mapping table is filled in as that chapter is authored. The inventory is the work-list; this matrix records what landed where.

---

## Reverse direction (every skill cites a passage)
Enforced structurally: every skill carries YAML frontmatter with `chapter` + `section` + `source_pages`, and quotes/preserves the cited passage in-body. The completeness-critic pass (DONE GATE #4) re-reads `book.txt` against this matrix to confirm zero uncited skills and zero orphan sections.

---

## Old seed-skill audit (skills/01-*.md … 19-*.md) — supersede, don't orphan

| Old skill | Traces to book? | Disposition |
|---|---|---|
| 01 IDEA Framework Core | ✅ Ch2 | Superseded by `00-foundations/02-idea-framework/*` |
| 02 Trevor Voice/Philosophy/Manifesto | ✅ Intro + Ch2 (thesis/AHB/voice) | Superseded by Intro skills + Ch2; "manifesto" framing folded into thesis skills |
| 03 Behavioural Science Foundations | ✅ cross-cutting (Ch2/Ch3) | Superseded by `04-science-and-research/*` |
| 04 Avatar 2.0 Five Fields | ✅ Ch3 (exact 5 fields) | Superseded by `01-customer/…avatar` |
| 05 Emotional Triggers & Shopper Psych | ✅ Ch2 table + Ch3 triggers | Superseded by Ch2 triggers-table + Ch3 trigger skills |
| 06 Customer Journey & Signposts | ✅ Ch8 | Superseded by `01-customer/…journey` |
| 07 Brand Purpose & Vision | ✅ Ch5 canvas | Superseded by Ch5 element skills |
| 08 Brand Mission & Values | ✅ Ch5 canvas | Superseded by Ch5 element skills |
| 09 Positioning & Value Prop | ✅ Ch5 canvas | Superseded by Ch5 element skills |
| 10 Brand Personality & Voice | ✅ Ch5/Ch6 | Superseded by Ch5 element + Ch6 voice skills |
| **11 Brand Essence & Brand DNA (4-circle: Attributes/Benefits/Values/Personality)** | ❌ **NOT in book** | 🚩 FLAG: invented/extra. The Brand Canvas has no Essence/DNA element or four-circle model. Not carried into the book-only tree. Trevor to decide if kept as a separate "beyond-the-book" skill. |
| **12 Agentic Commerce & AI Visibility (2026; Gemini, Walmart Sparky, ChatGPT agents)** | ◑ **PARTIAL** | Ch1 Rufus/Cosmo portion traces → folded into Ch1 AI skills. 🚩 FLAG: the 2026 agentic-commerce extension (Gemini, Walmart Sparky, "agentic" framing) is NOT in the 2025 book — out of scope for the book-only tree. |
| 13 Research Methods & Sources | ✅ Ch11 ("think like a detective" verbatim) | Superseded by `04-science-and-research/…research` |
| 14 Kahneman: Thinking Fast & Slow | ◑ PARTIAL | Book cites System 1/2 (1963–1977, 2158–2171) → science skill grounded in those citations. 🚩 exposition beyond the citation = extra, not reproduced. |
| 15 Cialdini: Influence | ◑ PARTIAL | Book cites reciprocity/social-proof/authority/scarcity → science skill from citations. 🚩 deeper exposition = extra. |
| 16 Zaltman: How Customers Think | ✅ Ch2/Ch3 (95% + metaphor elicitation) | Science skill grounded in citations. |
| **17 Sutherland: Alchemy** | ◑ **reference-only** | 🚩 FLAG: Sutherland appears ONLY in Further Reading (no in-text teaching). Becomes a reference entry, not a taught science skill. |
| 18 Lindstrom: Buyology | ◑ PARTIAL | Book cites "emotion beats logic" (1979–1997) → science skill from citation. 🚩 "sensory branding" deep detail = extra. |
| **19 Cialdini: Pre-Suasion** | ❌ **NOT in book** | 🚩 FLAG: book lists only Cialdini *Influence*; Pre-Suasion is absent. Out of scope for the book-only tree. |

**Old-skill cleanup — DONE.** 12 pure-duplicate seed skills (fully book-traceable, now superseded by `skills/idea/framework/`) were REMOVED: `01-idea-framework-core`, `02-trevor-voice-philosophy`, `03-behavioural-science`, `04-avatar-five-fields`, `05-emotional-triggers`, `06-customer-journey`, `07-brand-purpose-vision`, `08-brand-mission-values`, `09-positioning-value-prop`, `10-brand-personality-voice`, `13-research-methods`, `16-zaltman-subconscious`. (Deletions are working-tree changes, recoverable via `git checkout`.)

**7 seed skills MOVED to a separate paid add-on, `skills/idea-bonus-pack/`** (launch decision: book-only library ships first; beyond-the-book content is a purchasable bonus pack). They contain material that is NOT in the book and was deliberately not folded into the book-only tree (per the "do not silently drop non-book content" guardrail):
- `11-brand-essence-dna` — the four-circle Brand Essence/DNA model is not in the book.
- `12-agentic-commerce` — the Ch1 Rufus/Cosmo core is now in the tree; the 2026 agentic-commerce extension (Gemini, Walmart Sparky, ChatGPT agents) is beyond the 2025 book.
- `14-kahneman-system1-2`, `15-cialdini-influence`, `18-lindstrom-sensory` — their book-cited cores are now in `04-science-and-research/01-behavioral-science/`, but these files carry richer, outside-the-book exposition (deep Kahneman/Cialdini detail, Lindstrom sensory branding).
- `17-sutherland-psychologic` — Sutherland appears only in the book's Further Reading (no in-text teaching).
- `19-cialdini-presuasion` — the book cites only Cialdini's *Influence*; *Pre-Suasion* is absent.

---

## Exclusions log (book text intentionally NOT made into skills)
| Excluded | Lines | Reason |
|---|---|---|
| "Book A FREE Consultation Meeting" CTA (×~10) | 840–843, 1902–1905, 2284–2288, 2560–2563, 3109–3112, 3279–3284, 3707–3711, 4229–4232, 4519–4523, 4735–4738 | Marketing CTA, no teachable concept/tactic |
| About the Author bio | 12–77 | Credibility/marketing, no tactic |
| Table of Contents blurbs | 80–228 | Chapter summaries, not source content (real concepts live in the chapters) |
| Fair Use & Copyright Disclaimer | 4938–4956 | Legal back-matter |
| Editable-worksheet / booking URLs | various | Captured inside relevant skills as reference, not standalone skills |

These exclusions are the only book text not mapped to a skill; everything else maps. This list keeps the "no word missed" guarantee honest.
