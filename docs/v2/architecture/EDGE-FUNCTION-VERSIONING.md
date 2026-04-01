# Edge Function Versioning — `generate-brand-strategy-*`

**Status**: Planned
**Date**: 2026-03-27
**Authors**: Matthew Kerns, Claude (AI pair)

---

## Current State

Four edge functions share the `generate-brand-strategy` prefix with inconsistent naming:

| Directory | Lines | Model | Approach | Frontend Refs |
|---|---|---|---|---|
| `generate-brand-strategy-document` | 1,194 | gpt-4o | Single-pass: AI generates all 13 sections in one call using semantic retrieval queries | `MarkdownExportService:215` (V1 path) |
| `generate-brand-strategy-document-v2` | 1,261 | gpt-4o-mini | Single-pass with Trevor voice + skills vector store | **None — dead code** |
| `generate-brand-strategy-section` | 1,075 | gpt-4o-mini | Per-section generation; client orchestrates batches via `MarkdownExportService` | `MarkdownExportService:276` (V2 path) |
| `generate-brand-strategy-pdf` | 876 | None (no AI) | Pure HTML template from knowledge base + competitive analysis data | **None — unreferenced** |

### How V1 vs V2 Export Works

**V1** (`MarkdownExportService.generateV1`):
- Calls `generate-brand-strategy-document` once
- AI generates entire document in a single gpt-4o call
- Higher cost per call (~$0.15) but simpler

**V2** (`MarkdownExportService.generateV2`):
- Client-side orchestration with batch ordering (`SECTION_BATCHES` array)
- Calls `generate-brand-strategy-section` once per section (13 calls)
- Batches run in parallel (batch 1, 2, 3, then dependencies 97, 98, 99)
- Uses gpt-4o-mini (~$0.003/section) with Trevor voice directive
- Per-section retry on failure

### Dead Code

**`generate-brand-strategy-document-v2`**: An intermediate iteration that added Trevor voice and gpt-4o-mini to the single-pass approach. Superseded when the architecture shifted to per-section generation. Never wired into the frontend.

**`generate-brand-strategy-pdf`**: Generates HTML (not PDF) from raw knowledge base data without any AI. Appears to be an early export prototype. Never wired into the frontend.

---

## Proposed Refactoring

### Option A: Rename + Delete

| Current | Action | New Name | Notes |
|---|---|---|---|
| `generate-brand-strategy-document` | Rename | `generate-brand-strategy-document-v1` | Update `MarkdownExportService:215` |
| `generate-brand-strategy-document-v2` | **Delete** | — | Dead code, superseded by section-based V2 |
| `generate-brand-strategy-section` | Keep | `generate-brand-strategy-section` | Active V2, name is clear |
| `generate-brand-strategy-pdf` | **Delete** | — | Unreferenced HTML template generator |

### Option B: Rename Only (Conservative)

| Current | Action | New Name |
|---|---|---|
| `generate-brand-strategy-document` | Rename | `generate-brand-strategy-document-v1` |
| `generate-brand-strategy-document-v2` | Rename | `generate-brand-strategy-document-v2-deprecated` |
| `generate-brand-strategy-section` | Keep | `generate-brand-strategy-section` |
| `generate-brand-strategy-pdf` | Rename | `generate-brand-strategy-html-v1` |

### Steps (Either Option)

1. Rename directories under `supabase/functions/`
2. Update `MarkdownExportService.ts` reference to `generate-brand-strategy-document` (line 215)
3. Redeploy renamed functions: `supabase functions deploy <new-name>`
4. Verify V1 and V2 export paths still work
5. Delete old function deployments from Supabase dashboard if renamed

### Cost Note

The V1 path uses gpt-4o ($2.50/$10 per 1M tokens). If V1 is still used, migrating it to gpt-4o-mini would save ~94% on document generation calls. Alternatively, deprecate V1 entirely in favour of the V2 section-based approach.

---

**Last Updated**: 2026-03-27
