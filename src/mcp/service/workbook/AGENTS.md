# Workbook Assemblers + Export — Agent & Testing Context

Feature-local instructions for the **gold-workbook export engine** (the terminal stage of
the output engine). For the shared test account and live-QA setup see `docs/TEST_ACCOUNT.md`;
for the input-context spec see `brand-coach-mcp-planning/OUTPUT_CONTEXT_MANIFEST.md`; for the
end-to-end audit see `brand-coach-mcp-planning/E2E_GAP_REPORT.md`.

## What this feature is

Turns the **persisted IDEA artifact chain** into the two Trevor-approved gold .xlsx outputs:

- **Workbook A** — `IDEA BrandCoach InfinityVault Mockup.xlsx`: Trust Gap diagnostic → Avatar
  2.0 (S1-S4 + Signature) → Brand Canvas → Export Brief → Audit×IDEA.
- **Workbook B** — `InfinityVault Marketing Investment Audit.xlsx`: tiered investment matrix +
  90-day rollout phasing.

**Acceptance bar:** sheet/section structure matches the committed gold fixtures
(`src/mcp/__tests__/fixtures/workbook-{a,b}.json`), every fabrication-gated claim is
evidence-backed or owner-confirmed, and a live `mcp:dev` call produces openable files.

## CRITICAL rule — assembly reads persisted artifacts ONLY

The assemblers are **PURE functions over already-persisted artifact content**. They NEVER
regenerate, NEVER call an edge fn, NEVER touch Supabase or the network. This is what makes
export deterministic and fixture-testable: the same artifact map always renders the same
structure. All reads/writes (chain read, optional Storage upload) live in the *tool*
(`exportWorkbook.ts`), not the assemblers. **Do not add a network call to an assembler.**

## The pieces

| Layer | Path | Notes |
|-------|------|-------|
| Assembler A | `assembleWorkbookA.ts` | `assembleWorkbookA(map)` + `projectWorkbookAArtifacts(rows)`. Renders 5 sheets: `3. Diagnostic (IV)`, `4. Avatar 2.0 (IV)`, `5. Brand Canvas (IV)`, `6. Export Brief`, `7. Audit × IDEA`. Gold sheets 1-2 are static narrative, NOT rendered. A sheet is emitted only when its backing artifact is in the chain map. |
| Assembler B | `assembleWorkbookB.ts` | `assembleWorkbookB(record)` + `type MarketingAuditRecord`. Renders `Investment Matrix` + `Recommended Phasing` from one `marketing_audits` row (`investments` / `rollout` jsonb). Numeric cells (cumulative-impact bands) are preserved as real numbers, not regenerated strings. |
| Shared style | `style.ts` | One visual vocabulary for both: `applyTitle`, `applySectionTitleRow`, `applyColumnHeaderRow`, `applyDataRow`, `applyColumnWidths`, `WORKBOOK_A_COLUMN_WIDTHS`. Section banners / light-blue header rows / gray notes / gold widths. |
| Export tool | `../../tools/exportWorkbook.ts` | `export_workbook` MCP tool (`gateWrite`, never-fail upload). Reads chain (A) or current `marketing_audits` (B), renders, writes to `out_dir \|\| os.tmpdir()`. |

## Tool surface (`export_workbook`)

Input: `{ which: 'A'|'B', avatar_id?, out_dir?, brand_name?, upload?: boolean (default false) }`.
- `which:'A'` → `getChain` → `projectWorkbookAArtifacts` → `assembleWorkbookA`. Empty chain →
  `needs_input` listing missing kinds; nothing written.
- `which:'B'` → current `marketing_audits` row → `assembleWorkbookB`. No audit → `needs_input`.
- Success: `{ ok:true, path, sheets[], missing[], uploaded? }`. Identity-gated — anonymous → isError.

## How to test it

### Fixture / unit (no network, the gate)
```
npx vitest run --dir src/mcp        # 229 passed / 21 files (includes workbookA/B + exportTool)
npm run typecheck:mcp               # exit 0
```
Assembler suites: `workbookA.test.ts` (cell structure vs gold fixture A), `workbookB.test.ts`
(matrix tiering + phasing vs fixture B; the matrix has **19** move rows — the test derives
`GOLD_MOVE_COUNT` from the fixture, the "20 moves" code comment is stale), `exportTool.test.ts`.

### Live end-to-end (writes real .xlsx)
Run the rehearsals (live Supabase awake + QA account confirmed, `docs/TEST_ACCOUNT.md`):
```
npx tsx scripts/rehearsal-output-engine.ts      # fresh avatar, full chain, export A+B → /tmp/rehearsal-output-engine
npx tsx scripts/rehearsal-consistency.ts        # same avatar, never-ask-twice + export determinism → /tmp/rehearsal-consistency
```
Then open the .xlsx with openpyxl and verify against the gold originals in `~/Downloads`.

### Verify the output (openpyxl)
```python
import openpyxl
wb = openpyxl.load_workbook('/tmp/rehearsal-output-engine/InfinityVault-BrandCoach-Mockup.xlsx')
print(wb.sheetnames)   # ['3. Diagnostic (IV)', '4. Avatar 2.0 (IV)', '5. Brand Canvas (IV)', '6. Export Brief', '7. Audit × IDEA']
```

## Sample data

The complete IV chain lives under QA avatar `d6185f56-7ade-4c26-83d2-c076187117b1` (all 8
artifact kinds current). To re-resolve it, query `artifacts WHERE superseded_by IS NULL AND
avatar_id=…`. Marketing audit content: 13 investment rows / 4 rollout phases, grounding=evidence.

## Guardrails / known gaps (see E2E_GAP_REPORT.md for detail)

- **R1 (HIGH):** same-avatar REGENERATION is blocked by `saveArtifact` insert-then-supersede
  (`uq_artifacts_current_per_kind`). Export then silently re-renders the PRIOR chain (stale
  hazard). Fix in `artifactStore.ts` (supersede-before-insert), NOT here. Regen needs a fresh avatar.
- **R3 (LOW):** `export_workbook` does NOT `mkdir` its `out_dir` → ENOENT if absent. Rehearsals
  `mkdirSync` first. Fix: `mkdir -p` before `writeFile`.
- Assembly is a pure function — keep it that way; all I/O belongs in the tool.
- Migrations stay ADDITIVE only; never modify the existing Alpha tables.
