// @vitest-environment node
/**
 * Phase 5 Agent A — marketing-move library unit test.
 *
 * The load-bearing assertion (per the goal prompt): evaluating the library's benefit
 * models at `revenue = CALIBRATION_BASELINE_REVENUE` ($10K/mo — the size the gold was
 * calibrated to) reproduces gold fixture B's Investment-Matrix benefit ranges within
 * ±15%. The gold fixture is the source of TRUTH for the numbers; the library is the
 * reverse-engineered revenue function that must regenerate them.
 *
 * Also proves: every gold row is represented exactly once, metadata is transcribed
 * verbatim, qualitative cells pass through unchanged, the band scales linearly with
 * revenue, and the tier legend + estimate caveats match the gold verbatim.
 */
import { describe, it, expect } from 'vitest';
import workbookB from './fixtures/workbook-b.json';
import {
  MARKETING_MOVE_LIBRARY,
  MARKETING_MOVE_LIBRARY_VERSION,
  CALIBRATION_BASELINE_REVENUE,
  TIER_LEGEND,
  BENEFIT_ESTIMATE_CAVEATS,
  ROLLOUT_CAVEATS,
  getMarketingMove,
  evaluateBenefitBand,
  evaluateMoveBenefits,
  type MarketingMove,
  type BenefitBand,
} from '../data/marketingMoves.js';

// ---------------------------------------------------------------------------
// Fixture access + a tolerant gold-band parser (mirrors the extraction script).
// ---------------------------------------------------------------------------
type Cell = string | number | null;
interface FixtureTable {
  name: string | null;
  note: string | null;
  columns: (string | null)[];
  rows: Cell[][];
}
interface FixtureSheet {
  sheet: string;
  title: string;
  header_note: string | null;
  tables: FixtureTable[];
}
interface FixtureWorkbook {
  workbook: string;
  sheets: FixtureSheet[];
}
const wbB = workbookB as FixtureWorkbook;

const investmentMatrix = wbB.sheets[0].tables.find((t) => t.columns.includes('Investment'));
if (!investmentMatrix) {
  throw new Error('Investment Matrix table not found in fixture B');
}
const goldRows = investmentMatrix.rows;

interface GoldBand {
  low: number;
  high: number;
}
/** Parse a gold benefit cell into a numeric band, or null if it's qualitative. */
function parseGoldBand(raw: Cell): GoldBand | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/,/g, '');
  // Range: $A–B (en-dash) or $A-B, optionally signed with + − -.
  const range = cleaned.match(/([+−-]?)\$([0-9]+)[–-]([0-9]+)/);
  if (range) {
    const sign = range[1] === '−' || range[1] === '-' ? -1 : 1;
    return { low: sign * parseInt(range[2], 10), high: sign * parseInt(range[3], 10) };
  }
  // Single $N.
  const single = cleaned.match(/([+−-]?)\$([0-9]+)/);
  if (single) {
    const sign = single[1] === '−' || single[1] === '-' ? -1 : 1;
    const v = sign * parseInt(single[2], 10);
    return { low: v, high: v };
  }
  return null;
}

/** ±15% tolerance check; exact for zero/equal bands. */
function withinTolerance(actual: number, expected: number, pct = 0.15): boolean {
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) <= Math.abs(expected) * pct;
}

const HORIZON_GOLD_COL: ReadonlyArray<{ benefitKey: keyof ReturnType<typeof evaluateMoveBenefits>; col: number }> = [
  { benefitKey: 'benefit_1mo', col: 7 },
  { benefitKey: 'benefit_3mo', col: 8 },
  { benefitKey: 'benefit_6mo', col: 9 },
  { benefitKey: 'benefit_12mo', col: 10 },
];

/** Match a gold row to a library move by exact "Investment" name. */
function moveForGoldRow(row: Cell[]): MarketingMove {
  const name = row[1];
  const move = MARKETING_MOVE_LIBRARY.find((m) => m.name === name);
  if (!move) {
    throw new Error(`No library move matches gold investment name: ${String(name)}`);
  }
  return move;
}

describe('marketing-move library — versioning + completeness', () => {
  it('is versioned and calibrated to the $10K/mo gold baseline', () => {
    expect(MARKETING_MOVE_LIBRARY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(CALIBRATION_BASELINE_REVENUE).toBe(10_000);
  });

  it('contains one move per gold investment row, with unique stable ids', () => {
    expect(MARKETING_MOVE_LIBRARY.length).toBe(goldRows.length);
    const ids = MARKETING_MOVE_LIBRARY.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matches each gold row to exactly one move by verbatim name + tier', () => {
    for (const row of goldRows) {
      const move = moveForGoldRow(row);
      expect(move.tier_default).toBe(row[0]);
    }
  });

  it('getMarketingMove round-trips every id and throws on unknown', () => {
    for (const m of MARKETING_MOVE_LIBRARY) {
      expect(getMarketingMove(m.id).name).toBe(m.name);
    }
    // @ts-expect-error — intentionally passing an id outside the literal union.
    expect(() => getMarketingMove('does-not-exist')).toThrow();
  });
});

describe('marketing-move library — verbatim metadata transcription', () => {
  it('transcribes calendar/hours/effort/cash + description verbatim from the gold', () => {
    for (const row of goldRows) {
      const move = moveForGoldRow(row);
      expect(move.what_it_is).toBe(row[2]);
      expect(move.calendar_time).toBe(row[3]);
      expect(move.person_hours).toBe(row[4]);
      expect(move.effort).toBe(row[5]);
      expect(move.cash_cost_model.verbatim).toBe(row[6]);
    }
  });
});

describe('marketing-move library — benefit ranges reproduce gold @ $10K/mo (±15%)', () => {
  it('every NUMERIC gold band is regenerated within ±15% at the baseline revenue', () => {
    let numericCellsChecked = 0;
    for (const row of goldRows) {
      const move = moveForGoldRow(row);
      const evaluated = evaluateMoveBenefits(move, CALIBRATION_BASELINE_REVENUE);
      for (const { benefitKey, col } of HORIZON_GOLD_COL) {
        const gold = parseGoldBand(row[col]);
        if (!gold) continue; // qualitative gold cell — asserted separately below
        const actual = parseGoldBand(evaluated[benefitKey]);
        expect(
          actual,
          `move ${move.id} ${benefitKey} should render a numeric band, got "${evaluated[benefitKey]}"`,
        ).not.toBeNull();
        if (!actual) continue;
        expect(
          withinTolerance(actual.low, gold.low),
          `move ${move.id} ${benefitKey} low: got ${actual.low}, gold ${gold.low}`,
        ).toBe(true);
        expect(
          withinTolerance(actual.high, gold.high),
          `move ${move.id} ${benefitKey} high: got ${actual.high}, gold ${gold.high}`,
        ).toBe(true);
        numericCellsChecked += 1;
      }
    }
    // Sanity: the assertion actually exercised the bulk of the matrix.
    expect(numericCellsChecked).toBeGreaterThan(50);
  });

  it('reproduces the A+ overhaul gold band exactly at $10K/mo (anchor row)', () => {
    const aplus = getMarketingMove('aplus-content-overhaul');
    const b = evaluateMoveBenefits(aplus, 10_000);
    expect(b.benefit_1mo).toBe('+$200–500');
    expect(b.benefit_3mo).toBe('+$900–1,800');
    expect(b.benefit_6mo).toBe('+$2,000–4,200');
    expect(b.benefit_12mo).toBe('+$4,500–9,000');
  });

  it('renders thousands separators and the "cum." suffix like the gold PPC row', () => {
    const ppc = getMarketingMove('restructure-ppc');
    const b = evaluateMoveBenefits(ppc, 10_000);
    expect(b.benefit_3mo).toBe('+$600–900 cum.');
    expect(b.benefit_12mo).toBe('+$3,500–5,000 cum.');
  });
});

describe('marketing-move library — qualitative passthrough', () => {
  it('emits qualitative gold cells verbatim (no fabricated dollar figure)', () => {
    for (const row of goldRows) {
      const move = moveForGoldRow(row);
      const evaluated = evaluateMoveBenefits(move, CALIBRATION_BASELINE_REVENUE);
      for (const { benefitKey, col } of HORIZON_GOLD_COL) {
        const gold = parseGoldBand(row[col]);
        if (gold) continue; // numeric — covered above
        // The gold cell had no parseable band; the library must pass text through.
        expect(evaluated[benefitKey]).toBe(row[col]);
      }
    }
  });

  it('preserves the labeled negative test-loss band verbatim (SD off-Amazon mo1)', () => {
    const sd = getMarketingMove('sponsored-display-offamazon');
    expect(evaluateBenefitBand(sd.benefit_model.mo1, 10_000)).toBe('−$100 (test loss likely)');
  });
});

describe('marketing-move library — revenue scaling', () => {
  it('scales a numeric band linearly with revenue (doubling revenue doubles the band)', () => {
    const aplus = getMarketingMove('aplus-content-overhaul');
    const atBase = evaluateMoveBenefits(aplus, 10_000);
    const atDouble = evaluateMoveBenefits(aplus, 20_000);
    expect(atBase.benefit_1mo).toBe('+$200–500');
    expect(atDouble.benefit_1mo).toBe('+$400–1,000');
    const atHalf = evaluateMoveBenefits(aplus, 5_000);
    expect(atHalf.benefit_1mo).toBe('+$100–250');
  });

  it('renders a zero numeric band as "$0" regardless of revenue', () => {
    const zeroBand: BenefitBand = { kind: 'numeric', pct_low: 0, pct_high: 0 };
    expect(evaluateBenefitBand(zeroBand, 10_000)).toBe('$0');
    expect(evaluateBenefitBand(zeroBand, 1_000_000)).toBe('$0');
  });

  it('collapses an equal-end band to a single "+$N"', () => {
    const equal: BenefitBand = { kind: 'numeric', pct_low: 0.0168, pct_high: 0.0168 };
    expect(evaluateBenefitBand(equal, 10_000)).toBe('+$168');
  });
});

describe('marketing-move library — prerequisites + applicability are populated', () => {
  it('every move declares applicability conditions and known prerequisites', () => {
    for (const m of MARKETING_MOVE_LIBRARY) {
      expect(m.applicability_conditions.length).toBeGreaterThan(0);
      // prerequisites may legitimately be empty (e.g. free listing copy refresh).
      expect(Array.isArray(m.prerequisites)).toBe(true);
    }
  });

  it('Brand-Registry-gated free programs declare the brand_registry prerequisite', () => {
    for (const id of ['aplus-content-overhaul', 'amazon-posts', 'brand-referral-bonus', 'amazon-vine-288-single'] as const) {
      expect(getMarketingMove(id).prerequisites).toContain('brand_registry');
    }
  });

  it('Sponsored Brands Video requires a produced video asset', () => {
    expect(getMarketingMove('sponsored-brands-video-sd-retargeting').prerequisites).toContain('video_asset');
  });
});

describe('marketing-move library — verbatim legend + caveats', () => {
  it('tier legend matches the gold fixture verbatim', () => {
    const legendTable = wbB.sheets[0].tables.find((t) => t.name === 'Tier legend:');
    expect(legendTable).toBeDefined();
    // Gold renders T1 in the legend table's columns[1], T2/T3 in the rows.
    const t1 = legendTable!.columns[1];
    const t2 = legendTable!.rows.find((r) => r[0] === 'T2')?.[1];
    const t3 = legendTable!.rows.find((r) => r[0] === 'T3')?.[1];
    expect(TIER_LEGEND.T1).toBe(t1);
    expect(TIER_LEGEND.T2).toBe(t2);
    expect(TIER_LEGEND.T3).toBe(t3);
  });

  it('benefit-estimate caveats match the gold Notes section verbatim', () => {
    const notes = wbB.sheets[0].tables.find((t) => t.name === 'Notes on benefit estimates:');
    expect(notes).toBeDefined();
    const goldCaveats = [notes!.note, ...notes!.rows.map((r) => r[0])].filter(
      (s): s is string => typeof s === 'string',
    );
    expect([...BENEFIT_ESTIMATE_CAVEATS]).toEqual(goldCaveats);
  });

  it('rollout caveats match the gold Phasing sheet verbatim', () => {
    const caveats = wbB.sheets[1].tables.find((t) => t.name === 'Caveats:');
    expect(caveats).toBeDefined();
    const goldCaveats = [caveats!.note, ...caveats!.rows.map((r) => r[0])].filter(
      (s): s is string => typeof s === 'string',
    );
    expect([...ROLLOUT_CAVEATS]).toEqual(goldCaveats);
  });
});
