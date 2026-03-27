# V2 Brand Coach — Critical Path Gaps

> Verified 2026-03-26 against actual codebase. Each gap confirmed by reading source code.

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

## Verified Gaps

### Gap 1: ExportReadinessModal Not Wired (CRITICAL)

**Status:** Infrastructure complete, wiring missing

The export flow bypasses completeness checking entirely:
- `ExportReadinessModal` component: BUILT (shows % complete, warnings, strengths, quick wins)
- `useExportReadiness` hook: BUILT (weighted field analysis, quick win identification)
- **Neither is called from BrandCoachV2 or BrandMarkdownExport**

Users can generate a document from incomplete data with no warning.

**Fix:** Wire `useExportReadiness` into `BrandMarkdownExport` to show modal before export.

### Gap 2: Chapter-Specific AI Prompts (HIGH)

**Status:** PARTIALLY ADDRESSED

- Chapter context IS passed to edge function and used for **field tiering** (current chapter fields shown in full, others summarized)
- System prompt does NOT vary by chapter — same comprehensive IDEA overview regardless of chapter
- Domain tone adaptations exist in prompts.ts but are generic, not chapter-triggered

**Fix:** Add chapter-specific prompt sections that prime Trevor for the current chapter's focus areas.

### Gap 3: Missing Field Names on Chapter Completion (HIGH)

**Status:** CONFIRMED

`useChapterProceeding.ts` shows generic toast: "Complete Required Fields" / "Please chat with Trevor to complete all fields..."

Required fields ARE defined per chapter in `chapterFields.ts` with names and `required: boolean`. This data exists but isn't surfaced in the error message.

**Fix:** List missing field names in the toast or a popover.

### Gap 4: Journey Complete Celebration (ALREADY FIXED)

**Status:** NOT A GAP

`MilestoneCelebration.tsx` has full implementation:
- `fields_milestone`: every 5 fields → "Great Progress!"
- `chapter_complete`: confetti + "Chapter Complete!"
- `all_complete`: trophy + "Brand Profile Complete!" + confetti

May need verification that it's wired into BrandCoachV2 page.

### Gap 5: Export Readiness Quick Wins Not Actionable (PARTIALLY ADDRESSED)

**Status:** Modal wired to emit `(fieldId, chapterId)` on click, but parent doesn't handle it

`ExportReadinessModal` accepts `onQuickWinClick?: (fieldId: string, chapterId: string) => void` — the callback exists but no parent passes a handler.

**Fix:** Wire handler to navigate to chapter and focus the field, or auto-prompt Trevor.

### Gap 6: Book Panel Content is Static (CONFIRMED)

**Status:** Hardcoded content, dynamic tab switching

`IdeaBookPanel.tsx` has `IDEA_BOOK_CONTENT` hardcoded (comment: "this would ideally come from a database or System KB"). Tab switching IS reactive to chat topics, but content is placeholder excerpts.

**Fix:** Replace with actual IDEA book content. Lower priority — doesn't block value delivery.

### Gap 7: Resume from Chapter (ALREADY FIXED)

**Status:** NOT A GAP

`useChapterProgress.ts` automatically restores chapter state from `session.chapter_metadata` on page load. User lands on their last active chapter. No explicit "Resume" button needed.

## Priority Matrix

| Gap | Severity | Effort | Blocks Value? |
|-----|----------|--------|---------------|
| 1: Wire ExportReadinessModal | CRITICAL | Low | Yes — no quality gate before export |
| 3: Show missing field names | HIGH | Low | Partially — confusing UX |
| 2: Chapter-specific prompts | HIGH | Medium | No — chat works, just less guided |
| 5: Actionable quick wins | MEDIUM | Medium | No — modal shows info, just not navigable |
| 6: Dynamic book content | MEDIUM | Medium | No — placeholder content, not blocking |
| 4: Journey celebration | DONE | — | — |
| 7: Resume flow | DONE | — | — |

## Gap 1 Fix: Wiring Diagram

```
CURRENT FLOW (broken):
  User clicks "Download" → BrandMarkdownExport.handleExport() → generates document
  (No completeness check, ExportReadinessModal never shown)

TARGET FLOW:
  User clicks "Download"
    → useExportReadiness(fieldValues) computes readiness
    → ExportReadinessModal shown with:
        - Overall % complete
        - Critical warnings (missing key fields)
        - Quick wins (highest-impact empty fields)
        - "Export Anyway" / "Continue Building" buttons
    → If "Export Anyway": BrandMarkdownExport.handleExport()
    → If quick win clicked: navigate to chapter + focus field
```

## Orphaned Code to Clean Up

| File | Status | Action |
|------|--------|--------|
| `GenerateDocumentUseCase.ts` | Orphaned, no callers | Delete or defer |
| `usePDFGeneration.ts` | Stub, calls non-existent edge fn | Delete or implement |
| `generate-brand-strategy-document-v2/` | Never called, superseded | Mark deprecated |
