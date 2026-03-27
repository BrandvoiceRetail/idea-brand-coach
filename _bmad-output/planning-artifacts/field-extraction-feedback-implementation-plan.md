# Implementation Plan: Field Extraction Feedback System

**Source:** `_bmad-output/planning-artifacts/ux-design-specification.md`
**Design Direction:** B (Active & Guided) + C celebrations
**Date:** 2026-03-26

---

## Architecture Overview

```
Chat message arrives with extractedFields metadata
    │
    ▼
useFieldExtractionOrchestrator (MODIFIED)
    │ NO LONGER auto-saves → emits to queue instead
    ▼
useExtractionQueue (NEW)
    │ manages pending batch
    │
    ├─── useAlwaysAccept.isOn? ────────────────────────┐
    │         NO                                        YES
    │         │                                         │
    │    BatchReviewOrchestrator (NEW)           Auto-accept path:
    │    opens AdaptiveFieldReview (EXISTING)    commit each field →
    │         │                                  stagger flash
    │    ┌────┴────┐
    │  accept    reject
    │    │         │
    │    │    inject TrevBot
    │    │    follow-up msg
    │    ▼
    │  useScrollOpenFlash (NEW)
    │    scroll → open accordion → flash green
    │    │
    └────┴──────────────┐
                        ▼
                  useMilestone (NEW)
                  check 10/20/35 thresholds
                        │
                        ▼
                  MilestoneOverlay (NEW)
```

---

## Epic 0: Data Integration Layer (P0 — prerequisite)

The UI stories in Epic 1 assume fields can be persisted to the database and messages can be injected into chat. These three stories wire up the backend integration that doesn't exist yet.

### Story 0.1: Wire FieldPersistenceService to avatar_field_values Table

**Problem:** `setFieldManual()` currently saves to `localStorage` only. The `avatar_field_values` table exists in Supabase, `FieldPersistenceService` exists with `saveField()` and `batchSaveFields()`, but they're never called from the UI.

**Files:**
- `src/hooks/useFieldExtraction.ts` — MODIFY
- `src/services/field/FieldPersistenceService.ts` — VERIFY/FIX

**Changes:**
1. In `useFieldExtraction.ts`, after writing to localStorage, also call `FieldPersistenceService.saveField()` to persist to `avatar_field_values`
2. Add `source` parameter to save calls: `'ai'` for extraction-accepted fields, `'manual'` for user-typed fields
3. Include `confidence_score` and `chapter_id` when saving AI-extracted fields
4. On load: prefer `avatar_field_values` DB data when avatar ID is available, fall back to localStorage for anonymous/default users
5. The realtime subscription in `useFieldExtraction.ts` (lines 239-308) already listens to `avatar_field_values` changes — verify it works end-to-end

**Also wire `batchSaveFields()`:** When "Accept All N" commits multiple fields, use batch save instead of N individual saves.

**Schema reference:**
```sql
-- avatar_field_values table (already exists)
avatar_id UUID, field_id TEXT, field_value TEXT,
field_source TEXT ('ai'|'manual'), is_locked BOOLEAN,
confidence_score FLOAT, chapter_id TEXT
```

**AC:**
- [ ] Accepted field values persist to `avatar_field_values` table
- [ ] Manual edits persist to `avatar_field_values` with `source: 'manual'`
- [ ] Batch accept uses `batchSaveFields()` (single DB round-trip)
- [ ] Page reload restores field values from DB (not just localStorage)
- [ ] Locked fields (`is_locked = true`) are never overwritten by extraction

---

### Story 0.2: Local Message Injection for Rejection-to-Chat

**Problem:** The rejection-to-chat flow needs to add a TrevBot message to the chat without calling the edge function. Currently messages only appear via edge function responses or DB saves.

**Files:**
- `src/services/chat/ChatMessageService.ts` — EXISTS (supports `role: 'assistant'`)
- `src/hooks/v2/useChatOrchestration.ts` — MODIFY (or wherever messages state lives)

**Changes:**
1. Create a `injectLocalMessage(content: string, metadata?: object)` function that:
   - Adds the message to local React state immediately (optimistic UI)
   - Persists to `chat_messages` table with `role: 'assistant'` and `metadata: { injected: true, reason: 'field_rejection' }`
   - The message appears in the chat stream like any other TrevBot response
2. Wire this into `useRejectionToChat` hook (Story 1.7)

**Key decision:** These injected messages should NOT trigger a new edge function call. They're purely local. But they DO persist to the DB so they appear on page reload and in chat history.

**AC:**
- [ ] Rejection follow-up message appears in chat immediately (no loading spinner)
- [ ] Message persists to `chat_messages` table
- [ ] Message appears on page reload in chat history
- [ ] Message does NOT trigger an edge function call
- [ ] Message metadata includes `{ injected: true }` to distinguish from AI responses

---

### Story 0.3: Field-Gap-Aware Suggestion Engine for Ghost Text

**Problem:** Ghost text in the chat input needs to suggest the next question based on which fields are empty in the current chapter. The existing `generateFollowUpSuggestions()` in the edge function is keyword-based and doesn't know about field gaps.

**Files:**
- `src/hooks/v2/useGhostSuggestion.ts` — NEW (moved from Epic 2, the logic needs to be designed here)
- `supabase/functions/idea-framework-consultant/fields.ts` — REFERENCE (field definitions)

**Approach — client-side, no new API:**
```typescript
function useGhostSuggestion(
  currentChapter: BookChapter | null,
  fieldValues: Record<string, string | string[]>,
  allChapters: BookChapter[]
): string | null {
  // 1. Find empty fields in current chapter
  // 2. Map field IDs to natural-language prompts using a static map
  // 3. Return the first suggestion, or null if chapter is complete
}
```

**Static suggestion map** (lives in a new file `src/data/fieldSuggestionPrompts.ts`):
```typescript
export const FIELD_SUGGESTION_PROMPTS: Record<string, string> = {
  brandPurpose: "What's the deeper reason your brand exists beyond making money?",
  brandVision: "What future do you want your brand to help create?",
  brandMission: "How does your brand plan to achieve that vision?",
  brandValues: "What core values guide every decision your brand makes?",
  demographics: "Tell me about your ideal customer — age, location, income...",
  psychographics: "What are your customers' interests, values, and lifestyle?",
  painPoints: "What frustrations or challenges do your customers face?",
  // ... all 35 fields
};
```

**Why client-side:** The suggestion is just "ask about the next empty field." No AI needed — a static map of field ID → natural question is sufficient and instant. The edge function's `suggestions` array can supplement this later (P2).

**AC:**
- [ ] After TrevBot responds, ghost text shows a question targeting the next empty field in the current chapter
- [ ] Suggestions are contextually relevant (not generic)
- [ ] When all fields in current chapter are filled, suggests moving to next chapter
- [ ] Returns `null` when all 35 fields are filled (no suggestion needed)

---

## Epic 1: Core Extraction Feedback Loop (P0)

### Story 1.1: Extraction Queue Hook

**`src/hooks/v2/useExtractionQueue.ts`** — NEW

Manages the pending extraction batch. Fields enter the queue from the orchestrator and exit via accept/reject.

**Interface:**
```typescript
interface PendingField {
  fieldId: string;
  label: string;
  value: string | string[];
  confidence: number;
  source: 'user_stated' | 'user_confirmed' | 'inferred_strong' | 'document';
  context?: string;
  chapterId: string;
  chapterTitle: string;
  messageId: string;
}

interface UseExtractionQueueReturn {
  queue: PendingField[];
  currentIndex: number;
  enqueue: (fields: PendingField[]) => void;
  accept: (fieldId: string, value?: string | string[]) => void;
  reject: (fieldId: string) => void;
  acceptAll: () => void;
  clear: () => void;
  isOpen: boolean;
}
```

**Behavior:**
- `enqueue()` appends fields. If queue was empty, sets `isOpen = true`
- `accept()` removes field from queue, emits accepted event (consumed by scroll-open-flash + field save)
- `reject()` removes field, emits rejected event (consumed by rejection-to-chat)
- `acceptAll()` accepts all remaining in sequence
- Auto-closes when queue empties
- New extractions during active review append to queue, update progress indicator

**AC:** AC-2, AC-3 (partial)

---

### Story 1.2: Scroll-Open-Flash Hook

**`src/hooks/v2/useScrollOpenFlash.ts`** — NEW

Orchestrates the visual feedback: scroll to field → open accordion → trigger flash.

**Interface:**
```typescript
interface UseScrollOpenFlashReturn {
  triggerFlash: (fieldId: string, options?: { staggerDelay?: number }) => void;
  triggerBatchFlash: (fieldIds: string[], staggerMs?: number) => void;
}
```

**Dependencies:**
- `ChapterSectionAccordion` ref (existing `focusChapter` imperative handle)
- Needs extension: `focusField(fieldId: string)` to scroll to specific field within a chapter
- `FieldFlashHighlight` component wrapping each field

**Behavior:**
1. Look up `fieldId` → find chapter ID from `fieldToBookChapterId` map
2. Call `accordionRef.focusField(fieldId)` — opens chapter, scrolls to field
3. After scroll completes (200ms), trigger `FieldFlashHighlight` animation on that field
4. `triggerBatchFlash` runs with configurable stagger (default 200ms between fields)

**AC:** AC-1

---

### Story 1.3: Field Flash Highlight Component

**`src/components/v2/FieldFlashHighlight.tsx`** — NEW

Wraps field containers in ChapterSectionAccordion. Triggers green flash animation.

**Interface:**
```typescript
interface FieldFlashHighlightProps {
  fieldId: string;
  children: React.ReactNode;
  className?: string;
}

interface FieldFlashHandle {
  flash: () => void;
}
```

**Implementation:**
- `forwardRef` with `useImperativeHandle` exposing `flash()`
- `flash()` adds `animate-field-flash` class, removes after 1.5s
- `prefers-reduced-motion`: instant green border → reset (no animation)

**Tailwind config addition:**
```javascript
// tailwind.config.ts
keyframes: {
  'field-flash': {
    '0%': { backgroundColor: 'hsl(142 76% 36% / 0.2)' },
    '100%': { backgroundColor: 'transparent' },
  },
},
animation: {
  'field-flash': 'field-flash 1.5s ease-out',
},
```

**AC:** AC-1

---

### Story 1.4: Extend ChapterSectionAccordion — focusField API

**`src/components/v2/ChapterSectionAccordion.tsx`** — MODIFY

Extend the existing `ChapterAccordionHandle` to support field-level focus.

**Changes:**
```typescript
interface ChapterAccordionHandle {
  focusChapter: (chapterId: string) => void;
  focusField: (fieldId: string) => void;  // NEW
}
```

**`focusField` behavior:**
1. Find chapter containing `fieldId` (from chapter data prop)
2. Open that chapter's accordion section (add to `accordionValue`)
3. Scroll to the field element: `document.getElementById(`field-${fieldId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })`
4. Set 80px top offset to account for fixed header

**Also:** Wrap each field in `FieldFlashHighlight` with a ref registry keyed by `fieldId`. Expose a `flashField(fieldId)` method or use a context/event bus.

**AC:** AC-1

---

### Story 1.5: Always Accept Toggle

**`src/hooks/v2/useAlwaysAccept.ts`** — NEW
**`src/components/v2/AcceptAllToggle.tsx`** — NEW

**Hook:**
```typescript
function useAlwaysAccept(): {
  isOn: boolean;
  toggle: () => void;
  setOn: (value: boolean) => void;
}
```
- Persisted via `usePersistedField<boolean>('always-accept-extractions', false)`
- Persists across sessions

**Component:**
```typescript
interface AcceptAllToggleProps {
  isOn: boolean;
  onToggle: () => void;
}
```
- shadcn `Switch` + label: "Auto-accept future extractions"
- Appears in review modal header
- Clear, easily reversible

**AC:** AC-4

---

### Story 1.6: Batch Review Orchestrator

**`src/components/v2/BatchReviewOrchestrator.tsx`** — NEW

Connects extraction queue to AdaptiveFieldReview modal. The brain of the review flow.

**Props:**
```typescript
interface BatchReviewOrchestratorProps {
  queue: PendingField[];
  currentIndex: number;
  isOpen: boolean;
  onAccept: (fieldId: string, value?: string | string[]) => void;
  onReject: (fieldId: string) => void;
  onAcceptAll: () => void;
  onClose: () => void;
  alwaysAccept: boolean;
  onToggleAlwaysAccept: () => void;
}
```

**Renders:**
- `AcceptAllToggle` in header
- `AdaptiveFieldReview` with fields mapped from `PendingField[]` → `ReviewField[]`
- "Accept All N" button in footer (dynamically labeled)
- Progress indicator "1 of N"

**Behavior:**
- Converts `PendingField` → `ReviewField` format expected by existing components
- On accept: calls `onAccept(fieldId, editedValue)`, triggers scroll-open-flash
- On reject: calls `onReject(fieldId)`
- "Accept All N": calls `onAcceptAll()`, triggers batch flash with stagger
- When `alwaysAccept` is true and new fields arrive: auto-accept path (no modal)

**AC:** AC-2, AC-3, AC-4

---

### Story 1.7: Rejection-to-Chat Integration

**`src/hooks/v2/useRejectionToChat.ts`** — NEW

When a field is rejected, injects a TrevBot follow-up message into chat.

**Interface:**
```typescript
function useRejectionToChat(
  addSystemMessage: (content: string) => void
): {
  handleRejection: (field: PendingField) => void;
  handleBatchRejections: (fields: PendingField[]) => void;
}
```

**Behavior:**
- Single rejection: `"Got it, I won't use that for [Field Label]. What would you like instead?"`
- Multiple rejections (from batch): One combined message listing all rejected fields
- Messages are injected as assistant messages after the review modal closes (or after batch completes)
- Messages appear in normal chat flow — not toasts, not alerts

**AC:** AC-5

---

### Story 1.8: Orchestrator Rewire

**`src/hooks/useFieldExtractionOrchestrator.ts`** — MODIFY

Stop auto-saving. Route extractions through the queue.

**Current flow (lines ~121-126):**
```typescript
// Currently: auto-saves immediately
setFieldManual(fieldId, value);
```

**New flow:**
```typescript
// New: enqueue for review (or auto-accept)
enqueueFields(pendingFields);
// setFieldManual only called AFTER user accepts
```

**Changes:**
1. Remove direct `setFieldManual()` calls for AI-extracted fields
2. Build `PendingField` objects with full metadata (confidence, source, chapterId, etc.)
3. Call `enqueueFields()` from the extraction queue hook
4. Keep `recentlyUpdatedChapterIds` tracking — but trigger on accept, not on extraction
5. Manual field edits still bypass the queue and save immediately

**AC:** AC-6

---

### Story 1.9: Wire Everything in BrandCoachV2

**`src/pages/v2/BrandCoachV2.tsx`** — MODIFY
**`src/hooks/v2/useBrandCoachV2State.ts`** — MODIFY

Integrate all new hooks and components into the page orchestrator.

**New state in useBrandCoachV2State:**
```typescript
// From useExtractionQueue
extractionQueue, currentQueueIndex, enqueueFields,
acceptField, rejectField, acceptAllFields, isReviewOpen

// From useAlwaysAccept
alwaysAccept, toggleAlwaysAccept

// From useScrollOpenFlash
triggerFlash, triggerBatchFlash

// From useRejectionToChat
handleRejection
```

**New JSX in BrandCoachV2:**
```tsx
<BatchReviewOrchestrator
  queue={extractionQueue}
  currentIndex={currentQueueIndex}
  isOpen={isReviewOpen && !alwaysAccept}
  onAccept={(fieldId, value) => {
    acceptField(fieldId, value);
    setFieldManual(fieldId, value);
    triggerFlash(fieldId);
  }}
  onReject={(fieldId) => {
    rejectField(fieldId);
    handleRejection(field);
  }}
  onAcceptAll={() => {
    const fieldIds = extractionQueue.map(f => f.fieldId);
    acceptAllFields();
    fieldIds.forEach(id => setFieldManual(id, ...));
    triggerBatchFlash(fieldIds);
  }}
  onClose={() => {/* dismiss, keep pending */}}
  alwaysAccept={alwaysAccept}
  onToggleAlwaysAccept={toggleAlwaysAccept}
/>
```

**AC:** All P0 ACs

---

## Epic 2: Ghost Text Autocomplete (P1)

### Story 2.1: Install Ghost Text Packages

```bash
npm install react-copilot-autocomplete
npx shadcn@latest add https://www.shadcn.io/r/ai-prompt-inline-suggestions.json
```

Verify both packages work with existing React 18 + TypeScript setup.

---

### Story 2.2: Ghost Text in Chat Input

**`src/components/v2/GhostTextChatInput.tsx`** — NEW

Wraps the existing ChatInputBar textarea with shadcn AI Prompt Block.

**Behavior:**
- After TrevBot responds, compute suggested next question based on:
  - Current IDEA chapter
  - Unfilled fields in current chapter
  - Conversation context
- Show suggestion as inline gray autocomplete text
- Tab: accept and send
- Type: replace with user input
- Ghost text at 40% opacity, same font/size as input

**`src/hooks/v2/useGhostSuggestion.ts`** — NEW

Computes the ghost suggestion string.

```typescript
function useGhostSuggestion(
  currentChapter: BookChapter | null,
  fieldValues: Record<string, string | string[]>,
  lastAssistantMessage: string | null
): string | null
```

Returns suggested next prompt or `null`.

**AC:** AC-7

---

### Story 2.3: Ghost Text in Field Inputs

**`src/components/v2/GhostTextFieldWrapper.tsx`** — NEW

Wraps chapter panel Input/Textarea with `react-copilot-autocomplete`.

**Behavior:**
- When a field has a pending extracted value (from queue or recent extraction), show it as inline autocomplete
- Tab: accept value into field, trigger mini flash
- Type: override suggestion
- Only show for fields that have a pending extraction but haven't been reviewed yet

**AC:** AC-8

---

## Epic 3: Progress Bar & Milestones (P1)

### Story 3.1: Heart Red + Gold Progress Bar

**`src/components/v2/BrandCoachHeader.tsx`** — MODIFY

**Changes:**
- Replace current progress bar fill with gradient: Heart Red → Gold
- Add CSS custom properties: `--heart-red: hsl(0 85% 50%)`, `--gold-warm: hsl(40 90% 55%)`
- Gradient shifts as percentage increases (more gold at higher fill)
- Progress text: "N of 35 fields captured"

**New Tailwind utility:**
```javascript
// tailwind.config.ts
backgroundImage: {
  'progress-gradient': 'linear-gradient(90deg, hsl(0 85% 50%), hsl(40 90% 55%))',
},
```

**AC:** AC-9

---

### Story 3.2: Milestone Detection & Celebrations

**`src/hooks/v2/useMilestone.ts`** — NEW
**`src/components/v2/MilestoneOverlay.tsx`** — NEW

**Hook:**
```typescript
function useMilestone(fieldCount: number): {
  activeMilestone: 10 | 20 | 35 | null;
  dismissMilestone: () => void;
}
```
- Tracks which milestones have fired via `usePersistedField<number[]>('milestones-fired', [])`
- Fires once per threshold per profile

**Component:**
- `canvas-confetti` for particle effects
- 10 fields: pulse animation on progress bar + toast
- 20 fields: confetti burst + toast
- 35 fields: full confetti + gold progress bar + export CTA
- `prefers-reduced-motion`: toast only

**AC:** AC-10

---

### Story 3.3: Badge Click-to-Scroll

**`src/components/v2/FieldExtractionBadges.tsx`** — MODIFY

**Changes:**
- `onFieldClick` callback already exists — wire it through to `useScrollOpenFlash.triggerFlash(fieldId)`
- Works for badges in any message, not just most recent

**AC:** AC-11

---

## Epic 4: Polish (P2)

### Story 4.1: Direct Edit Nudge

**`src/components/v2/DirectEditNudge.tsx`** — NEW

Shown once per session when user edits a field manually. "Chat with TrevBot to fill fields faster — he can extract multiple fields from a single message."

Dismissible. Uses `sessionStorage` (not persisted across sessions).

---

### Story 4.2: Confidence Display in Review Modal

Extend `DesktopFieldReview` and `MobileFieldReview` to show confidence score on each field card. Highlight fields with confidence < 70% for extra attention.

---

### Story 4.3: Settings Page Integration

Add "Always Accept" toggle to settings page (if it exists). Mirror the persisted preference from `useAlwaysAccept`.

---

## Implementation Order

```
Week 1a: Epic 0 (P0) — Data integration layer (PREREQUISITE)
  ├── Story 0.1: Wire FieldPersistenceService to avatar_field_values
  ├── Story 0.2: Local message injection for rejection-to-chat
  └── Story 0.3: Field-gap-aware suggestion engine (static map)

Week 1b: Epic 1 (P0) — Core extraction feedback (depends on Epic 0)
  ├── Story 1.1: useExtractionQueue
  ├── Story 1.2: useScrollOpenFlash
  ├── Story 1.3: FieldFlashHighlight
  ├── Story 1.4: ChapterSectionAccordion focusField
  ├── Story 1.5: useAlwaysAccept + AcceptAllToggle
  ├── Story 1.6: BatchReviewOrchestrator
  ├── Story 1.7: useRejectionToChat (depends on Story 0.2)
  ├── Story 1.8: Orchestrator rewire (depends on Story 0.1)
  └── Story 1.9: Wire in BrandCoachV2

Week 2: Epic 2 + 3 (P1) — Ghost text + milestones
  ├── Story 2.1: Install packages
  ├── Story 2.2: Ghost text chat input (depends on Story 0.3)
  ├── Story 2.3: Ghost text field inputs
  ├── Story 3.1: Progress bar styling
  ├── Story 3.2: Milestones
  └── Story 3.3: Badge click-to-scroll

Week 3: Epic 4 (P2) — Polish
  ├── Story 4.1: Direct edit nudge
  ├── Story 4.2: Confidence display
  └── Story 4.3: Settings integration
```

---

## File Change Summary

| Action | File | Epic |
|--------|------|------|
| MODIFY | `src/hooks/useFieldExtraction.ts` | 0 |
| VERIFY | `src/services/field/FieldPersistenceService.ts` | 0 |
| MODIFY | `src/hooks/v2/useChatOrchestration.ts` | 0 |
| NEW | `src/data/fieldSuggestionPrompts.ts` | 0 |
| NEW | `src/hooks/v2/useExtractionQueue.ts` | 1 |
| NEW | `src/hooks/v2/useScrollOpenFlash.ts` | 1 |
| NEW | `src/hooks/v2/useAlwaysAccept.ts` | 1 |
| NEW | `src/hooks/v2/useRejectionToChat.ts` | 1 |
| NEW | `src/hooks/v2/useGhostSuggestion.ts` | 2 |
| NEW | `src/hooks/v2/useMilestone.ts` | 3 |
| NEW | `src/components/v2/FieldFlashHighlight.tsx` | 1 |
| NEW | `src/components/v2/AcceptAllToggle.tsx` | 1 |
| NEW | `src/components/v2/BatchReviewOrchestrator.tsx` | 1 |
| NEW | `src/components/v2/GhostTextChatInput.tsx` | 2 |
| NEW | `src/components/v2/GhostTextFieldWrapper.tsx` | 2 |
| NEW | `src/components/v2/MilestoneOverlay.tsx` | 3 |
| NEW | `src/components/v2/DirectEditNudge.tsx` | 4 |
| MODIFY | `src/hooks/useFieldExtractionOrchestrator.ts` | 1 |
| MODIFY | `src/hooks/v2/useBrandCoachV2State.ts` | 1 |
| MODIFY | `src/components/v2/ChapterSectionAccordion.tsx` | 1 |
| MODIFY | `src/components/v2/FieldExtractionBadges.tsx` | 3 |
| MODIFY | `src/components/v2/BrandCoachHeader.tsx` | 3 |
| MODIFY | `src/components/v2/ChatInputBar.tsx` | 2 |
| MODIFY | `src/pages/v2/BrandCoachV2.tsx` | 1 |
| MODIFY | `tailwind.config.ts` | 1, 3 |
| MODIFY | `src/index.css` | 1, 3 |
| INSTALL | `react-copilot-autocomplete` | 2 |
| INSTALL | shadcn AI Prompt Block | 2 |
| INSTALL | `canvas-confetti` | 3 |
