/**
 * Layer 3 (service) — shared workbook styling helpers.
 *
 * The two gold workbooks (`IDEA BrandCoach InfinityVault Mockup.xlsx` and
 * `InfinityVault Marketing Investment Audit.xlsx`) share one visual vocabulary.
 * This module is the single source of truth for that look so that
 * `assembleWorkbookA.ts` and `assembleWorkbookB.ts` render identically.
 *
 * Every constant here was reverse-engineered verbatim from the gold workbooks'
 * `xl/styles.xml` (Arial font family; navy `1F4E78` titles/section heads; gray
 * `595959` captions; light-blue `D9E1F2` table headers; the green/yellow/orange
 * tier fills `E2EFDA`/`FFF2CC`/`FCE4D6`). Do not invent new colors — extend the
 * palette by reading more cells out of the gold files.
 *
 * Pure helpers only: nothing here touches Supabase, the network, or identity.
 * Consumers pass an ExcelJS row/cell/column/worksheet and these mutate its
 * style in place (the ExcelJS idiom), returning the same handle for chaining.
 */
import type { Row, Cell, Column, Worksheet } from 'exceljs';

/**
 * Gold palette — ARGB hex strings exactly as they appear in the gold
 * workbooks' styles.xml `fgColor`/font `color` entries (alpha prefix `FF`).
 */
export const GOLD_PALETTE = {
  /** Section-head + title text, also the dark fill behind white section heads. */
  navy: 'FF1F4E78',
  /** Caption / note prose (header notes, section notes). */
  gray: 'FF595959',
  /** White text on the navy section-head fill. */
  white: 'FFFFFFFF',
  /** Default body text. */
  black: 'FF000000',
  /** Column-header row fill (Workbook A table headers). */
  headerBlue: 'FFD9E1F2',
  /** Tier 1 fill (green) — "do first". */
  tier1Green: 'FFE2EFDA',
  /** Tier 2 fill (yellow) — "queue next". */
  tier2Yellow: 'FFFFF2CC',
  /** Tier 3 fill (orange) — "defer". */
  tier3Orange: 'FFFCE4D6',
} as const;

/** The gold workbooks are entirely Arial. */
export const GOLD_FONT_NAME = 'Arial';

/** Type-safe key into {@link GOLD_PALETTE}. */
export type GoldColorName = keyof typeof GOLD_PALETTE;

/** Tier identifiers used by Workbook B's Investment Matrix. */
export type WorkbookTier = 'T1' | 'T2' | 'T3';

/**
 * Maps a tier id to its gold fill ARGB. Unknown ids resolve to no fill
 * (returns `null`) so callers never crash on an unexpected tier string.
 */
export function tierFillArgb(tier: string): string | null {
  switch (tier) {
    case 'T1':
      return GOLD_PALETTE.tier1Green;
    case 'T2':
      return GOLD_PALETTE.tier2Yellow;
    case 'T3':
      return GOLD_PALETTE.tier3Orange;
    default:
      return null;
  }
}

/** Builds a solid-pattern fill spec from an ARGB hex. */
function solidFill(argb: string): NonNullable<Cell['fill']> {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/**
 * Applies the gold sheet-title style to a cell (16pt navy bold in Workbook A's
 * convention). Pass `size` to match a specific sheet (Workbook B titles are
 * 14pt).
 */
export function applyTitle(cell: Cell, size = 16): Cell {
  cell.font = { name: GOLD_FONT_NAME, size, bold: true, color: { argb: GOLD_PALETTE.navy } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  return cell;
}

/**
 * Applies the gold header-note / caption style (gray, small, wrapped). Used for
 * the self-flagging caveat lines under each sheet title.
 */
export function applyHeaderNote(cell: Cell, size = 10): Cell {
  cell.font = { name: GOLD_FONT_NAME, size, italic: true, color: { argb: GOLD_PALETTE.gray } };
  cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  return cell;
}

/**
 * Styles an entire row as a gold section-head: navy fill + white bold text
 * across every populated cell. Mirrors the gold "Stage 1 — …" / table-name
 * banner rows.
 */
export function applySectionTitleRow(row: Row, size = 12): Row {
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.fill = solidFill(GOLD_PALETTE.navy);
    cell.font = { name: GOLD_FONT_NAME, size, bold: true, color: { argb: GOLD_PALETTE.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });
  return row;
}

/**
 * Applies the gold section-note style to a cell (gray prose under a section
 * head — the descriptive sentence that explains what the table shows).
 */
export function applySectionNote(cell: Cell, size = 10): Cell {
  cell.font = { name: GOLD_FONT_NAME, size, color: { argb: GOLD_PALETTE.gray } };
  cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  return cell;
}

/**
 * Styles an entire row as a gold table column-header: light-blue fill + navy
 * bold text. Mirrors the gold table header rows ("Dimension | Score / 25 | …").
 */
export function applyColumnHeaderRow(row: Row, size = 10): Row {
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.fill = solidFill(GOLD_PALETTE.headerBlue);
    cell.font = { name: GOLD_FONT_NAME, size, bold: true, color: { argb: GOLD_PALETTE.navy } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: GOLD_PALETTE.navy } } };
  });
  return row;
}

/**
 * Applies the gold body-cell style (plain Arial, top-aligned, wrapped) to a
 * single cell. The default for ordinary data rows.
 */
export function applyBodyCell(cell: Cell, size = 10): Cell {
  cell.font = { name: GOLD_FONT_NAME, size, color: { argb: GOLD_PALETTE.black } };
  cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  return cell;
}

/**
 * Tints a single cell with the tier fill for `tier` (green/yellow/orange).
 * Leaves the cell unfilled for unknown tiers. Returns whether a fill was set.
 */
export function applyTierFill(cell: Cell, tier: string): boolean {
  const argb = tierFillArgb(tier);
  if (argb === null) return false;
  cell.fill = solidFill(argb);
  return true;
}

/**
 * Applies the gold body style to every cell in a data row, then (if `tier` is
 * given and known) tints the whole row with its tier fill. Mirrors Workbook B's
 * Investment Matrix where each T1/T2/T3 row is color-banded.
 */
export function applyDataRow(row: Row, options: { size?: number; tier?: string } = {}): Row {
  const { size = 10, tier } = options;
  const tierArgb = tier !== undefined ? tierFillArgb(tier) : null;
  row.eachCell({ includeEmpty: false }, (cell) => {
    applyBodyCell(cell, size);
    if (tierArgb !== null) {
      cell.fill = solidFill(tierArgb);
    }
  });
  return row;
}

/**
 * A column-width spec: one entry per column, left to right (1-indexed in the
 * sheet). Mirrors the `width=` attributes in the gold worksheets' `<cols>`.
 */
export type ColumnWidths = readonly number[];

/**
 * Gold column widths for Workbook A's wide content sheets (title / 4-up content
 * blocks): cols 1-5 = 22, 28, 30, 30, 20 (verbatim from gold sheet1 `<cols>`).
 */
export const WORKBOOK_A_COLUMN_WIDTHS: ColumnWidths = [22, 28, 30, 30, 20];

/**
 * Gold column widths for Workbook B's Investment Matrix:
 * Tier(6) Investment(32) What-it-is(50) Calendar(16) Hours(18) Effort(20)
 * Cash(26) then the four benefit columns at 18 each (verbatim from gold).
 */
export const WORKBOOK_B_COLUMN_WIDTHS: ColumnWidths = [6, 32, 50, 16, 18, 20, 26, 18, 18, 18, 18];

/**
 * Sets column widths on a worksheet from a left-to-right width list. Columns
 * beyond the list keep their default width; a width of 0 or negative is skipped.
 */
export function applyColumnWidths(sheet: Worksheet, widths: ColumnWidths): void {
  widths.forEach((width, index) => {
    if (width <= 0) return;
    const column: Column = sheet.getColumn(index + 1);
    column.width = width;
  });
}

/**
 * Estimates a fit-to-content column width from the longest string in a set of
 * cell values, clamped to `[min, max]`. Useful when a sheet has no gold-fixed
 * width to copy. Width units are Excel "character" units (~1 per char).
 */
export function calcColumnWidth(
  values: readonly string[],
  options: { min?: number; max?: number; padding?: number } = {},
): number {
  const { min = 8, max = 60, padding = 2 } = options;
  const longest = values.reduce((acc, value) => {
    const longestLine = value
      .split('\n')
      .reduce((lineAcc, line) => Math.max(lineAcc, line.length), 0);
    return Math.max(acc, longestLine);
  }, 0);
  return Math.min(max, Math.max(min, longest + padding));
}
