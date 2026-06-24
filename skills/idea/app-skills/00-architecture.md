---
doc_ref: IDEA-APP-SKILLS-001 v1.0
date: 20 June 2026
author: Trevor Bradford, IDEA Brand Consultancy (Brandvoice Retail Ltd)
supersedes: All previous skill lists and skill architecture documents. This is the authoritative version.
status: 20 skills · 4 tiers · authoritative reference
type: framework
---

# SKILL — IDEA Brand Coach App Skill Architecture

## Purpose
The authoritative architecture for the IDEA Brand Coach app's operational skills. Twenty skills, four tiers. This document supersedes all previous skill lists. Each skill file under `app-skills/` implements one entry below. This is the **app skill architecture** — distinct from, and layered on top of, the book-decomposition corpus under `../framework/` (Trevor's book *What Captures The Heart Goes In The Cart*), which the app skills cite as source material.

---

> Customers don't buy the best product. They buy the brand that feels right. There's a science to that.

## 1. The governing principle
Every skill exists to serve one purpose: helping a brand owner understand **why their customer is not buying and what to fix first**. Skills that do not serve that purpose are not in the app.

The skills are organised in four tiers. **Tier 1** is the non-negotiable foundation — in context on every session. **Tier 2** is the diagnostic pipeline — the analytical engine that runs sequentially. **Tier 3** is the output and action layer — what the user receives and acts on. **Tier 4** is the science engine — the layer that makes everything else more precise without ever being visible to the user.

**The science is the engine, not the pitch.** Tier 4 skills inform the quality of every output. They are never cited to the user, never explained in the UI, and never used to justify a recommendation in academic language.

## 2. Architecture overview

| Tier | Name | Function | Skills |
|---|---|---|---|
| 1 | Foundation | Powers everything. In context on every session. The lens through which all other skills are applied. | 01–03 |
| 2 | Diagnostic pipeline | The analytical engine. Runs in sequence; each skill feeds the next. Produces the Avatar profile, buyer state classification, and Trust Gap Score. | 04–08 |
| 3 | Output and action | Translates diagnostic findings into things the user can act on immediately. Decision Trigger, design brief, CAPTURE copy, listing analysis. | 09–14 |
| 4 | Science engine | The behavioural science and neuroscience foundation. Informs precision of all outputs. Never visible to the user. | 15–20 |

## 3. Full skill list

| # | Skill name | Tier | Scope |
|---|---|---|---|
| 01 | IDEA Framework Core | 1 — Foundation | Alpha |
| 02 | Trevor's Voice and Coaching Philosophy | 1 — Foundation | Alpha |
| 03 | Commercial Problem Frame | 1 — Foundation | Alpha |
| 04 | Avatar 2.0: Forensic Portrait | 2 — Diagnostic | Alpha |
| 05 | The Four Buyer States Engine *(internal)* | 2 — Diagnostic | Alpha |
| 06 | The Trust Gap Score | 2 — Diagnostic | Alpha |
| 07 | Review Corpus Analysis | 2 — Diagnostic | Alpha |
| 08 | Purchase Motivation | 2 — Diagnostic | Alpha |
| 09 | The Decision Trigger™ | 3 — Output | Alpha |
| 10 | The Design Brief Generator | 3 — Output | Alpha |
| 11 | CAPTURE Framework™ | 3 — Output | Beta |
| 12 | Listing Analysis | 3 — Output | Alpha |
| 13 | Brand Canvas Outputs | 3 — Output | Beta |
| 14 | Competitor Trust Gap Analysis | 3 — Output | Beta |
| 15 | Bolte Taylor: Four Buyer States Foundation *(internal)* | 4 — Science | Alpha |
| 16 | Zaltman: The Subconscious Purchase Decision *(internal)* | 4 — Science | Alpha |
| 17 | Kahneman: System 1 and System 2 *(internal)* | 4 — Science | Alpha |
| 18 | Cialdini: The Six Principles of Influence *(internal)* | 4 — Science | Alpha |
| 19 | Shotton: Behavioural Economics in Practice *(internal)* | 4 — Science | Alpha |
| 20 | Lindstrom and Sutherland: Sensory and Irrational Value *(internal)* | 4 — Science | Alpha |

> **Scope-count discrepancy (to confirm with Trevor):** the master doc header states "14 Alpha · 6 Beta", but the per-skill table above yields **17 Alpha / 3 Beta** (Beta = 11, 13, 14). This library follows the granular per-skill table. See `_manifest.json` → `scope_note`.

## 4. What is new in this version
Twelve of the twenty skills are materially changed or entirely new.

| Skill | Status vs previous | Change summary |
|---|---|---|
| 01 IDEA Framework Core | Updated | Trust Gap™ and commercial problem frame now central. Strategy language removed. |
| 03 Commercial Problem Frame | New | Entirely new skill. Did not exist in previous architecture. |
| 04 Avatar 2.0 Forensic Portrait | Rebuilt | Three-layer architecture. Four-field output. Purchase motivation replaces Job-to-be-done. |
| 05 The Four Buyer States Engine | New | The Assessor, Protector, Expresser, Connector. Invisible to user. |
| 06 The Trust Gap Score | Updated | Plain-language primary conversion problem statement added. Buyer-state cross-reference added. |
| 07 Review Corpus Analysis | New | Dedicated skill. Previously distributed across Avatar and Trigger skills. |
| 08 Purchase Motivation | New | Replaces Job-to-be-done. IP-clean. Situational framing, not demographic. |
| 09 The Decision Trigger™ | Rebuilt | Rebuilt from v2.20. Six trigger types with buyer-state cross-reference. Component 0 added. |
| 10 Design Brief Generator | New | Direct output from trigger to actionable brief. |
| 15 Bolte Taylor | New | Neuroanatomical foundation for the Four Buyer States model. |
| 19 Shotton | New | Behavioural economics validation for CAPTURE and Decision Trigger. |

## 5. Build notes — how the skills are loaded into the app's knowledge base

**5.1 Tier 1 — always in context.** Skills 01, 02, 03 must be loaded into the system prompt / injected into context on **every** session, regardless of feature. Not called on demand — always present.

**5.2 Tier 2 — sequential pipeline.** Skills 04–08 run in sequence as the Avatar 2.0 pipeline. Skill 07 (corpus) feeds Skill 04. Skill 05 (Four Buyer States Engine) runs after Skill 04 and before Skill 06; its output is **internal only** — it informs Skills 06 and 09 but never produces user-facing text directly. The pipeline must enforce this sequence: Skills 06 and 09 must not run without Skill 05 having classified the dominant buyer state.

**5.3 Tier 3 — triggered by user context.** Skills 09 and 10 are triggered by completion of the Avatar 2.0 pipeline. Skill 12 (Listing Analysis) is triggered by a listing upload. Skills 11, 13, 14 are Beta — locked features with a waitlist CTA at Alpha.

**5.4 Tier 4 — background knowledge layer.** Skills 15–20 are loaded as background knowledge. They inform reasoning quality across all Tier 2 and Tier 3 outputs but never appear in user-facing copy. No Tier 4 source is named, cited, or referenced in any output the user sees.

**Hard rule across all tiers:** the words **Assessor, Protector, Expresser, Connector** must never appear in user-facing output. The buyer-state names are internal taxonomy only. The user sees the *consequence* of the classification, not the classification itself.

## Coaching Application
Treat this document as the index and the law for the operational skill set. When grounding any coach surface or MCP tool, resolve the relevant skill numbers here, load Tier 1 always, run Tier 2 in the mandated sequence, surface only user-facing tiers, and keep Tier 4 + Skill 05 invisible. The detailed per-skill specs live in the tier folders; the machine-readable contract is `_manifest.json`.

Related: [[01-idea-framework-core]] · [[03-commercial-problem-frame]] · [[04-avatar-2.0-forensic-portrait]] · [[05-four-buyer-states-engine]] · [[09-decision-trigger]]

> Customers don't buy the best product. They buy the brand that feels right. There's a science to that.
> IDEA Brand Consultancy · Brandvoice Retail Ltd · IDEA-APP-SKILLS-001 v1.0
