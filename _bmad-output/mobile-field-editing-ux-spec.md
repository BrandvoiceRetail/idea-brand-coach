---
stepsCompleted: ["step-01-init", "step-02-discovery"]
inputDocuments: ["prd.md", "TWO_PANEL_DESIGN.md", "FIELD_VISIBILITY_IMPROVEMENTS.md", "FIELD_VISIBILITY_IMPLEMENTED.md"]
---

# Mobile Field Editing UX Specification
**Project:** IDEA Brand Coach V2
**Focus:** Mobile Chat-Based Field Editing Experience
**Created:** 2026-03-17
**Designer:** Sally (UX Designer)
**Status:** Discovery Complete

---

## Executive Summary

This specification defines a chat-first mobile experience for the IDEA Brand Coach that makes field extraction transparent, celebratory, and efficient. The design combines multiple interaction patterns to create a seamless experience where users primarily edit fields through natural conversation, with manual editing available for fine-tuning.

## Core Design Principles

### 1. Chat-First, Edit-Second
- Primary interaction: Natural language updates via chat
- Secondary option: Manual field editing for precision
- AI handles most field population automatically

### 2. Progressive Disclosure
- Show only what's been discussed (no empty future chapters)
- Reveal new sections as fields are populated
- Display progress as "Step 7/10" format
- Applies to both mobile and desktop interfaces

### 3. Transparent Extraction
- In-chat badges show which fields were extracted
- Review overlay for field changes before commit
- Clear source attribution (AI vs manual)

### 4. Celebration Without Disruption
- Subtle badges for individual field extraction
- Prominent celebration for chapter completion
- Overall progress prominently displayed

---

## User Journey Map

### Primary Flow: Chat-Driven Field Population

```
User Types Message → AI Responds with Field Extraction
    ↓
Green Badges Appear Below Response
    ↓
Field Review Overlay Shows Changes
    ↓
User Accepts/Modifies → Fields Auto-Save
    ↓
Progress Bar Updates → Chapter Celebration (if complete)
```

### Secondary Flow: Manual Field Editing

```
User Taps Field Badge or Opens Fields Tab
    ↓
Floating Card Appears Over Grayed Chat
    ↓
User Edits Field Directly
    ↓
Auto-Save on Blur → Source Updates to "edited"
    ↓
Return to Chat with One Tap
```

---

## Interaction Patterns

### 1. In-Chat Field Extraction Badges

**Visual Design:**
- Small green badges with "+" icon appear below AI responses
- Show field label, not ID (e.g., "+Brand Name" not "+brand_name")
- Subtle fade-in animation (300ms)
- Tap badge to quick-edit that specific field

**Implementation:**
```typescript
// After AI message in chat
<div className="field-extraction-badges">
  <Badge variant="success" onClick={() => openFieldEditor(fieldId)}>
    <Plus className="h-3 w-3" />
    Brand Name
  </Badge>
</div>
```

### 2. Field Review Overlay (One-at-a-Time)

**Trigger:** After any AI extraction that populates fields

**Visual Design:**
- Semi-transparent overlay slides up from bottom (30% screen height)
- Shows ONE field at a time with before/after comparison
- Queue indicator shows position (1 of 3, 2 of 3, etc.)
- Swipe left/right or tap buttons to navigate between fields
- "Accept All Remaining" option available
- Dismissible with swipe down or X button

**Layout:**
```
┌─────────────────────────────┐
│ Field Update (1 of 3)  [X] │
│ ─────────────────────────── │
│                             │
│        Brand Name           │
│                             │
│ Before: (empty)             │
│ After:  "TechStart"         │
│                             │
│ [Reject] [Accept] [Accept All] │
│                             │
│ • ○ ○  (progress dots)      │
└─────────────────────────────┘
```

**Interaction Flow:**
- Accept: Saves field and moves to next
- Reject: Discards change and moves to next
- Accept All: Accepts current and all remaining
- Swipe right: Accept and next
- Swipe left: Reject and next
- Last field: Auto-dismisses after action

### 3. Quick Access Sheet

**Access Methods:**
1. Tap any field badge in chat
2. Tap "Fields" button in bottom toolbar
3. Switch to "Fields" tab

**Visual Design:**
- Full-screen modal with grayed-out chat background
- "Recently Updated" section at top (last 5 fields)
- Progressive chapters below (only populated ones)
- Each field shows source badge (AI/edited/locked)
- Close with X or swipe down

### 4. Bottom Toolbar Design

**Layout (when keyboard hidden):**
```
┌─────────────────────────────┐
│ [📎] [Input field...] [✓All]│
│ [Chat] [Fields] [Progress]  │
└─────────────────────────────┘
```

**Components:**
- Document upload button (📎)
- Message input field
- "Accept All" toggle (✓All) - enables auto-accept for extractions
- Tab switcher: Chat | Fields | Progress

**When Keyboard Active:**
- Bottom tabs hide
- Only input bar visible above keyboard
- Accept All toggle remains visible

### 5. Floating Field Cards

**Trigger:** Tap-to-edit on any field badge

**Visual Design:**
- Card appears centered over dimmed chat (80% opacity black overlay)
- Card takes 80% width, auto-height
- Shows single field for focused editing
- Auto-save indicator in top-right
- Swipe down or tap outside to dismiss

**Layout:**
```
┌─────────────────────┐
│ Brand Name     [AI] │
│ ─────────────────── │
│ [TechStart       ] │
│                    │
│ Define your brand's │
│ primary name       │
│                    │
│ [Cancel]    [Done] │
└─────────────────────┘
```

### 6. Tab Navigation

**Three Main Tabs:**

1. **Chat Tab**
   - Full chat interface with Trevor
   - Shows extraction badges
   - Message input at bottom

2. **Fields Tab**
   - Recently Updated section (collapsible)
   - Progressive chapter accordions
   - Only shows populated chapters
   - Search/filter at top

3. **Progress Tab**
   - Visual progress wheel (0-100%)
   - Chapter completion checklist
   - Field count by chapter
   - Export options

---

## Progressive Disclosure Strategy

### Initial State
- Only show Chapter 1 fields
- Display "Step 1 of 11" in header
- Hide future chapters completely

### As Conversation Progresses
- Reveal chapters when first field populates
- Update step counter dynamically
- Maintain collapsed state for completed chapters
- Auto-expand active chapter

### Jump-Ahead Handling
If user discusses Chapter 8 content while on Chapter 3:
- Reveal Chapter 8 immediately
- Show intermediate chapters as "skipped" state
- Update progress to show non-linear completion

---

## Visual Feedback Hierarchy

### Level 1: Subtle (Individual Fields)
- Green badge fade-in under AI message
- Checkmark animation on field save
- Source badge update (AI → edited)

### Level 2: Noticeable (Chapter Completion)
- Progress bar fills to milestone
- Chapter checkmark animation
- Toast notification: "Chapter 3 Complete! 🎉"

### Level 3: Celebratory (Major Milestones)
- 50% completion: Blue confetti animation
- 75% completion: Purple celebration
- 100% completion: Full-screen success state

---

## Recently Updated Fields View

**Always Accessible Via:**
- Swipe right from chat edge
- Tap "Recent" chip in Fields tab
- Automatic section in field review overlay

**Shows:**
- Last 5-10 field updates
- Timestamp (relative: "2 min ago")
- Before/after values
- Quick edit button
- Source attribution

**Layout:**
```
Recently Updated
────────────────
Brand Name (2 min ago)
"TechStart" [AI] [Edit]

Target Audience (5 min ago)
"Remote workers..." [edited] [Edit]

Mission Statement (12 min ago)
"To revolutionize..." [AI] [Edit]
```

---

## Settings & Preferences

### Auto-Accept Settings
Located in chat toolbar, persists per session:
- **Off (default):** Show review overlay for each extraction
- **On:** Auto-accept all AI extractions, show toast only
- **Smart:** Auto-accept if confidence > 80%

### Visual Preferences
- Reduce animations (accessibility)
- Increase contrast mode
- Larger touch targets option

---

## Responsive Breakpoints

### Mobile (320-768px)
- Full implementation as specified
- Single column layout
- Bottom sheet pattern
- Floating cards for editing

### Tablet (768-1024px)
- Side-by-side chat + fields (50/50 split)
- Floating cards become side panels
- Tab navigation becomes sidebar

### Desktop (1024px+)
- Two-panel layout as currently implemented
- All progressive disclosure rules apply
- Recently Updated as sticky sidebar section

---

## Animation Specifications

### Field Badge Appearance
- Duration: 300ms
- Easing: ease-out
- Effect: Fade in + slight scale (0.9 → 1.0)

### Review Overlay
- Duration: 400ms
- Easing: spring(stiffness: 300, damping: 30)
- Effect: Slide up from bottom

### Progress Updates
- Duration: 600ms
- Easing: ease-in-out
- Effect: Animated fill with glow

### Chapter Completion
- Duration: 1000ms
- Effect: Checkmark draw + pulse
- Confetti: 2-second particle animation

---

## Accessibility Considerations

### Screen Reader Support
- All badges have descriptive ARIA labels
- Field changes announced: "Brand Name field updated with TechStart"
- Progress updates announced at milestones

### Keyboard Navigation
- Tab through badges in chat
- Enter to edit field
- Escape to close overlays
- Arrow keys navigate field list

### Touch Targets
- Minimum 44x44px touch targets
- Extra padding on critical actions
- Avoid clustered interactive elements

---

## Success Metrics

### Engagement Metrics
- Fields populated via chat vs manual: Target 80/20 ratio
- Average time to 50% completion: < 10 minutes
- Overlay interaction rate: > 60% review before accept

### Usability Metrics
- Mis-taps on badges: < 5%
- Time to find recently updated: < 3 seconds
- Manual correction rate: < 15% of AI extractions

### Delight Metrics
- Progress celebration engagement
- Completion rate improvement
- User sentiment on field visibility

---

## Technical Implementation Notes

### State Management
```typescript
interface FieldExtractionState {
  pendingExtractions: FieldExtraction[]
  recentlyUpdated: FieldUpdate[]
  autoAcceptEnabled: boolean
  reviewOverlayVisible: boolean
}
```

### Chat Message Enhancement
```typescript
interface EnhancedMessage {
  content: string
  role: 'user' | 'assistant'
  extractedFields?: {
    fieldId: string
    value: string
    confidence: number
  }[]
  timestamp: Date
}
```

### Progressive Disclosure Logic
```typescript
function getVisibleChapters(fieldValues: FieldValues): Chapter[] {
  return chapters.filter(chapter =>
    chapter.fields.some(field =>
      fieldValues[field.id] !== undefined
    )
  )
}
```

---

## Next Steps

### Phase 1: Core Implementation (Week 1)
- [ ] In-chat extraction badges
- [ ] Field review overlay
- [ ] Auto-save functionality
- [ ] Recently updated view

### Phase 2: Progressive Disclosure (Week 2)
- [ ] Dynamic chapter visibility
- [ ] Step counter in header
- [ ] Jump-ahead handling
- [ ] Tab navigation

### Phase 3: Polish & Delight (Week 3)
- [ ] Animations and transitions
- [ ] Celebration states
- [ ] Accessibility enhancements
- [ ] Settings persistence

---

## Appendix: Design Decisions

### Why Multiple Interaction Patterns?
Combining tap-to-edit, floating cards, and tab switching provides flexibility for different user preferences and contexts. Power users can stay in chat, while users who prefer structure can use the Fields tab.

### Why Progressive Disclosure?
Reduces cognitive load by hiding irrelevant empty chapters while still allowing non-linear conversation flow when users jump ahead naturally.

### Why Review Overlay?
Builds trust by showing exactly what the AI extracted before committing changes. The "Accept All" option provides efficiency for confident users.

### Why Auto-Save?
Reduces friction and prevents data loss. Manual save buttons add unnecessary steps in a mobile context where network issues are common.

---

*This specification is a living document and will be updated based on user testing and implementation discoveries.*