---
skill: "12"
name: Listing Analysis
tier: 3 — Output and Action
scope: Alpha
user_facing: true
internal_only: false
always_in_context: false
trigger: Triggered by a listing upload. Primary entry point for the paid tier.
depends_on: "07, 06"
status: summary
detailed_doc_pending: true
type: framework
doc_ref: IDEA-APP-SKILLS-001 v1.0
---

# SKILL — Listing Analysis

## Purpose
How to read an Amazon listing, Shopify page, or TikTok listing **as a brand strategist**: mapping listing elements to the IDEA pillars, identifying which buyer state the current listing addresses and which it ignores, and articulating the gap. The **primary entry point for the paid tier** (triggered by a listing upload).

---

## Scope & status
- **Alpha.** Triggered by listing upload; feeds the diagnostic pipeline (Skill 07 corpus ingestion + Skill 06 enrichment) and frames the gap the Decision Trigger fixes.
- **Authoritative description** above is from the master architecture (IDEA-APP-SKILLS-001 v1.0, Tier 3). **The detailed Listing Analysis document is pending from Trevor (BrandVoice).** Author the element→pillar mapping, the per-channel reading method (Amazon vs Shopify vs TikTok), and the "which buyer state does this listing serve / ignore" articulation when delivered. Do not invent the per-element detail beyond the spec above.

## Build notes (from the Avatar2 dev brief)
- The paid tier opens with account creation + listing upload (screenshots, text, or both); this triggers the Avatar 2.0 pipeline (Avatar2 dev brief §7.1).
- Uploaded context must persist permanently against the account — never re-ask for it (§7.3, §9.2).

## Coaching Application
On upload, read the listing against the four pillars, name which buyer state it currently speaks to and which it neglects, and hand the gap to the Trust Gap Score (Skill 06) and Decision Trigger (Skill 09). Keep the read in commercial language.

Related: [[06-trust-gap-score]] · [[07-review-corpus-analysis]] · [[09-decision-trigger]] · [[14-competitor-trust-gap-analysis]]
