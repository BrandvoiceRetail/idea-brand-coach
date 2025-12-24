SOP: Brand Canvas Strategy Document Generation
Integrated with Avatar 2.0, Interactive Insight, and Brand Coach
Purpose
Build a single, reliable pipeline that turns the user’s work across the IDEA app into a client ready Brand Strategy document (Lite or Full), and also stores those insights as standalone Brand Canvas sections.
The Brand Canvas is the central strategic memory and synthesis layer of the app, not a standalone worksheet.

1. System Objective
   As the user completes the IDEA tools in the app, the system must:
   Capture outputs from:

Brand Canvas (8 steps)

Avatar 2.0

Interactive Insight Module

Brand Coach Module

Persist them in a structured way

Surface them inside the Brand Canvas as standalone sections

Use them automatically when generating:

Lite Strategy document

Full Strategy document

Result: the more the user completes, the smarter the Brand Canvas and the exported strategy become, without re-entry.

2. Single Source of Strategic Truth
   Rule
   Once an insight is saved or confirmed in any module, it becomes part of the brand’s strategic truth set and must be available to:
   Brand Canvas sections

Strategy document exports (Lite and Full)

Future downstream tools (listings, A+ content, pitch decks, education hubs)

Conflict resolution priority
When two modules disagree, Lovable resolves conflicts in this order:
Confirmed Brand Coach decisions (accepted guidance)

Avatar 2.0 confirmed insights

Interactive Insight validated patterns

Manual Brand Canvas edits (unless explicitly marked as “final”)

3. Data Capture and Storage Requirements
   3.1 Canonical Brand Profile Object
   Create a canonical object (per brand/workspace) that stores all strategic outputs.
   Minimum fields:
   brand_id

document_mode_default (lite/full, optional)

canvas_steps (8 step objects)

avatar2_outputs

interactive_insight_outputs

brand_coach_outputs

derived_canvas_sections (standalone sections created from other modules)

locks (which sections are locked by user)

audit_log (who changed what, when)

3.2 Output “Confidence” States
Every captured insight should include:
status: draft | saved | confirmed

source_module: canvas | avatar2 | insight | coach

last_updated

locked: true/false

Only saved or confirmed content can auto-populate the Brand Canvas and exports.

4. Cross Module Ingestion into Brand Canvas
   4.1 Avatar 2.0 → Brand Canvas
   Capture
   Personas (primary, secondary, tertiary)

Functional buyer intent

Emotional buyer intent

Identity based intent

Four Moments of Buyer Intent

What customers want to feel

Beliefs, barriers, motivations (as available)

Use
Auto-populate the Brand Canvas “Customer Understanding” area

Provide input to positioning, value proposition, messaging, education strategy

Create standalone Brand Canvas sections
Customer Understanding

Buyer Intent Framework

Emotional Drivers

Identity Signals

These must be visible in the Brand Canvas UI, editable (unless locked), and clearly labelled as derived from Avatar 2.0.

4.2 Interactive Insight → Brand Canvas
Capture
Buyer intent categories: informational, commercial, transactional, navigational

Search behaviour patterns

Motivational insights

Emotional triggers

Shopper type classifications

Relevant demographics

User validated summaries

Use
Enrich Avatar insights with real world behaviour

Strengthen positioning logic, value proposition, education strategy, and channel relevance (especially search led journeys)

Create standalone Brand Canvas sections
Buyer Motivation and Triggers

Search and Intent Behaviour

Emotional Trigger Map

Shopper Type Summary

These must be visible in the Brand Canvas UI, editable (unless locked), and clearly labelled as derived from Interactive Insight.

4.3 Brand Coach → Brand Canvas
Capture
User questions

AI strategic responses

Clarified decisions (accepted by user)

Messaging refinements

Strategic recommendations accepted by user

Uploaded knowledge documents (metadata and any extracted, user approved insights)

Use
Treat accepted guidance as decision-grade refinement

Override ambiguity and drive consistency across foundations, positioning, principles, and risks

Create standalone Brand Canvas sections
Strategic Decisions Log

Brand Guidance Summary

Clarified Positioning Notes

Strategic Risks and Watchouts

These must be visible in the Brand Canvas UI, editable (unless locked), and clearly labelled as derived from Brand Coach.

5. Brand Canvas 8 Step Inputs and Expansion Rules
   The Brand Canvas retains its 8 core steps. Each step must capture structured inputs and be expandable into document sections.
   Step 1: Brand Purpose
   Inputs
   Why the brand exists beyond selling

Human problem solved

Emotional outcome

Founding belief

Expansion
Produce a purpose section that states the human role and stabilising value of the brand

Step 2: Brand Vision
Inputs
Long-term impact

Category aspiration

Trust target

Expansion
Future anchor, plus how it guides decisions and credibility

Step 3: Brand Mission
Inputs
What the brand does

How it delivers purpose

Who it serves and how

Expansion
Practical execution lens, avoid repeating purpose

Step 4: Brand Values
Inputs
5 to 7 values

Meaning in practice

Do’s and don’ts

Expansion
Lived principles with “how it shows up”

Step 5: Positioning Statement
Inputs
Category

Target customer

Differentiation

Emotional benefit

Expansion
Clean statement plus strategic explanation (context, emotional advantage, white space)

Step 6: Value Proposition
Inputs
Primary benefit

Functional advantages

Emotional rewards

Why preferable

Expansion
Clear proposition plus why customers choose it, what problem it removes

Step 7: Brand Personality
Inputs
Human traits

Traits to avoid

Emotional role

Expansion
Behavioural descriptors, how the brand feels in interaction

Step 8: Brand Voice
Inputs
Tone descriptors

Language style

Communication do’s and don’ts

Expansion
Voice as a system, how it builds trust and clarity across channels

6. Strategy Document Output Structure
   Lovable generates documents in this order.
   Full Strategy document (default structure)
   Cover Page

Executive Summary

Introduction and Strategic Overview

Customer Understanding (Avatar 2.0 synthesis, enriched with Insight)

Brand Foundations (Purpose, Vision, Mission, Values, Personality, Voice)

Brand Story (if available, otherwise generate from foundations and heritage inputs)

Brand Positioning (Positioning Statement, Value Proposition, differentiation, white space)

Brand Principles

Brand Territories and Extensions (Education included if relevant)

Strategic Outcomes and Implications

Optional: Potential Shortcomings and Risks (if enabled)

This order is fixed.
Lite Strategy document (tier controlled)
Cover Page

Executive Summary (short)

Customer Snapshot (condensed Avatar synthesis)

Brand Foundations (condensed)

Positioning Statement

Value Proposition

Personality and Voice (combined)

Strategic Direction Summary

Lite removes deep dives (story, territories, principles, channel implications, risks).

7. Global Writing Rules
   Apply these rules to every document:
   Calm, senior, strategic tone

No hype language

No em dashes

Short paragraphs, clear hierarchy

Emotion and logic balanced

Written as brand truth, not marketing copy

UK English spelling and punctuation

Use bullets only where clarity improves

Apply a final harmonisation pass after section drafting.

8. Lite vs Full Toggle Implementation
   Where it lives
   On “Generate Brand Strategy”:
   Lite Strategy

Full Strategy

The toggle does not change the Brand Canvas UI, it only changes export depth and section inclusion.
What it controls
Section inclusion

Section depth

Expansion logic per section

The same underlying inputs are used in both modes.

9. Prompting Specification for Lovable
   9.1 Global system prompt (always on)
   Use the “senior strategist” system prompt with strict language rules (UK English, no em dashes, no hype, no filler).
   9.2 Mode specific system prompt
   Lite mode: concise, no frameworks, no deep dives

Full mode: deep, defensible system, connect emotional and commercial logic

9.3 Section call template (required)
Every section is generated via a deterministic call:
section_name

document_mode

structured_inputs

cross_module_insights (avatar, insight, coach, as applicable)

previous_sections_summary (short, to maintain coherence)

locks

Lovable must generate at the requested depth from the start, not summarise a longer output.

10. Assembly and Quality Pass
    Before export, Lovable runs:
    Narrative coherence pass

Remove repetition

Ensure logical flow

Align emotional language and tone

Strategic depth check

Every section answers “so what?”

No surface-level generic strategy language

Formatting pass

Headings, spacing, clean hierarchy

Render outputs

DOCX primary

PDF optional

In-app preview optional

11. Pre Export QA Checklist
    Lovable must block export unless all critical checks pass.
    Structural integrity
    Mode is consistent across all sections

Sections appear in approved order

No missing or duplicated sections

No placeholders remain

Mode fidelity
Lite: concise, no deep dives, no tables, no risks

Full: includes “why it matters”, system logic, cross references

Content integrity
No AI tell phrases

Minimal repetition across purpose, mission, vision

No invented facts or claims

All strategic truths trace back to captured inputs or confirmed module outputs

Tone and language
Calm and authoritative

UK English

No em dashes

Readable paragraphs and headings

Strategic coherence
Purpose aligns with vision

Mission aligns with positioning

Values align with principles

Territories align with positioning

Education aligns with brand role (if present)

Commercial readiness
Usable for Amazon, packaging, retail pitches, investor conversations

Founder confidence test: safe to share externally

12. Success Criteria
    This SOP is successful if:
    The Brand Canvas accumulates insight across modules with no re-entry

The exported strategy reads like a senior strategist authored it

Lite feels clear and valuable, not thin

Full feels deep and defensible, not bloated

The system consistently improves as the user progresses through the IDEA tools

Here is the developer-ready appendix you asked for, structured so your team can implement without interpretation gaps.
Appendix A: Canonical Data Objects
A1. BrandProfile (single source of truth)

{
"brand_id": "string",
"brand_name": "string",
"workspace_id": "string",
"owner_user_id": "string",
"document_mode_default": "lite|full",
"created_at": "iso8601",
"updated_at": "iso8601",

"canvas_steps": {
"purpose": { "status": "draft|saved|confirmed", "locked": false, "source": "canvas", "data": {} },
"vision": { "status": "draft|saved|confirmed", "locked": false, "source": "canvas", "data": {} },
"mission": { "status": "draft|saved|confirmed", "locked": false, "source": "canvas", "data": {} },
"values": { "status": "draft|saved|confirmed", "locked": false, "source": "canvas", "data": {} },
"positioning_statement": { "status": "draft|saved|confirmed", "locked": false, "source": "canvas", "data": {} },
"value_proposition": { "status": "draft|saved|confirmed", "locked": false, "source": "canvas", "data": {} },
"personality": { "status": "draft|saved|confirmed", "locked": false, "source": "canvas", "data": {} },
"voice": { "status": "draft|saved|confirmed", "locked": false, "source": "canvas", "data": {} }
},

"avatar2_outputs": {
"status": "draft|saved|confirmed",
"locked": false,
"source": "avatar2",
"data": {}
},

"interactive_insight_outputs": {
"status": "draft|saved|confirmed",
"locked": false,
"source": "insight",
"data": {}
},

"brand_coach_outputs": {
"status": "draft|saved|confirmed",
"locked": false,
"source": "coach",
"data": {}
},

"derived_canvas_sections": [
{
"section_id": "string",
"title": "string",
"source_module": "avatar2|insight|coach",
"status": "draft|saved|confirmed",
"locked": false,
"data": {},
"created_at": "iso8601",
"updated_at": "iso8601"
}
],

"audit_log": [
{
"event_id": "string",
"event_type": "string",
"source_module": "canvas|avatar2|insight|coach|system",
"actor_user_id": "string|null",
"timestamp": "iso8601",
"diff_summary": "string"
}
]
}

A2. Common “InsightBlock” shape (recommended)
Use one consistent structure so sections can be moved, locked, and traced.
{
"id": "string",
"label": "string",
"content": "string",
"bullets": ["string"],
"evidence": ["string"],
"tags": ["string"],
"status": "draft|saved|confirmed",
"locked": false,
"source_module": "canvas|avatar2|insight|coach",
"source_ref": "string",
"last_updated": "iso8601"
}

Appendix B: Module Event Triggers and Write Rules
B1. Avatar 2.0 Tool
Trigger events
avatar2.save

avatar2.confirm

avatar2.lock

Write rules
On save or confirm, write to brand_profile.avatar2_outputs

Generate or update derived canvas sections:

Customer Understanding

Buyer Intent Framework

Emotional Drivers

Identity Signals

Do not
Overwrite user edited Brand Canvas fields unless those fields are unedited or explicitly set to “auto-sync”.

B2. Interactive Insight Module
Trigger events
insight.save

insight.confirm

insight.lock

Write rules
On save or confirm, write to brand_profile.interactive_insight_outputs

Generate or update derived canvas sections:

Buyer Motivation and Triggers

Search and Intent Behaviour

Emotional Trigger Map

Shopper Type Summary

Do not
Store raw web scraped text. Store only summarised, user validated outputs.

B3. Brand Coach Module
Trigger events
coach.answer_saved

coach.recommendation_accepted

coach.decision_locked

coach.document_uploaded

coach.extraction_confirmed (if you do extraction)

Write rules
Accepted recommendations become confirmed and are highest priority in conflict resolution

Generate or update derived canvas sections:

Strategic Decisions Log

Brand Guidance Summary

Clarified Positioning Notes

Strategic Risks and Watchouts

Do not
Treat unaccepted AI responses as truth. Only accepted items should impact strategy generation.

B3. Brand Coach Module
Trigger events
coach.answer_saved

coach.recommendation_accepted

coach.decision_locked

coach.document_uploaded

coach.extraction_confirmed (if you do extraction)

Write rules
Accepted recommendations become confirmed and are highest priority in conflict resolution

Generate or update derived canvas sections:

Strategic Decisions Log

Brand Guidance Summary

Clarified Positioning Notes

Strategic Risks and Watchouts

Do not
Treat unaccepted AI responses as truth. Only accepted items should impact strategy generation.

Appendix C: Section Mapping Table
What feeds what in the exported Brand Strategy

Export Section
Primary Inputs
Enrichment Inputs
Notes
Executive Summary
Canvas steps 1–8
Avatar 2.0, Insight, Coach
Must reflect most “confirmed” truths
Introduction (Full)
Coach context, uploaded docs (confirmed)
Canvas Purpose/Vision
Full only
Customer Understanding
Avatar 2.0
Insight patterns
Never read like raw personas
Brand Foundations
Purpose, Vision, Mission, Values
Coach refinements
Personality and Voice included
Brand Story (Full)
Purpose, Vision, Values
Coach context, heritage inputs
Full only
Brand Positioning
Positioning Statement, Value Proposition
Insight triggers, Avatar intent
Include white space in Full
Brand Principles (Full)
Values + Coach decisions
Avatar emotional needs
Full only
Territories (Full)
Canvas territories if present
Insight patterns, Coach guidance
Education expansion lives here
Outcomes
Vision + Positioning
Coach decisions
Must be commercially usable
Risks (Optional, Full)
Coach “watchouts”
Compliance notes
Only if enabled

Appendix D: Standalone Brand Canvas Section Taxonomy
These should appear in the Brand Canvas UI with source labels.
Derived from Avatar 2.0
Customer Understanding

Buyer Intent Framework

Emotional Drivers

Identity Signals

Derived from Interactive Insight
Buyer Motivation and Triggers

Search and Intent Behaviour

Emotional Trigger Map

Shopper Type Summary

Derived from Brand Coach
Strategic Decisions Log

Brand Guidance Summary

Clarified Positioning Notes

Strategic Risks and Watchouts

Appendix E: Strategy Generation Payload (what Lovable receives)
This is the recommended shape for each section generation call.
{
"brand_id": "string",
"document_mode": "lite|full",
"section_name": "string",
"section_order_index": 1,
"inputs": {
"canvas_steps": {},
"derived_canvas_sections": [],
"avatar2_outputs": {},
"interactive_insight_outputs": {},
"brand_coach_outputs": {}
},
"locks": {
"locked_sections": ["string"],
"locked_fields": ["string"]
},
"conflict_resolution": {
"priority_order": ["coach", "avatar2", "insight", "canvas"],
"resolution_log": []
},
"previous_sections_summary": "string"
}

Appendix F: Auto-Sync vs Manual Override (recommended UX rule)
Each derived section gets a simple control:
Auto-sync: ON (default)

Auto-sync: OFF (user edits take precedence)

Lock: prevents any overwrite

This prevents frustration and protects consultant grade output integrity.

If you want next, I can add a final appendix with: exact Lite vs Full section inclusion arrays, plus a “block export” error catalogue mapping QA failures to developer-friendly error codes and user-facing messages.
