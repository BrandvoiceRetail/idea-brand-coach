// @vitest-environment node
/**
 * Phase 6 Agent B — assembleWorkbookB structure test.
 *
 * Load-bearing assertions (per the goal prompt: "from fixture-B-derived audit content,
 * sheet/column/row-count structure matches"):
 *
 *  1. The workbook has exactly the two gold sheets, named "Investment Matrix" and
 *     "Recommended Phasing", in order.
 *  2. "Investment Matrix": title + self-flagging header note cells; the 11 gold column
 *     headers verbatim/in order; exactly one color-banded data row per persisted move;
 *     the Tier-legend block (3 rows) and the benefit-notes block (5 caveats).
 *  3. "Recommended Phasing": title + header note; the 5 phase columns + one row per
 *     persisted phase; the cumulative-impact grid (5 columns, one row per horizon, with
 *     low/mid/high preserved as NUMBERS); the caveats block.
 *  4. Assembly is PURE over persisted data — two assembles of the same audit produce
 *     structurally identical sheets (deterministic, no regeneration).
 *  5. Contract-gated: a persisted row whose jsonb fails the Phase-0 contract throws
 *     (no silent half-rendered workbook).
 *
 * The audit content under test is DERIVED FROM the committed gold fixture B so the rows,
 * columns, and counts trace back to the Trevor-approved workbook, not to invented data.
 */
import { describe, it, expect } from 'vitest';
import type { Worksheet } from 'exceljs';
import workbookBFixture from './fixtures/workbook-b.json';
import {
  marketingAuditOutputSchema,
  rolloutPlanOutputSchema,
  type MarketingAuditOutput,
  type RolloutPlanOutput,
  type InvestmentRow,
  type RolloutPhase,
  type CumulativeImpactRow,
} from '../contracts/index.js';
import {
  assembleWorkbookB,
  type MarketingAuditRecord,
  WORKBOOK_B_SHEET_NAMES,
  INVESTMENT_MATRIX_COLUMNS,
  PHASING_COLUMNS,
  CUMULATIVE_IMPACT_COLUMNS,
} from '../service/workbook/assembleWorkbookB.js';

// ---------------------------------------------------------------------------
// Fixture → contract-shaped audit record. We read the gold fixture's two sheets
// and re-key the rows into the InvestmentRow / RolloutPhase / CumulativeImpactRow
// contract shapes, so the structure under test is grounded in the gold workbook.
// ---------------------------------------------------------------------------

interface FixtureTable {
  name: string | null;
  note: string | null;
  columns: string[];
  rows: Array<Array<string | number>>;
}
interface FixtureSheet {
  sheet: string;
  title: string;
  header_note: string;
  tables: FixtureTable[];
}
const fixtureSheets = (workbookBFixture as { sheets: FixtureSheet[] }).sheets;
const matrixSheet = fixtureSheets.find((s) => s.sheet === 'Investment Matrix');
const phasingSheet = fixtureSheets.find((s) => s.sheet === 'Recommended Phasing');
if (!matrixSheet || !phasingSheet) throw new Error('fixture B is missing an expected sheet');

/** The Investment Matrix data table is the first table whose name is null. */
const matrixTable = matrixSheet.tables.find((t) => t.name === null);
if (!matrixTable) throw new Error('fixture B Investment Matrix table not found');

/** The phasing data table is the first null-named table on the phasing sheet. */
const phaseTable = phasingSheet.tables.find((t) => t.name === null);
const cumulativeTable = phasingSheet.tables.find((t) =>
  (t.name ?? '').startsWith('Cumulative impact'),
);
if (!phaseTable || !cumulativeTable) throw new Error('fixture B phasing tables not found');

const GOLD_MOVE_COUNT = matrixTable.rows.length; // 20 moves in gold B
const GOLD_PHASE_COUNT = phaseTable.rows.length; // 4 phases
const GOLD_HORIZON_COUNT = cumulativeTable.rows.length; // 4 horizons

function toInvestmentRow(cells: Array<string | number>): InvestmentRow {
  const c = cells.map((v) => String(v));
  return {
    tier: c[0] as InvestmentRow['tier'],
    investment: c[1],
    what_it_is: c[2],
    calendar_time: c[3],
    person_hours: c[4],
    level_of_effort: c[5],
    cash_cost: c[6],
    benefit_1mo: c[7],
    benefit_3mo: c[8],
    benefit_6mo: c[9],
    benefit_12mo: c[10],
  };
}

function toPhase(cells: Array<string | number>): RolloutPhase {
  const c = cells.map((v) => String(v));
  return { phase: c[0], window: c[1], action: c[2], cash_needed: c[3], why_now: c[4] };
}

function toCumulative(cells: Array<string | number>): CumulativeImpactRow {
  return {
    horizon: String(cells[0]),
    low: Number(cells[1]),
    mid: Number(cells[2]),
    high: Number(cells[3]),
    notes: String(cells[4]),
  };
}

function buildAuditRecord(): MarketingAuditRecord {
  const investments: MarketingAuditOutput = {
    rows: matrixTable!.rows.map(toInvestmentRow),
    grounding: 'evidence',
    evidence_refs: [{ kind: 'business_fact', ref: 'revenue/margin/ad metrics (slot #8)' }],
  };
  const rollout: RolloutPlanOutput = {
    phases: phaseTable!.rows.map(toPhase),
    cumulative_impact: cumulativeTable!.rows.map(toCumulative),
    grounding: 'evidence',
    evidence_refs: [{ kind: 'business_fact', ref: 'cash timing (slot #9)' }],
  };
  // Sanity: the derived content must itself satisfy the Phase-0 contracts.
  marketingAuditOutputSchema.parse(investments);
  rolloutPlanOutputSchema.parse(rollout);
  return { investments, rollout };
}

/** Read a worksheet's column-A string values, top to bottom (for section detection). */
function colAValues(sheet: Worksheet): string[] {
  const out: string[] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const v = row.getCell(1).value;
    out.push(v == null ? '' : String(v));
  });
  return out;
}

/** Find the 1-based row index whose column-A value exactly equals `label`. */
function rowIndexOf(sheet: Worksheet, label: string): number {
  return colAValues(sheet).findIndex((v) => v === label) + 1;
}

describe('assembleWorkbookB — structure vs gold fixture B', () => {
  it('produces exactly the two gold sheets, named + ordered', () => {
    const wb = assembleWorkbookB(buildAuditRecord());
    expect(wb.worksheets.map((s) => s.name)).toEqual([...WORKBOOK_B_SHEET_NAMES]);
    expect(WORKBOOK_B_SHEET_NAMES).toEqual(['Investment Matrix', 'Recommended Phasing']);
  });

  describe('Investment Matrix sheet', () => {
    const wb = assembleWorkbookB(buildAuditRecord());
    const sheet = wb.getWorksheet('Investment Matrix');
    if (!sheet) throw new Error('Investment Matrix sheet missing');

    it('renders the gold title + self-flagging header note', () => {
      expect(sheet.getCell('A1').value).toBe(matrixSheet!.title);
      expect(sheet.getCell('A2').value).toBe(matrixSheet!.header_note);
    });

    it('renders the 11 gold column headers verbatim + in order', () => {
      const headerRowIdx = rowIndexOf(sheet, 'Tier');
      expect(headerRowIdx).toBeGreaterThan(0);
      const headerRow = sheet.getRow(headerRowIdx);
      const headers = INVESTMENT_MATRIX_COLUMNS.map((_, i) => headerRow.getCell(i + 1).value);
      expect(headers).toEqual([...INVESTMENT_MATRIX_COLUMNS]);
      expect(INVESTMENT_MATRIX_COLUMNS).toHaveLength(matrixTable!.columns.length);
      expect([...INVESTMENT_MATRIX_COLUMNS]).toEqual(matrixTable!.columns);
    });

    it('renders exactly one data row per persisted move, with every cell populated', () => {
      const headerRowIdx = rowIndexOf(sheet, 'Tier');
      // The GOLD_MOVE_COUNT rows immediately after the header are the moves.
      for (let i = 0; i < GOLD_MOVE_COUNT; i++) {
        const dataRow = sheet.getRow(headerRowIdx + 1 + i);
        const tier = String(dataRow.getCell(1).value);
        expect(['T1', 'T2', 'T3']).toContain(tier);
        // All 11 columns are non-empty (benefit bands are free-text strings, never blank).
        for (let c = 1; c <= INVESTMENT_MATRIX_COLUMNS.length; c++) {
          expect(String(dataRow.getCell(c).value).length).toBeGreaterThan(0);
        }
      }
    });

    it('tier-bands each data row with its gold fill color', () => {
      const headerRowIdx = rowIndexOf(sheet, 'Tier');
      const fillByTier: Record<string, string> = {
        T1: 'FFE2EFDA',
        T2: 'FFFFF2CC',
        T3: 'FFFCE4D6',
      };
      for (let i = 0; i < GOLD_MOVE_COUNT; i++) {
        const dataRow = sheet.getRow(headerRowIdx + 1 + i);
        const tier = String(dataRow.getCell(1).value);
        const fill = dataRow.getCell(1).fill;
        expect(fill?.type).toBe('pattern');
        const argb = fill?.type === 'pattern' ? fill.fgColor?.argb : undefined;
        expect(argb).toBe(fillByTier[tier]);
      }
    });

    it('renders the Tier-legend block (banner + 3 legend rows)', () => {
      const legendIdx = rowIndexOf(sheet, 'Tier legend:');
      expect(legendIdx).toBeGreaterThan(0);
      // T1 / T2 / T3 legend rows follow the banner.
      expect(String(sheet.getRow(legendIdx + 1).getCell(1).value)).toBe('T1');
      expect(String(sheet.getRow(legendIdx + 2).getCell(1).value)).toBe('T2');
      expect(String(sheet.getRow(legendIdx + 3).getCell(1).value)).toBe('T3');
      // Each legend row carries its meaning in column B.
      expect(String(sheet.getRow(legendIdx + 1).getCell(2).value).length).toBeGreaterThan(0);
    });

    it('renders the benefit-notes block (banner + 5 caveat lines)', () => {
      const notesIdx = rowIndexOf(sheet, 'Notes on benefit estimates:');
      expect(notesIdx).toBeGreaterThan(0);
      for (let i = 1; i <= 5; i++) {
        expect(String(sheet.getRow(notesIdx + i).getCell(1).value).startsWith('•')).toBe(true);
      }
    });
  });

  describe('Recommended Phasing sheet', () => {
    const wb = assembleWorkbookB(buildAuditRecord());
    const sheet = wb.getWorksheet('Recommended Phasing');
    if (!sheet) throw new Error('Recommended Phasing sheet missing');

    it('renders the gold title + header note', () => {
      expect(sheet.getCell('A1').value).toBe(phasingSheet!.title);
      expect(sheet.getCell('A2').value).toBe(phasingSheet!.header_note);
    });

    it('renders the 5 phase columns + one row per persisted phase', () => {
      const headerIdx = rowIndexOf(sheet, 'Phase');
      expect(headerIdx).toBeGreaterThan(0);
      const headerRow = sheet.getRow(headerIdx);
      const headers = PHASING_COLUMNS.map((_, i) => headerRow.getCell(i + 1).value);
      expect(headers).toEqual([...PHASING_COLUMNS]);
      for (let i = 0; i < GOLD_PHASE_COUNT; i++) {
        const phaseRow = sheet.getRow(headerIdx + 1 + i);
        // Phase label starts with "Phase"; all 5 cells populated.
        expect(String(phaseRow.getCell(1).value).startsWith('Phase')).toBe(true);
        for (let c = 1; c <= PHASING_COLUMNS.length; c++) {
          expect(String(phaseRow.getCell(c).value).length).toBeGreaterThan(0);
        }
      }
    });

    it('renders the cumulative-impact grid (banner + 5 columns + one row per horizon)', () => {
      const bannerIdx = colAValues(sheet).findIndex((v) =>
        v.startsWith('Cumulative impact'),
      );
      expect(bannerIdx).toBeGreaterThanOrEqual(0);
      const headerRow = sheet.getRow(bannerIdx + 2); // banner, then column header
      const headers = CUMULATIVE_IMPACT_COLUMNS.map((_, i) => headerRow.getCell(i + 1).value);
      expect(headers).toEqual([...CUMULATIVE_IMPACT_COLUMNS]);
      // One numeric row per horizon, low/mid/high preserved as numbers.
      for (let i = 0; i < GOLD_HORIZON_COUNT; i++) {
        const dataRow = sheet.getRow(bannerIdx + 3 + i);
        expect(String(dataRow.getCell(1).value).startsWith('Month')).toBe(true);
        expect(typeof dataRow.getCell(2).value).toBe('number');
        expect(typeof dataRow.getCell(3).value).toBe('number');
        expect(typeof dataRow.getCell(4).value).toBe('number');
      }
    });

    it('preserves the gold cumulative-impact numbers exactly (no regeneration)', () => {
      // findIndex is 0-based; the banner's 1-based row is bannerIdx+1, the column header
      // is bannerIdx+2, and the first cumulative data row is bannerIdx+3 (1-based getRow).
      const bannerIdx = colAValues(sheet).findIndex((v) => v.startsWith('Cumulative impact'));
      const goldFirst = cumulativeTable!.rows[0];
      const renderedRow = sheet.getRow(bannerIdx + 3);
      expect(renderedRow.getCell(2).value).toBe(Number(goldFirst[1]));
      expect(renderedRow.getCell(3).value).toBe(Number(goldFirst[2]));
      expect(renderedRow.getCell(4).value).toBe(Number(goldFirst[3]));
    });

    it('renders the caveats block (banner + 5 caveat lines)', () => {
      const caveatsIdx = rowIndexOf(sheet, 'Caveats:');
      expect(caveatsIdx).toBeGreaterThan(0);
      for (let i = 1; i <= 5; i++) {
        expect(String(sheet.getRow(caveatsIdx + i).getCell(1).value).startsWith('•')).toBe(true);
      }
    });
  });

  it('is deterministic — two assembles produce structurally identical sheets', () => {
    const a = assembleWorkbookB(buildAuditRecord());
    const b = assembleWorkbookB(buildAuditRecord());
    for (const name of WORKBOOK_B_SHEET_NAMES) {
      const sa = a.getWorksheet(name);
      const sb = b.getWorksheet(name);
      expect(sa && sb).toBeTruthy();
      expect(sa!.rowCount).toBe(sb!.rowCount);
      expect(colAValues(sa!)).toEqual(colAValues(sb!));
    }
  });

  it('throws when persisted investments jsonb fails the marketing_audit contract', () => {
    const bad: MarketingAuditRecord = {
      investments: { rows: [], grounding: 'evidence', evidence_refs: [] }, // rows.min(1) violated
      rollout: buildAuditRecord().rollout,
    };
    expect(() => assembleWorkbookB(bad)).toThrow(/marketing_audit contract/);
  });

  it('throws when persisted rollout jsonb fails the rollout_plan contract', () => {
    const bad: MarketingAuditRecord = {
      investments: buildAuditRecord().investments,
      rollout: { phases: [], cumulative_impact: [], grounding: 'evidence', evidence_refs: [] },
    };
    expect(() => assembleWorkbookB(bad)).toThrow(/rollout_plan contract/);
  });
});
