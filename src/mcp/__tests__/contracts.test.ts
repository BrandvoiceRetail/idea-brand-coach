// @vitest-environment node
/**
 * Phase 0 Agent B — contracts unit test.
 *
 * Proves every gold-workbook section maps and parses into its artifact contract.
 * Where the gold .xlsx layout differs from the runtime schema (interleaved canvas
 * grid, positioning statement options split across columns + rows, header-cell scores), the
 * mapping lives in a thin in-test mapper — the gold fixture is the source of TRUTH
 * for columns, the contract is the source of truth for SHAPE.
 *
 * The grounding envelope is contributed by the GENERATOR at runtime, not present in
 * the gold cells, so each mapper attaches a fixture-derived grounding stub
 * (grounding:'inference' — the gold itself self-flags inference) before parsing.
 */
import { describe, it, expect } from 'vitest';
import workbookA from './fixtures/workbook-a.json';
import workbookB from './fixtures/workbook-b.json';
import {
  CONTRACTS,
  CONTEXT_SLOTS,
  getSlot,
  diagnosticInterpretationContract,
  avatarS1VocabContract,
  avatarS2JobmapContract,
  avatarS3TriggersContract,
  avatarS4ObjectionsContract,
  positioningStatementContract,
  brandCanvasContract,
  exportBriefContract,
  auditXIdeaContract,
  marketingAuditContract,
  rolloutPlanContract,
  type FrequencySignal,
} from '../contracts/index.js';

// ---------------------------------------------------------------------------
// Fixture access helpers (typed-loosely; the gold fixture shape is from P0-A).
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

const wbA = workbookA as FixtureWorkbook;
const wbB = workbookB as FixtureWorkbook;

function sheet(wb: FixtureWorkbook, name: string): FixtureSheet {
  const s = wb.sheets.find((x) => x.sheet === name);
  if (!s) throw new Error(`fixture sheet not found: ${name}`);
  return s;
}

/** The grounding stub the generator would attach at runtime; gold = inference. */
const groundingStub = { grounding: 'inference' as const, evidence_refs: [] };

const str = (c: Cell): string => String(c ?? '').trim();
/** Split a comma-listed gold cell into a verbatim array. */
const splitList = (c: Cell): string[] =>
  str(c)
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

// ===========================================================================
// Slots fixture — sanity on the §4 const itself.
// ===========================================================================
describe('CONTEXT_SLOTS (§4)', () => {
  it('declares all 18 slots with stable ids 1..18', () => {
    expect(CONTEXT_SLOTS).toHaveLength(18);
    expect(CONTEXT_SLOTS.map((s) => s.id)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
  });

  it('every slot has a non-empty ask question and ends its resolution chain at a terminal store', () => {
    for (const s of CONTEXT_SLOTS) {
      expect(s.askQuestion.length).toBeGreaterThan(0);
      expect(s.residesIn.length).toBeGreaterThan(0);
      const terminal = s.residesIn[s.residesIn.length - 1];
      // user-facing slots end at 'ask'; system FRAMEWORK slots end at 'framework_static'.
      expect(['ask', 'framework_static']).toContain(terminal);
    }
  });

  it('getSlot resolves by id and throws on unknown', () => {
    expect(getSlot(6).class).toBe('PRODUCT-TRUTH');
    // @ts-expect-error — 99 is not a SlotId.
    expect(() => getSlot(99)).toThrow();
  });

  it('every contract.requiredContext references a real slot id', () => {
    for (const contract of Object.values(CONTRACTS)) {
      for (const id of contract.requiredContext) {
        expect(CONTEXT_SLOTS.some((s) => s.id === id)).toBe(true);
      }
    }
  });
});

// ===========================================================================
// Workbook A — sheet 3: diagnostic_interpretation
// ===========================================================================
describe('diagnostic_interpretation ← A sheet 3', () => {
  it('maps the overall score, primary gap, 4 dimensions, and triage into the contract', () => {
    const s = sheet(wbA, '3. Diagnostic (IV)');
    // Header table: ["Overall...", null, "58 / 100", null, "Primary gap: Empathy"]
    const headerCols = s.tables[0].columns;
    const overall = Number(str(headerCols[2]).split('/')[0].trim());
    const primaryGap = str(headerCols[4]).replace(/^Primary gap:\s*/, '');

    // The "four dimensions" table: name = interpretation line, note = "The four dimensions".
    const dimTable = s.tables[1];
    const interpretation = str(dimTable.name).replace(/^Interpretation:\s*/, '');
    const dimensions = dimTable.rows.map((r) => ({
      dimension: str(r[0]) as 'Insight' | 'Distinctiveness' | 'Empathy' | 'Authenticity',
      score: Number(str(r[1]).split('/')[0].trim()),
      what_it_measures: str(r[2]),
      brand_read: str(r[3]),
      where_it_shows_up: str(r[4]),
    }));

    const recTable = s.tables[2];

    const mapped = {
      overall_score: overall,
      primary_gap: primaryGap as 'Empathy',
      interpretation,
      dimensions,
      recommended_next_module: 'Avatar 2.0™',
      recommendation_rationale: str(recTable.note),
      ...groundingStub,
    };

    const parsed = diagnosticInterpretationContract.outputSchema.parse(mapped);
    expect(parsed.overall_score).toBe(58);
    expect(parsed.primary_gap).toBe('Empathy');
    expect(parsed.dimensions).toHaveLength(4);
    expect(parsed.dimensions.map((d) => d.dimension)).toEqual([
      'Insight',
      'Distinctiveness',
      'Empathy',
      'Authenticity',
    ]);
    expect(parsed.dimensions[2].score).toBe(11);
  });
});

// ===========================================================================
// Workbook A — sheet 4: the five avatar stages
// ===========================================================================
describe('avatar stages ← A sheet 4', () => {
  const s = sheet(wbA, '4. Avatar 2.0 (IV)');
  const stageTable = (prefix: string): FixtureTable => {
    const t = s.tables.find((x) => str(x.name).startsWith(prefix));
    if (!t) throw new Error(`avatar stage table not found: ${prefix}`);
    return t;
  };

  it('S1 vocabulary forensics parses (every cluster has verbatim words + a labeled band)', () => {
    const t = stageTable('Stage 1');
    const clusters = t.rows.map((r) => ({
      cluster: str(r[0]),
      customer_words: splitList(r[1]),
      frequency_signal: str(r[2]) as FrequencySignal,
      why_it_matters: str(r[3]),
    }));
    const parsed = avatarS1VocabContract.outputSchema.parse({ clusters, ...groundingStub });
    expect(parsed.clusters).toHaveLength(6);
    expect(parsed.clusters[0].customer_words.length).toBeGreaterThan(1);
    expect(parsed.clusters[0].frequency_signal).toBe('Very high');
  });

  it('S2 job map parses', () => {
    const t = stageTable('Stage 2');
    const job_map = t.rows.map((r) => ({
      functional_job: str(r[0]),
      emotional_job: str(r[1]),
      identity_job: str(r[2]),
      villain: str(r[3]),
    }));
    const parsed = avatarS2JobmapContract.outputSchema.parse({ job_map, ...groundingStub });
    expect(parsed.job_map).toHaveLength(1);
    expect(parsed.job_map[0].villain).toContain('cheap binder');
  });

  it('S3 decision triggers parse (volume is a labeled band, never a number)', () => {
    const t = stageTable('Stage 3');
    const triggers = t.rows.map((r) => ({
      trigger_moment: str(r[0]),
      what_they_feel: str(r[1]),
      search_terms: splitList(r[2]),
      estimated_volume_band: str(r[3]),
    }));
    const parsed = avatarS3TriggersContract.outputSchema.parse({ triggers, ...groundingStub });
    expect(parsed.triggers).toHaveLength(6);
    expect(typeof parsed.triggers[0].estimated_volume_band).toBe('string');
    expect(parsed.triggers[0].search_terms.length).toBeGreaterThan(0);
  });

  it('S4 objections parse (verbatim signal is preserved as a real quote string)', () => {
    const t = stageTable('Stage 4');
    const objections = t.rows.map((r) => ({
      hesitation: str(r[0]),
      verbatim_signal: str(r[1]),
      resolution: str(r[2]),
    }));
    const parsed = avatarS4ObjectionsContract.outputSchema.parse({ objections, ...groundingStub });
    expect(parsed.objections).toHaveLength(4);
    expect(parsed.objections[0].verbatim_signal).toContain('dimpling');
  });

  it('S5 positioning statement options parse (options split across the table name + rows)', () => {
    const t = stageTable('Stage 5');
    // Gold quirk: Option 1 lives in the columns row; Options 2..N live in rows.
    const optionFromColumns = { option: 1, sentence: str(t.columns[1]) };
    const optionsFromRows = t.rows.map((r) => ({
      option: Number(str(r[0]).replace(/^Option\s*/, '')),
      sentence: str(r[1]),
    }));
    const options = [optionFromColumns, ...optionsFromRows];
    const parsed = positioningStatementContract.outputSchema.parse({ options, ...groundingStub });
    expect(parsed.options).toHaveLength(4);
    expect(parsed.options[0].option).toBe(1);
    expect(parsed.options[0].sentence).toContain("isn't buying a card binder");
  });
});

// ===========================================================================
// Workbook A — sheet 5: brand_canvas (interleaved 2-pane grid)
// ===========================================================================
describe('brand_canvas ← A sheet 5', () => {
  it('normalizes the interleaved positioning/voice grid + positioning statement + story into the contract', () => {
    const s = sheet(wbA, '5. Brand Canvas (IV)');
    const canvasTable = s.tables[0];
    const storyTable = s.tables[1];

    // The Positioning Statement line lives in the canvas table's `note`.
    const positioning_statement = str(canvasTable.note);
    // The grid interleaves: columns = [Category, <cat val>, Voice attributes, <voice val>];
    // rows alternate left=positioning label/value, right=voice label/value.
    // columns row carries Category + Voice attributes; data rows carry the rest.
    const cols = canvasTable.columns;
    const rows = canvasTable.rows;
    // rows: ["Positioning"] header, then [Position, val, Tone do's, val], etc.
    const dataRows = rows.filter((r) => r.length >= 4);

    const left = new Map<string, string>();
    const right = new Map<string, string>();
    // header columns: cols[0]="Category", cols[1]=val, cols[2]="Voice attributes", cols[3]=val
    left.set(str(cols[0]), str(cols[1]));
    right.set(str(cols[2]), str(cols[3]));
    for (const r of dataRows) {
      left.set(str(r[0]), str(r[1]));
      right.set(str(r[2]), str(r[3]));
    }

    const mapped = {
      positioning_statement,
      positioning: {
        category: left.get('Category') ?? '',
        position: left.get('Position') ?? '',
        promise: left.get('Promise') ?? '',
        villain: left.get('Villain') ?? '',
        identity_payoff: left.get('Identity payoff') ?? '',
      },
      voice: {
        voice_attributes: right.get('Voice attributes') ?? '',
        tone_dos: right.get("Tone do's") ?? '',
        tone_donts: right.get("Tone don'ts") ?? '',
        words_we_use: splitList(right.get('Words we use') ?? ''),
        words_we_dont: splitList(right.get("Words we don't") ?? ''),
      },
      story_spine: str(storyTable.note),
      ...groundingStub,
    };

    const parsed = brandCanvasContract.outputSchema.parse(mapped);
    expect(parsed.positioning_statement).toContain('certainty that everything');
    expect(parsed.positioning.category).toContain('Premium trading card binders');
    expect(parsed.positioning.villain).toContain('cheap big-box binder');
    expect(parsed.voice.words_we_use.length).toBeGreaterThan(3);
    expect(parsed.voice.words_we_dont).toContain('Cheap');
    expect(parsed.story_spine).toContain('InfinityVault');
  });
});

// ===========================================================================
// Workbook A — sheet 6: export_brief (fabrication-gated)
// ===========================================================================
describe('export_brief ← A sheet 6', () => {
  it('maps title formula + 5 bullets + 7 image slots + PPC tiers; flags the gated 30-DAY GUARANTEE claim', () => {
    const s = sheet(wbA, '6. Export Brief');
    const listingTable = s.tables[0];
    const imageTable = s.tables[1];

    // Row 0 = TITLE FORMULA; rows 1..5 = bullets.
    const [titleRow, ...bulletRows] = listingTable.rows;

    // Bullet 5 carries the invented policy claim → fabrication-gated, confirmed:false.
    const stageRefForIndex = (i: number) =>
      (['s3_triggers', 's2_jobmap', 's1_vocab', 's4_objections', 's4_objections'] as const)[i];

    const bullets = bulletRows.map((r, i) => {
      const example = str(r[2]);
      const claims = /GUARANTEE|Holds 432|PSA-slab|432-card/.test(example)
        ? [{ claim: example.slice(0, 40), slot: 6 as const, confirmed: false }]
        : [];
      return {
        element: str(r[0]),
        brief: str(r[1]),
        example_output: example,
        stage_ref: stageRefForIndex(i),
        product_truth_claims: claims,
      };
    });

    const image_brief = imageTable.rows.map((r) => ({
      slot: str(r[0]),
      intent: str(r[1]),
      brief: str(r[2]),
    }));

    // PPC tiers live in the third section's `note` prose — extract the labeled tiers.
    const ppcNote = str(s.tables[2].note);
    const tierLines = (label: string): string[] => {
      const seg = ppcNote.split(label)[1]?.split(/TIER [A-C]/)[0] ?? '';
      return seg
        .split(/[•\n]/)
        .map((x) => x.replace(/['']/g, '').trim())
        .filter((x) => x.length > 3 && !x.endsWith(':') && !x.startsWith('('));
    };

    const mapped = {
      title_formula: {
        brief: str(titleRow[1]),
        example_output: str(titleRow[2]),
        product_truth_claims: [
          { claim: 'Holds 432 Cards Side-Loading', slot: 6 as const, confirmed: false },
        ],
      },
      bullets,
      image_brief,
      ppc_keywords: {
        tier_a: tierLines('TIER A'),
        tier_b: tierLines('TIER B'),
        tier_c: tierLines('TIER C'),
      },
      ...groundingStub,
    };

    const parsed = exportBriefContract.outputSchema.parse(mapped);
    expect(parsed.bullets).toHaveLength(5);
    expect(parsed.image_brief).toHaveLength(7);
    expect(parsed.image_brief[0].slot).toBe('Hero');
    expect(parsed.ppc_keywords.tier_a.length).toBeGreaterThan(0);

    // Fabrication gate: the 30-DAY GUARANTEE bullet carries an unconfirmed PRODUCT-TRUTH claim.
    const guaranteeBullet = parsed.bullets.find((b) => b.example_output.includes('30-DAY GUARANTEE'));
    expect(guaranteeBullet).toBeDefined();
    expect(guaranteeBullet?.product_truth_claims.some((c) => c.confirmed === false)).toBe(true);
    expect(guaranteeBullet?.product_truth_claims[0].slot).toBe(6);
  });
});

// ===========================================================================
// Workbook A — sheet 7: audit_x_idea
// ===========================================================================
describe('audit_x_idea ← A sheet 7', () => {
  it('maps the investment × IDEA rows with a labeled lift multiplier', () => {
    const s = sheet(wbA, '7. Audit × IDEA');
    const rows = s.tables[0].rows.map((r) => ({
      audit_investment: str(r[0]),
      without_idea: str(r[1]),
      with_idea: str(r[2]),
      estimated_lift: str(r[3]),
    }));
    const parsed = auditXIdeaContract.outputSchema.parse({ rows, ...groundingStub });
    expect(parsed.rows.length).toBeGreaterThan(5);
    expect(parsed.rows[0].estimated_lift).toContain('2–3x');
  });
});

// ===========================================================================
// Workbook B — Investment Matrix: marketing_audit
// ===========================================================================
describe('marketing_audit ← B Investment Matrix', () => {
  it('maps every investment row (tier + cost + 1/3/6/12-mo benefit bands)', () => {
    const s = sheet(wbB, 'Investment Matrix');
    const rows = s.tables[0].rows.map((r) => ({
      tier: str(r[0]) as 'T1' | 'T2' | 'T3',
      investment: str(r[1]),
      what_it_is: str(r[2]),
      calendar_time: str(r[3]),
      person_hours: str(r[4]),
      level_of_effort: str(r[5]),
      cash_cost: str(r[6]),
      benefit_1mo: str(r[7]),
      benefit_3mo: str(r[8]),
      benefit_6mo: str(r[9]),
      benefit_12mo: str(r[10]),
    }));
    const parsed = marketingAuditContract.outputSchema.parse({ rows, ...groundingStub });
    expect(parsed.rows.length).toBeGreaterThan(15);
    expect(parsed.rows.map((x) => x.tier)).toContain('T1');
    expect(parsed.rows.map((x) => x.tier)).toContain('T3');
    // benefit cells are free-text bands (gold has "Saves ~$168 + recovers margin", "+$200–500").
    expect(typeof parsed.rows[0].benefit_1mo).toBe('string');
  });
});

// ===========================================================================
// Workbook B — Recommended Phasing: rollout_plan
// ===========================================================================
describe('rollout_plan ← B Recommended Phasing', () => {
  it('maps the phase grid + cumulative-impact grid (numeric low/mid/high)', () => {
    const s = sheet(wbB, 'Recommended Phasing');
    const phaseTable = s.tables[0];
    const impactTable = s.tables.find((t) => str(t.name).startsWith('Cumulative impact'));
    if (!impactTable) throw new Error('cumulative impact table not found');

    const phases = phaseTable.rows.map((r) => ({
      phase: str(r[0]),
      window: str(r[1]),
      action: str(r[2]),
      cash_needed: str(r[3]),
      why_now: str(r[4]),
    }));

    const cumulative_impact = impactTable.rows.map((r) => ({
      horizon: str(r[0]),
      low: Number(r[1]),
      mid: Number(r[2]),
      high: Number(r[3]),
      notes: str(r[4]),
    }));

    const parsed = rolloutPlanContract.outputSchema.parse({
      phases,
      cumulative_impact,
      ...groundingStub,
    });
    expect(parsed.phases).toHaveLength(4);
    expect(parsed.cumulative_impact).toHaveLength(4);
    // fixture preserves these as JSON numbers — assert they survive as numbers.
    expect(parsed.cumulative_impact[0].low).toBe(500);
    expect(parsed.cumulative_impact[3].high).toBe(35000);
    expect(parsed.cumulative_impact[0].low).toBeLessThanOrEqual(parsed.cumulative_impact[0].mid);
  });
});
