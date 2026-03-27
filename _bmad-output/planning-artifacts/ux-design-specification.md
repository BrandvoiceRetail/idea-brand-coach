---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "docs/v2/README.md"
  - "docs/v2/architecture/TWO_PANEL_DESIGN.md"
  - "docs/FIELD_VISIBILITY_IMPROVEMENTS.md"
  - "src/components/v2/AdaptiveFieldReview.tsx"
  - "src/components/v2/DesktopFieldReview.tsx"
  - "src/components/v2/MobileFieldReview.tsx"
  - "src/components/v2/FieldExtractionBadges.tsx"
  - "src/components/AISuggestionPreview.tsx"
  - "src/hooks/useFieldExtractionOrchestrator.ts"
  - "supabase/functions/idea-framework-consultant/fields.ts"
---

# UX Design Specification - IDEA Brand Coach Field Extraction Feedback

**Author:** Matthew
**Date:** 2026-03-26
**Focus:** Progressive disclosure of field updates + accept/reject preview modal

---

## Executive Summary

### Project Vision

Enable IDEA Brand Coach users to clearly see, understand, and control how AI-extracted field values flow from chat conversations into their brand profile. Transform the currently invisible extraction process into a transparent, trust-building interaction with progressive visual feedback — auto-scrolling to fields, opening chapter sections, and presenting review modals that respect the user's chosen level of control.

### Target Users

Brand owners and marketers (intermediate tech comfort) building brand strategies through conversational AI coaching. They work through 11 IDEA framework chapters, sharing brand information naturally. They need confidence that the system correctly captures and categorizes their input — and the ability to correct it when it doesn't.

### Key Design Challenges

1. **Invisible extraction** — Users share brand information in chat but receive no clear signal when fields are populated. This creates uncertainty ("Did it capture my brand values?") and leads to repeated information sharing.

2. **Trust deficit with auto-apply** — The orchestrator silently writes AI-extracted values into fields. Users who later discover AI-written content in their profile lose trust in the system. Manual edits must visibly take priority.

3. **No spatial feedback in chapter panels** — When extraction happens, the chapter accordion panels don't visually change. Users can't see progress without manually expanding each section.

4. **Accept-all vs. review-each** — Power users want to skip review entirely. Careful users want field-by-field control. The UX must serve both without adding complexity.

### Design Opportunities

1. **Leverage existing AdaptiveFieldReview system** — Complete accept/reject/edit modal with device-adaptive UX (keyboard shortcuts on desktop, swipe gestures on mobile) is already built and only needs proper integration.

2. **Scroll-open-flash feedback loop** — When a field is extracted, the chapter panel auto-scrolls to the relevant section, the accordion opens, and the field flashes green. This creates immediate spatial awareness connecting conversation to profile.

3. **Review modal with accept-all toggle** — Two modes of operation:
   - **Review mode (default):** After scroll-open-flash on the first extracted field, a single batched AdaptiveFieldReview modal appears showing all extracted fields with a progress indicator ("1 of 3"). User can accept, reject, or edit each field — or hit "Accept All N" to approve the entire batch. As each field is accepted, the chapter panel scrolls to that field and flashes green, providing spatial feedback within the batched flow.
   - **Accept-all mode (user-toggled):** User checks "Auto-accept extractions." All extracted fields scroll-open-flash in sequence and land directly — no modal interruption. Recent auto-accepted values remain reviewable via the chapter panel.

4. **Multi-field batch behavior** — When multiple fields are extracted from a single message:
   - Left panel scrolls to the first field, opens its accordion section, flashes it green
   - One batched review modal opens with progress indicator and all fields queued
   - As user accepts each field (A key, swipe right, or click), the panel scrolls to that field and flashes it
   - "Accept All N" button available to approve the entire batch at once
   - "Always Accept" toggle in modal header to enable auto-accept mode persistently
   - If accept-all mode is on: no modal, all fields flash in sequence with stagger delay

5. **Badge-to-panel navigation** — Clicking extraction badges in chat triggers the same scroll-open-flash behavior, creating a direct visual connection between conversation and profile at any time.

## Core User Experience

### Defining Experience

The primary interaction surface is **conversational chat with TrevBot** (AI brand coach). Users share brand information naturally through dialogue, and the system extracts, categorizes, and populates their brand profile fields automatically. The core experience loop is:

1. User talks to TrevBot about their brand
2. TrevBot responds with coaching guidance
3. Fields are extracted and presented for review (or auto-accepted)
4. Chapter panels visually update with scroll-open-flash feedback
5. User sees their brand profile growing in real-time

Secondary interaction: some users prefer **direct field editing** in the chapter panels. These users should be gently nudged toward AI-assisted features (e.g., contextual hint: "Chat with TrevBot to fill fields faster — he can extract multiple fields from a single message"). The upsell path leads to sessions with real Trevor for hands-on brand consulting.

### Platform Strategy

- **Web-first responsive design** — desktop two-panel layout (chat + chapters), mobile chat-primary with sheet overlay for chapters
- **Desktop:** Mouse/keyboard primary. Keyboard shortcuts in review modal (A=Accept, R=Reject, arrows=navigate). Left panel always visible for spatial feedback.
- **Mobile:** Touch primary. Swipe gestures in review modal (left=reject, right=accept). Bottom sheet for chapter panels. Scroll-open-flash works within the sheet when triggered.
- **Tablet:** Sheet overlay for chapters (same as mobile), but larger touch targets (44px minimum).
- **No offline requirement** — AI features require connectivity.

### Effortless Interactions

1. **Natural conversation → profile building** — User talks normally to TrevBot, fields populate automatically. No special syntax, no form-filling friction.
2. **Review at your pace** — Default review mode lets careful users inspect each extraction. "Always Accept" toggle lets power users skip the modal entirely. Both feel intentional, not accidental.
3. **Spatial awareness without effort** — The scroll-open-flash pattern means users never have to hunt for what changed. The system shows them.
4. **Two-level accept controls** — "Accept All N" clears the current batch in one click. "Always Accept" toggle in the review modal header persists as a user preference (also accessible in settings). These are visually distinct actions:
   - **"Accept All 3" button** — appears in the review modal footer, resolves this batch only, styled as a secondary action
   - **"Always Accept" toggle** — appears in the review modal header, persists across sessions, styled as a switch with explanatory label ("Auto-accept future extractions")
5. **Direct editors get nudged, not blocked** — Users editing fields manually see a subtle, non-intrusive hint suggesting TrevBot chat for faster workflow. Shown once per session, dismissible.

### Critical Success Moments

1. **First extraction feedback** — The first time a user sees the scroll-open-flash after sharing brand info with TrevBot. This is the "aha" moment where they understand the system is listening and capturing. Same pattern as all subsequent extractions — the pattern teaches itself.
2. **Batch review completion** — Accepting 3-5 fields from a single message and watching them cascade into the chapter panels. This is the "progress celebration" moment.
3. **Trust calibration** — The moment a user toggles "Always Accept" — they've decided TrevBot is good enough to trust. This must feel like an empowered choice, not a surrender of control. Easily reversible.
4. **Profile completion milestones** — Crossing thresholds (10/35, 20/35, 35/35 fields) should feel meaningful through progressive disclosure in the chapter panels.
5. **TrevBot → Trevor upsell moment** — When users hit complexity that benefits from human expertise, the transition from AI coach to human coach should feel like a natural upgrade, not a paywall.

### Experience Principles

1. **Show, don't tell** — Every extraction is visually demonstrated through scroll-open-flash. No toast notifications saying "field updated" — the field itself shows the update happening.
2. **User controls the trust dial** — Review-each is the default. Accept-all-batch is one click away. Always-accept is a deliberate toggle. The user decides how much oversight they want, and can change their mind at any time.
3. **Chat is the engine, panels are the dashboard** — Conversation with TrevBot drives input; chapter panels reflect output. The scroll-open-flash bridges these two surfaces into one coherent experience.
4. **Never invisible, never intrusive** — Extractions are always visible (badges + flash). But the system never blocks the user from continuing their conversation — the review modal is dismissible, and chat remains functional while review is pending.

## Desired Emotional Response

### Primary Emotional Goals

1. **Confidence ("It heard me")** — Users should feel certain that TrevBot understood their input and translated it correctly into the right field. The scroll-open-flash provides instant visual confirmation. No uncertainty, no need to repeat themselves.

2. **Accomplishment ("Look at my progress")** — Watching fields cascade into chapter panels creates momentum. The profile is visibly growing. Each extraction is a small win that compounds into a sense of real progress through the IDEA framework.

3. **Agency ("I'm in control")** — The review modal asks, never tells. Users confirm what their brand is — the AI suggests, the human decides. And when they toggle "Always Accept," that's their choice to trust, not the system's choice to override them.

### Emotional Journey Mapping

| Stage | Desired Emotion | Design Support |
|-------|----------------|----------------|
| First message to TrevBot | Curiosity, ease | Natural chat interface, no form friction |
| First extraction flash | "Oh cool, it's working!" | Scroll-open-flash draws attention without startling |
| Review modal appears | Engaged, checking | Batched modal feels efficient, not interruptive |
| Accepting correct extraction | Satisfied, efficient | Green flash cascade celebrates the moment |
| Rejecting incorrect extraction | "Easy fix, no problem" | TrevBot acknowledges in chat: "Got it, I won't use that for [field]. What would you like instead?" — closing the loop conversationally |
| Toggling Always Accept | Empowered, trusting | Clear label, easy to reverse, positioned as a preference not a commitment |
| Seeing 20/35 fields filled | Momentum, pride | Progressive disclosure in panels shows growth, not remaining gaps |
| Returning next session | Continuity, recognition | Profile state preserved, TrevBot picks up where they left off |

### Micro-Emotions

**Critical to get right:**
- **Confidence over confusion** — Every extraction is visually confirmed. The user never wonders "did it work?"
- **Trust over skepticism** — Review-by-default builds trust before users opt into auto-accept
- **Accomplishment over overwhelm** — Progress is shown as fields filled, not fields remaining. Celebrate what's done.
- **Easy-fix over frustration** — Rejection is one click/swipe, TrevBot acknowledges it conversationally and redirects. No dead ends.

**Emotions to actively prevent:**
- "What just happened?" — unclear extraction without visual feedback
- "Ugh, another popup" — review modal must feel efficient, not nagging. Batched review + Accept All prevents modal fatigue
- "The AI is stupid" — wrong extractions should feel like a normal part of collaboration, not system failure. TrevBot's conversational acknowledgment of rejections normalizes the correction
- "Did I lose my edits?" — manual edits must visibly take priority and never be overwritten silently

### Design Implications

1. **Confidence → Scroll-open-flash timing** — Animation must be fast enough to feel responsive (200-300ms delay) but visible enough to register. Not so fast it's missed, not so slow it feels laggy.

2. **Accomplishment → Progressive disclosure** — Chapter panels should emphasize filled fields with subtle visual weight (checkmarks, filled indicators). Progress should feel additive, not a countdown of what's missing.

3. **Agency → Two-tier accept architecture** — "Accept All 3" (batch) and "Always Accept" (toggle) are visually distinct. The toggle has a clear label and is easily reversible. Neither feels like a trap.

4. **Easy-fix → Rejection-to-chat loop** — When a user rejects a field in the review modal, TrevBot posts a follow-up message in chat acknowledging the rejection and asking for the correct value. This keeps the conversation alive and makes corrections feel collaborative, not adversarial.

5. **No popup fatigue → Batched review** — Multiple extractions from one message produce one modal with progress indicator, not N separate interruptions. "Accept All N" is always available as an escape hatch.

### Emotional Design Principles

1. **Celebrate progress, don't count gaps** — Show "15 of 35 fields captured" not "20 fields remaining." Green fills, not empty outlines.
2. **Corrections are conversations** — Rejecting a field isn't an error state, it's a dialogue. TrevBot responds to rejections in chat, making the correction feel like natural collaboration.
3. **Trust is earned then offered** — Default to review mode so users see TrevBot getting it right. Only then offer the "Always Accept" toggle. Trust is built through demonstrated competence.
4. **Speed of feedback = speed of trust** — The faster the scroll-open-flash responds to extraction, the more the user trusts the system is working. Latency erodes confidence.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Grammarly — Sidebar Card Review Pattern**
- Inline highlights in content + sidebar card showing the suggestion with accept/dismiss
- User sees both the original and the suggestion simultaneously — no context switching
- Cards stack in the sidebar, creating a reviewable queue
- **Why it works:** The suggestion is always visible but never imposed. The user acts when ready.
- **How we adapt:** Our `DesktopFieldReview` right-sidebar panel maps directly to this pattern. The chapter panel shows the field, the review card shows the extraction alongside it. On mobile, the bottom sheet serves the same role.

**GitHub Copilot — Ghost Text Suggestions**
- Faded/ghosted text appears inline as you type, showing what the AI suggests
- Tab to accept the full suggestion, Escape to dismiss, or keep typing to override
- Trust builds over time — users learn the AI's accuracy and accept faster
- **Why it works:** Zero friction acceptance. The suggestion occupies the same space as the final content. No modal, no button — just Tab.
- **How we adapt two surfaces:**
  - **Ghost text in fields:** When TrevBot extracts a value, the target field shows the suggestion as ghosted placeholder text. User Tabs to accept or starts typing to replace. The field is never auto-filled — it's suggested-and-waiting.
  - **Ghost text in chat input:** After TrevBot's response, the chat input field ghosts a suggested follow-up prompt (e.g., "Tell me about your ideal customer..."). Tab to send, or type something different. Guides the conversation without forcing it.

**Notion AI — Streaming Accept/Reject**
- AI content streams in visibly, then presents Accept/Try Again/Discard inline
- User sees the content being generated, building anticipation and trust
- Accept commits the content; discard removes it cleanly
- **Why it works:** The streaming makes AI work feel transparent, not opaque.
- **How we adapt:** Our SSE streaming already shows TrevBot's response being generated. The extraction badges that appear after streaming completes serve a similar "here's what I did — approve it?" role.

**Linear — Auto-Detected Metadata Chips**
- As you type an issue description, Linear infers labels/priority/assignee and shows them as editable chips
- Chips are clickable to change, removable to dismiss
- **Why it works:** Inferred metadata is shown, not hidden. The user sees the AI's interpretation immediately.
- **How we adapt:** Our `FieldExtractionBadges` already follow this pattern — green chips under the message showing what was extracted. Clicking navigates to the field.

### Transferable UX Patterns

**Pattern 1: Ghost Text Suggestion → Tab Accept (from Copilot)**
- **In fields:** Extracted values appear as ghost text in the target field. Tab accepts, typing overrides. No modal needed for single-field updates.
- **In chat input:** Suggested follow-up prompts appear as ghost text. Tab sends, typing replaces. Guides IDEA framework progression naturally.
- **Supports:** Agency ("I'm in control"), effortless interaction, trust-building through progressive familiarity

**Pattern 2: Sidebar Review Card (from Grammarly)**
- Review panel slides in from the right (desktop) or bottom (mobile) showing extraction details
- User sees both the field and the review card simultaneously
- Cards queue for batched review with progress indicator
- **Supports:** Confidence ("I can see what changed"), batched review efficiency, spatial awareness

**Pattern 3: Editable Inference Chips (from Linear)**
- Extraction badges shown inline under messages as clickable chips
- Each chip navigates to its field via scroll-open-flash
- Chips show confidence level for low-confidence extractions
- **Supports:** Transparency, progressive disclosure, badge-to-panel navigation

**Pattern 4: Streaming Transparency (from Notion AI)**
- TrevBot's response streams visibly, extraction badges animate in with stagger after stream completes
- User watches the AI "work" which builds trust before the review moment
- **Supports:** Trust-building, anticipation, "it's working" confidence

### Anti-Patterns to Avoid

1. **Silent auto-fill** — Writing values directly into fields without any visual indication. Users discover AI-written content later and lose trust. (Current behavior we're fixing.)

2. **Modal bombardment** — One modal per extracted field per message. If TrevBot extracts 4 fields, that's 4 separate interruptions. Batched review prevents this.

3. **Confirmation fatigue** — Requiring explicit confirmation for every tiny extraction, even after the user has demonstrated trust. The "Always Accept" toggle prevents this for power users.

4. **Hidden suggestion state** — Ghost text that's too subtle to notice, or suggestions that disappear before the user can act on them. Ghost text must be clearly visible (distinct opacity/color) and persistent until acted upon.

5. **Blocking the conversation** — Review modals that prevent the user from continuing to chat. The review should be dismissible, and chat should remain functional with pending reviews queued.

### Design Inspiration Strategy

**Adopt:**
- Ghost text in fields for extracted values — Tab to accept, type to override
- Ghost text in chat input for suggested follow-up prompts
- Right-sidebar review card pattern (already built as DesktopFieldReview)
- Staggered badge animation after stream completion

**Adapt:**
- Grammarly's sidebar queue → our batched review modal with progress indicator ("1 of 3")
- Copilot's single-line ghost → multi-line ghost text for textarea fields (brand purpose, vision, etc.)
- Linear's chips → our extraction badges with confidence scores and chapter context

**Avoid:**
- Silent auto-fill without visual feedback
- Per-field modal interruptions (batch instead)
- Blocking chat while review is pending
- Ghost text that's too subtle to notice

## Design System Foundation

### Design System Choice

**shadcn/ui + Tailwind CSS + Radix UI** — already established in the codebase. This is a themeable system providing customizable components with a strong accessible foundation.

### Rationale for Selection

- **Already in production** — No migration cost. All v2 components already use this stack.
- **Accessibility built-in** — Radix primitives handle ARIA, focus management, keyboard navigation
- **Tailwind customization** — Custom utilities, animations, and design tokens via `tailwind.config.ts`
- **Framer Motion integration** — Already used for badge stagger animations, extends naturally to scroll-open-flash
- **Component consistency** — shadcn's composable pattern (Button, Badge, Sheet, Accordion) keeps new extraction feedback components consistent with existing UI

### Implementation Approach

**Extend, don't replace.** All new extraction feedback patterns build on existing components:

| New Pattern | Built With | Extends |
|-------------|-----------|---------|
| Ghost text in chat input | **shadcn.io AI Prompt Block** (`npx shadcn@latest add ai-prompt-inline-suggestions`) | Existing `ChatInputBar` textarea |
| Ghost text in fields | **react-copilot-autocomplete** (`asChild` wrapping existing inputs) | Existing `ChapterFieldSet` Input/Textarea |
| Green flash animation | Tailwind custom `animate-field-flash` | `tailwind.config.ts` + `index.css` |
| Scroll-to-field | Utility function + accordion state | `ChapterSectionAccordion` |
| Batched review modal | `AdaptiveFieldReview` + batch state | Existing review components |
| "Always Accept" toggle | shadcn Switch component | `usePersistedField` hook |
| Rejection-to-chat | Chat message injection | Existing `useChat` / message system |

### Ghost Text Package Strategy

**Chat input — shadcn.io AI Prompt with Inline Suggestions Block:**
- Official shadcn block, native to our stack
- Tab to accept ghost suggestion, alternative suggestion chips below
- Purpose-built for AI prompt interfaces
- Install: `npx shadcn@latest add https://www.shadcn.io/r/ai-prompt-inline-suggestions.json`
- Wraps our existing chat textarea with ghost text overlay
- Suggestion source: TrevBot suggests next IDEA framework question based on current chapter + field gaps

**Field inputs — react-copilot-autocomplete:**
- `asChild` pattern wraps existing shadcn Input/Textarea without replacing them
- Custom `handleCompletion` function receives AI-extracted value as suggestion
- Tab accepts the ghost value into the field, typing overrides
- Works for both single-line (Input) and multi-line (Textarea) fields
- Install: `npm install react-copilot-autocomplete`
- Suggestion source: extracted field values from TrevBot conversation, shown as ghost text until accepted

### Customization Strategy

**New design tokens needed:**
- `--field-flash-color`: green-500/20 for the flash highlight
- `--ghost-text-opacity`: 0.4 for ghost suggestion text (react-copilot-autocomplete `styles.suggestion`)
- `--flash-duration`: 1.5s for the highlight animation

**New Tailwind utilities:**
- `animate-field-flash` — keyframes: green bg flash → transparent over 1.5s
- `text-ghost` — opacity + italic styling for ghost suggestions (fallback for custom contexts)

**New components (2 custom + 2 packages):**
1. `FieldFlashHighlight` — Wraps field containers, triggers CSS animation on command
2. `AcceptAllToggle` — Switch + label + persistence logic, used in review modal header
3. *(package)* shadcn AI Prompt Block — ghost text for chat input
4. *(package)* react-copilot-autocomplete — ghost text for field inputs

## Visual Design Foundation

### Color System

**Derived from the "What Captures the Heart Goes in the Cart" book cover:**

**Primary Palette:**
- **Background:** Deep black/near-black (`hsl(220 13% 9%)` — already in codebase) — premium, bold, matches the book's black background
- **Text Primary:** White (`hsl(0 0% 100%)`) — clean contrast, matches book title typography
- **Text Secondary:** Light gray (`hsl(220 10% 70%)`) — supporting text, muted content

**Accent Colors:**
- **Heart Red** — Primary accent color. Drawn from the red heart on the book cover. Used for:
  - IDEA brand mark / logo accent
  - Emotional moments and highlights
  - TrevBot → Trevor upsell CTAs
  - High-priority actions
  - Suggested value: `hsl(0 85% 50%)` / `#E02020` — vibrant, warm red matching the cover heart

- **Gold/Warm** — Secondary accent. Drawn from the gold packages in the shopping cart. Used for:
  - Premium features / upsell indicators
  - Milestone celebrations (10/20/35 fields)
  - Locked field indicators (already using amber — aligns naturally)
  - Suggested value: `hsl(40 90% 55%)` / `#E8A817` — warm gold matching the cover packages

**Semantic Colors (extraction feedback — keeping green, extending with brand palette):**
- **Extraction Success:** Green (`green-500/10` background, `green-700` text) — already established, stays. Green = growth, progress, "your brand is growing"
- **Field Flash:** `green-500/20` → transparent over 1.5s — the scroll-open-flash animation
- **Ghost Text:** `opacity: 0.4`, using text-secondary color — visible but clearly not committed
- **Rejection/Error:** Heart Red at reduced opacity — "not quite right, let's try again"
- **Locked/Manual Edit:** Gold/amber — "you've taken ownership of this field"
- **Review Pending:** Soft blue or neutral — "waiting for your decision"

**Color Hierarchy for Field States:**
| Field State | Color | Meaning |
|-------------|-------|---------|
| Empty | Default border, no fill | Not yet captured |
| Ghost suggestion | Ghost text at 40% opacity | TrevBot suggests, waiting for accept |
| Pending review | Soft pulse or subtle border | In review modal queue |
| Just accepted | Green flash animation | Freshly captured |
| Filled (AI source) | Subtle green-500/5 bg + Sparkles icon | TrevBot contributed this |
| Filled (manual) | Default bg + pencil icon | User wrote this directly |
| Locked | Gold/amber border + lock icon | User has locked from AI updates |

### Typography System

**Derived from book cover typography:**

The book cover uses bold, high-impact sans-serif typography — "GOES IN THE CART" in heavy weight, "What Captures the Heart" in lighter weight. This creates a confident, modern hierarchy.

**Current codebase fonts (keep as-is):**
- The app already uses the system font stack via Tailwind defaults
- shadcn/ui components inherit this consistently

**Type scale for new extraction feedback components:**
- **Field labels:** `text-sm font-medium` (already established in ChapterFieldSet)
- **Ghost suggestion text:** `text-sm italic opacity-40` — clearly a suggestion, not committed content
- **Review modal title:** `text-base font-semibold` — "Field Review" header
- **Review modal field label:** `text-sm font-medium` — field name in review card
- **Review modal value:** `text-sm` — the extracted value to review
- **Badge text:** `text-xs font-medium` — extraction badges, chapter badges
- **Progress indicators:** `text-[10px] uppercase tracking-wider` — "1 of 3", pillar headers

**Tone:** Professional but approachable. The book cover feels confident and bold without being aggressive — the app should mirror that. Not sterile, not playful — *assured*.

### Spacing & Layout Foundation

**Already established in codebase — document for the new components:**

**Base unit:** 4px (Tailwind default rem scale)
**Component spacing for extraction feedback:**
- **Extraction badges:** `gap-2` (8px) between badges, `mt-3` (12px) above badge row
- **Review modal padding:** `p-3` (12px) for card content, `p-4` (16px) for modal container
- **Field flash highlight:** `p-2` (8px) padding on the highlight wrapper — enough to show the green flash around the field without crowding
- **Ghost text inset:** Matches existing Input/Textarea padding exactly — ghost text must align perfectly with real text
- **Accept/Reject buttons:** `gap-2` (8px) between buttons, minimum 44px touch target on mobile/tablet
- **Scroll-to-field offset:** 80px top offset when auto-scrolling — accounts for fixed header

**Layout principles for extraction feedback:**
1. **Fields and their feedback share the same row** — source badges (AI/manual/locked) sit inline with the field label, not below it
2. **Review modal doesn't obscure the field it's reviewing** — on desktop, sidebar (right); on mobile, bottom sheet (70vh max)
3. **Chat and chapter panels remain independently scrollable** — extraction feedback connects them visually (scroll-open-flash) but doesn't merge their scroll contexts

### Accessibility Considerations

**Contrast ratios (WCAG 2.1 AA minimum):**
- White text on dark background: 15.4:1 (exceeds AAA)
- Heart Red on dark background: verify ≥ 4.5:1 for text, ≥ 3:1 for UI elements
- Green extraction badges: `green-700` on `green-500/10` background — verify contrast
- Ghost text at 40% opacity: not required to meet contrast since it's supplementary, but must be visible enough to notice

**Animation accessibility:**
- `prefers-reduced-motion`: disable field flash animation, replace with instant border-color change
- `prefers-reduced-motion`: disable stagger delays on badge animations
- Review modal keyboard navigation: Tab through fields, A/R shortcuts, Escape to dismiss

**Touch targets:**
- All interactive elements ≥ 44px on touch devices (already enforced via `isTouchDevice` in ChatInputBar)
- Accept/Reject buttons in review modal: minimum 44px height
- Extraction badge click targets: minimum 44px tap area even if badge is visually smaller (padding on the hit area)

## Defining Experience

### The Core Interaction

**"Talk about your brand, watch your strategy take shape — and feel confident enough to invest in it."**

The user has a conversation with TrevBot. They're not filling out a 35-field form — they're talking about their brand the way they'd talk to a trusted advisor. As they talk, their brand profile materializes: fields flash green, chapters fill in, and the strategy document grows. By the end, they have a complete brand strategy they built through dialogue — not one handed to them by an agency.

The defining moment isn't when a field is extracted. It's when the user looks at their completed profile and thinks: *"Yes, this is my brand. I'm confident putting money behind this."*

### User Mental Model

**Where users are coming from:**
Users currently build brand strategies by hiring agencies. The agency delivers a spreadsheet, slide deck, or asset set after weeks of back-and-forth. The process is:
- **Expensive** — agency fees for brand strategy range from $5K-$50K+
- **Opaque** — the user shares information, then waits. They don't see the strategy being built.
- **Passive** — the user receives a deliverable rather than participating in its creation
- **Disconnected** — users often don't feel emotional ownership of agency-delivered strategies

**The mental model shift IDEA Brand Coach creates:**
- From "fill in 35 fields" → "tell TrevBot about my brand"
- From "wait for the agency to deliver" → "watch my strategy take shape in real-time"
- From "I received a brand strategy" → "I built my brand strategy"
- From "I hope this is right" → "I feel confident investing in this"

**Key insight:** The field extraction feedback (scroll-open-flash, review modal, ghost text) isn't just UX polish — it's the mechanism that creates the *feeling of participation*. When users see their words become fields, accept or refine them, and watch chapters fill in, they feel ownership. That ownership creates confidence. Confidence creates willingness to invest.

### Success Criteria

**The core experience succeeds when:**

1. **Users feel like co-creators, not form-fillers** — the conversation with TrevBot feels like working with an advisor, not entering data into a system
2. **Progress is visible and continuous** — every message potentially moves the needle. The scroll-open-flash shows progress happening in real-time, not at the end
3. **Users trust the output enough to act on it** — the review modal builds trust by showing the user exactly what was captured and letting them correct it. By the time they export their strategy document, they've verified every field
4. **The process feels faster and cheaper than an agency** — a user can build a meaningful brand strategy in a single focused session with TrevBot, not weeks of agency back-and-forth
5. **Users can articulate their brand after the process** — the IDEA framework chapters give them language and structure for what was previously intuition

**Success indicators:**
- User completes 25+ of 35 fields in a single session
- User exports a strategy document they share with their team
- User describes the experience as "I built my brand strategy" (ownership language)
- User says they feel "confident" investing in the strategy
- User returns to refine and iterate, not start over

### Novel vs. Established UX Patterns

**This combines familiar patterns in an innovative way:**

**Established patterns we're using:**
- Chat interface (familiar from ChatGPT, iMessage, Slack)
- Form fields in accordion panels (familiar from any settings/profile page)
- Accept/reject review (familiar from Grammarly, GitHub PRs)
- Ghost text suggestions (familiar from Copilot, Gmail Smart Compose)

**The novel combination:**
- **Conversation-driven form population** — chat messages automatically populate structured fields. Users have seen chat and forms separately, but not chat *driving* forms in real-time.
- **Scroll-open-flash as a bridge** — the visual connection between chat (right panel) and profile (left panel) is novel. It creates a spatial "cause and effect" that users don't see in other products.
- **Trust dial** — the progression from review-each → accept-batch → always-accept is a novel trust-calibration pattern. Users self-select their comfort level with AI.

**Teaching the novel pattern:**
No explicit onboarding needed. The scroll-open-flash *is* the onboarding — the first time it happens, the user understands the system. The pattern is self-teaching because it's visually obvious: "I said something in chat, and this field over here lit up green."

### Experience Mechanics

**1. Initiation:**
- User opens `/v2/coach` and sees TrevBot's greeting in the chat panel
- TrevBot introduces itself and asks an opening question based on the current IDEA chapter
- Ghost text in the chat input suggests a starting prompt (Tab to use, or type your own)
- The left panel shows chapter accordion with empty fields — the "before" state

**2. Interaction:**
- User types naturally about their brand in the chat input
- TrevBot responds with coaching guidance + calls `extract_brand_fields` tool
- Green extraction badges appear under TrevBot's message (staggered animation)
- Left panel: accordion scrolls to relevant chapter → section opens → field flashes green
- **If review mode (default):** Batched AdaptiveFieldReview modal slides in from right (desktop) or bottom (mobile). Shows extracted value with Accept/Reject/Edit. Progress indicator "1 of 3". "Accept All N" button for batch. "Always Accept" toggle in header.
- **If always-accept mode:** No modal. Fields flash green in sequence with stagger delay. Ghost text appears in field showing the value, then commits automatically.
- User can click any extraction badge in chat history to trigger scroll-open-flash to that field
- Ghost text in fields shows extracted values as suggestions (Tab to accept, type to override)
- Ghost text in chat input suggests the next TrevBot question (guides IDEA progression)

**3. Feedback:**
- **Success:** Green flash on field, badge under message, progress count updates ("16 of 35 fields captured")
- **Rejection:** TrevBot acknowledges in chat: "Got it, I won't use that for [field]. What would you like instead?" — keeps conversation alive
- **Edit:** User modifies value in review modal, accepted value reflects their edit. Field flashes green with the corrected value.
- **Error/low confidence:** Badge shows confidence % for <70% extractions. Review modal highlights these for extra attention.
- **Milestone:** Crossing 10/20/35 thresholds triggers subtle celebration in chapter panel progress indicators

**4. Completion:**
- User has worked through IDEA chapters via conversation, reviewing/accepting fields along the way
- Chapter panels show filled fields with checkmarks, progress bars at or near 100%
- User clicks Export → generates brand strategy document from all captured fields
- The exported document is the deliverable that replaces the agency's slide deck
- User feels: "I built this. I understand it. I'm confident investing in it."

## Design Direction Decision

### Selected Direction: B — Active & Guided (with elements from C)

**Base:** Direction B — Active & Guided
- Auto review modal with batched accept after scroll-open-flash
- Two-tier accept: "Accept All N" per batch + "Always Accept" toggle
- Rejection → TrevBot acknowledges in chat and redirects
- Ghost text as **inline autocomplete** (Copilot-style Tab-to-accept), not placeholder hints
- 1.5s green flash with auto-scroll and accordion open

**Additions from Direction C:**
- **Milestone celebrations** — confetti/animation at progress milestones (10/20/35 fields, pillar completion)
- **Heart Red + Gold progress bar styling** — progress indicators use the book cover palette for visual warmth and brand consistency

**Clarification on Ghost Text:**
Ghost text means **inline autocomplete suggestions** — the user types, TrevBot suggests the rest in gray text inline, Tab accepts the full suggestion. This is the GitHub Copilot / Gmail Smart Compose pattern, NOT static placeholder text. Both surfaces:
- **Chat input:** shadcn AI Prompt Block — suggests next question based on IDEA chapter progression
- **Field inputs:** react-copilot-autocomplete — shows extracted value as inline autocomplete, Tab to accept

### What Was Not Selected

**Direction A (Subtle & Ambient):** Too passive. No auto-modal means users might miss extractions. The badges-only approach doesn't create the "aha" moment of scroll-open-flash + review modal. Ghost text alone doesn't communicate enough about what happened.

**Direction C standalone (Celebratory & Bold):** The cascade animation and Heart Red badges add visual excitement but risk feeling heavy for routine interactions. The celebrations and progress bar colors are great — adopted into Direction B. The full cascade stagger for every extraction is too much for day-to-day use.

### Combined Design Direction Summary

| Feature | Decision |
|---------|----------|
| Primary feedback | Scroll-open-flash (1.5s green) + auto-open accordion |
| Review pattern | Batched AdaptiveFieldReview modal (default on) |
| Batch accept | "Accept All N" button in modal footer |
| Auto-accept | "Always Accept" toggle in modal header (persists) |
| Auto-accept behavior | No modal, fields flash green in sequence with stagger |
| Ghost text — chat | Inline autocomplete (Tab to accept), shadcn AI Prompt Block |
| Ghost text — fields | Inline autocomplete (Tab to accept), react-copilot-autocomplete |
| Rejection handling | TrevBot acknowledges in chat, asks for correction |
| Progress bar styling | Heart Red + Gold gradient (from book cover palette) |
| Milestones | Celebration animation at 10/20/35 fields |
| Badge style | Green extraction badges with stagger animation |
| Color palette | Book cover: black bg, Heart Red accent, Gold secondary, green for extraction |

## User Journeys & Flows

### Journey 1: First-Time Extraction (Trust-Building)

**Persona:** New user, first session with TrevBot, review mode (default)

```
User opens /v2/coach
    │
    ▼
TrevBot greeting + opening question (ghost text suggests starter prompt in chat input)
    │
    ▼
User types about their brand naturally
    │
    ▼
TrevBot responds + calls extract_brand_fields (1-3 fields)
    │
    ├── Chat panel: Green extraction badges animate in (staggered) under TrevBot's message
    │
    ├── Left panel: Auto-scroll to first extracted field's chapter
    │   └── Accordion section opens → field flashes green (1.5s)
    │
    └── Review modal slides in (right sidebar desktop / bottom sheet mobile)
        ├── Shows first field: label, extracted value, source badge, confidence
        ├── Progress indicator: "1 of 3"
        ├── Actions: [Accept (A)] [Reject (R)] [Edit]
        ├── Footer: [Accept All 3] button
        └── Header: [ ] Always Accept toggle (off by default)
            │
            ├── User accepts → field commits, panel scrolls to next field, flashes green
            │   └── Next field in queue shown in modal ("2 of 3")
            │
            ├── User rejects → field discarded
            │   └── TrevBot posts in chat: "Got it, I won't use that for [Brand Values]. What would you like instead?"
            │   └── Next field in queue shown in modal
            │
            └── User clicks "Accept All 3" → all remaining fields commit
                └── Fields flash green in sequence (200ms stagger)
```

**Key moments:**
- First scroll-open-flash = "aha, it's capturing my brand info"
- First accept = "I'm validating what TrevBot heard"
- First reject = "I'm in control, easy to fix"

---

### Journey 2: Power User Flow (Always-Accept Mode)

**Persona:** Returning user who has toggled "Always Accept"

```
User continues conversation with TrevBot
    │
    ▼
TrevBot responds + extracts 4 fields
    │
    ├── Chat panel: Green extraction badges animate in
    │
    └── Left panel (NO modal):
        ├── Scroll to field 1 → accordion opens → flash green (commits immediately)
        ├── 200ms delay → scroll to field 2 → flash green
        ├── 200ms delay → scroll to field 3 → flash green
        └── 200ms delay → scroll to field 4 → flash green
            │
            ▼
        Progress count updates: "19 of 35 fields captured"
            │
            ▼ (if milestone crossed)
        Milestone celebration: "20 fields!" with Heart Red + Gold animation
```

**Key moments:**
- Stagger cascade = satisfying visual momentum
- No interruption = flow state maintained
- Milestone = "I'm making real progress"

---

### Journey 3: Ghost Text Autocomplete in Chat

**Persona:** Any user, during conversation

```
TrevBot finishes response about brand positioning
    │
    ▼
Chat input shows ghost text autocomplete:
"Tell me about your ideal customer's biggest frustration..."
    │
    ├── User presses Tab → ghost text becomes real input → sends automatically
    │   └── TrevBot responds to the suggested question
    │
    ├── User starts typing something else → ghost text disappears
    │   └── New ghost text may appear as they type (autocomplete)
    │
    └── User ignores → ghost text persists until they interact
```

---

### Journey 4: Ghost Text Autocomplete in Fields

**Persona:** User editing fields directly in chapter panel

```
User clicks into "Brand Purpose" field in chapter panel
    │
    ▼
Field shows ghost text autocomplete from TrevBot's last extraction:
"To empower small business owners to build authentic brands..."
    │
    ├── User presses Tab → ghost value accepted into field
    │   └── Field flashes green briefly
    │
    ├── User starts typing → ghost text updates as autocomplete
    │   └── AI suggests completions based on conversation context
    │
    └── Subtle hint appears (once per session): "Chat with TrevBot to fill fields faster"
```

---

### Journey 5: Rejection-to-Chat Loop

**Persona:** User reviewing extractions, finds an incorrect value

```
Review modal shows: Brand Archetype = "The Hero"
User thinks: "No, we're more of a Guide/Mentor"
    │
    ▼
User clicks [Reject] (or presses R, or swipes left on mobile)
    │
    ├── Field value discarded (not saved)
    ├── Modal advances to next field ("2 of 3")
    │
    └── TrevBot posts in chat (after modal closes or after batch completes):
        "I hear you — 'The Hero' didn't feel right for Brand Archetype.
         What archetype resonates more with your brand's role in
         your customer's story?"
            │
            ▼
        User responds: "We're more of a Guide — we help customers
        find their own path"
            │
            ▼
        TrevBot extracts: Brand Archetype = "The Guide"
        → Normal extraction flow (scroll-open-flash + review or auto-accept)
```

---

### Journey 6: Document Upload Extraction

**Persona:** User uploads existing brand document (PDF/deck)

```
User clicks upload icon → selects document → upload completes
    │
    ▼
TrevBot: "I found some great content in your document. Let me extract
what I can for your brand profile..."
    │
    ▼
TrevBot calls extract_brand_fields with 8-12 fields (source: "document")
    │
    ├── Chat panel: Extraction badges animate in (large batch)
    │
    ├── Left panel: Scroll to first field
    │
    └── Review modal opens with larger batch:
        ├── Progress: "1 of 10"
        ├── Each field shows: label, value, "From: your uploaded document"
        ├── "Accept All 10" button prominent (large batch = likely wants batch accept)
        └── "Always Accept" toggle available
            │
            ├── User reviews a few, accepts rest with "Accept All"
            │   └── Stagger cascade across chapter panels
            │
            └── Progress: "25 of 35 fields captured" → Milestone celebration!
```

---

### Journey 7: Milestone Celebrations

**Persona:** Any user crossing a progress threshold

```
Extraction brings total to 10/35 (or 20/35, or 35/35)
    │
    ▼
Progress bar updates with Heart Red + Gold gradient fill
    │
    ├── 10 fields: Subtle pulse animation on progress bar
    │   └── Toast-style note: "10 fields captured — your brand foundation is taking shape!"
    │
    ├── 20 fields: Confetti burst from progress bar area
    │   └── "20 fields — over halfway! Your brand strategy is really coming together."
    │
    └── 35 fields: Full celebration — confetti + progress bar fills to gold
        └── "All 35 fields captured! Your complete brand strategy is ready to export."
        └── Export CTA becomes prominent
```

---

### Journey 8: Returning User / Session Continuity

**Persona:** User returns after previous session

```
User opens /v2/coach
    │
    ▼
Previous session loads: chat history + field values restored
    │
    ├── Chapter panels show previously filled fields (checkmarks, filled indicators)
    ├── Progress bar shows current state (e.g., "22 of 35")
    ├── "Always Accept" preference persisted from last session
    │
    └── TrevBot greeting acknowledges progress:
        "Welcome back! You've got 22 of 35 fields filled.
         Last time we were working on Brand Positioning.
         Shall we pick up where we left off?"
            │
            ▼
        Ghost text in chat input: "Yes, let's continue with positioning..."
```

---

### Flow Summary: State Machine

```
                    ┌─────────────────┐
                    │  IDLE            │
                    │  (chatting)      │
                    └────────┬────────┘
                             │ extract_brand_fields called
                             ▼
                    ┌─────────────────┐
                    │  EXTRACTING     │
                    │  (badges appear) │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
            "Always Accept" ON   "Always Accept" OFF
                    │                 │
                    ▼                 ▼
         ┌──────────────┐  ┌──────────────────┐
         │ AUTO-ACCEPT   │  │ REVIEW MODE      │
         │ stagger flash │  │ modal open       │
         │ no modal      │  │ accept/reject/   │
         └──────┬───────┘  │ accept-all        │
                │          └────────┬─────────┘
                │                   │
                │          ┌────────┴────────┐
                │          │                 │
                │      accepted          rejected
                │          │                 │
                │          ▼                 ▼
                │   ┌────────────┐  ┌──────────────┐
                │   │ FLASH      │  │ CHAT FOLLOWUP│
                │   │ commit     │  │ TrevBot asks  │
                │   │ scroll     │  │ for correction│
                │   └─────┬──────┘  └──────┬───────┘
                │         │                │
                └────┬────┘                │
                     │                     │
                     ▼                     │
            ┌─────────────────┐            │
            │ CHECK MILESTONE │◄───────────┘
            │ 10/20/35?       │
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  IDLE            │
            │  (back to chat)  │
            └─────────────────┘
```

## Implementation Specification

### Component Inventory

All new components and modifications needed to implement Direction B + C celebrations.

#### New Components

| Component | File | Purpose | Priority |
|-----------|------|---------|----------|
| `FieldFlashHighlight` | `src/components/v2/FieldFlashHighlight.tsx` | Wraps field containers, triggers green flash CSS animation on command via ref | P0 |
| `AcceptAllToggle` | `src/components/v2/AcceptAllToggle.tsx` | shadcn Switch + label + `usePersistedField` for "Always Accept" preference | P0 |
| `BatchReviewOrchestrator` | `src/components/v2/BatchReviewOrchestrator.tsx` | Manages batched extraction queue, controls AdaptiveFieldReview modal, handles accept-all/reject-to-chat flows | P0 |
| `MilestoneOverlay` | `src/components/v2/MilestoneOverlay.tsx` | Confetti/animation overlay triggered at 10/20/35 thresholds. Heart Red + Gold palette | P1 |
| `GhostTextChatInput` | `src/components/v2/GhostTextChatInput.tsx` | Wraps ChatInputBar textarea with shadcn AI Prompt Block for inline autocomplete | P1 |
| `GhostTextFieldWrapper` | `src/components/v2/GhostTextFieldWrapper.tsx` | Wraps chapter panel Input/Textarea with react-copilot-autocomplete `asChild` | P1 |
| `DirectEditNudge` | `src/components/v2/DirectEditNudge.tsx` | One-per-session hint shown when user edits a field directly: "Chat with TrevBot to fill fields faster" | P2 |

#### Modified Components

| Component | File | Changes | Priority |
|-----------|------|---------|----------|
| `ChapterSectionAccordion` | `src/components/v2/ChapterSectionAccordion.tsx` | Add scroll-to-field API via ref, integrate `FieldFlashHighlight` wrappers, programmatic accordion open | P0 |
| `ChatMessageList` | `src/components/v2/ChatMessageList.tsx` | Wire rejection-to-chat: inject TrevBot follow-up messages when fields are rejected | P0 |
| `BrandCoachV2` | `src/pages/v2/BrandCoachV2.tsx` | Integrate `BatchReviewOrchestrator`, pass extraction events, wire scroll-open-flash orchestration | P0 |
| `ChatInputBar` | `src/components/v2/ChatInputBar.tsx` | Replace textarea with `GhostTextChatInput` wrapper | P1 |
| `BrandCoachHeader` | `src/components/v2/BrandCoachHeader.tsx` | Heart Red + Gold progress bar styling, milestone threshold detection | P1 |
| `FieldExtractionBadges` | `src/components/v2/FieldExtractionBadges.tsx` | Add click-to-scroll: clicking a badge triggers scroll-open-flash to that field | P1 |

#### Modified Hooks

| Hook | File | Changes | Priority |
|------|------|---------|----------|
| `useFieldExtractionOrchestrator` | `src/hooks/useFieldExtractionOrchestrator.ts` | Emit extraction events to `BatchReviewOrchestrator` instead of auto-saving. Support "always accept" bypass. | P0 |
| `useBrandCoachV2State` | `src/hooks/v2/useBrandCoachV2State.ts` | Add `alwaysAccept` persisted state, `pendingExtractions` queue, scroll-open-flash coordination | P0 |

#### New Hooks

| Hook | File | Purpose | Priority |
|------|------|---------|----------|
| `useScrollOpenFlash` | `src/hooks/v2/useScrollOpenFlash.ts` | Orchestrates: scroll to field → open accordion → trigger flash animation. Accepts field ID, returns trigger function | P0 |
| `useAlwaysAccept` | `src/hooks/v2/useAlwaysAccept.ts` | Persisted boolean preference via `usePersistedField<boolean>`. Used by `BatchReviewOrchestrator` and `AcceptAllToggle` | P0 |
| `useExtractionQueue` | `src/hooks/v2/useExtractionQueue.ts` | Manages pending extraction batch: add fields, accept/reject individual, accept-all, clear. Emits events for scroll-open-flash | P0 |
| `useMilestone` | `src/hooks/v2/useMilestone.ts` | Tracks field count, detects threshold crossings (10/20/35), triggers `MilestoneOverlay` | P1 |
| `useGhostSuggestion` | `src/hooks/v2/useGhostSuggestion.ts` | Computes ghost text suggestion for chat input based on current chapter + field gaps | P1 |

#### New Design Tokens & Utilities

| Token/Utility | File | Details |
|---------------|------|---------|
| `--field-flash-color` | `src/index.css` | `hsl(142 76% 36% / 0.2)` — green-500/20 |
| `--heart-red` | `src/index.css` | `hsl(0 85% 50%)` / `#E02020` |
| `--gold-warm` | `src/index.css` | `hsl(40 90% 55%)` / `#E8A817` |
| `animate-field-flash` | `tailwind.config.ts` | Keyframes: green bg → transparent over 1.5s |
| `animate-milestone-pulse` | `tailwind.config.ts` | Keyframes: scale 1→1.05→1 with gold glow |
| `bg-progress-gradient` | `tailwind.config.ts` | Linear gradient: Heart Red → Gold |

#### Package Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react-copilot-autocomplete` | latest | Ghost text autocomplete for field inputs |
| shadcn AI Prompt Block | via `npx shadcn@latest add` | Ghost text autocomplete for chat input |
| `canvas-confetti` | ^1.9 | Milestone celebration confetti (lightweight, no deps) |

---

### Implementation Priorities

#### P0 — Core Extraction Feedback (Must Have)

The minimum viable extraction feedback loop. Without these, users still can't see what was extracted or control it.

1. **Scroll-open-flash pipeline** — `useScrollOpenFlash` + `FieldFlashHighlight` + accordion integration
2. **Batch review modal** — `BatchReviewOrchestrator` + `useExtractionQueue` + existing `AdaptiveFieldReview`
3. **Two-tier accept** — `AcceptAllToggle` + `useAlwaysAccept` + "Accept All N" button
4. **Rejection-to-chat** — TrevBot follow-up message injection on reject
5. **Orchestrator rewire** — `useFieldExtractionOrchestrator` emits to queue instead of auto-save

#### P1 — Enhanced Experience (Should Have)

Builds on P0 to add delight, guidance, and visual polish.

6. **Ghost text in chat input** — shadcn AI Prompt Block integration
7. **Ghost text in fields** — react-copilot-autocomplete integration
8. **Heart Red + Gold progress bar** — milestone detection + celebration overlay
9. **Badge click-to-scroll** — extraction badges navigate to fields
10. **Milestone celebrations** — confetti at 10/20/35 thresholds

#### P2 — Polish (Nice to Have)

11. **Direct edit nudge** — one-per-session hint for manual field editors
12. **Confidence display** — show confidence % on low-confidence extractions in review modal
13. **Settings page integration** — "Always Accept" toggle accessible from settings

---

### Acceptance Criteria

#### P0 Acceptance Criteria

**AC-1: Scroll-Open-Flash**
- [ ] When a field is extracted, the left panel auto-scrolls to the relevant chapter section
- [ ] The accordion section containing the field opens automatically
- [ ] The field container flashes green for 1.5s (`animate-field-flash`)
- [ ] Scroll offset accounts for fixed header (80px top offset)
- [ ] `prefers-reduced-motion`: instant border-color change instead of animation

**AC-2: Batched Review Modal**
- [ ] When fields are extracted (and "Always Accept" is OFF), `AdaptiveFieldReview` modal opens
- [ ] Modal shows all extracted fields from the message as a batch with progress indicator ("1 of N")
- [ ] Desktop: right sidebar layout (existing `DesktopFieldReview`)
- [ ] Mobile: bottom sheet layout (existing `MobileFieldReview`)
- [ ] Each field shows: label, extracted value, source badge, confidence score
- [ ] User can Accept (A key), Reject (R key), or Edit each field
- [ ] Accepting a field triggers scroll-open-flash on that field in the left panel
- [ ] Modal is dismissible — chat remains functional with pending reviews queued

**AC-3: Accept All N (Batch)**
- [ ] "Accept All N" button visible in review modal footer
- [ ] Clicking it accepts all remaining unreviewed fields in the current batch
- [ ] Fields flash green in sequence with 200ms stagger delay
- [ ] Button label updates dynamically ("Accept All 3" → "Accept All 2" as fields are reviewed)

**AC-4: Always Accept Toggle**
- [ ] Toggle appears in review modal header with label "Auto-accept future extractions"
- [ ] Toggle state persists across sessions via `usePersistedField<boolean>`
- [ ] When ON: new extractions skip the modal, flash green in sequence, commit immediately
- [ ] When OFF: normal review modal flow
- [ ] Easily reversible — user can turn off at any time via the next review modal or settings

**AC-5: Rejection-to-Chat**
- [ ] When user rejects a field in the review modal, the value is discarded (not saved)
- [ ] After modal closes (or after batch completes), TrevBot posts a follow-up message in chat
- [ ] Message format: "Got it, I won't use that for [Field Label]. What would you like instead?"
- [ ] User's next response triggers normal extraction flow for that field
- [ ] Rejection does not block the review of remaining fields in the batch

**AC-6: Orchestrator Rewire**
- [ ] `useFieldExtractionOrchestrator` no longer auto-saves extracted fields
- [ ] Extracted fields are emitted to `useExtractionQueue` as pending
- [ ] Fields are only saved after explicit user acceptance (or auto-accept if toggled)
- [ ] Manual field edits (typed directly) bypass the queue and save immediately
- [ ] Locked fields are never overwritten by extraction

#### P1 Acceptance Criteria

**AC-7: Ghost Text Chat Input**
- [ ] After TrevBot responds, chat input shows inline autocomplete suggestion
- [ ] Suggestion is based on current IDEA chapter + unfilled fields
- [ ] Tab accepts the suggestion and sends the message
- [ ] Typing replaces the ghost text with user input
- [ ] Ghost text is visually distinct (40% opacity, gray)

**AC-8: Ghost Text Field Input**
- [ ] When a field has a pending extracted value (from TrevBot), it shows as inline autocomplete
- [ ] Tab accepts the value into the field
- [ ] Typing overrides the suggestion
- [ ] Ghost text aligns perfectly with real text (same padding, font, size)

**AC-9: Progress Bar Styling**
- [ ] Progress bar uses Heart Red → Gold gradient (`bg-progress-gradient`)
- [ ] Fill percentage reflects `savedFieldCount / 35`
- [ ] Gradient shifts as progress increases (more gold at higher percentages)

**AC-10: Milestone Celebrations**
- [ ] At 10 fields: subtle pulse animation on progress bar + toast message
- [ ] At 20 fields: confetti burst + congratulatory toast
- [ ] At 35 fields: full celebration + export CTA prominence increase
- [ ] Each milestone triggers only once per profile (not on page reload)
- [ ] `prefers-reduced-motion`: toast only, no animation

**AC-11: Badge Click-to-Scroll**
- [ ] Clicking an extraction badge in chat triggers scroll-open-flash on the corresponding field
- [ ] Works for badges in any message (not just the most recent)

---

### Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Extraction during active review modal | New fields append to the current batch queue, progress indicator updates ("1 of 5" → "1 of 7") |
| User closes review modal with pending fields | Pending fields remain in queue, badge shows pending count. Next extraction re-opens modal with combined queue |
| Field already has a value when extracted | Review modal shows both current value and new extraction side-by-side. Accept replaces, reject keeps current |
| Locked field extracted | Extraction is silently skipped for that field. Badge still appears but shows lock icon. Not added to review queue |
| Manual edit while review is pending | Manual edit takes priority. If the edited field is in the review queue, it's removed from the queue |
| Network error during save after accept | Retry once. If still fails, show error toast and keep field in queue for re-accept |
| "Always Accept" toggled ON mid-review | Current batch completes normally. Next extraction uses auto-accept |
| 0 fields extracted from a message | No scroll-open-flash, no modal, no badges. Normal chat response only |
| All fields in batch rejected | All discarded. TrevBot posts one combined follow-up referencing all rejected fields |

---

### Responsive Behavior Summary

| Viewport | Left Panel | Review Modal | Ghost Text | Celebrations |
|----------|-----------|-------------|-----------|-------------|
| Desktop (1024px+) | Always visible, scroll-open-flash in place | Right sidebar (`DesktopFieldReview`) | Full autocomplete in fields + chat | Confetti anchored to progress bar |
| Tablet (768-1023px) | Sheet overlay, auto-opens on extraction for flash | Bottom sheet (70vh) | Full autocomplete | Confetti anchored to header |
| Mobile (<768px) | Sheet overlay, auto-opens on extraction for flash | Bottom sheet (85vh, swipe gestures) | Chat input only (fields too narrow for ghost text) | Toast only, no confetti |

---

### Technical Dependencies

```
useFieldExtractionOrchestrator (existing, modified)
    │ emits extraction events
    ▼
useExtractionQueue (new)
    │ manages pending batch
    ├──▶ BatchReviewOrchestrator (new)
    │       ├── AdaptiveFieldReview (existing)
    │       │     ├── DesktopFieldReview (existing)
    │       │     └── MobileFieldReview (existing)
    │       ├── AcceptAllToggle (new)
    │       │     └── useAlwaysAccept (new)
    │       └── on reject → ChatMessageList injection
    │
    ├──▶ useScrollOpenFlash (new)
    │       ├── ChapterSectionAccordion.scrollToField()
    │       └── FieldFlashHighlight.flash()
    │
    └──▶ useMilestone (new)
            └── MilestoneOverlay (new)
```

---

*This specification is complete and ready for implementation planning.*
