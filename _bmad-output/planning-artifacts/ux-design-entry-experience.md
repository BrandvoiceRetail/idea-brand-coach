---
stepsCompleted: [1, 2, 3, 4, 5]
status: build-ready (steps 6–11 design-system / components / interaction / accessibility consolidated into the Visual & Interaction Language, Build-Ready, and Design System & Accessibility sections)
inputDocuments:
  - "AGENTS.md + docs/architecture/STORE_AND_RESURFACE.md — GOVERNING rule: every user input is persisted to a durable RLS-scoped table the moment it's given AND resurfaced where useful (tool/workflow, app UI prefill, MCP panels). Directly underwrites this redesign's 'never re-ask, resurface what's known' spine."
  - "Slack: IDEA_Entry_Experience_Brief_v1.1.docx (IDEA-APP-ENTRY-001 v1.1, Trevor Bradford) — GOVERNING brief + 10 acceptance criteria (full text extracted into §Governing Inputs below)"
  - "docs/mcp/ONBOARDING_VOICE_TREVOR.md — Trevor's voice doctrine (three movements, Recognition-before-extraction, 'Trevor Bradford scaled')"
  - "docs/v4/ONBOARDING_FLOW_REPORT.md — current signup→CHOICE→connector→/v4 journey + gating"
  - "src/pages/v2/ProblemSolverDiagnostic.tsx (+ src/components/v2/problem-solver/*) — the current 8-screen diagnostic + RecognitionScreen (Movement 1)"
  - "src/pages/v4/V4Diagnose.tsx, V4OnboardingChoice.tsx, V4ConnectorSetup.tsx, V4Onboarding.tsx, components/v4/V4Layout.tsx — current /v4 entry + spine shell"
  - "_bmad-output/planning-artifacts/ux-design-fix-navigation.md — prior shipped spec (Fix-stage breadcrumb), sibling to this work"
  - "Slack: IDEA_Foundational_Strategy_Document_v1.0.docx (Trevor) — positioning bedrock: what the product is (35yrs practice × Harvard neuroscience), why it exists, differentiation; 'Customers don't buy the best product. They buy the brand that feels right. There's a science to that.' Governs positioning; the entry experience honours it but resequences per the Empathetic gap."
---

# UX Design Specification — idea-brand-coach · Entry Experience + Diagnose Flow

**Author:** Matthew (facilitated by Sally, UX Designer)
**Date:** 2026-06-28

**Scope:** Review the whole entry → diagnose flow start to finish and simplify it to deliver the
entry experience Trevor specified (IDEA-APP-ENTRY-001 v1.1), incorporating the evolutions since
(the /v4 spine surface, MCP onboarding, the connector path). Staged so **Movement 1 is specified
and reviewed first** per Trevor's gate (AC#7) before Movements 2 & 3 are detailed.

In-flight goals folded into this design:
- The Diagnose tab should route an already-diagnosed / already-onboarded user straight to **Fix**
  (no wizard restart) — "Route onward to the Fix tab" decision.
- Remove the doubled chrome (inner stepper + nested card) so the stage is one elegant on-brand surface.

---

## Governing Inputs (source-of-truth, not generated design)

### Trevor's three movements (sequence is non-negotiable; word count is not)
1. **Recognition** — mirror the customer's own experience; no product, no framework, no "Trust Gap" word. Feel seen first (Protector state). Mobile: gap not mentioned until after ≤2 scrolls at 375px.
2. **Diagnosis** — describe the mechanism in plain language, show it explains the experience, *then* name "Trust Gap" (name comes after the description, never before).
3. **Prescription** — product as the specific answer; *then* credentials (35 years + Harvard neuroscience) as the reason to trust the answer; CTA **"Find my Trust Gap"**. Governing descriptor appears in nav sub-label, footer, and after the CTA: *"The IDEA Brand Coach reads what your customer's brain is deciding about your brand and keeps you one step ahead of the gap."*

### The product's own diagnostic (why this brief exists)
Trust Gap **54/100**, primary gap **Empathetic 8/25**, Decision Trigger **Recognition** — the product
led with evidence before making its own customer feel understood. This entry redesign is the fix.

### The 10 Acceptance Criteria (verbatim, IDEA-APP-ENTRY-001 v1.1 §8)
1. Movement 1 (Recognition) contains no product references, no framework vocabulary, and no Trust Gap terminology. Entirely about the customer's experience.
2. The Trust Gap is named for the first time in Movement 2, after it has been described in plain language, not before.
3. The credentials (35 years, Harvard neuroscience) appear inside Movement 3, after the product has been introduced, not before it.
4. The diagnostic instruction above the four questions reads: "Look at your listing as a first-time shopper would. Score what you actually see, not what you intended to show."
5. The results screen shows the Component 0 statement as the largest, most prominent element, above the Trust Gap Score and pillar breakdown.
6. The Brand Defence loop appears on the results screen below the upgrade prompt, with the single contextual line specified in §6.
7. Show the three movements to Trevor on the updated demo before any further build. Confirm the recognition moment in Movement 1 produces: "that is exactly where I am."
8. No CAPTURE element names appear anywhere in the entry experience or results screen.
9. No buyer-state names (Assessor, Protector, Expresser, Connector) appear in any user-facing element.
10. Entry CTA reads "Find my Trust Gap"; results CTA reads "Upload my listing and find the fix". No other CTA copy is acceptable.

### What does NOT change (brief §7)
The four diagnostic questions (Fix 1), the agentic run screen (S4), the Avatar profile (S5), the
warranty claim gate + design brief (S6), the Dove anchor + CAPTURE removal, the memory promise
(S3/S8). Screens 3→8 remain as built. This brief changes the **entry experience** and the
**results-screen sequence** only.

### Current-state gap (audit)
Only **Movement 1 (RecognitionScreen)** was built; Movements 2 & 3 were never built (the flow jumps
Recognition → 4 questions). The results-screen resequence (AC#5), loop-on-results (AC#6), and
instruction reframe (AC#4) are not implemented. The /v4 Diagnose stage embeds the diagnostic with
doubled chrome (its own stepper + BrandBar + nested card under the v4 spine stepper) — the "janky"
whitespace/inner-tabs feel. The /v4 authed entry (CHOICE fork → connector/megaprompt) extracts before
it recognises — the same Empathetic-gap inversion, now on the authed surface.

---

## Executive Summary

### Project Vision
Deliver the entry experience Trevor specified (IDEA-APP-ENTRY-001 v1.1): a strict
Recognition → Diagnosis → Prescription sequence that earns the right to be heard
before the product speaks, flowing into the free Trust-Gap diagnostic and a
finding-first results screen — and unify it with the authed /v4 spine so a brand
owner meets ONE coherent "Trevor Bradford, scaled" experience, not three bolted-on
flows. Governing line everywhere: "reads what your customer's brain is deciding
about your brand and keeps you one step ahead of the gap."

### Target Users
The Protector-state founder: has worked hard on the right problem, watched the
number stay wrong, been burned by past fixes. Sceptical, mobile-first, time-poor.
Converts only after recognition — credentials land last, as confirmation, never as
the opening claim.

### Key Design Challenges
1. Sequence is fragile: reversing or merging the three movements destroys the
   effect — yet Movements 2 & 3 were never built (flow jumps Recognition → questions).
2. Two surfaces, one feeling: the public entry/diagnostic arc and the authed /v4
   spine (CHOICE fork → connector/megaprompt) must read as one experience; today
   the /v4 entry extracts before it recognises (the same Empathetic inversion).
3. Doubled chrome on /v4/diagnose (inner stepper + nested card under the spine
   stepper) breaks the elegance and the "one surface" feel.
4. Mobile-first hard constraint: Movement 1 must reach the gap in ≤2 scrolls at 375px.
5. Returning / already-onboarded users must skip the wizard and land on Fix.
6. Store-and-resurface (governing AGENTS rule): every input the entry/diagnostic
   collects must persist to a durable RLS-scoped table and resurface — so the
   diagnosis is data-aware and the coach never re-asks across surfaces.

### Design Opportunities
1. The "how does it know that about my brand?" moment (Component 0, made the
   largest element) — the single highest-leverage trust event; reusable across surfaces.
2. "Trevor Bradford, scaled" voice as the moat no competitor can copy — direct,
   specific, no hedging, at every step.
3. Data-aware Diagnosis: reuse what MCP onboarding/avatar already knows (per
   store-and-resurface) so the coach never re-asks — turning the Empathetic fix
   into a reason to come back.

---

## Core User Experience

### Defining Experience
One continuous Recognition → Diagnosis → Prescription arc that turns a sceptical, tired founder
into someone who *wants* the diagnostic, then delivers a finding so specific it reads as "you've
seen my brand." The core action is not "fill in a form"; it is "be shown the truth about my
listing, one move at a time."

### Platform Strategy
Mobile-first, 375px the design target (the founder checks numbers on a phone) — Movement 1 reaches
the gap in ≤2 scrolls; desktop is the second layout, not the primary. The experience lives natively
inside the authed /v4 dark (v23 black/gold) shell as ONE surface — no nested card, no second stepper.
Public (pre-auth) and authed (/v4) renders share the same movement components and voice.

### Effortless Interactions
- Recognition lands with zero input — never a form or "give me your brand" first.
- Diagnosis is data-aware: it resurfaces what's already known (MCP onboarding, avatar, prior
  diagnostic — per store-and-resurface) and asks for at most the ONE highest-leverage missing thing.
- A returning / already-onboarded user is advanced past what's done — often straight to their Fix.
- Every captured input persists immediately and reappears wherever it's useful.

### Critical Success Moments
1. Movement 1 recognition: "that is exactly where I am." (Trevor's AC#7 — the gate.)
2. Results Component 0: "how does it know that about my brand?" (finding before score.)
3. The two CTAs convert: "Find my Trust Gap" → "Upload my listing and find the fix."

### Experience Principles
1. Recognition before extraction — earn the right to be heard.
2. Mechanism first, name second — describe the gap, then call it "Trust Gap."
3. Credentials last — confirmation of a predisposition, never the opening claim.
4. One surface, one voice — direct, specific, no hedging ("Trevor Bradford, scaled").
5. Never re-ask — resurface what's known; advance, don't restart.
6. Mobile-first — ≤2 scrolls to the gap; trim copy, never the movement.
7. Finding before number — Component 0 is the largest element on results.

---

## Desired Emotional Response

### Primary Emotional Goals
The one feeling that must land: **"this product has seen people in exactly my position."** Recognition →
the guard drops. Then **relief** (someone finally named what's wrong) and **earned trust** (not sold to).
End state: **confident clarity** — "I know the one thing to fix." Differentiator: every other tool makes
the founder feel *processed/managed*; this makes them feel *understood, then equipped*.

### Emotional Journey Mapping
- Arrival (Protector state): wary, tired, sceptical, braced for another generic tool.
- Movement 1 Recognition: seen → guard drops ("that's exactly me").
- Movement 2 Diagnosis: relief + dawning understanding ("so that's why").
- Movement 3 Prescription: trust — credentials confirm, don't sell → readiness.
- Diagnostic: in control, observing — not being judged.
- Results (Component 0): the jolt — "how does it know that about my brand?" → belief.
- Returning: anticipation — the gap moves, the engine finds it; coming back = staying ahead.
- When data is missing: honesty not friction ("—", ask one thing) → trust held.

### Micro-Emotions
Critical: Trust over Scepticism (the whole game) · Recognition/Belonging over Isolation · Confidence over
Confusion · Relief over Anxiety · Accomplishment at the one fix. Avoid: feeling sold to, processed, judged,
or buried under a menu.

### Design Implications
- Feel seen → lead with the mirror; zero input first; cinematic image of their situation.
- Trust not sold → credentials last; honest "—", never invented numbers; hold the finding under pressure.
- Confidence not overwhelm → one question at a time; ONE fix, no menu of fifty.
- The jolt → Component 0 the largest element, specific to their brand.
- Calm & premium → dark liquid glass, generous space, subtle (not flashy) motion.
- Returning anticipation → the Defence loop framed as staying ahead, not redoing.

### Emotional Design Principles
1. Earn the right to be heard before saying anything (recognition first).
2. Specific beats generic — specificity produces "how does it know?"
3. Honesty sustains trust — never fabricate; say what you can't see.
4. One thing, not many — confidence comes from focus.
5. Warm but not soft — the finding stays honest even when unflattering.

---

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis
- **Mango "liquid glass" dashboard** (`~/Downloads/dashboard.html`) — translucent surfaces, ambient
  light, restraint, micro-physics. Lesson: premium = light + restraint, not ornament.
- **Trevor's v27 cinematic IDEA site** — full-bleed emotional image (the chasm), bold sans, one big
  claim. Lesson: the image does the recognition; lead with one image + one sentence.
- **Linear / Apple dark product pages** — calm dark canvas, generous space, one accent, subtle motion.
  Lesson: confidence through reduction.
- **Typeform / Cal.com focused flows** — one question at a time, progress hairline. Lesson: lower
  cognitive load → confidence.

### Transferable UX Patterns
- One-question-at-a-time → the 4 diagnostic questions. · Full-bleed emotional hero → Recognition.
- Glass cards over ambient light → all panels. · Finding-as-headline → Component 0 largest.
- Progress hairline + micro-physics → calm forward motion.

### Anti-Patterns to Avoid
- Multi-field forms up front (kills recognition — the old "give me your brand" wall).
- Score-first results (number before meaning) — reversed by Component-0-first.
- A menu of recommendations (overwhelm) — ONE fix.
- Doubled chrome / nested steppers (the /v4 jank). · Flashy motion / a second accent hue.
- Inventing data to fill blanks — honest "—".

### Design Inspiration Strategy
- **Adopt:** glass + ambient (Mango), cinematic hero (Trevor), one-question flow (Typeform), finding-first.
- **Adapt:** Mango's *light* glass → our *dark* register; Trevor's bold sans → shared across app + site.
- **Avoid:** forms-first, score-first, menus, doubled chrome, a second hue.

---

## Visual & Interaction Language — "Dark Liquid Glass"

**Intent (Matthew, 2026-06-28):** the Trust Gap diagnostic must feel *high-tech, high-quality,
translucent, modern, and simple* — to the fidelity of `~/Downloads/dashboard.html` (the Mango
"K-beauty light + liquid glass" system), but in Trevor's **dark v23** register.

### What we take from the reference (the craft, not the palette)
1. **Real glass:** translucent surfaces under `backdrop-filter: blur() saturate()`, an `inset` top-edge
   light highlight, and a diagonal specular `.sheen` — lit glass, never a flat card.
2. **Ambient depth:** soft blurred light-blobs fixed behind everything so the glass refracts something
   luminous (the page feels lit from within).
3. **Restraint = quality:** one type system (a display serif for *moments* + a clean body face), one
   accent, large radii (22–30px), generous air, hairline borders, few elements per view.
4. **Micro-physics:** `translateY(-3px)` hover lift, `cubic-bezier(.22,.8,.3,1)` easing, a `viewIn`
   fade-rise on view change, `prefers-reduced-motion` honoured, real `:focus-visible`.

### The translation to dark v23 (SSOT palette: blk #111111 · wrm #F5F4F0 · gld #D4960A · gld-lt #FEF5DC)
| Light reference | Dark v23 Trust Gap |
|---|---|
| white translucent gradient | `rgba(20,18,14,.55)` over `blur(28px) saturate(160%)` |
| warm cream colour-blobs | low **gold glow**: radial `gld @ .12` behind the active panel |
| white .66 borders | hairline `rgba(255,255,255,.10)` + `inset 0 1px 0` gold-tinted top-edge |
| amber specular sheen | warm-gold sheen `@ .08`, `mix-blend-mode: screen` |
| mango soft shadow | deep black drop + faint gold bloom `0 0 60px rgba(212,150,10,.18)` |

Implementation note: introduce a small reusable **dark-glass utility** (`.glass-dark` / `.glass-dark-strong`
+ `.sheen`) in the v4 surface rather than ad-hoc `backdrop-blur` (today only a few components blur ad-hoc;
no shared liquid-glass primitive exists). Reuse the existing v23 semantic tokens (`bg-foreground`,
`text-background/NN`, `text-gold-warm`, `bg-gold-light`). Provide a non-blur fallback (solid dark surface)
for browsers without `backdrop-filter` and a reduced-transparency path for accessibility.

### Simplicity applied to the three movements (one screen, one job)
- **Movement 1 (Recognition):** the mirror sentence(s) on glass, floating over the gold-lit dark — no
  nav, no card chrome, no product. The image (Movement 1 visual brief) sits behind the glass as the
  ambient luminance. Mobile: gap unmentioned for ≤2 scrolls (AC#1, AC#7).
- **The four questions:** ONE glass panel, ONE question visible at a time, a slim gold progress hairline;
  instruction is AC#4 verbatim. Observation, not a form.
- **Results (Component 0):** the Component 0 statement is the hero — large, display serif, faintly gold-glowing
  on the strongest glass; the Trust Gap Score + pillar breakdown recede as quiet secondary glass *below* it
  (AC#5). The Brand Defence loop sits lower still as a calm diagram (AC#6).

### Guardrails (locked with Matthew on the mock, 2026-06-29)
- **Wet glass over glow.** Direction is *polished dark "liquid glass"* — crisp diagonal specular streak +
  glossy top reflection + bright cool edge-highlight, base a cool near-black. Gold is a *whisper* of
  ambient glow, never a heavy bloom. (Tuned down from the first pass.)
- **Dim text must read.** Secondary/"grey" copy over dark glass sits at ≥0.85 (body) / ≥0.64 (labels)
  opacity of the warm ink — visibly contrasting, AA+; the first pass at .66/.42 was too low.
- **UK English everywhere** (Trevor Skill 02 red-line): "sceptical", "Analyse", "Defence", "recognised",
  "behaviour". Applies to mock + spec + the live build.
- One accent (gold). No second hue. Motion is subtle and physical, never decorative.
- This is a *visual* layer over the movement structure — it never reorders or merges the movements
  (AC#1–3 sequencing is untouched by styling).

### Cinematic hero + the chasm asset (added 2026-06-29)
- The entry hero **combines the cliff-chasm image** (lone figure on a dark cliff facing a gold-lit far
  edge = the Trust Gap made literal) with a **liquid-glass headline panel** floating over it. Source =
  Trevor's v27 "exact image home"; the **cliff** variant is the chosen one (Matthew, over the doorway
  variant). Clean asset pending from Trevor; working stand-in = screenshot crop `idea-cliff-hero.jpg`.
- **Emotional connection before the jump** (Matthew's feedback, Slack 2026-06-26): never ask the customer
  to *cross the gap* (CTA / diagnostic / purchase) before the hero has shown the gap and built recognition.
  The hero says it outright: *"…the gap is where the sale is lost — and we won't ask you to cross it
  without first showing you exactly where it is."* This is Recognition-first, expressed visually.
- The same cliff image backs **Movement 1 (Recognition)** in the diagnostic — fades in behind the glass
  mirror, fades out into Diagnosis.

### Typeface decision (2026-06-29, pending final confirm)
- **Bold sans (Inter) — matches Trevor's live site.** Headlines Inter 800, tight tracking, gold-italic
  accent word ("…the way *it should.*"). The earlier Fraunces serif is **retired** so app + marketing
  site read as one family — Trevor: *"the website and app UI [must] be consistent… It's a trust signal."*

### Working prototypes (open in a browser)
- `trust-gap-diagnostic-mock.html` — the spec mock: diagnostic in dark liquid glass + cinematic
  Recognition; doubles as the **AC#7 demo** for Trevor.
- `landing-cinematic-glass.html` — redesigned landing: cinematic chasm hero + glass + bold sans.
- `landing-darkglass.html`, `trust-gap-diagnostic-mock-landingstyle.html` — earlier exploration variants.
- `idea-cliff-hero.jpg` — hero image (screenshot-crop stand-in until Trevor's clean asset arrives).

<!-- Steps 03+ append core experience, IA, movement specs, results-screen spec, and /v4 integration. Movement 1 is specified first for Trevor's AC#7 sign-off. -->

---

## Build-Ready Specification (for the single implementation build)

This is the scoped work for the one coherent build that lands after Trevor's Movement-1 sign-off (AC#7).

### A. Information architecture — one Recognition-led arc
- **Public (pre-auth)** front door = the cinematic Recognition hero → **Movement 2 Diagnosis** →
  **Movement 3 Prescription** (credentials last; CTA "Find my Trust Gap") → the **4-question diagnostic**
  → **results** (Component 0 → score → Defence loop → "Upload my listing and find the fix").
- **Authed `/v4`** first-run lands on the **same Recognition-led arc**, NOT the CHOICE fork. The connector
  becomes a **quiet in-context enabler** offered inside Diagnosis/Prescription ("want me to pull your
  analytics? add the coach in Claude"), never a gateway the user must clear first.
- `/v4/diagnose` stage = the embedded diagnostic, **de-chromed**: drop the inner `Stepper` + `BrandBar`
  + nested warm card; render as ONE surface under the v4 spine stepper (fixes the "janky" doubled chrome).

### B. Diagnose → Fix routing (the deferred goal — precise spec)
On entering `/v4/diagnose`, compute `alreadyDiagnosed` from **durable, RLS-scoped** sources (store-and-resurface;
never transient state):
- a saved diagnostic submission/result for the **active avatar**, OR
- an MCP-built avatar that already carries a **Trust Gap score and/or Decision Trigger**.

Behaviour:
- `alreadyDiagnosed === true` → render a **recap card** instead of restarting the wizard:
  "You've already diagnosed — ✓ Trust Gap scored · ✓ primary trigger identified" + primary CTA
  **"Continue to Fix"** → `navigate(V4_ROUTES.FIX)`; secondary link "Re-run the diagnostic" re-enters the flow.
- `alreadyDiagnosed === false` → render the Recognition-led arc (A).
- Loading state while the durable read resolves (avoid the avatar-hydration race seen in autofill —
  wait for `currentAvatar` before deciding).

**✅ IMPLEMENTED 2026-06-29** — `src/pages/v4/V4Diagnose.tsx` reads the latest persisted diagnostic
(`diagnosticService.getLatestDiagnostic(selectedAvatarId)`); when a Trust Gap score exists it renders a
recap (Trust Gap score + widest pillar) with **Continue to Fix → `/v4/fix`** and a "Re-run the diagnostic"
escape, holding a placeholder until avatar + query hydration settle (no flash). Events
`v4_diagnose_already_done` / `_skip_to_fix` / `_rerun`. Tests:
`src/pages/v4/__tests__/V4Diagnose.nav.test.tsx` (3, green); tsc + eslint clean. **Not deployed** (gated to Matthew).

### C. Results-screen resequence (in-app diagnostic) — AC#4/5/6
- Instruction above the 4 questions, verbatim (AC#4): *"Look at your listing as a first-time shopper
  would. Score what you actually see, not what you intended to show."*
- Results order (AC#5): **Component 0 statement (largest)** → Trust Gap Score + pillar breakdown →
  Defence loop + its one line (AC#6) → CTA **"Upload my listing and find the fix"** (AC#10).
- Forensic report persistence: the **Trust Gap score is already persisted** (`diagnostic_submissions`,
  per-avatar) and is what powers the §B detection. Only the forensic/Decision-Trigger detail is still
  in-memory — fine, the score alone proves "already diagnosed".

### D. Visual application
Apply the locked **dark liquid glass + cinematic** language (see Visual & Interaction Language): cliff
hero on Recognition, glass panels, bold sans (Inter), gold accent, UK English. Introduce a shared
`.glass-dark` utility rather than ad-hoc blur.

### E. Acceptance-criteria → implementation map
| AC | Where it's satisfied |
|----|----------------------|
| 1 Recognition pure | `RecognitionScreen` (cinematic) — no product/framework/Trust-Gap words |
| 2 name after describe | new **Movement 2** component (mechanism → then "Trust Gap") |
| 3 credentials last | new **Movement 3** component (product → then 35yrs/Harvard → CTA) |
| 4 instruction copy | `ProblemSolverDiagnostic` step-1 instruction string |
| 5 Component 0 largest | results screen resequence (FixScreen/results) |
| 6 loop on results | results screen — Defence loop block + line |
| 7 Trevor sign-off | the mock `trust-gap-diagnostic-mock.html` is the demo artifact |
| 8 no CAPTURE names | copy review + existing terminology guard |
| 9 no buyer-state names | copy review + terminology guard |
| 10 CTA copy | entry CTA "Find my Trust Gap"; results CTA "Upload my listing and find the fix" |

### F. File touch-list (single build)
- `src/pages/v4/V4Diagnose.tsx` — routing guard (B) + de-chrome embed.
- `src/pages/v2/ProblemSolverDiagnostic.tsx` — one-surface embedded mode, results resequence, AC#4 copy,
  persist result.
- `src/components/v2/problem-solver/RecognitionScreen.tsx` — cinematic Recognition (hero image + glass).
- **new** Movement 2 / Movement 3 components (Diagnosis, Prescription) between Recognition and the questions.
- `/v4` entry (VersionGate / V4OnboardingChoice) — Recognition-first; connector demoted to in-context.
- shared `.glass-dark` utility (index.css / a small component).
- tests: routing guard (already-diagnosed → Fix), movement sequencing, results order, ACs.
- asset: swap `idea-cliff-hero.jpg` for Trevor's hi-res clean file when it lands.

---

## Design System, Components & Accessibility (consolidates workflow steps 6–11)

### Design system
- **No new framework / no new dependency.** Extend the existing v23 token set (`--gold-warm`,
  `--gld-lt`, `bg-foreground`, `text-background/NN`) and shadcn-ui primitives. Add ONE shared
  **`.glass-dark` / `.glass-dark-strong` + `.sheen`** utility (the dark-liquid-glass primitive) so blur
  is not re-implemented ad hoc.
- **Type:** Inter — 800 for headlines (tight tracking), gold-italic accent word; Inter body. Serif retired.
- **Colour:** dark canvas (`#0B0B0B/#111`), one accent (gold `#D4960A`); IDEA-dimension hues
  (I/D/E/A) used ONLY in the framework/score context, never elsewhere.
- **Motion:** subtle, physical — `viewIn` fade-rise, hover lift, `cubic-bezier(.22,.8,.3,1)`; never flashy.

### Component inventory (reusable)
`GlassPanel` (+ strong/sheen) · `GoldButton` / `GhostButton` · `Pill` (live/roadmap) · `MovementShell`
(Recognition/Diagnosis/Prescription) · `CinematicHero` (image + glass copy) · `QuestionScale` (1–5,
one-at-a-time, gold progress hairline) · `Component0Hero` · `ScorePillars` · `DefenceLoop` ·
`RecapCard` (already-diagnosed → Continue to Fix).

### Accessibility & responsiveness
- **Contrast:** body text on glass ≥ AA; dim text floor 0.85 / labels 0.64 opacity (locked); gold is
  accent/glow, never body text on dark.
- **Motion/transparency:** honour `prefers-reduced-motion` (disable animations) and provide a
  reduced-transparency / non-`backdrop-filter` fallback (solid dark surface).
- **Keyboard & focus:** the 1–5 scale is a radiogroup (arrow-key navigable); visible `:focus-visible`
  ring (gold); all CTAs reachable and labelled; image is decorative (`aria-hidden`).
- **Responsive:** mobile-first at 375px; Movement 1 reaches the gap in ≤2 scrolls; split hero collapses
  to image-behind-glass on ≤860px; tap targets ≥44px.
- **Copy discipline:** UK English; no CAPTURE names; no buyer-state names in any user-facing element
  (AC#8/9), enforced by the existing terminology guard.

---

## Spec status
**Build-ready.** Movements + sequence (AC#1–3, 10), diagnostic + results resequence (AC#4–6), visual
language, emotional design, IA, routing (diagnose→Fix), component inventory, accessibility, and the
AC→file map are all specified. **Gate before build:** Trevor's Movement-1 sign-off (AC#7) using
`trust-gap-diagnostic-mock.html`. **Pending asset:** Trevor's hi-res clean cliff image.

---

## How this fits the whole app

This entry experience is not a standalone funnel — it is the **front of the product spine** and the
layer that unifies the app's five surfaces.

### The five surfaces it threads
Marketing site · free Trust-Gap diagnostic · authed **/v4 spine** · **MCP connector coach**
(Claude/ChatGPT) · in-app chat. Today they have drifted (different looks, 3 overlapping "diagnose"
engines, duplicated context stores). The redesign threads them with:
- **One concept** — the *Trust Gap* (score + Decision Trigger) is the object on every surface.
- **One arc** — Recognition → Diagnosis → Prescription, whichever door the user enters.
- **One look** — dark liquid glass + cinematic + bold sans, site *and* app ("a trust signal").

### It feeds the spine (the actual product)
Diagnose → Analyse → Fix → Re-measure → **Defend** is the product and the reason to return. The entry
experience is the **on-ramp**: the diagnostic result *is* the entry into Fix. The landing's loop diagram,
the results-screen loop, and the /v4 spine nav are the **same five stages** at different fidelities.

### The data backbone (the deep tie-in)
*Store-and-resurface*: what the **MCP connector onboarding** gathers (avatar, Trust Gap, Decision
Trigger) is the same durable, RLS-scoped data the **/v4 app** reads. That is exactly why the
**diagnose→Fix routing** exists — the app recognises work the user did in Claude and advances them
("one product, many doors"). Without the backbone, every surface re-asks and they feel like separate tools.

### Commercial funnel
Free diagnostic (score) → paid forensic fix (upload listing) → ongoing Defence loop (return /
subscription). The entry experience is the top of that funnel; the spine is what's monetised.

### Caveat to hold
On the MCP connector the final words are composed by host-Claude, so "one experience" there is enforced
via shared skills + deterministic tool outputs (Trust Gap, Decision Trigger) — **steered, not authored**
(coach-surface-parity ADR). The app and site are where the voice is fully baked.

---

## Live New-User Walkthrough — Findings (2026-06-29, prod)

**Method:** cognitive walkthrough of the live prod app. Logged-out new-user state verified via a clean
cloud browser (the `/auth` wall); the post-auth path walked in a logged-in Playwright session (account
"KE"). Every step below was observed on `ideabrandcoach.icodemybusiness.com`, not inferred.

### The accessible path a new user actually hits
```
Landing (/)  ──"Start the diagnostic"──▶  /v3/diagnostic  ──▶  🔒 /auth WALL  (new user stops here)
                                                              │ (past the wall / logged in:)
   Recognition screen ▶ "Show me why" ▶ 4-question self-assessment ▶ SCORE-first results ▶ £97 paywall
   /v4/diagnose ▶ same Recognition ▶ (no skip) same 4 questions ▶ Analyse gate ▶ /v4 onboarding (resets)
```

### Diagnostic surfaces exposed (the fragmentation, confirmed in `src/App.tsx`)
- `/v1/diagnostic` → `FreeDiagnostic` — **PUBLIC**, one-question-at-a-time. The only ungated one — but
  **orphaned** (landing/nav never link to it; only the unlinked bare `/diagnostic` redirects to it).
- `/v2/diagnostic`, `/v3/diagnostic` (+Recognition, the "latest"), `/v4/diagnose` → `ProblemSolverDiagnostic`
  — all `RequireAuth`, all 4-questions-on-one-page with **different question wording** than `/v1`.
- `/v1/brand-diagnostic`, `/v1/idea-diagnostic` — legacy IDEA-dimension diagnostics (gated, separate).
- Net: **two engines, divergent question sets, ~4 overlapping diagnose routes.**

### ✅ What makes sense
- The **Recognition screen** is live and strong (real "worn-out founder" image + the mirror copy, "…Nobody
  has been able to tell you why") — on both `/v3` and `/v4/diagnose`.
- The conversational **"paste everything, I'll read it back"** intake (`/v4` root) is the right idea.
- Honest "—"/no-fabrication; the spine stepper concept; the (local) diagnose→Fix recap.
- AC#4 instruction copy is live verbatim on the diagnostics.

### 🔁 Redundancies
1. **"Trust Gap" is produced 3 non-reconciling ways** — subjective self-assessment (`/v1`,`/v3`,`/v4`),
   connector-derived-from-reviews, and "we'll find your Trust Gap together" (`/v4` onboarding). A user who
   already has one is asked to subjectively re-rate a gap the engine measured objectively.
2. **Two diagnostic engines** (`FreeDiagnostic` vs `ProblemSolverDiagnostic`) — different questions, layout
   (paginated vs single-page), interaction model.
3. **Two steppers stacked** on `/v4/diagnose` — the 5-stage spine bar on top of the embedded diagnostic's
   own 7-step bar (1 Diagnose FREE…7 BETA ✦). Stepper-inside-a-stepper.
4. **"Brand Coach" header twice** on `/v4/diagnose` (app top bar + nested "IDEA Brand Coach").
5. **"Free Trust Gap Diagnostic" 3× on one screen** (stepper chip + top-right label + eyebrow); and
   rendering "FREE" labels **inside the authed app** (wrong context).
6. **Defence loop diagram 3×** (landing section + results "start of the loop" + paywall).
7. **Recognition screen duplicated** across `/v3` and `/v4/diagnose`.
8. **Spine shown twice at once** (top stepper + bottom mobile-style nav) on desktop width.

### 🔴 Clunky / doesn't make sense
1. **"No account first" → login wall.** Landing promises "FREE DIAGNOSTIC · NO ACCOUNT FIRST," but its only
   diagnostic CTA (`/v3`) is `RequireAuth` and bounces to `/auth`. The genuinely free `/v1` is unreachable.
2. **Results are score-first.** Big "60/100 TRUST GAP SCORE" → gradient bar → dimension breakdown, with
   **no plain-language Component-0 finding leading** (violates brief AC#5; kills the "how does it know that
   about my brand" moment). The four answered questions also **persist above** the results (scroll-past).
3. **Already-onboarded users re-do everything (prod).** Logged-in, freshly-diagnosed account still gets the
   full Recognition + blank 4 questions on `/v4/diagnose` (no skip/prefill); Analyse re-asks "tell me about
   your brand"; the `/v4` onboarding textarea is **blank** and the spine checkmarks **reset**. (The recap→Fix
   fix exists in code but is **not deployed**.)
4. **Analyse detours out of the spine** — its gate ("Tell me about your brand") routes back to `/v4` root
   onboarding mid-flow, then promises to "bring you straight back."
5. **Order is backwards** — the warm "read it back" intake is buried behind Diagnose + the Analyse gate,
   instead of leading.
6. **£97 paywall after a 10-second self-score**, selling customer profile / Decision Trigger / design brief —
   the same artifacts the connector already produces. Web and connector value props don't reconcile.
7. **Arbitrary tie-break** — all pillars 15/25 yet results assert "Primary gap: Insight."
8. **CTA copy drifts** — results "Find out exactly what to fix" (brief AC#10 mandates "Upload my listing and
   find the fix"); paywall then says "Claim my founding price." Three verbs for one action.

### Direct answer — "if onboarded via MCP, do they skip or see prefilled steps?"
**Neither, on prod.** No surface detects prior onboarding to skip or prefill: `/v2`·`/v3` re-ask the 4
self-scores blank; `/v4/diagnose` re-runs Recognition + questions; Analyse re-asks brand context; the
onboarding textarea is empty and the spine resets. Only `/v4/diagnose`'s **local, undeployed** recap advances
an already-diagnosed user. And the self-assessment can't be prefilled from MCP anyway (different signal:
subjective scores vs review-derived) — so the redundancy is structural, not just a missing read.

### Prioritised fixes (fold into the Build-Ready spec)
1. **One diagnostic engine + one stepper.** Retire `FreeDiagnostic`/the 7-step embedded stepper; the
   `/v4` spine is the only progress system. (Closes redundancies #2, #3, #4, #8.)
2. **"Has a Trust Gap from any source" → skip/prefill everywhere.** Deploy the diagnose→Fix recap; extend
   the same detection to Analyse and the onboarding so they resurface, never re-ask. (Closes 🔴#3, #4.)
3. **Fix the free-diagnostic entry.** Point the landing at ONE genuinely ungated diagnostic (ideally the
   Recognition one) so "no account first" is true. (Closes 🔴#1.)
4. **Results finding-first.** Component-0 statement as the hero, score/pillars below; transition to a clean
   results view (don't leave the questions above). (Closes 🔴#2, #7.)
5. **Lead with the "read it back" intake; one CTA vocabulary** ("Find my Trust Gap" → "Upload my listing
   and find the fix"). (Closes 🔴#5, #8.)
6. **De-dupe chrome/copy** — one "Brand Coach" header, one "Trust Gap Diagnostic" label, loop diagram once
   per surface. (Closes 🔁#5, #6, #7.)

### Fix → Re-measure → Defend (completing the walk)
- **Spine checkmarks are loose** — Diagnose/Analyse/Fix render ✓ without genuine completion (Fix ✓ with no
  funnel built); the `/v4` onboarding detour *resets* them. Progress state isn't trustworthy.
- **Fix** is scoped to a template "Default Avatar" with "No funnel pieces yet"; data only arrives "once your
  coach pulls them in Claude" (connector dependency); **"Continue to Re-measure" is enabled with zero data**.
- **Re-measure** throws a hard **"We couldn't read your diagnostic history / Try again"** error (even though a
  Trust Gap exists) and **"Continue to Defend" is disabled** (dead-end).
- **Defend** asserts a healthy verdict from no data — "Holding steady · Nothing has drifted · No assets
  drifted ✓" with **zero assets and no Signature** (violates no-fabrication); reachable despite "Roadmap";
  "Export workbook" offered with no loop data.

### Recap deploy note (2026-06-29)
The diagnose→Fix recap is **deployed** (`main`@212a441 → prod, bundle `index-D3pkiT_t.js`, verified live) but
detection is **avatar-scoped**, so it doesn't fire when the Trust Gap is on a different scope than the active
avatar — confirmed live (KE's active "Default Avatar" has no own diagnostic). → **T1 broadens it.**

---

## Consolidated Tickets (fix-all, 2026-06-29)

| # | Fix | Files (approx) | Risk | Status |
|---|-----|----------------|------|--------|
| **T1** | Broaden recap detection to a Trust Gap from **any scope** (brand-baseline / any avatar), not just active | `V4Diagnose.tsx` | low | safe-now |
| **T2** | De-chrome embedded diagnostic in `/v4` — hide inner 7-step stepper + nested "IDEA Brand Coach" header + "FREE" labels when `embedded` | `ProblemSolverDiagnostic.tsx` | low-med | safe-now |
| **T3** | Results **finding-first** — Component-0 statement above score/pillars; clean results view (drop the questions left above) | results in `ProblemSolverDiagnostic.tsx` | med | safe-now |
| **T4** | **Defend**: no healthy verdict from no data — gate "holding steady / no drift" behind real assets+Signature; honest empty otherwise | `V4Defend.tsx` | low | safe-now |
| **T5** | **Re-measure**: graceful empty instead of the hard "couldn't read diagnostic history" error | `V4Remeasure.tsx` / read hook | low | safe-now |
| **T6** | CTA copy consistency — entry "Find my Trust Gap"; results "Upload my listing and find the fix" | landing + results | low | safe-now |
| **T7** | De-dupe labels/headers — one "Trust Gap Diagnostic" label, one "Brand Coach" header, loop once/surface | `ProblemSolverDiagnostic.tsx`, landing | low | safe-now |
| **T8** | Spine checkmarks reflect real completion; don't reset on the onboarding detour | `/v4` spine/stepper state | med | safe-now |
| **T9** | Landing → **ungated** free diagnostic so "no account first" is true (point CTA at one public diagnostic) | `public/landing.html` + route gating | med-HIGH (funnel/monetization) | **NEEDS DECISION** |
| **T10** | Consolidate the **two diagnostic engines + one stepper** (retire the duplication) | `App.tsx`, both engines | HIGH (refactor) | **NEEDS DECISION** |

**Plan:** implement **T1–T8** (safe, high-value, no funnel/monetization risk) now, verify, batch-deploy.
**T9 & T10** touch the live funnel + the £97 monetization + a real refactor — flagged for a product call
before I rip out routes/engines.

### Monetization model (Matthew, 2026-06-29) — "earn the ask", trial = one piece
**Decisions:** (1) *Earn the ask* — the full diagnostic + the first fix are FREE; never ask before value.
(2) *Pay to continue monitoring the funnel and using the app* — membership is the ongoing Brand Defence
loop, not a one-time fee. (3) *Free trial = ONE funnel piece the user can iterate on* (diagnose → fix →
re-test that single piece) until the trial runs out; paid unlocks the WHOLE funnel + ongoing monitoring.

**Shipped (T-paywall, 2026-06-29):** the £97 Unlock screen moved from Step 2 (before any value) to AFTER
the fix (now step 6), reframed from "pay to see your fix" → "free trial: one piece to iterate on; become a
member for your whole funnel + monitoring". The forensic diagnostic + first fix are now reachable free
(free-account gate, not payment). Files: `ProblemSolverDiagnostic.tsx`, `problem-solver/theme.ts`,
`problem-solver/UnlockScreen.tsx`.

**Follow-up — NOW BUILT (T-trial, 2026-06-29):** the one-piece trial *enforcement*. Entitlement reads the
existing `user_subscriptions` table (active/trialing = member; fails safe to non-member) via
`src/lib/entitlement.ts` (`isMember`, `FREE_TRIAL_PIECE_LIMIT=1`) + `useEntitlement` hook. The gate:
`fixService.addPiece` refuses a non-member's 2nd brand piece (server-side safety net, injectable
member-check for tests); `V4Fix` gates the "Add a piece" entry points → `UpgradeDialog` + a trial-limit
banner on the map; the upgrade CTA routes to `/v1/subscribe`. The count is brand-wide (pieces are
brand-scoped), so the limit is consistent across avatar lenses. Events `v4_trial_limit_hit` /
`v4_upgrade_cta_clicked`. **Not bypass-proof** without an RLS/edge entitlement gate on `brand_assets`
inserts (UI + service gate only) — a hardened server gate + real Stripe checkout are the remaining steps.

### T11 — funnel pieces brand-scoped, evaluation per-avatar (live-verified design, 2026-06-29)
**Root cause (verified vs LIVE prod, not just repo):** the brand-scoped model ALREADY exists in the DB and
the MCP/connector service — but the **frontend `/v4` Fix uses the legacy avatar-keyed path**
(`SupabaseBrandFunnelService.listAssets(avatarId)` / `getCoverage(avatarId)` via `fixService`). That is
why pieces vanish when the avatar is switched.

**Live facts (Supabase MCP):** `brands` table is the anchor (one per user, `primary_avatar_id`).
`brand_assets.brand_id` exists + is populated on all 3 live rows + FK'd to brands; `avatar_id` now nullable;
brand-scoped unique index `uq_brand_assets_current_per_touchpoint (brand_id, touchpoint_id) WHERE
superseded_by IS NULL` is live. `brand_asset_audits` (per-avatar overlay) + `save_asset_audit_atomic(...)`
RPC are live. 3 pieces, **0 duplicates**, 0 brand_tests, 1 audit row → migration is near-zero-risk on data.
**Gap:** `brand_asset_audits` has `overall_score` + `audit_result` but **no per-avatar `status`** column
(status is piece-level on `brand_assets`).

**Design:**
1. **Tiny additive migration** — add `status text` (same CHECK as brand_assets) to `brand_asset_audits`;
   extend `save_asset_audit_atomic` with `p_status`; backfill the 1 existing audit row. Additive, reversible.
2. **Frontend re-scope (no edge change)** — pieces read by `brand_id`; the per-avatar verdict
   (status/score/audit) reads from `brand_asset_audits` for the active avatar, `pending` when none yet;
   audits are recorded to the overlay via `save_asset_audit_atomic` AFTER the existing `audit-asset` edge fn
   computes them (edge fn untouched → not Ask-First).
3. **UI** — `V4Fix` reads pieces from the brand (via `useBrand().brand.id`); the avatar selector becomes the
   **evaluation lens** ("assess these pieces for which customer"), so pieces never disappear on switch.

This keeps the deeper edge-function reconciliation out of scope; the existing live RPC + overlay carry the
per-avatar evaluation.


