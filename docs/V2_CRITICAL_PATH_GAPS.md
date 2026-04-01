# V2 Brand Coach — Critical Path Gaps

> Last updated 2026-04-01. All gaps verified and resolved.

## Current State: What Works

The core value loop is **functional end-to-end**:

```
Auth → Chat with Trevor → Fields Auto-Extract → Accept/Reject → Save to DB → Complete Chapters
```

Document generation infrastructure **exists and works**:
- `BrandMarkdownExport` component handles export UI
- `MarkdownExportService` orchestrates batch section generation
- `generate-brand-strategy-section` edge function generates per-section content
- 13 IDEA-aligned sections generated in 5 batches with retry logic

## Gap Status Summary

| Gap | Status | Resolution |
|-----|--------|------------|
| 1: Wire ExportReadinessModal | **DONE** | Wired into `BrandMarkdownExport` via optional `fieldValues` prop; modal shown before export in v2 |
| 2: Chapter-specific AI prompts | **DONE** | Added `getChapterGuidance()` in edge function `prompts.ts`; Trevor adapts per chapter |
| 3: Show missing field names | **DONE** | `useChapterProceeding` toast now lists up to 5 specific field names with overflow |
| 4: Journey celebration | **DONE** | `MilestoneCelebration` wired into BrandCoachV2 — field milestones, chapter confetti, final trophy |
| 5: Actionable quick wins | **DEFERRED** | By design — modal shows readiness info; "Continue Building" closes modal without navigation |
| 6: Dynamic book content | **DONE** | Extracted to `src/v2/constants/idea-book-content.ts`; IdeaBookPanel imports from constants |
| 7: Resume from chapter | **DONE** | Was never a gap — `useChapterProgress` restores chapter state from session metadata |

## Resolved Details

### Gap 1: ExportReadinessModal Wired (commit f1a7...)

- `BrandMarkdownExport` accepts optional `fieldValues` prop
- When provided, clicking export shows `ExportReadinessModal` first
- "Export Anyway" proceeds with generation; "Continue Building" closes
- V1 usage (no `fieldValues`) unchanged — direct export

### Gap 2: Chapter-Specific AI Prompts (commit f5e4...)

- `getChapterGuidance(chapterNumber)` returns 2-3 sentence coaching focus per chapter
- Maps all 11 chapters to IDEA phases: Identify (1-3), Discover (4-6), Execute (7-9), Analyze (10-11)
- Appended to Trevor's system prompt; graceful fallback for invalid chapters

### Gap 3: Missing Field Names in Toast (commit f1a7...)

- `useChapterProceeding` now shows: "3 Fields Remaining — Missing: Brand Purpose, Brand Vision, Brand Mission"
- Up to 5 field names shown with "+N more" overflow
- Directs user: "Chat with Trevor to complete them"

### Gap 4: Milestone Celebrations (commit f5e4...)

- `useMilestoneCelebration` hook wired into `useBrandCoachV2State`
- Field milestones every 5 fields saved
- Chapter completion triggers confetti
- Final chapter shows trophy + "Brand Profile Complete"
- Auto-dismiss after 5 seconds

### Gap 5: Quick Win Navigation (DEFERRED)

- `ExportReadinessModal` accepts `onQuickWinClick` callback but no parent wires it
- User chose "just close modal" behavior — clicking "Continue Building" closes and returns to chat
- Can be wired later if user testing shows demand for direct field navigation

### Gap 6: Book Content Extraction (this commit)

- `IDEA_BOOK_CONTENT` and `KEY_CONCEPTS` moved from `IdeaBookPanel.tsx` to `src/v2/constants/idea-book-content.ts`
- Component reduced from 315 to 168 lines (data separated from UI)
- Content remains static — appropriate since it's framework reference material, not user data

## Orphaned Code Cleanup (this commit)

| File | Action |
|------|--------|
| `src/v2/application/use-cases/GenerateDocumentUseCase.ts` | Deleted — orphaned, no imports |
| `src/v2/application/use-cases/CreateBrandUseCase.ts` | Deleted — architectural stub, no imports |
| `src/v2/application/use-cases/CreateAvatarUseCase.ts` | Deleted — architectural stub, no imports |
| `src/v2/application/use-cases/UpdateFieldsFromChatUseCase.ts` | Deleted — architectural stub, no imports |
| `src/v2/application/` directory | Deleted — empty after use-case removal |
| `supabase/functions/generate-brand-strategy-document-v2/` | Deleted — never called, superseded by `generate-brand-strategy-section` |

### Not in v2 Scope

| File | Status | Note |
|------|--------|------|
| `src/hooks/usePDFGeneration.ts` | Broken stub | Calls non-existent `generate-pdf` edge fn; used by v1 Dashboard.tsx only |
