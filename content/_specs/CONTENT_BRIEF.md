# IDEA Brand Coach — Marketing Content Generation Brief

This brief governs three content programs: **blog posts** (`content/blog/*.md`),
**social-ad video storyboards** (`content/storyboards/*.md`), and **newsletter
emails** (`content/emails/*.md`). Every writer agent must follow it exactly.

## 1. Product truth (what you may claim)

**IDEA Brand Coach** (ideabrandcoach.com) is an AI brand coach for **Amazon-first
ecommerce brand owners**. It diagnoses why a listing/funnel isn't converting and
directs the fix. Core promise: *"You have the data. You don't have the diagnosis."*

- **IDEA framework** = **Insight-Driven, Distinctive, Empathetic, Authentic** (four
  pillars, each scored 0–100). The **Trust Gap score** identifies the weakest pillar —
  the gap between what your listing says and what your customer needs to feel.
- Free 6-question **diagnostic** at `/diagnostic` — no account, instant result.
- The coach runs live working sessions (in-app at ideabrandcoach.com and as a
  claude.ai connector) and uses **real tools** (section 3). It plans/directs creative;
  image & video **generation executes on Higgsfield** (the coach writes the plan,
  prompts, reference-kit discipline; Higgsfield renders).
- Book grounding: *What Captures the Heart Goes in the Cart* by Trevor Bradford,
  IDEA Brand Consultancy.

**Honesty rails (hard):**
- NEVER invent testimonials, named customers, or specific revenue/CVR results
  presented as real. Scenario numbers must be framed as illustrative ("say your
  CTR is 0.31%", "a founder we'll call Maya").
- Personas are composite/fictional brand owners; make that implicitly clear
  (no fake "verified" case studies).
- Only cite tools from section 3, by their exact names, doing what they actually do.
- No pricing claims, no guarantees, no "AI magic" hype. Coach = diagnosis +
  direction; the brand owner ships the fix.

## 2. Audience & voice

**Audience:** Amazon-first ecommerce brand owners (often 1–10 person teams, $10k–$500k/mo),
profitable-on-paper but leaking margin because of **low CTR** (search grid), **low CVR**
(listing), or **weak brand connection** (no repeat/retention, ad fatigue, price-race).
They have Helium10/DataDive-level data literacy but no brand diagnosis skills.

**Voice:** Trevor-style coach — direct, warm, forensic. Short sentences. Concrete.
Diagnose-then-prescribe structure. Never academic, never listicle-fluff. Speak to
"you", the founder. British-flavoured plain English is fine; no em-dash abuse, no
"in today's competitive landscape" filler, no "unlock/supercharge/game-changer".

**The narrative spine for every piece:** a brand owner has a number that looks wrong
(morning-dashboard number), the coach traces it to a **funnel position**, names the
**psychological cause** (IDEA pillar / decision trigger), and directs a **specific
fix with a named tool**, then measures the lift.

## 3. Real tool surface (cite ONLY these, exact names)

**Diagnose:** `run_trust_gap` (IDEA scorecard, finds weakest pillar), `assess_idea_dimensions`
(scores derived from evidence), `identify_decision_trigger` (the ONE psychological lever this
purchase turns on: permission, recognition, identity, belonging, momentum, fear_of_loss),
`compute_trust_gap_lift` (before/after delta), `run_diagnostic_evidence`.

**Know the customer:** `build_avatar_stage` (forensic avatar: S1 vocabulary → S2 job map →
S3 triggers → S4 objections), `create_avatar`/`update_avatar`, `ingest_evidence` (parses real
reviews & listing snapshots — including by ASIN), `bulk_ingest_evidence`.

**Funnel:** `upsert_funnel_touchpoint`, `list_funnel_inventory`, `get_funnel_coverage`
(coverage gaps), `run_funnel_audit` (per-avatar audit overlay; finds the weakest link),
`audit_asset` (one asset vs the avatar), `get_funnel_piece_metrics`, `ingest_funnel_analytics`.

**Direct the creative (the Higgsfield bridge — plans that a host executes on Higgsfield):**
- `generate_listing_image_brief` — full listing image-SET brief (main + gallery slots incl. the
  photoreal lifestyle "felt moment" slot).
- `generate_main_image_title_plan` — main image + title as ONE positioning statement;
  title formula (brand + real keyword + difference in first ~80 chars); CTR split-test plan.
- `generate_aplus_content_plan` — A+ page as one continuous 1472×3008 editorial composition,
  5 addressable beats, mobile rules.
- `generate_storefront_messaging_plan` — store hero 3000×600, brand story, signature-derived
  tagline system, job-mapped category tiles.
- `generate_video_storyboard` — scene-by-scene video plan (listing_video / social_short /
  brand_story); storyboard-image mode (ONE multi-panel storyboard image → ONE video job) or
  per-scene precision; marketing-studio preset routing for UGC/unboxing/high-motion ads.
- `generate_ugc_ad_plan` — script-level UGC ad (review / try-on / unboxing / problem-solution):
  persona cast FROM the customer avatar, 3 trigger-angled spoken hooks over one body,
  claim-gated talking points, "I thought X, but…" skeptic flip, AI-presenter disclosure rails.
- `refine_creative_plan` — the update path: surgical component edits (one scene/panel/slot)
  or positioning-change propagation across every live plan.
- Also: `generate_brief` (designer-ready brief), `generate_signature` (the distinctive line),
  `generate_positioning_moves`, `generate_concepts`, `generate_canvas`, `design_test`
  (hypothesis → structured test), `publish_filter_check`.

**Prove it worked:** `create_campaign`, `get_campaign_metrics`, `ingest_content_performance`,
`ingest_campaign_analytics`, `get_experiment_lift`, `compute_trust_gap_lift`.

**Retention:** `create_email_sequence` (welcome=5, nurture=7, abandoned_cart=3 steps),
`add_email_step`, `get_sequence_performance`.

**Higgsfield execution vocabulary** (when describing the creative handoff): `generate_image`,
`generate_video`, `upscale_image`, `outpaint_image` (e.g. store hero to 3000×600), `reframe`
(aspect change), `remove_background`, marketing-studio UGC presets. Reference-kit discipline:
product sheet from the REAL product photo; character sheets so the same face/state persists
across scenes; edit-before-regenerate.

## 4. Funnel taxonomy (use these canonical position names)

- **Awareness:** paid_social_creative, organic_social_profile, influencer_ugc,
  amazon_main_image, seo_content, founder_social
- **Consideration:** amazon_listing_copy, amazon_brand_story, shopify_pdp, brand_store_about,
  displayed_reviews, founder_content
- **Purchase decision:** cart_checkout_flow, shipping_returns_policy, trust_badges_social_proof,
  urgency_messaging
- **Retention:** order_confirmation_email, shipping_email, packaging_unboxing, insert_cards,
  welcome_series, winback_replenishment, support_voice
- **Advocacy:** review_request_flow, referral_program, ugc_repost_permissions, loyalty_community

## 5. Formats

### 5a. Blog post (`content/blog/<slug>.md`)
Frontmatter (all required unless noted; simple `key: value`, no YAML nesting):
```
---
title: <≤65 chars, keyword-bearing, specific>
description: <140–160 chars meta description>
date: <assigned in your spec — do not change>
category: <one of: Diagnose | Creative | Funnel | Customer | Retention | Measure>
funnel: <one canonical funnel position from section 4>
tools: <comma-separated exact tool names used in the piece>
keywords: <3-6 comma-separated search phrases>
slug: <assigned in your spec — do not change>
---
```
Body: 900–1,400 words. **Markdown subset ONLY**: `##`/`###` headings, paragraphs,
`**bold**`, `*italic*`, `` `code` `` (for tool names), `[link](/diagnostic)` or absolute https
links, `-` or `1.` flat lists (no nesting), `>` blockquotes, `---` rules. NO tables, NO images,
NO HTML, NO footnotes.

Structure: hook on the felt pain (the morning number) → why the usual fixes fail →
the diagnosis lens (IDEA pillar / trust gap / decision trigger) → a worked scenario with a
composite founder using named tools step-by-step (show 1-2 short "what the coach said"
moments) → the Higgsfield handoff where relevant → what to measure after → close with ONE
next action. Internal links: `/diagnostic` in every post where natural; `/blog/` optional;
2–4 sibling-post links using their assigned slugs when provided in your spec.

### 5b. Social-ad video storyboard (`content/storyboards/<slug>.md`)
Frontmatter:
```
---
title: <working title of the ad>
pain: <ctr | cvr | connection>
funnel: <canonical funnel position the ad fixes>
tool: <the ONE coach tool featured>
format: <ugc_review | ugc_tryon | ugc_unboxing | problem_solution | founder_story | product_demo>
duration: <15s | 30s>
aspect: 9:16
persona: <one-line composite brand-owner persona this ad targets>
---
```
Body sections (use `##` headings, in this order):
1. `## Strategy` — the pain point in the brand owner's words; the specific moment in THEIR
   Amazon-first funnel where the coach's tool solves the connection problem; the decision
   trigger angle of the hook.
2. `## Hook variants` — 3 spoken first-lines (one per trigger angle), labelled.
3. `## Scene-by-scene` — numbered scenes: `1. [0-3s] VISUAL: … | VO: … | TEXT ON SCREEN: …`
   (every scene has all three fields; 15s ≈ 4-5 scenes, 30s ≈ 6-8).
4. `## Production notes (Higgsfield)` — mode (storyboard-image vs per-scene vs marketing-studio
   preset), reference kit, negative-prompt/no-text rules, diegetic audio note.
5. `## CTA & measurement` — end card, destination, and which metric proves the ad worked.
The featured coach tool must appear IN the ad's story (e.g. the founder runs `run_funnel_audit`
and sees the weak link) — the ad sells the coach, not the founder's product.

### 5c. Newsletter email (`content/emails/<slug>.md`)
Frontmatter:
```
---
subject: <≤55 chars>
preview: <35–90 chars preheader>
week: <integer 1–52>
send: <a | b>            # a = first weekly send, b = optional second
theme: <one of: teardown | tool_spotlight | myth | checklist | metric_deepdive | story | seasonal>
funnel: <canonical funnel position>
tools: <comma-separated exact tool names referenced>
---
```
Body: 250–450 words. Pattern: one sharp observation → one mini-lesson tied to a funnel
position → one concrete action (often "run the free diagnostic" or one tool move) →
single CTA link (`https://ideabrandcoach.com/diagnostic` or `/blog/<slug>` when the spec
names a companion post). Same voice; write like a smart friend, not a broadcast. Sign-off:
"— The IDEA Brand Coach team". No fake urgency, no discount talk (product is in beta).

## 6. Quality bar (verifiers will check these)

1. Frontmatter parses; required keys present; assigned slug/date/week untouched.
2. Only section-3 tool names, backticked, used accurately (a director tool PLANS,
   Higgsfield RENDERS; the diagnostic is free; no invented features).
3. Funnel position named from section 4 and central to the piece (not decorative).
4. Scenario numbers framed as illustrative; zero fabricated real-world results.
5. Markdown subset only; blog 900–1,400 words; email 250–450; storyboard scenes complete.
6. No duplicate angles with sibling pieces listed in your spec; titles ≠ near-identical.
7. Voice check: would a sharp founder forward this? Cut anything that reads like AI filler.
